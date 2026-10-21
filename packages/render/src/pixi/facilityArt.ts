/**
 * Cassette-futurism pixel art for facilities. `drawBody` is static (cached),
 * `drawLive` is redrawn every frame (CRT telemetry, lamps, fans, reels, needles,
 * knife switch, crates, badges). Coordinates: `x` = world left edge of the
 * facility, `top` = world top of its floor cell. Body/accent colours come from
 * `FacilityDef.color` / `accent`; everything else from the palette tokens.
 */
import type { FacilityDef } from "@aitower/content";
import type { RenderOptions } from "@aitower/shared";
import type { FacilityView } from "@aitower/sim";
import type { Graphics } from "pixi.js";
import { type ArtTier, type RackVariant, annexTiles, artSpec, artTier, bodyArt, bodyWidth, cabinetDetail, rackVariant, stripHeight, trimDetail } from "../art";
import { alertColor, hex, skinAccent, skinColor } from "../color";
import { type LiveFx, NO_FX, breathFrame, crtMotif, isPlain, lampFactor } from "../horror";
import { RotorPhases } from "../green";
import { type SkinEffect, type SkinPath, skinEffects } from "../skin";
import { FAC_BOTTOM, FAC_TOP, PIPE_H, PIPE_RETURN_Y, PIPE_SUPPLY_Y, TILE, TUBE_Y } from "../constants";
import { BRASS, COPPER, CRATE, GLASS, type Mat, NUTRIENT, PAPER, STEEL, T, VERDI, dk, lt, mat, mix } from "../palette";
import { CRT_GLYPHS, FROST, LED, badgeFor, crtGlyph, flicker, isActive, ledCue } from "../status";
import { bioLive, bioreactorBody, cullingBody, dnaTubes, growthBody, neuralPit, neuralPulse, nutrientBody, organoidJar, organoidPulse, quarantineBody, skinBody, statusEyes, sterilizerBody } from "./bioArt";
import {
	bevel,
	cornerBracket,
	dialFace,
	disc,
	fanBlades,
	glyph3,
	hash,
	lamp,
	meterNeedle,
	needle,
	panelMeter,
	dither,
	px,
	ring,
	rivet,
	valveWheel,
} from "./draw";
import { greenKindBody, greenKindLive, greenSkin, pathLive, synthSkin, windOmega } from "./greenArt";
import type { TextPool } from "./labels";

const H = FAC_BOTTOM - FAC_TOP;
const HOUSING = mat(T.housing);
const ROTORS = new RotorPhases();
const EFFECT_CACHE = new Map<string, ReadonlySet<SkinEffect>>();

/** `skinEffects` memoised per (path, stage, kind): the per-frame live pass must not build a Set per facility. */
const cachedEffects = (path: SkinPath, stage: 0 | 1 | 2 | 3 | 4, kind: Parameters<typeof skinEffects>[1]): ReadonlySet<SkinEffect> => {
	const key = `${path}${stage}${kind}`;
	let e = EFFECT_CACHE.get(key);
	if (!e) {
		e = skinEffects({ path, stage }, kind);
		EFFECT_CACHE.set(key, e);
	}
	return e;
};

export { rackVariant, type RackVariant };

// ─── Shared parts ──────────────────────────────────────────────────────

/** Enamel cabinet with riveted brass corners. */
function enamel(g: Graphics, x: number, y: number, w: number, h: number, m: Mat, corners = true): void {
	bevel(g, x, y, w, h, m);
	if (!corners) return;
	cornerBracket(g, x, y, -1, -1);
	cornerBracket(g, x + w - 1, y, 1, -1);
	cornerBracket(g, x, y + h - 1, -1, 1);
	cornerBracket(g, x + w - 1, y + h - 1, 1, 1);
}

/** Thin cold-light label line (no brass nameplates in the synthetic look). */
function nameplate(g: Graphics, x: number, y: number, w: number): void {
	px(g, x, y, w, 1, BRASS.mid, 0.7);
	px(g, x + 1, y + 2, Math.max(1, w - 4), 1, BRASS.lo, 0.6);
}

/** Vertical 3-px pipe (hi/mid/lo). */
function vpipe(g: Graphics, x: number, y0: number, y1: number, m: Mat): void {
	if (y1 <= y0) return;
	px(g, x, y0, 1, y1 - y0, m.hi);
	px(g, x + 1, y0, 1, y1 - y0, m.mid);
	px(g, x + 2, y0, 1, y1 - y0, m.lo);
}

/** Horizontal 3-px pipe. */
function hpipe(g: Graphics, x0: number, x1: number, y: number, m: Mat): void {
	if (x1 <= x0) return;
	px(g, x0, y, x1 - x0, 1, m.hi);
	px(g, x0, y + 1, x1 - x0, 1, m.mid);
	px(g, x0, y + 2, x1 - x0, 1, m.lo);
}

/** Drop pipes from the ceiling coolant pair down to a body (supply at sx, return at rx). */
function dropPipes(g: Graphics, top: number, sx: number, rx: number, toY: number): void {
	vpipe(g, sx, top + PIPE_SUPPLY_Y, toY, COPPER);
	vpipe(g, rx, top + PIPE_RETURN_Y, toY, VERDI);
	px(g, sx - 1, toY - 2, 5, 2, COPPER.dk);
	px(g, rx - 1, toY - 2, 5, 2, VERDI.dk);
}

/** Horizontal louvres. */
function louvres(g: Graphics, x: number, y: number, w: number, h: number, m: Mat): void {
	px(g, x, y, w, h, m.line);
	for (let ly = y + 1; ly < y + h - 1; ly += 2) {
		px(g, x + 1, ly, w - 2, 1, m.hi);
		px(g, x + 1, ly + 1, w - 2, 1, m.dk);
	}
}

/** Kick plate along the bottom of a cabinet. */
function kick(g: Graphics, x: number, y: number, w: number): void {
	px(g, x, y, w, 3, HOUSING.mid);
	px(g, x, y, w, 1, HOUSING.hi);
	for (let i = x + 2; i < x + w - 2; i += 3) px(g, i, y + 1, 1, 1, HOUSING.line);
}

// ─── Static bodies ─────────────────────────────────────────────────────

/** Options of `drawBody`: a grown facility, the plain look (horror off), and the biotech stage overlays. */
export interface BodyOpts {
	grown?: boolean;
	plain?: boolean;
	/** Stage overlays. `path` defaults to biotech; `horror` (0 off, 0.5 mild, 1 full) tones the greentech fungus. */
	skin?: { effects: ReadonlySet<SkinEffect>; alpha: number; seed: number; path?: SkinPath; horror?: number };
}

