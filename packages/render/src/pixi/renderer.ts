/** Pixi v8 implementation of the `Renderer` contract. */
import type { ContentDB } from "@aitower/content";
import type { CellPointerEvent, Ghost, OverlayMode, Renderer, Selection } from "@aitower/shared";
import type { CellRef, SimView } from "@aitower/sim";
import { Application, Container, Graphics, Sprite, Texture, TextureSource, TilingSprite } from "pixi.js";
import { type Camera, type GridDims, cellCenter, clampCamera, floorTop, groundY, offset } from "../camera";
import { DEFAULT_ZOOM, FAC_BOTTOM, FAC_TOP, SETTLE_MS, TILE } from "../constants";
import { Interpolator, effectiveAlpha, hashArrays } from "../interp";
import { Background } from "./background";
import { Bots } from "./bots";
import { drawCoolant, drawPower, dripCells } from "./conduits";
import { Effects, dripFloorY } from "./effects";
import { drawBody, drawLive } from "./facilityArt";
import { Input } from "./input";
import { TextPool } from "./labels";
import { Lifts, liftKey } from "./lifts";
import { GhostLayer, drawSelection, selectionRect } from "./markers";
import { Overlays } from "./overlays";
import { Pneumatics } from "./pneumatics";
import { T } from "../palette";
import { Structure } from "./structure";

/** Screen-space CRT finish: faint scanlines + vignette, both ≤ 8 % opacity (STYLE §1). */
function makeScreenFx(): { root: Container; resize: (w: number, h: number) => void; destroy: () => void } {
	const root = new Container();
	const lines = document.createElement("canvas");
	lines.width = 1;
	lines.height = 3;
	const lc = lines.getContext("2d");
	if (lc) {
		lc.fillStyle = "#0d0b08";
		lc.fillRect(0, 0, 1, 1);
	}
	const lineTex = Texture.from(lines);
	lineTex.source.scaleMode = "nearest";
	const scan = new TilingSprite({ texture: lineTex, width: 1, height: 1 });
	scan.alpha = 0.06;
	const vig = document.createElement("canvas");
	vig.width = 128;
	vig.height = 128;
	const vc = vig.getContext("2d");
	if (vc) {
		const grd = vc.createRadialGradient(64, 64, 30, 64, 64, 92);
		grd.addColorStop(0, "rgba(13,11,8,0)");
		grd.addColorStop(1, "rgba(13,11,8,1)");
		vc.fillStyle = grd;
		vc.fillRect(0, 0, 128, 128);
	}
	const vigTex = Texture.from(vig);
	const vignette = new Sprite(vigTex);
	vignette.alpha = 0.08;
	root.addChild(scan, vignette);
	return {
		root,
		resize(w, h) {
			scan.width = w;
			scan.height = h;
			vignette.width = w;
			vignette.height = h;
		},
		destroy() {
			lineTex.destroy(true);
			vigTex.destroy(true);
		},
	};
}

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
		background: T.ink,
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
	const facLabels = new TextPool(9);
	const pneumatics = new Pneumatics(content);
	const bots = new Bots(content);
	const effects = new Effects(content);
	const overlays = new Overlays(content);
	const ghost = new GhostLayer(content);
	const selectionG = new Graphics();
	world.addChild(
		structure.earth,
		structure.shell,
		conduits,
		structure.plates,
		lifts.shafts,
		lifts.cars,
		facBodies,
		facLive,
		facLabels.root,
		pneumatics.g,
		bots.g,
		effects.g,
		overlays.root,
		ghost.root,
		selectionG,
	);
	const screenFx = makeScreenFx();
	screenFx.resize(w0, h0);
	app.stage.addChild(background.root, world, screenFx.root);

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
		const fk = facilityKey(view);
		if (gridChanged || ch !== keys.conduit || fk !== keys.fac) {
			// Drips only where no facility stands underneath.
			const occupied = new Set<string>();
			for (const f of view.facilities) for (let k = 0; k < f.width; k++) occupied.add(`${f.x + k}:${f.floor}`);
			effects.setDrips(
				dripCells(view)
					.filter((d) => !occupied.has(`${Math.floor(d.x / TILE)}:${d.floor}`))
					.map((d) => ({ x: d.x, y: d.y, floorY: dripFloorY(floorTop(view, d.floor)) })),
			);
		}
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
		if (gridChanged || fk !== keys.fac) {
			keys.fac = fk;
			facBodies.clear();
			for (const f of view.facilities) {
				const def = content.facilities[f.defId];
				if (def) drawBody(facBodies, def, f.x * TILE, floorTop(view, f.floor));
			}
		}
		pneumatics.onTick(view, (now - t0) / 1000);
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

			// Per-frame layers (facility details culled to the viewport).
			const vx0 = -o.x / cam.zoom - 4 * TILE;
			const vx1 = (cam.vw - o.x) / cam.zoom + 4 * TILE;
			const vy0 = -o.y / cam.zoom - 2 * FAC_BOTTOM;
			const vy1 = (cam.vh - o.y) / cam.zoom + FAC_TOP;
			facLive.clear();
			facLabels.begin();
			for (const f of view.facilities) {
				const def = content.facilities[f.defId];
				if (!def) continue;
				const fx = f.x * TILE;
				const ft = floorTop(view, f.floor);
				if (fx > vx1 || fx + def.width * TILE < vx0 || ft > vy1 || ft < vy0) continue;
				drawLive(facLive, def, f, fx, ft, t, facLabels);
			}
			facLabels.end();
			pneumatics.draw(t);
			const liftPos = (id: number): number | null => liftInterp.get(id, a)?.y ?? null;
			lifts.drawCars(view, (l) => liftPos(l.id) ?? l.carFloor, t);
			const botPos = (b: { id: number; x: number; floor: number }) => botInterp.get(b.id, a) ?? { x: b.x, y: b.floor };
			bots.draw(view, botPos, (b) => botInterp.velocity(b.id), t);
			effects.update(view, bots.torches, dt, t);

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
			screenFx.resize(width, height);
			cam = { ...cam, vw: width, vh: height };
			if (grid) cam = clampCamera(cam, grid);
			if (lastView) renderer.draw(lastView, 1);
		},
		destroy() {
			input.destroy();
			// Destroys the whole scene graph (all layer Graphics are children of the stage).
			app.destroy({ removeView: true }, { children: true });
			background.destroyShared();
			screenFx.destroy();
		},
	};
	return renderer;
}

