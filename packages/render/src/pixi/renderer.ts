/** Pixi v8 implementation of the `Renderer` contract. */
import type { ContentDB } from "@aitower/content";
import type { CellPointerEvent, Ghost, OverlayMode, Renderer, RenderOptions, Selection } from "@aitower/shared";
import type { CellRef, SimEvent, SimView } from "@aitower/sim";
import { Application, Container, Graphics, Sprite, Texture, TextureSource, TilingSprite } from "pixi.js";
import { type Camera, type GridDims, cellCenter, clampCamera, floorTop, groundY, offset } from "../camera";
import { DEFAULT_ZOOM, FAC_BOTTOM, FAC_TOP, SETTLE_MS, TILE } from "../constants";
import { Interpolator, effectiveAlpha, hashArrays } from "../interp";
import { type HorrorStages, type LiveFx, SIGN_WORD, easeToward, horrorStages, signWord } from "../horror";
import { type SkinStage, pathSkin, skinEffects } from "../skin";
import { GreenDecals } from "./greenDecals";
import { Juice } from "./juice";
import { HorrorLayer } from "./horror";
import { Arrows } from "./arrows";
import { Background } from "./background";
import { Bots } from "./bots";
import { drawCoolant, drawNutrient, drawPower, dripCells } from "./conduits";
import { Effects, dripFloorY } from "./effects";
import { Feedback } from "./feedback";
import { drawBody, drawLive } from "./facilityArt";
import { Input } from "./input";
import { TextPool } from "./labels";
import { Lifts, liftKey } from "./lifts";
import { GhostLayer, drawSelection, selectionRect } from "./markers";
import { Overlays } from "./overlays";
import { Pneumatics } from "./pneumatics";
import { Presentation } from "../presentation";
import { T } from "../palette";
import { type Tag, type TagTone, hits, pillWidth, planTags } from "../labelPlan";
import { px } from "./draw";
import { botBox, BOT_H } from "./bots";
import { botDims, botKind } from "../botArt";
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

/** Cache key of the facility bodies: layout, growths, and the skin (stage x intensity) the cached art was drawn for. */
/** Game minutes per real second while the title scene shows its slow day (a full day takes six minutes). */
const TITLE_DAY_RATE = 4;
const TITLE_ZOOM = 1;