/** Static body plus the light trim its `unlockTier` earns (racks carry theirs per cabinet) and the stage overlays. */
export function drawBody(g: Graphics, def: FacilityDef, x: number, top: number, opts: BodyOpts = {}): void {
	PLAIN = opts.plain === true;
	const art = bodyArt(def, opts.grown);
	const y = top + FAC_TOP;
	if (art === "growth") {
		growthBody(g, x, y, def.width * TILE, PLAIN, opts.skin?.seed ?? def.width);
		return;
	}
	baseBody(g, def, art, x, top);
	if (def.kind !== "rack") {
		const extra = annexTiles(def);
		if (extra > 0) annexBay(g, x + bodyWidth(def) * TILE, y, extra * TILE, skinColor(hex(def.color)), skinAccent(hex(def.accent)));
		tierTrim(g, x, y, def.width * TILE, artSpec(def).tier);
	}
	if (opts.skin && opts.skin.effects.size > 0) {
		const W = def.width * TILE;
		const path = opts.skin.path ?? "biotech";
		if (path === "greentech") greenSkin(g, x, y, W, { ...opts.skin, horror: opts.skin.horror ?? 1 });
		else if (path === "synthetic") synthSkin(g, x, y, W, { ...opts.skin, horror: 1 });
		else skinBody(g, x, y, W, opts.skin, def.kind === "chiller" || def.kind === "cdu" || def.kind === "ups");
	}
}

/** Enamel bay that fills tiles beyond a body's native width: louvres, a dial and a kick plate. */
function annexBay(g: Graphics, x: number, y: number, W: number, c: number, a: number): void {
	const m = mat(c);
	enamel(g, x, y + 4, W - 1, H - 4, m);
	px(g, x + 2, y + 7, W - 5, 1, mix(a, c, 0.5));
	louvres(g, x + 2, y + 10, W - 5, 10, m);
	dialFace(g, x + Math.floor((W - 6) / 2), y + 21, 5);
	kick(g, x + 1, y + H - 4, W - 3);
}

/** Edge trim for non-rack facilities: brass rail, plinth, pilasters and finials, only on edge rows/columns the bodies leave free. */
function tierTrim(g: Graphics, x: number, y: number, W: number, tier: ArtTier): void {
	const d = trimDetail(tier, W / TILE);
	if (d.topRail) {
		px(g, x + 2, y, W - 4, 1, BRASS.mid);
		for (let k = x + 3; k < x + W - 3; k += 3) px(g, k, y, 1, 1, BRASS.hi);
	}
	if (d.plinth) {
		px(g, x + 1, y + H - 1, W - 2, 1, BRASS.lo);
		for (let k = x + 3; k < x + W - 3; k += 4) px(g, k, y + H - 1, 1, 1, BRASS.mid);
	}
	if (d.pilasters) {
		for (const px0 of [x, x + W - 1]) {
			px(g, px0, y + 2, 1, H - 5, BRASS.mid);
			for (let k = y + 4; k < y + H - 4; k += 4) px(g, px0, k, 1, 1, BRASS.hi);
		}
	}
	if (d.finials) {
		for (const fx of [x + 1, x + W - 4]) {
			px(g, fx, y, 3, 3, BRASS.line);
			px(g, fx + 1, y + 1, 1, 1, BRASS.hi);
			px(g, fx, y, 3, 1, BRASS.mid);
		}
	}
}

function baseBody(g: Graphics, def: FacilityDef, art: ReturnType<typeof bodyArt>, x: number, top: number): void {
	const c = skinColor(hex(def.color));
	const a = skinAccent(hex(def.accent));
	const W = bodyWidth(def) * TILE;
	const y = top + FAC_TOP;
	switch (art) {
		case "nutrient":
			nutrientBody(g, x, y, W, c);
			return;
		case "sterilizer":
			sterilizerBody(g, x, y, W, c);
			return;
		case "culling_room":
			cullingBody(g, x, y, W, c);
			return;
		case "quarantine":
			quarantineBody(g, x, y, W, c);
			return;
		case "bioreactor":
			bioreactorBody(g, x, y, W, c, PLAIN);
			return;
		case "growth":
			return;
		case "rack":
			rackBody(g, def, x, y, top, c, a);
			return;
		case "crah":
			crahBody(g, x, y, W, c, a);
			return;
		case "chiller":
			chillerBody(g, x, y, top, W, c, a);
			return;
		case "cdu":
			cduBody(g, x, y, top, W, c, a);
			return;
		case "grid_tie":
			gridTieBody(g, x, y, top, W, c, a);
			return;
		case "genset":
			gensetBody(g, x, y, top, W, c, a);
			return;
		case "ups":
			upsBody(g, x, y, W, c, a);
			return;
		case "depot":
			depotBody(g, x, y, W, c, a);
			return;
		case "charger":
			chargerBody(g, x, y, W, c, a);
			return;
		case "solar":
		case "wind":
		case "heat_export":
		case "carbon":
			greenKindBody(g, art, x, y, W, c);
			return;
	}
}

// Synthetic cabinet layout (local to a 15-px cabinet starting at cx = tile x + 1): dark glass door, a vertical
// status light strip down the left edge (1 px core at STRIP_X + 1 px glow), variant hardware on the right.
const CAB_W = 15;
const STRIP_X = 2;
const STRIP_Y = 4;
const GLYPH_X = 5; // 3×3 status glyph (colour-blind shapes) beside the strip head
const GLYPH_Y = 4;
const EYE_Y = 8; // eyes / face when the status light is "watching" (stage 3, full intensity)

/** Set per `drawBody` call: draw the plain synthetic look (horror intensity off). */
let PLAIN = false;

