/** Pixi v8 implementation of the `Renderer` contract. */
import type { ContentDB } from "@aitower/content";
import type { CellPointerEvent, Ghost, OverlayMode, Renderer, Selection } from "@aitower/shared";
import type { CellRef, SimView } from "@aitower/sim";
import { Application, Container, Graphics, TextureSource } from "pixi.js";
import { type Camera, type GridDims, cellCenter, clampCamera, floorTop, groundY, offset } from "../camera";
import { DEFAULT_ZOOM, SETTLE_MS, TILE } from "../constants";
import { Interpolator, effectiveAlpha, hashArrays } from "../interp";
import { Background } from "./background";
import { Bots } from "./bots";
import { drawCoolant, drawPower } from "./conduits";
import { Effects } from "./effects";
import { drawBody, drawLive } from "./facilityArt";
import { Input } from "./input";
import { Lifts, liftKey } from "./lifts";
import { GhostLayer, drawSelection, selectionRect } from "./markers";
import { Overlays } from "./overlays";
import { Structure } from "./structure";

const facilityKey = (view: SimView): string => view.facilities.map((f) => `${f.id}:${f.defId}:${f.floor}:${f.x}`).join("|");

export async function createPixiRenderer(host: HTMLElement, content: ContentDB): Promise<Renderer> {
	TextureSource.defaultOptions.scaleMode = "nearest";
	const app = new Application();
	const w0 = host.clientWidth || window.innerWidth;
	const h0 = host.clientHeight || window.innerHeight;
	await app.init({
		width: w0,
		height: h0,
		preference: "webgl",
		antialias: false,
		roundPixels: true,
		resolution: Math.max(1, Math.round(window.devicePixelRatio || 1)),
		autoDensity: true,
		background: 0x070b1e,
		autoStart: false,
		sharedTicker: false,
	});
	const canvas = app.canvas;
	canvas.style.display = "block";
	canvas.style.imageRendering = "pixelated";
	canvas.style.touchAction = "none";
	host.appendChild(canvas);

	// ─── Scene graph ───────────────────────────────────────────────────
	const background = new Background();
	const world = new Container();
	const structure = new Structure();
	const conduits = new Graphics();
	const lifts = new Lifts();
	const facBodies = new Graphics();
	const facLive = new Graphics();
	const bots = new Bots(content);
	const effects = new Effects(content);
	const overlays = new Overlays(content);
	const ghost = new GhostLayer(content);
	const selectionG = new Graphics();
	world.addChild(
		structure.earth,
		structure.shell,
		conduits,
		lifts.shafts,
		lifts.cars,
		facBodies,
		facLive,
		bots.g,
		effects.g,
		overlays.root,
		ghost.root,
		selectionG,
	);
	app.stage.addChild(background.root, world);

	// ─── State ─────────────────────────────────────────────────────────
	let cam: Camera = { cx: 0, cy: 0, zoom: DEFAULT_ZOOM, vw: w0, vh: h0 };
	let grid: GridDims | null = null;
	let pendingFocus: CellRef | null = null;
	let overlay: OverlayMode = "normal";
	let overlayDirty = true;
	let selection: Selection = null;
	let lastView: SimView | null = null;
	let lastTick = Number.NaN;
	let lastTickAt = 0;
	let lastFrame = performance.now();
	const keys = { slab: -1, conduit: -1, fac: "", lift: "", grid: "" };
	const botInterp = new Interpolator(3);
	const liftInterp = new Interpolator(3);
	const t0 = performance.now();

	const input = new Input(canvas, {
		camera: () => cam,
		setCamera: (c) => {
			cam = grid ? clampCamera(c, grid) : c;
		},
		grid: () => grid,
	});

	const centreOn = (cell: CellRef): void => {
		if (!grid) {
			pendingFocus = cell;
			return;
		}
		const p = cellCenter(grid, cell);
		cam = clampCamera({ ...cam, cx: p.x, cy: p.y }, grid);
	};

	const onNewTick = (view: SimView, now: number): void => {
		lastTickAt = now;
		botInterp.beginTick();
		for (const b of view.bots) botInterp.push(b.id, b.x, b.floor);
		botInterp.endTick();
		liftInterp.beginTick();
		for (const l of view.lifts) liftInterp.push(l.id, 0, l.carFloor);
		liftInterp.endTick();

		const gk = `${view.width}:${view.floorMin}:${view.floorMax}`;
		const gridChanged = gk !== keys.grid;
		if (gridChanged) {
			keys.grid = gk;
			grid = { width: view.width, floorMin: view.floorMin, floorMax: view.floorMax };
			if (pendingFocus) {
				const f = pendingFocus;
				pendingFocus = null;
				centreOn(f);
			} else {
				centreOn({ x: Math.floor(view.width / 2), floor: Math.max(view.floorMin, Math.min(0, view.floorMax)) });
			}
		}
		const sh = hashArrays(view.slab);
		if (gridChanged || sh !== keys.slab) {
			keys.slab = sh;
			structure.rebuild(view);
		}
		const ch = hashArrays(view.power, view.coolant);
		if (gridChanged || ch !== keys.conduit) {
			keys.conduit = ch;
			conduits.clear();
			drawPower(conduits, view);
			drawCoolant(conduits, view);
		}
		const lk = liftKey(view.lifts);
		if (gridChanged || lk !== keys.lift) {
			keys.lift = lk;
			lifts.rebuildShafts(view);
		}
		const fk = facilityKey(view);
		if (gridChanged || fk !== keys.fac) {
			keys.fac = fk;
			facBodies.clear();
			for (const f of view.facilities) {
				const def = content.facilities[f.defId];
				if (def) drawBody(facBodies, def, f.x * TILE, floorTop(view, f.floor));
			}
		}
		overlayDirty = true;
	};

	const renderer: Renderer = {
		draw(view, alpha) {
			const now = performance.now();
			const dt = Math.min((now - lastFrame) / 1000, 0.25);
			lastFrame = now;
			const t = (now - t0) / 1000;
			if (view !== lastView || view.tick !== lastTick) {
				lastView = view;
				lastTick = view.tick;
				onNewTick(view, now);
			}
			const a = effectiveAlpha(alpha, now - lastTickAt, SETTLE_MS);

			// Camera.
			input.tick(dt);
			if (grid) cam = clampCamera(cam, grid);
			const o = offset(cam);
			world.position.set(o.x, o.y);
			world.scale.set(cam.zoom);
			background.update(cam.vw, cam.vh, cam.zoom, o.y + groundY(view) * cam.zoom, o.x, view.minuteOfDay, t);

			// Per-frame layers.
			facLive.clear();
			for (const f of view.facilities) {
				const def = content.facilities[f.defId];
				if (def) drawLive(facLive, def, f, f.x * TILE, floorTop(view, f.floor), t);
			}
			const liftPos = (id: number): number | null => liftInterp.get(id, a)?.y ?? null;
			lifts.drawCars(view, (l) => liftPos(l.id) ?? l.carFloor, t);
			const botPos = (b: { id: number; x: number; floor: number }) => botInterp.get(b.id, a) ?? { x: b.x, y: b.floor };
			bots.draw(view, botPos, (b) => botInterp.velocity(b.id), t);
			effects.update(view, botPos, dt, t);

			overlays.root.visible = overlay !== "normal";
			if (overlayDirty) {
				overlayDirty = false;
				overlays.rebuild(view, overlay);
			}
			overlays.animate(view, overlay, t);
			ghost.update(view, t);
			const rect = selectionRect(
				view,
				selection,
				content,
				(id) => {
					const b = view.bots.find((v) => v.id === id);
					return b ? botPos(b) : null;
				},
				liftPos,
			);
			drawSelection(selectionG, rect, t);

			app.render();
		},
		setOverlay(mode) {
			if (mode !== overlay) {
				overlay = mode;
				overlayDirty = true;
			}
		},
		setGhost(g: Ghost | null) {
			ghost.set(g);
		},
		setSelection(sel) {
			selection = sel;
		},
		focus(cell) {
			centreOn(cell);
		},
		onPointer(cb: (e: CellPointerEvent) => void) {
			return input.subscribe(cb);
		},
		resize(width, height) {
			app.renderer.resize(width, height);
			cam = { ...cam, vw: width, vh: height };
			if (grid) cam = clampCamera(cam, grid);
			if (lastView) renderer.draw(lastView, 1);
		},
		destroy() {
			input.destroy();
			// Destroys the whole scene graph (all layer Graphics are children of the stage).
			app.destroy({ removeView: true }, { children: true });
			background.destroyShared();
		},
	};
	return renderer;
}

