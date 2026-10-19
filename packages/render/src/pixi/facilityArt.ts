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
import { type ArtTier, type RackVariant, annexTiles, artSpec, bodyWidth, cabinetDetail, rackVariant, trimDetail } from "../art";
import { alertColor, hex } from "../color";
import { FAC_BOTTOM, FAC_TOP, PIPE_H, PIPE_RETURN_Y, PIPE_SUPPLY_Y, TILE, TUBE_Y } from "../constants";
import { BRASS, COPPER, CRATE, GLASS, type Mat, PAPER, SCREEN, STEEL, T, VERDI, dk, lt, mat, mix } from "../palette";
import { CRT_GLYPHS, badgeFor, crtGlyph, flicker, isActive, ledCue, phosphorFor } from "../status";
import {
	bevel,
	cornerBracket,
	crt,
	dialFace,
	disc,
	fanBlades,
	glyph3,
	hash,
	lamp,
	meterNeedle,
	needle,
	panelMeter,
	px,
	ring,
	rivet,
	valveWheel,
} from "./draw";
import type { TextPool } from "./labels";

const H = FAC_BOTTOM - FAC_TOP;
const HOUSING = mat(T.housing);
const TAPE = mix(T.housing, T.copper, 0.35);

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

/** Brass nameplate with "engraved" text pixels. */
function nameplate(g: Graphics, x: number, y: number, w: number): void {
	px(g, x, y, w, 3, BRASS.lo);
	px(g, x, y, w, 1, BRASS.hi);
	px(g, x + 1, y + 1, w - 2, 1, BRASS.mid);
	for (let i = x + 1; i < x + w - 1; i += 2) px(g, i, y + 1, 1, 1, BRASS.dk);
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

/** Static body plus the brass trim its `unlockTier` earns (racks carry theirs per cabinet). */
export function drawBody(g: Graphics, def: FacilityDef, x: number, top: number): void {
	baseBody(g, def, x, top);
	if (def.kind === "rack") return;
	const extra = annexTiles(def);
	if (extra > 0) annexBay(g, x + bodyWidth(def) * TILE, top + FAC_TOP, extra * TILE, hex(def.color), hex(def.accent));
	tierTrim(g, x, top + FAC_TOP, def.width * TILE, artSpec(def).tier);
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

function baseBody(g: Graphics, def: FacilityDef, x: number, top: number): void {
	const c = hex(def.color);
	const a = hex(def.accent);
	const W = bodyWidth(def) * TILE;
	const y = top + FAC_TOP;
	switch (def.kind) {
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
	}
}

// Mainframe cabinet layout (local to a 15-px cabinet starting at cx = tile x + 1).
const CAB_W = 15;
const CRT_X = 3; // screen
const CRT_Y = 7;
const CRT_W = 7;
const CRT_H = 5;
const LAMP_Y = 14;

function rackBody(g: Graphics, def: FacilityDef, x: number, y: number, top: number, c: number, a: number): void {
	const spec = artSpec(def);
	const v = spec.variant ?? "air";
	const m = mat(c);
	const liquid = v === "dlc" || v === "immersion";
	for (let i = 0; i < def.width; i++) {
		const cx = x + i * TILE + 1;
		const det = cabinetDetail(spec.tier, i, def.width);
		if (liquid) {
			// Ceiling drops: supply into the left cabinet's manifold, return out of the right one.
			if (i === 0) vpipe(g, cx + 11, top + PIPE_SUPPLY_Y + PIPE_H, y + 1, COPPER);
			if (i === def.width - 1) vpipe(g, cx + 11, top + PIPE_RETURN_Y + PIPE_H, y + 1, VERDI);
		}
		enamel(g, cx, y, CAB_W, H, m);
		nameplate(g, cx + 3, y + 2, 7);
		// Accent pinstripe.
		px(g, cx + 2, y + 5, 11, 1, mix(a, c, 0.55));
		// CRT bezel + dark glass with a glint.
		px(g, cx + CRT_X - 1, y + CRT_Y - 1, CRT_W + 2, CRT_H + 2, HOUSING.line);
		px(g, cx + CRT_X - 1, y + CRT_Y - 1, CRT_W + 2, 1, HOUSING.hi);
		px(g, cx + CRT_X, y + CRT_Y, CRT_W, CRT_H, SCREEN);
		px(g, cx + CRT_X, y + CRT_Y, 1, 1, lt(SCREEN, 0.25));
		if (v === "storage") {
			// Reel-to-reel window (reels spin live).
			px(g, cx + 2, y + 13, 9, 14, HOUSING.line);
			px(g, cx + 3, y + 14, 7, 12, GLASS);
			px(g, cx + 3, y + 14, 7, 1, lt(GLASS, 0.18));
			// Lamp sockets in the side column.
			for (const ly of [14, 18, 22]) px(g, cx + 11, y + ly - 1, 3, 4, m.lo);
		} else {
			// Lamp sockets.
			for (const lx of [3, 6, 9]) px(g, cx + lx, y + LAMP_Y + 2, 2, 1, m.lo);
			// Punch-card intake grille (air), a narrower panel beside the manifold (DLC) or a glass immersion tank.
			if (v === "immersion") immersionTank(g, cx + TANK_X, y + TANK_Y, hex(def.accent), i);
			else louvres(g, cx + 2, y + 17, v === "dlc" ? 8 : 9, 8, m);
			// Punch-card slot (card drawn live).
			px(g, cx + 3, y + 26, 7, 1, T.ink);
			px(g, cx + 3, y + 27, 7, 1, m.hi);
			if (v === "air") {
				// Toggle switches in the side column.
				for (const ty of [7, 10]) {
					px(g, cx + 11, y + ty, 2, 2, HOUSING.line);
					px(g, cx + 12, y + ty - 1, 1, 2, STEEL.hi);
				}
				px(g, cx + 11, y + 18, 2, 3, BRASS.lo);
				px(g, cx + 11, y + 18, 1, 1, BRASS.hi);
			} else {
				// Side copper (supply) / verdigris (return) manifold with brass valve wheels.
				const pm = i === 0 ? COPPER : VERDI;
				vpipe(g, cx + 11, y + 1, y + 26, pm);
				valveWheel(g, cx + 10, y + 13, i);
				if (v === "dlc") valveWheel(g, cx + 10, y + 19, i + 1);
				px(g, cx + 10, y + 25, 5, 2, pm.dk);
			}
		}
		kick(g, cx + 1, y + H - 4, CAB_W - 2);
		cabinetTrim(g, v, det, cx, y);
	}
	// Pneumatic receiver where the job tube meets the cabinet top.
	const rx = x + 6;
	px(g, rx, top + TUBE_Y - 1, 4, 4, BRASS.line);
	px(g, rx + 1, top + TUBE_Y - 1, 2, 4, BRASS.mid);
	px(g, rx + 1, top + TUBE_Y - 1, 1, 1, BRASS.hi);
}

// Immersion tank (local to a cabinet): glass box with a brass lid, dielectric fluid, submerged blades.
const TANK_X = 2;
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
	// Brass lid with bolts, and a foot.
	px(g, x, y, TANK_W, 1, BRASS.mid);
	px(g, x, y, 1, 1, BRASS.hi);
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

/** Gauge / hopper / crest / pilaster extras that a rack cabinet earns from its `unlockTier`. */
function cabinetTrim(g: Graphics, v: RackVariant, d: ReturnType<typeof cabinetDetail>, cx: number, y: number): void {
	const liquid = v === "dlc" || v === "immersion";
	if (d.cornice) {
		px(g, cx + 2, y + 1, CAB_W - 4, 1, BRASS.mid);
		for (let k = cx + 3; k < cx + CAB_W - 3; k += 2) px(g, k, y + 1, 1, 1, BRASS.hi);
	}
	if (d.pilasters) {
		px(g, cx + 1, y + 6, 1, 20, BRASS.mid);
		if (!liquid) px(g, cx + CAB_W - 2, y + 6, 1, 20, BRASS.mid);
		for (let k = y + 8; k < y + 25; k += 4) {
			px(g, cx + 1, k, 1, 1, BRASS.hi);
			if (!liquid) px(g, cx + CAB_W - 2, k, 1, 1, BRASS.hi);
		}
	}
	if (d.gauge) {
		if (liquid) {
			// Brass collars on the manifold.
			for (const cy of [y + 5, y + 21]) {
				px(g, cx + 10, cy, 5, 2, BRASS.mid);
				px(g, cx + 10, cy, 5, 1, BRASS.hi);
			}
		} else {
			// 3×3 pressure gauge in the side column (air) or beside the CRT (storage).
			const gy = v === "storage" ? y + 7 : y + 13;
			px(g, cx + 11, gy, 3, 3, BRASS.mid);
			px(g, cx + 12, gy + 1, 1, 1, PAPER.hi);
			px(g, cx + 11, gy, 1, 1, BRASS.hi);
			px(g, cx + 13, gy, 1, 1, T.red);
		}
	}
	if (d.hopper) {
		// Punch-card hopper on the cabinet top: brass cheeks around a stack of cards with punched holes.
		px(g, cx + 9, y - 1, 5, 1, BRASS.lo);
		px(g, cx + 9, y - 3, 1, 2, BRASS.mid);
		px(g, cx + 13, y - 3, 1, 2, BRASS.mid);
		px(g, cx + 10, y - 2, 3, 1, PAPER.lo);
		px(g, cx + 10, y - 3, 3, 1, PAPER.hi);
		px(g, cx + 11, y - 3, 1, 1, dk(T.paper, 0.5));
	}
	if (d.crest) {
		// Brass Ministry crest above the cabinet.
		px(g, cx + 6, y - 4, 3, 1, BRASS.hi);
		px(g, cx + 5, y - 3, 5, 2, BRASS.mid);
		px(g, cx + 6, y - 1, 3, 1, BRASS.lo);
		px(g, cx + 7, y - 3, 1, 1, T.ink);
		px(g, cx + 7, y - 2, 1, 1, T.red);
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
export function drawLive(g: Graphics, def: FacilityDef, f: FacilityView, x: number, top: number, t: number, opt: RenderOptions, labels?: TextPool): void {
	const y = top + FAC_TOP;
	const W = def.width * TILE;
	const active = isActive(f.status, f.enabled);
	const c = hex(def.color);
	const calm = opt.reducedMotion;
	switch (def.kind) {
		case "rack":
			rackLive(g, def, f, x, y, t, opt);
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
	drawBadge(g, f, x + W / 2, top + 1, t, calm);
}

function crate(g: Graphics, x: number, y: number): void {
	px(g, x, y, 5, 5, CRATE.lo);
	px(g, x, y, 5, 1, CRATE.hi);
	px(g, x, y + 1, 4, 3, CRATE.mid);
	px(g, x + 1, y + 2, 2, 1, CRATE.stamp);
}

function rackLive(g: Graphics, def: FacilityDef, f: FacilityView, x: number, y: number, t: number, opt: RenderOptions): void {
	const v = rackVariant(def);
	const calm = opt.reducedMotion;
	const cue = ledCue(f.status, f.enabled, opt.colorBlind);
	const slot = Math.floor(t * 6);
	// Blinking lamps hold lit under reduced motion (steady colour, no blink).
	const blinkOn = calm || Math.floor(t * 2.5) % 2 === 0;
	// CRT phosphor by health tone; the CRT flicker stops under reduced motion or with CRT effects off.
	const ph = cue.mode === "off" ? null : phosphorFor(cue.tone, opt.colorBlind);
	const steady = calm || !opt.crtEffects;
	const glyph = cue.mode === "off" ? null : crtGlyph(f.status);
	const speed = f.status === "ok" ? 5 : f.status === "idle" ? 0.6 : cue.tone === "fault" ? 0 : 2.5;
	const level = f.status === "idle" ? 0.25 : cue.tone === "fault" ? (blinkOn ? 1 : 0.15) : 0.35 + 0.65 * Math.max(0.2, f.clock);
	const active = isActive(f.status, f.enabled);
	for (let i = 0; i < def.width; i++) {
		const cx = x + i * TILE + 1;
		if (ph) {
			crt(g, cx + CRT_X, y + CRT_Y, CRT_W, CRT_H, ph[0], ph[1], level, t, f.id * 8 + i, speed, true, steady);
			if (glyph) glyph3(g, cx + CRT_X + 2, y + CRT_Y + 1, CRT_GLYPHS[glyph], ph[0]);
		}
		const lampOn = (l: number): boolean =>
			cue.mode === "off"
				? false
				: cue.mode === "blink"
					? blinkOn
					: cue.mode === "steady"
						? l === 0
						: calm || flicker(f.id, i * 8 + l, slot + l) < 0.3 + f.clock * 0.55;
		if (v === "storage") {
			[14, 18, 22].forEach((ly, l) => {
				lamp(g, cx + 11, y + ly, l === 2 && cue.mode === "activity" ? cue.accent : cue.color, lampOn(l));
			});
			// Spinning tape reels.
			const ang = active && !calm ? t * (f.status === "idle" ? 1.2 : 5) * (i ? 1 : -0.8) : 0;
			for (const [k, ry] of [y + 14, y + 20].entries()) {
				// Flange rim, wound tape (more on the supply reel), hub with a rotating notch.
				ring(g, cx + 3, ry, 6, STEEL.mid, TAPE);
				if (k === 1) px(g, cx + 4, ry + 2, 4, 2, dk(T.housing, 0.2));
				const a = ang + k;
				px(g, Math.floor(cx + 6 + Math.cos(a) * 2), Math.floor(ry + 3 + Math.sin(a) * 2), 1, 1, STEEL.hi);
				px(g, cx + 5, ry + 2, 2, 2, STEEL.hi);
				px(g, cx + 6, ry + 3, 1, 1, T.ink);
			}
			px(g, cx + 9, y + 16, 1, 8, TAPE);
		} else {
			[3, 6, 9].forEach((lx, l) => {
				lamp(g, cx + lx, y + LAMP_Y, cue.color, lampOn(l));
			});
			if (v === "immersion") {
				// Bubbling fluid: more bubbles under load, none when dark; held at fixed positions under reduced motion.
				const n = !f.enabled || cue.mode === "off" ? 0 : active ? 5 : 2;
				tankBubbles(g, cx, y, hex(def.accent), f.id * 8 + i, n, t, !calm && active);
			}
			// Punch card feeding through the slot.
			const feed = active && !calm && f.jobId !== null ? Math.floor(t * 1.5 + i) % 3 : 0;
			const kx = cx + 4 + ((f.id + i) % 3);
			px(g, kx, y + 24 + feed, 3, 2 - Math.min(1, feed), PAPER.mid);
			px(g, kx + 1, y + 24 + feed, 1, 1, dk(T.paper, 0.5));
		}
	}
}

/** Status tag (wrench / crossed drop / crossed bolt) hanging above the facility. */
function drawBadge(g: Graphics, f: FacilityView, cx: number, y: number, t: number, calm: boolean): void {
	const b = badgeFor(f.status);
	if (!b) return;
	if (!calm && Math.floor(t * 2) % 3 === 2) return; // gentle blink, held steady under reduced motion
	const x = Math.round(cx) - 5;
	const face = b === "wrench" ? T.amber : b === "noCoolant" ? T.verdigris : T.paper;
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