function rackBody(g: Graphics, def: FacilityDef, x: number, y: number, top: number, c: number, a: number): void {
	const spec = artSpec(def);
	const v = spec.variant ?? "air";
	const m = mat(c);
	const sh = stripHeight(spec.tier);
	const liquid = v === "dlc" || v === "immersion";
	const bio = v === "organoid" || v === "neural";
	for (let i = 0; i < def.width; i++) {
		const cx = x + i * TILE + 1;
		const det = cabinetDetail(spec.tier, i, def.width);
		if (liquid) {
			// Ceiling drops: supply into the left cabinet's manifold, return out of the right one.
			if (i === 0) vpipe(g, cx + 11, top + PIPE_SUPPLY_Y + PIPE_H, y + 1, COPPER);
			if (i === def.width - 1) vpipe(g, cx + 11, top + PIPE_RETURN_Y + PIPE_H, y + 1, VERDI);
		}
		enamel(g, cx, y, CAB_W, H, m);
		// Dark glass door with a cold edge light, a finer accent line at the head and the status light groove.
		px(g, cx + 4, y + 3, 9, 23, dk(c, 0.45));
		px(g, cx + 4, y + 3, 9, 1, lt(c, 0.12));
		px(g, cx + 4, y + 3, 1, 23, lt(c, 0.08));
		px(g, cx + 5, y + 2, 7, 1, mix(a, c, 0.5));
		px(g, cx + STRIP_X, y + STRIP_Y - 1, 1, sh + 2, HOUSING.line);
		px(g, cx + STRIP_X, y + STRIP_Y, 1, sh, dk(T.housing, 0.2));
		if (v === "storage") {
			// Data cells: a window of small modules (lit live).
			px(g, cx + 4, y + 13, 9, 13, HOUSING.line);
			for (let r = 0; r < 3; r++) for (let q = 0; q < 3; q++) px(g, cx + 5 + q * 3, y + 14 + r * 4, 2, 3, dk(T.steel, 0.4));
		} else if (v === "dna") {
			dnaTubes(g, cx + 4, y + 11, 9, 15, i, PLAIN);
		} else {
			// Fine vent slits.
			for (let ly = y + 13; ly < y + 25; ly += 2) px(g, cx + 6, ly, 4, 1, HOUSING.line);
			if (v === "immersion") immersionTank(g, cx + TANK_X, y + TANK_Y, skinAccent(hex(def.accent)), i);
			else if (v === "organoid") organoidJar(g, cx + TANK_X, y + TANK_Y, i, PLAIN);
			if (liquid || v === "organoid") {
				// Side manifold: coolant lines (cyan) or the pale-green nutrient feed, with a valve.
				const pm = v === "organoid" ? NUTRIENT : i === 0 ? COPPER : VERDI;
				vpipe(g, cx + 11, y + 1, y + 26, pm);
				valveWheel(g, cx + 10, y + 13, i);
				px(g, cx + 10, y + 25, 5, 2, pm.dk);
			}
		}
		kick(g, cx + 1, y + H - 4, CAB_W - 2);
		cabinetTrim(g, v, det, cx, y);
	}
	if (v === "neural") neuralPit(g, x + 3, y + 11, def.width * TILE - 6, 15, PLAIN);
	void bio;
	// Pneumatic receiver where the job tube meets the cabinet top.
	const rx = x + 6;
	px(g, rx, top + TUBE_Y - 1, 4, 4, BRASS.line);
	px(g, rx + 1, top + TUBE_Y - 1, 2, 4, BRASS.mid);
	px(g, rx + 1, top + TUBE_Y - 1, 1, 1, BRASS.hi);
}

// Immersion tank (local to a cabinet): glass box with a light lid, dielectric fluid, submerged blades.
const TANK_X = 3;
const TANK_Y = 16;
const TANK_W = 8;
const TANK_H = 10;
/** Dielectric fluid: the glass tint pulled toward the def's accent. */
const fluidColor = (accent: number): number => lt(mix(GLASS, accent, 0.55), 0.1);

function immersionTank(g: Graphics, x: number, y: number, accent: number, i: number): void {
	const fluid = fluidColor(accent);
	px(g, x, y, TANK_W, TANK_H, BRASS.line);
	px(g, x + 1, y + 1, TANK_W - 2, TANK_H - 2, GLASS);
	px(g, x + 1, y + 3, TANK_W - 2, TANK_H - 4, fluid);
	px(g, x + 1, y + 3, TANK_W - 2, 1, lt(fluid, 0.35)); // meniscus
	// Submerged server blades with a status pip each.
	for (const bx of [x + 3, x + 5]) {
		px(g, bx, y + 4, 1, TANK_H - 5, dk(T.housing, 0.2));
		px(g, bx, y + 4, 1, 1, (bx + i) % 2 ? T.green : T.amber);
	}
	px(g, x + 1, y + 2, 1, TANK_H - 4, lt(GLASS, 0.3), 0.8); // glint
	// Light lid and a foot.
	px(g, x, y, TANK_W, 1, BRASS.mid);
	px(g, x + TANK_W - 1, y, 1, 1, BRASS.hi);
	px(g, x, y + TANK_H - 1, TANK_W, 1, BRASS.lo);
}

/** Bubbles rising in an immersion tank; `rise` 0..1 per bubble (held at fixed phases when `moving` is false). */
function tankBubbles(g: Graphics, cx: number, y: number, accent: number, id: number, n: number, t: number, moving: boolean): void {
	const col = lt(fluidColor(accent), 0.75);
	const cols = [3, 5, 7];
	for (let k = 0; k < n; k++) {
		const ph = moving ? (t * 0.7 + hash(id, k)) % 1 : hash(id, k);
		const by = y + TANK_Y + TANK_H - 3 - Math.round(ph * (TANK_H - 6));
		px(g, cx + TANK_X + cols[k % 3], by, 1, 1, col, moving ? 0.9 * (1 - ph * 0.5) : 0.75);
	}
}

/** Light detail a rack cabinet earns from its `unlockTier`: edge lights, gauge, sensor bar, beacon. */
function cabinetTrim(g: Graphics, v: RackVariant, d: ReturnType<typeof cabinetDetail>, cx: number, y: number): void {
	const liquid = v === "dlc" || v === "immersion" || v === "organoid";
	if (d.cornice) px(g, cx + 2, y + 1, CAB_W - 4, 1, BRASS.mid, 0.8);
	if (d.pilasters) {
		px(g, cx + 1, y + 6, 1, 20, BRASS.mid, 0.5);
		if (!liquid) px(g, cx + CAB_W - 2, y + 6, 1, 20, BRASS.mid, 0.5);
	}
	if (d.gauge) {
		if (liquid) {
			// Thin light collars on the manifold.
			for (const cy of [y + 5, y + 21]) {
				px(g, cx + 10, cy, 5, 1, BRASS.hi);
				px(g, cx + 10, cy + 1, 5, 1, BRASS.lo);
			}
		} else {
			// 3×3 glass gauge in the side column.
			const gy = y + 7;
			px(g, cx + 10, gy, 3, 3, HOUSING.line);
			px(g, cx + 11, gy + 1, 1, 1, BRASS.hi);
			px(g, cx + 12, gy, 1, 1, BRASS.mid);
		}
	}
	if (d.hopper) {
		// Sensor bar on the cabinet top.
		px(g, cx + 9, y - 1, 5, 1, BRASS.lo);
		px(g, cx + 10, y - 2, 3, 1, BRASS.mid);
		px(g, cx + 11, y - 2, 1, 1, BRASS.hi);
	}
	if (d.crest) {
		// Beacon lens above the cabinet.
		px(g, cx + 6, y - 3, 3, 2, BRASS.mid);
		px(g, cx + 7, y - 3, 1, 1, BRASS.hi);
		px(g, cx + 7, y - 1, 1, 1, BRASS.lo);
	}
}

function crahBody(g: Graphics, x: number, y: number, W: number, c: number, a: number): void {
	const m = mat(c);
	enamel(g, x + 1, y, W - 2, H, m);
	nameplate(g, x + 4, y + 2, 9);
	louvres(g, x + 3, y + 7, 11, 18, m);
	// Fan backing plate, then the cage ring (blades + wires drawn live).
	const fx = x + 16;
	const fy = y + 6;
	ring(g, fx, fy, 13, STEEL.line, dk(T.housing, 0.4));
	// Zip ties lashing the cage to the cabinet.
	px(g, fx - 1, fy + 5, 2, 1, PAPER.hi);
	px(g, fx + 12, fy + 5, 2, 1, PAPER.hi);
	px(g, fx + 6, fy - 1, 1, 2, PAPER.hi);
	px(g, fx + 6, fy + 12, 1, 2, PAPER.hi);
	// Thermostat dial + plate.
	dialFace(g, x + 17, y + 21, 5);
	px(g, x + 23, y + 22, 5, 3, HOUSING.line);
	px(g, x + 24, y + 23, 3, 1, mix(a, c, 0.3));
	kick(g, x + 2, y + H - 4, W - 4);
}