const facilityKey = (view: SimView, skinKey: string): string => `${skinKey}#${view.facilities.map((f) => `${f.id}:${f.defId}:${f.floor}:${f.x}:${f.grown ? 1 : 0}`).join("|")}`;

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
	const tagLabels = new TextPool(9);
	const pillBg = new Graphics();
	const pillLabels = new TextPool(10);
	const pneumatics = new Pneumatics(content);
	const bots = new Bots(content);
	const effects = new Effects(content);
	const feedback = new Feedback(content);
	const horror = new HorrorLayer();
	const decals = new GreenDecals();
	const juice = new Juice(content);
	const arrows = new Arrows(content);
	const overlays = new Overlays(content);
	const ghost = new GhostLayer(content);
	const selectionG = new Graphics();
	world.addChild(
		structure.earth,
		structure.shell,
		conduits,
		horror.root,
		decals.g,
		structure.plates,
		lifts.shafts,
		lifts.cars,
		facBodies,
		facLive,
		facLabels.root,
		tagLabels.root,
		pillBg,
		pillLabels.root,
		horror.live,
		feedback.dark,
		pneumatics.g,
		bots.g,
		effects.g,
		juice.root,
		feedback.g,
		overlays.root,
		ghost.root,
		selectionG,
	);
	const screenFx = makeScreenFx();
	screenFx.resize(w0, h0);
	app.stage.addChild(background.root, world, arrows.root, screenFx.root);

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
	// Name tags and status words (planned once per tick), and their colours.
	let tags: Tag[] = [];
	const TAG_FILL: Record<TagTone, number> = { name: 0xc9d9e2, warn: 0xffd27a, fault: 0xff8a8a, dim: T.steel };
	const TAG_EDGE: Record<TagTone, number> = { name: 0, warn: T.amber, fault: T.red, dim: T.steel };
	const botInterp = new Interpolator(3);
	const liftInterp = new Interpolator(3);
	const t0 = performance.now();
	const pres = new Presentation();
	// Biotech skin: stage x intensity drive every horror layer (recomputed per tick and on option change only).
	let stages: HorrorStages = horrorStages(0, 0, pres.options.horrorIntensity);
	let skinKey = "0f";
	let skinScore = 0;
	// Greentech / synthetic skin (separate from the biotech horror stages): path, stage and the fungus's horror alpha.
	let ppath: "greentech" | "synthetic" | null = null;
	let pstage: SkinStage = 0;
	let bgPath: "biotech" | "greentech" | "synthetic" | null = null;
	let bgStage: SkinStage = 0;
	let titleScene = false;
	let titleCx = 0;
	let titleCam: Camera | null = null;
	let phorror = 1;
	let droughtAmt = 0;
	const live: LiveFx = { stages, score: 0, stage: 0, cursor: null, paused: false };
	const cursor = { x: 0, y: 0 };
	let cursorSeen = false;
	let pointer: { sx: number; sy: number } | null = null;
	const onPointerMove = (e: PointerEvent): void => {
		const r = canvas.getBoundingClientRect();
		pointer = { sx: e.clientX - r.left, sy: e.clientY - r.top };
	};
	const onPointerLeave = (): void => {
		pointer = null;
	};
	canvas.addEventListener("pointermove", onPointerMove);
	canvas.addEventListener("pointerleave", onPointerLeave);
	const refreshSkin = (view: SimView): void => {
		const skin = pathSkin(view);
		const off = pres.options.horrorIntensity === "off";
		const stage = off || skin.path !== "biotech" ? 0 : skin.stage;
		stages = horrorStages(stage, skin.score, pres.options.horrorIntensity);
		skinScore = skin.score;
		ppath = skin.path === "greentech" || skin.path === "synthetic" ? skin.path : null;
		pstage = ppath ? skin.stage : 0;
		phorror = pres.options.horrorIntensity === "off" ? 0 : pres.options.horrorIntensity === "mild" ? 0.5 : 1;
		bgPath = off && skin.path === "biotech" ? null : skin.path;
		bgStage = skin.path === "biotech" ? stage : pstage;
		skinKey = `${stage}${pres.options.horrorIntensity[0]}${ppath ? `${ppath[0]}${pstage}` : ""}`;
		live.pskin = ppath && pstage > 0 ? { path: ppath, stage: pstage, horror: phorror } : undefined;
		live.stages = stages;
		live.stage = stage;
		live.score = skinScore;
	};

	const input = new Input(canvas, {
		camera: () => cam,
		setCamera: (c) => {
			cam = grid ? clampCamera(c, grid) : c;
		},
		grid: () => grid,
		// Alert arrows live in screen space: a click focuses the camera on the facility they point at.
		press: (sx, sy) => {
			const hit = arrows.at(sx, sy);
			if (!hit) return false;
			centreOnPoint(hit.focus.x, hit.focus.y);
			return true;
		},
		over: (sx, sy) => arrows.at(sx, sy) !== null,
	});

	const centreOnPoint = (x: number, y: number): void => {
		if (grid) cam = clampCamera({ ...cam, cx: x, cy: y }, grid);
	};

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
		refreshSkin(view);
		const ch = hashArrays(view.power, view.coolant, view.nutrient);
		const fk = facilityKey(view, skinKey);
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
			drawNutrient(conduits, view);
		}
		const dkey = ppath === "greentech" && pstage > 0 ? `${pstage}:${keys.grid}:${sh}:${ch}` : "";
		if (decals.needsRebuild(dkey)) decals.rebuild(view, dkey ? pstage : 0, dkey);
		if (horror.needsRebuild(sh ^ Math.imul(ch, 31), stages)) horror.rebuild(view, sh ^ Math.imul(ch, 31), stages);
		const lk = liftKey(view.lifts);
		if (gridChanged || lk !== keys.lift) {
			keys.lift = lk;
			lifts.rebuildShafts(view);
		}
		if (gridChanged || fk !== keys.fac) {
			keys.fac = fk;
			facBodies.clear();
			const plain = pres.options.horrorIntensity === "off";
			for (const f of view.facilities) {
				const def = content.facilities[f.defId];
				if (!def) continue;
				const cls = f.grown || def.growth ? "growth" : def.kind;
				const skin =
					ppath && pstage > 0
						? { effects: skinEffects({ path: ppath, stage: pstage }, cls), alpha: 1, seed: f.id, path: ppath, horror: phorror }
						: { effects: skinEffects({ path: stages.stage > 0 ? "biotech" : null, stage: stages.stage }, cls), alpha: stages.alpha, seed: f.id };
				drawBody(facBodies, def, f.x * TILE, floorTop(view, f.floor), { grown: f.grown, plain, skin });
			}
		}
		tags = planTags(view.facilities, (id) => content.facilities[id]?.name);
		feedback.onTick(view);
		pneumatics.onTick(view, (now - t0) / 1000);
		overlayDirty = true;
	};

	const renderer: Renderer = {
		pushEvents(events: SimEvent[]) {
			juice.push(events, lastView);
		},
		setOptions(o: RenderOptions) {
			// Cheap when nothing changed: only changed keys invalidate anything.
			const changed = pres.set(o);
			if (changed.length === 0) return;
			if (changed.includes("colorBlind")) overlayDirty = true;
			if (changed.includes("horrorIntensity") && lastView) {
				// Cached bodies and decals depend on the intensity: force a rebuild on the next draw.
				keys.fac = "";
				lastTick = Number.NaN;
			}
			if (changed.includes("crtEffects")) screenFx.root.visible = pres.options.crtEffects;
		},
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
			const opt = pres.options;
			const paused = now - lastTickAt > SETTLE_MS;
			// A drought dims and flattens the sky (eased; instant under reduced motion).
			const dTarget = view.drought ? 1 : 0;
			droughtAmt = opt.reducedMotion || Math.abs(droughtAmt - dTarget) < 0.002 ? dTarget : easeToward(droughtAmt, dTarget, dt, 1.2);
			// Title scene: a slow virtual day and a lazy pan; the sim and the saved game stay untouched.
			let minute = view.minuteOfDay;
			if (titleScene) {
				const sway = opt.reducedMotion ? 0 : Math.sin(t * 0.05) * (cam.vw / TITLE_ZOOM / 3);
				cam = { ...cam, zoom: TITLE_ZOOM, cx: titleCx + sway, cy: grid ? groundY(grid) - (cam.vh * 0.24) / TITLE_ZOOM : cam.cy };
				if (grid) cam = clampCamera(cam, grid);
				if (!opt.reducedMotion) minute = (minute + t * TITLE_DAY_RATE) % 1440;
			}
			background.setStyle(view.tier, bgPath, bgStage);
			live.minute = minute;
			live.tick = view.tick;
			live.drought = view.drought;
			background.update(cam.vw, cam.vh, titleScene ? 2 : cam.zoom, o.y + groundY(view) * cam.zoom, o.x, minute, t, opt, signWord(stages, t, opt.reducedMotion) !== SIGN_WORD, droughtAmt);
			// Eyes follow the cursor slowly: ease a world-space point toward the pointer.
			if (pointer && stages.eyes) {
				const wx = (pointer.sx - o.x) / cam.zoom;
				const wy = (pointer.sy - o.y) / cam.zoom;
				if (!cursorSeen) {
					cursor.x = wx;
					cursor.y = wy;
					cursorSeen = true;
				} else {
					cursor.x = easeToward(cursor.x, wx, dt);
					cursor.y = easeToward(cursor.y, wy, dt);
				}
				live.cursor = cursor;
			} else live.cursor = null;
			live.paused = paused;

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
				drawLive(facLive, def, f, fx, ft, t, opt, facLabels, live);
			}
			facLabels.end();
			// Name tags (calm: only in the normal view, and not zoomed out) and status words (always: they say where the trouble is).
			tagLabels.begin();
			pillBg.clear();
			pillLabels.begin();
			// Name tags are quiet: only on hover (below) and in help mode. Status words stay on.
			const helpOn = typeof document !== "undefined" && document.querySelector(".aitower-hud.is-help") !== null;
			const showNames = helpOn && overlay === "normal" && cam.zoom >= 2;
			for (const tg of tags) {
				const isWord = tg.tone !== "name";
				if (!isWord && !showNames) continue;
				// Status pills sit just right of the facility's own warning badge, which hangs at its centre.
				const pw = isWord ? pillWidth(tg.text) : 0;
				const tx = tg.cx * TILE + (isWord ? 7 + pw / 2 : 0);
				if (tx > vx1 || tx < vx0) continue;
				const ty = floorTop(view, tg.floor);
				if (ty > vy1 || ty < vy0) continue;
				const cy = ty + FAC_TOP - 4;
				if (!isWord) {
					tagLabels.put(tg.text, tx, cy, TAG_FILL.name);
					continue;
				}
				px(pillBg, tx - pw / 2, cy - 6, pw, 12, TAG_EDGE[tg.tone]);
				px(pillBg, tx - pw / 2 + 1, cy - 5, pw - 2, 10, T.ink);
				pillLabels.put(tg.text, tx, cy, TAG_FILL[tg.tone]);
			}
			pillLabels.end();

			pneumatics.draw(t, opt);
			const liftPos = (id: number): number | null => liftInterp.get(id, a)?.y ?? null;
			lifts.drawCars(view, (l) => liftPos(l.id) ?? l.carFloor, t, opt);
			const botPos = (b: { id: number; x: number; floor: number }) => botInterp.get(b.id, a) ?? { x: b.x, y: b.floor };
			bots.draw(view, botPos, (b) => botInterp.velocity(b.id), t, opt, stages);
			horror.updateBreath(view, stages, t, opt);
			horror.update({ x0: vx0, x1: vx1, y0: vy0, y1: vy1 }, stages, t, opt);
			effects.update(view, bots.torches, dt, t, opt);
			juice.update(dt, opt.reducedMotion);
			feedback.update(view, { x0: vx0, x1: vx1, y0: vy0, y1: vy1 }, dt, t, opt);

			overlays.root.visible = overlay !== "normal";
			if (overlayDirty) {
				overlayDirty = false;
				overlays.rebuild(view, overlay, opt);
			}
			overlays.animate(view, overlay, t, opt);
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
			// Hover label for the bot or lift under the pointer.
			if (pointer && overlay === "normal") {
				const wx = (pointer.sx - o.x) / cam.zoom;
				const wy = (pointer.sy - o.y) / cam.zoom;
				let hovered = false;
				for (const f of view.facilities) {
					const fd = content.facilities[f.defId];
					const fty = floorTop(view, f.floor);
					if (fd && hits(wx, wy, { x: f.x * TILE, y: fty + FAC_TOP, w: fd.width * TILE, h: FAC_BOTTOM - FAC_TOP }, 0)) {
						tagLabels.put(fd.name, (f.x + fd.width / 2) * TILE, fty + FAC_TOP - 4, TAG_FILL.name);
						hovered = true;
						break;
					}
				}
				for (const b of hovered ? [] : view.bots) {
					const p = botPos(b);
					const w = botDims(botKind(content.bots[b.defId])).w;
					const bb = botBox(view, p.x, p.y, w);
					if (hits(wx, wy, { x: bb.x, y: bb.y, w, h: BOT_H })) {
						tagLabels.put(content.bots[b.defId]?.name ?? "Bot", bb.x + w / 2, bb.y - 7, TAG_FILL.name);
						hovered = true;
						break;
					}
				}
				if (!hovered) {
					for (const l of view.lifts) {
						const ly = floorTop(view, liftPos(l.id) ?? l.carFloor) + FAC_TOP;
						if (hits(wx, wy, { x: l.x * TILE, y: ly, w: TILE, h: FAC_BOTTOM - FAC_TOP })) {
							tagLabels.put("Lift", l.x * TILE + TILE / 2, ly - 4, TAG_FILL.name);
							break;
						}
					}
				}
			}
			tagLabels.end();
			// Hover label for the bot or lift under the pointer.
			if (pointer && overlay === "normal") {
				const wx = (pointer.sx - o.x) / cam.zoom;
				const wy = (pointer.sy - o.y) / cam.zoom;
				let hovered = false;
				for (const b of view.bots) {
					const p = botPos(b);
					const w = botDims(botKind(content.bots[b.defId])).w;
					const bb = botBox(view, p.x, p.y, w);
					if (hits(wx, wy, { x: bb.x, y: bb.y, w, h: BOT_H })) {
						tagLabels.put(content.bots[b.defId]?.name ?? "Bot", bb.x + w / 2, bb.y - 7, TAG_FILL.name);
						hovered = true;
						break;
					}
				}
				if (!hovered) {
					for (const l of view.lifts) {
						const ly = floorTop(view, liftPos(l.id) ?? l.carFloor) + FAC_TOP;
						if (hits(wx, wy, { x: l.x * TILE, y: ly, w: TILE, h: FAC_BOTTOM - FAC_TOP })) {
							tagLabels.put("Lift", l.x * TILE + TILE / 2, ly - 4, TAG_FILL.name);
							break;
						}
					}
				}
			}
			tagLabels.end();
			arrows.update(view, cam, t, opt);

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
		setTitleScene(on) {
			if (on === titleScene) return;
			titleScene = on;
			if (on) {
				titleCx = cam.cx;
				titleCam = cam;
			} else if (titleCam) {
				cam = { ...cam, zoom: titleCam.zoom, cx: titleCx, cy: titleCam.cy };
				if (grid) cam = clampCamera(cam, grid);
			}
		},
		focus(cell) {
			centreOn(cell);
			if (titleScene) titleCx = cam.cx;
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
			canvas.removeEventListener("pointermove", onPointerMove);
			canvas.removeEventListener("pointerleave", onPointerLeave);
			overlays.destroy();
			// Destroys the whole scene graph (all layer Graphics are children of the stage).
			app.destroy({ removeView: true }, { children: true });
			background.destroyShared();
			screenFx.destroy();
		},
	};
	return renderer;
}