function chillerBody(g: Graphics, x: number, y: number, top: number, W: number, c: number, a: number): void {
	const m = mat(c);
	// Saddle supports + skid.
	px(g, x + 2, y + H - 2, 46, 2, HOUSING.line);
	for (const sx of [x + 9, x + 33]) {
		px(g, sx, y + 21, 7, 9, STEEL.line);
		px(g, sx + 1, y + 22, 5, 7, STEEL.lo);
		px(g, sx + 1, y + 22, 5, 1, STEEL.mid);
	}
	// Riveted boiler tank: horizontal cylinder with domed ends.
	const tx0 = x + 9;
	const tx1 = x + 40;
	const ty = y + 3;
	const th = 20;
	for (let k = 0; k < th; k++) {
		const u = (k + 0.5) / th;
		const col = k === 0 || k === th - 1 ? m.line : u < 0.18 ? m.hi : u < 0.55 ? m.mid : u < 0.82 ? m.lo : m.dk;
		const dw = Math.round(6 * Math.sqrt(Math.max(0, 1 - ((k + 0.5 - th / 2) / (th / 2)) ** 2)));
		px(g, tx0 - dw, ty + k, tx1 - tx0 + dw * 2, 1, col);
		px(g, tx0 - dw, ty + k, 1, 1, m.line);
		px(g, tx1 + dw - 1, ty + k, 1, 1, m.line);
	}
	// Seams with rivets.
	for (const sx of [tx0 + 1, tx0 + 11, tx0 + 21, tx1 - 2]) {
		px(g, sx, ty + 1, 1, th - 2, m.dk);
		for (let k = ty + 2; k < ty + th - 2; k += 3) rivet(g, sx + 1, k, m);
	}
	for (let k = tx0 - 3; k < tx1 + 3; k += 3) {
		rivet(g, k, ty + 3, m);
		rivet(g, k, ty + th - 4, m);
	}
	nameplate(g, tx0 + 3, ty + 11, 7);
	// Pressure gauge (needle live) on the tank.
	dialFace(g, tx0 + 12, ty + 5, 7);
	// Steam vent stack with brass cap.
	vpipe(g, tx0 + 23, top + 3, ty + 1, STEEL);
	px(g, tx0 + 22, top + 2, 5, 2, BRASS.mid);
	px(g, tx0 + 22, top + 2, 5, 1, BRASS.hi);
	px(g, tx0 + 26, top + 6, 2, 2, BRASS.lo); // whistle valve
	// Copper coil pack (serpentine).
	const cx0 = x + 49;
	const cx1 = x + W - 3;
	px(g, cx0 - 1, y + 3, cx1 - cx0 + 2, 24, STEEL.line);
	px(g, cx0, y + 4, cx1 - cx0, 22, dk(T.housing, 0.2));
	for (let k = 0; k < 6; k++) {
		const ry = y + 5 + k * 3.5;
		px(g, cx0 + 1, Math.round(ry), cx1 - cx0 - 2, 1, COPPER.hi);
		px(g, cx0 + 1, Math.round(ry) + 1, cx1 - cx0 - 2, 1, COPPER.lo);
		const bx = k % 2 ? cx0 : cx1 - 1;
		if (k < 5) px(g, bx, Math.round(ry), 1, 5, COPPER.mid);
	}
	// Feed pipe tank → coil, and drops to the ceiling pair.
	hpipe(g, tx1 + 5, cx0 - 1, y + 12, COPPER);
	dropPipes(g, top, cx0 + 3, tx0 + 4, y + 4);
	px(g, x + 3, y + 1, 3, 2, mix(a, c, 0.3));
}

function cduBody(g: Graphics, x: number, y: number, top: number, W: number, c: number, a: number): void {
	const m = mat(c);
	dropPipes(g, top, x + 4, x + W - 8, y + 5);
	enamel(g, x + 1, y + 4, W - 2, H - 4, m);
	// Headers.
	hpipe(g, x + 3, x + W - 3, y + 8, COPPER);
	hpipe(g, x + 3, x + W - 3, y + 19, VERDI);
	// Branches with valve wheels (wheels live).
	for (const bx of [x + 6, x + 14, x + 22]) {
		vpipe(g, bx, y + 11, y + 19, BRASS);
		px(g, bx - 1, y + 10, 5, 1, BRASS.dk);
		px(g, bx - 1, y + 18, 5, 1, BRASS.dk);
	}
	// Pump motor + gauge.
	px(g, x + 4, y + 23, 11, 6, HOUSING.line);
	px(g, x + 5, y + 24, 9, 4, mix(T.olive, T.housing, 0.3));
	px(g, x + 5, y + 24, 9, 1, lt(T.olive, 0.2));
	for (let i = x + 6; i < x + 13; i += 2) px(g, i, y + 25, 1, 3, dk(T.olive, 0.5));
	panelMeter(g, x + 18, y + 23, 9, 6);
	px(g, x + 28, y + 24, 1, 4, mix(a, c, 0.4));
}

function gridTieBody(g: Graphics, x: number, y: number, top: number, W: number, c: number, a: number): void {
	const m = mat(c);
	// Transformer tank with cooling fins.
	enamel(g, x + 3, y + 10, 34, H - 10, m);
	for (let i = x + 6; i < x + 35; i += 3) {
		px(g, i, y + 14, 1, H - 19, m.dk);
		px(g, i + 1, y + 14, 1, H - 19, m.hi);
	}
	nameplate(g, x + 14, y + 12, 9);
	// Porcelain / bakelite insulators with brass terminals and feeder wires up to the ceiling.
	for (const ix of [x + 8, x + 18, x + 28]) {
		px(g, ix + 1, top + 1, 1, y + 1 - top, dk(T.housing, 0.3));
		px(g, ix - 1, y + 9, 5, 2, HOUSING.mid);
		for (let d = 0; d < 4; d++) {
			const dy = y + 7 - d * 2;
			px(g, ix - 1, dy, 5, 1, PAPER.hi);
			px(g, ix, dy + 1, 3, 1, PAPER.lo);
		}
		px(g, ix, y, 3, 1, BRASS.hi);
	}
	// Bakelite switchboard (knife switch drawn live).
	const bx = x + 39;
	px(g, bx, y + 3, W - 42, H - 3, HOUSING.line);
	px(g, bx + 1, y + 4, W - 44, H - 5, HOUSING.mid);
	px(g, bx + 1, y + 4, W - 44, 1, HOUSING.hi);
	for (const [sx, sy] of [
		[bx + 2, y + 5],
		[bx + W - 45, y + 5],
		[bx + 2, y + H - 3],
		[bx + W - 45, y + H - 3],
	])
		px(g, sx, sy, 1, 1, BRASS.mid);
	// Contacts (top clips) + hinge blocks for the two blades.
	for (const k of [0, 8]) {
		px(g, bx + 6 + k, y + 7, 4, 2, BRASS.lo);
		px(g, bx + 6 + k, y + 7, 4, 1, BRASS.hi);
		px(g, bx + 6 + k, y + 22, 4, 3, BRASS.lo);
		px(g, bx + 7 + k, y + 23, 2, 1, BRASS.hi);
	}
	// Danger plate.
	px(g, bx + 3, y + H - 6, W - 48, 4, T.red);
	px(g, bx + 4, y + H - 5, W - 50, 2, PAPER.mid);
	px(g, bx + 6, y + H - 5, 3, 1, T.ink);
	px(g, x + 4, y + 11, 2, 2, mix(a, c, 0.2));
}

function gensetBody(g: Graphics, x: number, y: number, top: number, W: number, c: number, a: number): void {
	const m = mat(c);
	// Skid.
	px(g, x + 1, y + H - 4, W - 2, 4, STEEL.line);
	px(g, x + 2, y + H - 3, W - 4, 2, STEEL.lo);
	px(g, x + 2, y + H - 3, W - 4, 1, STEEL.mid);
	// Exhaust stack (behind the engine) up toward the ceiling, with a rain cap drawn live.
	vpipe(g, x + 41, top + 5, y + 10, mat(mix(T.steel, T.copper, 0.25)));
	px(g, x + 40, top + 15, 5, 2, STEEL.line);
	// Engine block + cylinder heads with brass bolts.
	enamel(g, x + 12, y + 11, 35, H - 15, m, false);
	for (let k = 0; k < 4; k++) {
		const hx = x + 14 + k * 8;
		px(g, hx, y + 7, 7, 5, m.line);
		px(g, hx + 1, y + 8, 5, 3, m.mid);
		px(g, hx + 1, y + 8, 5, 1, m.hi);
		px(g, hx + 3, y + 7, 1, 1, BRASS.hi);
	}
	// Exhaust manifold.
	px(g, x + 14, y + 12, 30, 2, dk(T.copper, 0.35));
	px(g, x + 14, y + 12, 30, 1, dk(T.copper, 0.1));
	// "DIESEL" brass plate + accent stripe.
	nameplate(g, x + 22, y + 17, 11);
	px(g, x + 13, y + 22, 33, 1, mix(a, c, 0.45));
	// Flywheel housing (spokes live).
	ring(g, x + 1, y + 11, 15, STEEL.line, STEEL.lo);
	disc(g, x + 3, y + 13, 11, dk(T.steel, 0.5));
	// Radiator with grille.
	enamel(g, x + 48, y + 6, W - 50, H - 10, m);
	for (let ry = y + 9; ry < y + H - 7; ry += 2) px(g, x + 50, ry, W - 54, 1, m.line);
	// Control box on a stalk (lamps live).
	px(g, x + 52, y + 1, 9, 5, HOUSING.line);
	px(g, x + 53, y + 2, 7, 3, HOUSING.mid);
	px(g, x + 56, y + 6, 1, 1, STEEL.lo);
}

function upsBody(g: Graphics, x: number, y: number, W: number, c: number, a: number): void {
	const m = mat(c);
	// Timber/steel shelving.
	px(g, x + 1, y + 2, 2, H - 2, m.line);
	px(g, x + W - 3, y + 2, 2, H - 2, m.line);
	px(g, x + 1, y + 16, W - 2, 2, m.mid);
	px(g, x + 1, y + 16, W - 2, 1, m.hi);
	px(g, x + 1, y + H - 2, W - 2, 2, m.mid);
	px(g, x + 1, y + H - 2, W - 2, 1, m.hi);
	// Glass jars: 4 on the upper shelf (meter beside them), 6 on the lower.
	const jar = (jx: number, jy: number, h: number): void => {
		px(g, jx, jy, 6, h, VERDI.line);
		px(g, jx + 1, jy + 1, 4, h - 1, mix(GLASS, T.verdigris, 0.25));
		px(g, jx + 1, jy + 4, 4, h - 4, mix(T.verdigris, T.green, 0.25), 0.55); // acid
		px(g, jx + 1, jy + 4, 4, 1, lt(T.verdigris, 0.45), 0.8);
		px(g, jx + 2, jy + 2, 1, h - 3, dk(T.housing, 0.4)); // lead plates
		px(g, jx + 4, jy + 2, 1, h - 3, dk(T.housing, 0.4));
		px(g, jx + 1, jy + 1, 1, h - 2, lt(GLASS, 0.3)); // glint
		px(g, jx, jy - 1, 6, 1, HOUSING.mid); // lid
		px(g, jx + 1, jy - 2, 1, 1, BRASS.hi);
		px(g, jx + 4, jy - 2, 1, 1, BRASS.hi);
	};
	for (let k = 0; k < 4; k++) jar(x + 4 + k * 7, y + 5, 11);
	for (let k = 0; k < 6; k++) jar(x + 4 + k * 7, y + 20, 9);
	// Copper bus bars linking the terminals.
	px(g, x + 5, y + 2, 25, 1, COPPER.mid);
	px(g, x + 5, y + 17, 39, 1, COPPER.mid);
	// Analog charge meter panel (needle live).
	px(g, x + 33, y, 13, 15, HOUSING.line);
	px(g, x + 34, y + 1, 11, 13, HOUSING.mid);
	px(g, x + 34, y + 1, 11, 1, HOUSING.hi);
	panelMeter(g, x + 35, y + 2, 9, 7);
	px(g, x + 36, y + 10, 7, 1, mix(a, c, 0.3));
}

function depotBody(g: Graphics, x: number, y: number, W: number, c: number, a: number): void {
	const m = mat(c);
	// Back mesh (diagonal lattice).
	for (let j = 1; j < H - 1; j += 2) for (let i = (j >> 1) % 2 ? 3 : 1; i < W - 2; i += 4) px(g, x + i, y + j, 1, 1, m.lo, 0.7);
	// Shelves.
	for (const sy of [y + 10, y + 20]) {
		px(g, x + 2, sy, W - 4, 2, m.mid);
		px(g, x + 2, sy, W - 4, 1, m.hi);
		px(g, x + 2, sy + 2, W - 4, 1, m.line, 0.6);
	}
	// Cage frame: posts + top rail.
	for (const px0 of [x + 1, x + W / 2 - 1, x + W - 3]) {
		px(g, px0, y, 2, H, m.line);
		px(g, px0, y, 1, H, m.mid);
	}
	px(g, x + 1, y, W - 2, 2, m.line);
	px(g, x + 1, y, W - 2, 1, m.hi);
	px(g, x + 1, y + H - 1, W - 2, 1, m.line);
	// Requisition plate (count drawn live) with brass rim.
	px(g, x + W - 15, y + 2, 12, 8, BRASS.line);
	px(g, x + W - 14, y + 3, 10, 6, PAPER.mid);
	px(g, x + W - 14, y + 3, 10, 1, PAPER.hi);
	px(g, x + 4, y + 3, 5, 2, mix(a, c, 0.2));
}

function chargerBody(g: Graphics, x: number, y: number, W: number, c: number, a: number): void {
	const m = mat(c);
	// Dock pad: brass contact strips on a dark plinth.
	px(g, x + 1, y + H - 3, W - 10, 3, HOUSING.line);
	for (let i = x + 2; i < x + W - 10; i += 3) px(g, i, y + H - 3, 2, 1, BRASS.mid);
	// Pedestal with brass cap.
	enamel(g, x + W - 9, y + 4, 8, H - 4, m);
	px(g, x + W - 10, y + 2, 10, 3, BRASS.lo);
	px(g, x + W - 10, y + 2, 10, 1, BRASS.hi);
	dialFace(g, x + W - 8, y + 9, 5);
	px(g, x + W - 7, y + 18, 3, 6, HOUSING.line);
	px(g, x + W - 6, y + 19, 1, 4, mix(a, c, 0.4));
	// Pantograph pivot.
	px(g, x + W - 11, y + 6, 3, 3, BRASS.line);
	px(g, x + W - 10, y + 7, 1, 1, BRASS.hi);
}

// ─── Live details ──────────────────────────────────────────────────────

/** Time-varying details drawn on top of the cached body. `t` is seconds. */
/**
 * Per-frame live details. `opt.reducedMotion` stops spin/flutter/flap and holds blinking lamps lit
 * (status lamps show a steady colour); `opt.colorBlind` switches status colours to blue/orange.
 */
export function drawLive(g: Graphics, def: FacilityDef, f: FacilityView, x: number, top: number, t: number, opt: RenderOptions, labels?: TextPool, lf: LiveFx = NO_FX): void {
	const y = top + FAC_TOP;
	const W = def.width * TILE;
	const active = isActive(f.status, f.enabled);
	const c = skinColor(hex(def.color));
	const calm = opt.reducedMotion;
	const art = bodyArt(def, f.grown);
	const eff = skinEffects({ path: lf.stage > 0 ? "biotech" : null, stage: lf.stage }, art === "growth" ? "growth" : def.kind);
	const sel: string = art === "growth" ? "growth" : def.kind;
	switch (sel) {
		case "solar":
		case "wind":
		case "heat_export":
		case "carbon": {
			const usable = active && f.status !== "tripped";
			const omega = sel === "wind" && !calm ? windOmega(lf.tick ?? 0, lf.drought === true, usable) : 0;
			greenKindLive(g, x, y, W, {
				kind: sel,
				id: f.id,
				usable,
				heatKw: f.heatKw,
				exportKw: def.green?.exportKw ?? 0,
				minute: lf.minute ?? 720,
				tick: lf.tick ?? 0,
				drought: lf.drought === true,
				calm,
				t,
				phase: sel === "wind" ? ROTORS.at(f.id, t, omega) : 0,
			});
			break;
		}
		case "growth":
			bioLive(g, "growth", f.id, x, y, W, t, active, calm, lf, eff.has("eyes") && lf.stages.eyes);
			break;
		case "nutrient":
		case "quarantine":
		case "bioreactor":
			bioLive(g, sel, f.id, x, y, W, t, active, calm, lf, sel === "bioreactor" && eff.has("eyes") && lf.stages.eyes);
			break;
		case "sterilizer":
			bioLive(g, art === "culling_room" ? "culling_room" : "sterilizer", f.id, x, y, W, t, active, calm, lf, false);
			break;
		case "rack":
			rackLive(g, def, f, x, y, t, opt, lf, eff);
			break;
		case "crah": {
			const run = active;
			const spin = run && !calm;
			const cap = def.cooling?.capacityKw ?? 150;
			const fx = x + 16;
			const fy = y + 6;
			fanBlades(g, fx + 1, fy + 1, 11, spin ? t * (7 + 12 * Math.min(1, f.heatKw / cap)) : 0.4, lt(T.steel, 0.35));
			// Cage wires over the blades.
			for (const k of [3, 6, 9]) px(g, fx + k, fy + 1, 1, 11, STEEL.mid, 0.55);
			px(g, fx + 1, fy + 6, 11, 1, STEEL.mid, 0.55);
			// Ribbon streamer fluttering from the cage.
			for (let k = 0; k < 6; k++) {
				const wv = spin ? Math.round(Math.sin(t * 13 - k * 1.1) * (k * 0.35)) : 0;
				const rx = run ? fx + 12 + k : fx + 12;
				const ry = run ? fy + 8 + wv : fy + 8 + k;
				px(g, rx, ry, 1, 1, k % 2 ? T.red : lt(T.red, 0.3));
			}
			lamp(g, x + 25, y + 23, run ? T.green : T.amber, active);
			break;
		}
		case "chiller": {
			const cap = def.cooling?.capacityKw ?? 600;
			const load = active ? Math.min(1, f.heatKw / cap) : 0;
			needle(g, x + 21, y + 8, 7, load + Math.sin(t * 9) * 0.02 * load);
			lamp(g, x + 4, y + 1, active ? (load > 0.9 ? T.red : T.green) : T.amber, true, 0.25);
			break;
		}
		case "cdu": {
			const ph = active ? Math.floor(t * 3) : 0;
			for (const [k, bx] of [x + 5, x + 13, x + 21].entries()) valveWheel(g, bx, y + 12, ph + k);
			const cap = def.cooling?.capacityKw ?? 400;
			meterNeedle(g, x + 18, y + 23, 9, 6, active ? Math.min(1, f.heatKw / cap) : 0);
			break;
		}
		case "grid_tie": {
			const on = active && f.powerKw > 0;
			const bx = x + 39;
			for (const k of [0, 8]) {
				const hx = bx + 8 + k;
				const hy = y + 23;
				if (on) {
					// Closed: blade straight up into the clips.
					px(g, hx - 1, y + 8, 2, hy - (y + 8), BRASS.hi);
					px(g, hx + 1, y + 8, 1, hy - (y + 8), BRASS.lo);
					px(g, hx - 1, y + 12, 3, 3, T.ink);
					px(g, hx - 1, y + 12, 3, 1, HOUSING.hi);
				} else {
					// Open: blade swung out and down.
					for (let s = 0; s < 12; s++) px(g, hx + Math.round(s * 0.7), hy - Math.round(s * 0.7), 2, 1, BRASS.hi);
					px(g, hx + 7, hy - 10, 3, 3, T.ink);
				}
			}
			lamp(g, bx + 18, y + 6, on ? T.amber : alertColor(opt.colorBlind), on || calm || Math.floor(t * 2) % 2 === 0);
			break;
		}
		case "genset": {
			const run = f.running === true;
			const ang = run && !calm ? t * 11 : 0.3;
			// Flywheel spokes.
			for (let k = 0; k < 4; k++) {
				const aa = ang + (k * Math.PI) / 2;
				for (let s = 1; s < 5; s++) px(g, Math.floor(x + 8.5 + Math.cos(aa) * s), Math.floor(y + 18.5 + Math.sin(aa) * s), 1, 1, STEEL.hi);
			}
			px(g, x + 8, y + 18, 2, 2, BRASS.mid);
			// Rain cap flapping on the stack.
			const flap = run && !calm ? Math.floor(t * 9) % 2 : 0;
			px(g, x + 40, top + 4 - flap, 5, 1, STEEL.hi);
			px(g, x + 40, top + 5 - flap, 5, 1, STEEL.lo);
			lamp(g, x + 54, y + 3, run ? T.green : T.red, true, 0.3);
			lamp(g, x + 57, y + 3, T.amber, run && (calm || Math.floor(t * 4) % 2 === 0), 0.3);
			if (run && !calm) {
				// Engine shake on the heads.
				const j = Math.floor(t * 18) % 2;
				px(g, x + 14 + j, y + 8, 31, 1, lt(c, 0.25), 0.5);
			}
			break;
		}
		case "ups": {
			const ch = Math.max(0, Math.min(1, f.charge ?? 0));
			meterNeedle(g, x + 35, y + 2, 9, 7, ch);
			lamp(g, x + 43, y + 11, ch > 0.2 ? T.green : alertColor(opt.colorBlind), active && (ch > 0.2 || calm || Math.floor(t * 2) % 2 === 0), 0.25);
			if (active && !calm) {
				// Bubbles rising in the acid.
				for (let k = 0; k < 10; k++) {
					const ph = (t * 0.6 + hash(f.id, k)) % 1;
					const jx = x + 4 + (k % (k < 4 ? 4 : 6)) * 7 + 3;
					const jy = k < 4 ? y + 15 : y + 28;
					px(g, jx, jy - Math.round(ph * 5), 1, 1, lt(T.verdigris, 0.6), 0.7 * (1 - ph));
				}
			}
			break;
		}
		case "depot": {
			const n = Math.max(0, Math.floor(f.stored ?? 0));
			const per = Math.max(1, Math.floor((W - 6) / 6));
			const shown = Math.min(n, per * 3);
			for (let i = 0; i < shown; i++) {
				const s = Math.floor(i / per);
				const k = i % per;
				const bx = x + 3 + k * 6;
				const by = y + H - 6 - s * 10;
				if (s === 2 && bx > x + W - 17) continue; // keep the plate clear
				crate(g, bx, by);
			}
			labels?.put(String(n).padStart(2, "0"), x + W - 9, y + 5.5, T.ink);
			// Fill gauge along the top edge: green when stocked, amber when low, red when empty.
			const cap = Math.max(1, def.logistics?.capacity ?? 1);
			const frac = Math.min(1, n / cap);
			const gw = W - 14;
			px(g, x + 3, y + 1, gw, 3, T.ink, 0.7);
			if (frac > 0) px(g, x + 4, y + 2, Math.max(1, Math.round((gw - 2) * frac)), 1, frac > 0.3 ? T.green : T.amber);
			else px(g, x + 4, y + 2, gw - 2, 1, alertColor(opt.colorBlind), 0.8);
			break;
		}
		case "charger": {
			// Pantograph arm: scissor from the pivot to a contact shoe over the pad.
			const ext = active ? (calm ? 0.75 : 0.75 + 0.25 * Math.sin(t * 1.5)) : 0;
			const px0 = x + W - 10;
			const py0 = y + 7;
			const sx = x + 8;
			const sy = y + 8 + Math.round(ext * 10);
			const n = 3;
			for (let k = 0; k <= 10 * n; k++) {
				const u = k / (10 * n);
				const lx = Math.round(px0 + (sx - px0) * u);
				const zig = Math.abs(((u * n * 2) % 2) - 1) * 3;
				px(g, lx, Math.round(py0 + (sy - py0) * u - zig), 1, 1, BRASS.mid);
				px(g, lx, Math.round(py0 + (sy - py0) * u + zig), 1, 1, BRASS.lo);
			}
			px(g, sx - 3, sy + 3, 7, 2, BRASS.line);
			px(g, sx - 2, sy + 3, 5, 1, BRASS.hi);
			lamp(g, x + W - 6, y + 25, T.green, active && (calm || Math.sin(t * 4) > -0.3), 0.3);
			break;
		}
	}
	if (!f.enabled || f.status === "unpowered" || f.status === "disabled") px(g, x + 1, y, W - 2, H, T.ink, 0.45);
	if (f.status === "tooCold") frost(g, x, y, W, f.id);
	stageLive(g, x, y, W, f.id, t, calm, lf, eff, art === "growth");
	if (lf.pskin && lf.pskin.stage > 0) pathLive(g, x, y, W, f.id, t, calm, cachedEffects(lf.pskin.path, lf.pskin.stage, art === "growth" ? "growth" : def.kind), lf.pskin.horror);
	drawBadge(g, f, x + W / 2, top + 1, t, calm);
}

/** Pale-blue frost on a device that is below its temperature band: crystals along the edges and a dithered rime. */
function frost(g: Graphics, x: number, y: number, W: number, id: number): void {
	dither(g, x + 1, y + H - 12, W - 2, 10, FROST, 0.28, 2);
	for (let k = 1; k < W - 1; k += 2) {
		const h = hash(id, k);
		if (h < 0.55) px(g, x + k, y + 1, 1, 1 + Math.floor(h * 5), FROST, 0.75);
	}
	px(g, x + 1, y + 1, W - 2, 1, lt(FROST, 0.4), 0.55);
}

/**
 * Biotech stage extras drawn every frame: the faint pulse (stage 1, non-racks), breathing housings (stage 3, a two-frame
 * 1-px inflate at 0.2 Hz). Both stop under reduced motion; `mild` halves the alpha.
 */
function stageLive(g: Graphics, x: number, y: number, W: number, id: number, t: number, calm: boolean, lf: LiveFx, eff: ReadonlySet<SkinEffect>, growth: boolean): void {
	if (calm || lf.stages.alpha <= 0 || growth) return;
	const a = lf.stages.alpha;
	if (eff.has("pulse")) {
		const k = 0.5 + 0.5 * Math.sin(((Math.PI * 2) * t) / 3.4 + hash(id, 3) * 6.28);
		px(g, x + 1, y + 2, W - 2, H - 4, T.flesh, 0.05 * a * k);
	}
	if (eff.has("breathe") && breathFrame(t + hash(id, 4), false) === 1) {
		px(g, x, y + 3, 1, H - 6, T.flesh, 0.5 * a);
		px(g, x + W - 1, y + 3, 1, H - 6, T.flesh, 0.5 * a);
		px(g, x + 1, y - 1, W - 2, 1, T.flesh, 0.35 * a);
	}
}

function crate(g: Graphics, x: number, y: number): void {
	px(g, x, y, 5, 5, CRATE.lo);
	px(g, x, y, 5, 1, CRATE.hi);
	px(g, x, y + 1, 4, 3, CRATE.mid);
	px(g, x + 1, y + 2, 2, 1, CRATE.stamp);
}

function rackLive(g: Graphics, def: FacilityDef, f: FacilityView, x: number, y: number, t: number, opt: RenderOptions, fx: LiveFx, eff: ReadonlySet<SkinEffect>): void {
	const v = rackVariant(def);
	const calm = opt.reducedMotion;
	const cue = ledCue(f.status, f.enabled, opt.colorBlind);
	const slot = Math.floor(t * 6);
	const blinkOn = calm || Math.floor(t * 2.5) % 2 === 0;
	const glyph = cue.mode === "off" ? null : crtGlyph(f.status);
	const active = isActive(f.status, f.enabled);
	const sh = stripHeight(artTier(def.unlockTier));
	const level = f.status === "idle" ? 0.2 : cue.tone === "fault" ? 1 : 0.3 + 0.7 * Math.max(0.2, f.clock);
	const fault = cue.tone === "fault";
	for (let i = 0; i < def.width; i++) {
		const cx = x + i * TILE + 1;
		const seed = f.id * 8 + i;
		// Status light strip: lit from the bottom by clock, faint pulse at stage 1+ (out of step per cabinet).
		if (cue.mode !== "off") {
			const pulse = eff.has("pulse") ? lampFactor(fx.stages, f.id, i, t, calm) : 1;
			const col = pulse < 1 ? mix(cue.color, T.ink, (1 - pulse) * 0.6) : cue.color;
			const on = cue.mode === "blink" ? blinkOn : true;
			const rows = cue.mode === "steady" ? 2 : Math.max(1, Math.round(sh * level));
			if (on) {
				px(g, cx + STRIP_X, y + STRIP_Y + sh - rows, 1, rows, col);
				px(g, cx + STRIP_X + 1, y + STRIP_Y + sh - rows, 1, rows, col, 0.22 * pulse);
				px(g, cx + STRIP_X, y + STRIP_Y + sh - rows, 1, 1, lt(col, 0.55));
			}
			if (cue.mode === "activity" && !calm) {
				// A bright segment travels up the strip with activity.
				const sy = y + STRIP_Y + ((slot * 2 + i * 5) % sh);
				px(g, cx + STRIP_X, sy, 1, 1, lt(cue.accent, 0.35), 0.9);
			}
			if (glyph) glyph3(g, cx + GLYPH_X, y + GLYPH_Y, CRT_GLYPHS[glyph], cue.color);
		}
		// Eyes and faces in the status light (stage 3, full intensity).
		const motif = cue.mode === "off" ? "none" : eff.has("eyes") ? crtMotif(fx.stages, seed, fx.score, fault) : "none";
		if (motif !== "none") statusEyes(g, cx + GLYPH_X, y + EYE_Y, motif, lt(cue.color, 0.55), seed, t, fx, cx + GLYPH_X + 3, y + EYE_Y + 1, calm);
		if (v === "storage") {
			for (let r = 0; r < 3; r++)
				for (let q = 0; q < 3; q++) {
					const lit = cue.mode !== "off" && (calm ? (r + q + i) % 2 === 0 : flicker(f.id, i * 9 + r * 3 + q, slot) < 0.2 + f.clock * 0.5);
					if (lit) px(g, cx + 5 + q * 3, y + 14 + r * 4, 2, 3, r === 2 && q === 2 ? cue.accent : cue.color, 0.9);
				}
		} else if (v === "immersion") {
			const n = !f.enabled || cue.mode === "off" ? 0 : active ? 5 : 2;
			tankBubbles(g, cx, y, skinAccent(hex(def.accent)), seed, n, t, !calm && active);
		} else if (v === "organoid") {
			organoidPulse(g, cx + TANK_X, y + TANK_Y, seed, t, !calm && !isPlain(fx), active);
		}
	}
	if (v === "neural") neuralPulse(g, x + 3, y + 11, def.width * TILE - 6, 15, f.id, t, !calm && !isPlain(fx) && active);
}

/** Status tag (wrench / crossed drop / crossed bolt) hanging above the facility. */
function drawBadge(g: Graphics, f: FacilityView, cx: number, y: number, t: number, calm: boolean): void {
	const b = badgeFor(f.status);
	if (!b) return;
	if (!calm && Math.floor(t * 2) % 3 === 2) return; // gentle blink, held steady under reduced motion
	const x = Math.round(cx) - 5;
	const face = b === "wrench" ? T.amber : b === "noCoolant" ? T.verdigris : b === "noNutrient" ? LED.starved : b === "tooCold" ? FROST : T.paper;
	px(g, x - 1, y - 1, 11, 9, T.ink, 0.85);
	px(g, x, y, 9, 7, face);
	px(g, x, y, 9, 1, lt(face, 0.4));
	px(g, x + 4, y - 2, 1, 1, BRASS.hi);
	const ink = T.ink;
	if (b === "wrench") {
		px(g, x + 2, y + 1, 2, 2, ink);
		px(g, x + 3, y + 2, 1, 1, face);
		px(g, x + 4, y + 3, 1, 1, ink);
		px(g, x + 5, y + 4, 1, 1, ink);
		px(g, x + 6, y + 5, 2, 1, ink);
	} else if (b === "noCoolant") {
		px(g, x + 4, y + 1, 1, 1, T.paper);
		px(g, x + 3, y + 2, 3, 2, T.paper);
		px(g, x + 3, y + 4, 3, 1, T.paper);
		cross(g, x, y);
	} else if (b === "noNutrient") {
		// Empty feed tube: open top, one drop.
		px(g, x + 3, y + 1, 1, 4, ink);
		px(g, x + 5, y + 1, 1, 4, ink);
		px(g, x + 3, y + 5, 3, 1, ink);
		px(g, x + 4, y + 2, 1, 1, ink);
	} else if (b === "tooCold") {
		// Snowflake.
		px(g, x + 4, y + 1, 1, 5, ink);
		px(g, x + 2, y + 3, 5, 1, ink);
		px(g, x + 3, y + 2, 1, 1, ink);
		px(g, x + 5, y + 2, 1, 1, ink);
		px(g, x + 3, y + 4, 1, 1, ink);
		px(g, x + 5, y + 4, 1, 1, ink);
	} else {
		px(g, x + 4, y + 1, 2, 1, ink);
		px(g, x + 3, y + 2, 2, 1, ink);
		px(g, x + 3, y + 3, 4, 1, ink);
		px(g, x + 5, y + 4, 1, 1, ink);
		px(g, x + 4, y + 5, 1, 1, ink);
		cross(g, x, y);
	}
}

function cross(g: Graphics, x: number, y: number): void {
	for (let i = 0; i < 7; i++) px(g, x + 1 + i, y + i, 1, 1, T.red);
}

/** World x of the pneumatic receiver of a rack (capsule target). */
export const receiverX = (x: number): number => x + 8;

