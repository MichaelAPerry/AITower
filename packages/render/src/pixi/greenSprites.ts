/**
 * Own sprites of the Green tree (docs/TREES.md section 7, docs/STYLE_PC98.md): the four tree racks (NM-1 and NM-2
 * neuromorphic, PH-1 and PH-2 photonic) and the support items that used to borrow a base body (economizer, adiabatic unit and
 * chiller, hydrogen fuel cell, iron-air store, geothermal well, Bea's microgrid).
 *
 * Same rules as the rest of the world art: only axis-aligned rects, a 1 px dark outline (`bevel`), a light rim top-left, a shadow
 * bottom-right, every colour a token or a shade of one. Green is the `--tree-green` leaf trim (`TREE`); the photonic racks add
 * white / cyan glass and light. Rack sprites draw only the door interior of a 15 px cabinet (the shell, status strip and kick
 * plate stay the shared ones in `facilityArt.ts`), so tiers, proportions and status read exactly like AC-1 / LC-2.
 *
 * Static parts go into the cached body; the `*Live` functions run every frame and only blink, spin or slide a few rects
 * (module constants and arithmetic only: no allocation per frame).
 * Coordinates: support sprites take `x` = left edge, `y` = top of the body (`top + FAC_TOP`), `W` = width in px, and stay inside
 * x..x+W, y..y+H (31 rows). Racks take `cx` = cabinet left edge (tile x + 1), `y` = body top.
 */
import type { Graphics } from "pixi.js";
import type { GreenSprite } from "../art";
import { BRASS, PAPER, STEEL, T, TREE_GREEN, dk, lt, mat, mix } from "../palette";
import { bevel, dialFace, dither, fanBlades, hash, lamp, needle, px, ring, valveWheel } from "./draw";
import { solarGlow } from "../green";

const HOUSING = mat(T.housing);
/** The Green tree's leaf-green ramp. */
export const TREE = mat(TREE_GREEN);

/** Cabinet shell (the rack enamel colour) of each Green rack: graphite with a leaf cast, the photonic ones paler and bluer. */
export const greenShell = (s: GreenSprite): number => (s === "ph1" || s === "ph2" ? mix(T.putty, T.brass, 0.18) : mix(T.putty, T.greenDim, 0.42));

export const isGreenRack = (s: GreenSprite | null): s is "nm1" | "nm2" | "ph1" | "ph2" => s === "nm1" || s === "nm2" || s === "ph1" || s === "ph2";

// ─── Palette of the sprites (all derived from tokens) ──────────────────
const CHIP = mix(T.steel, T.ink, 0.45);
const CHIP_ALT = dk(CHIP, 0.3);
const CHIP_HI = lt(CHIP, 0.28);
const TRACE = dk(TREE.mid, 0.6);
const GLASS_P = mix(T.housingHi, T.brass, 0.2);
const BEAM = mix(GLASS_P, T.paper, 0.55);
const SHELL = mat(mix(T.putty, T.greenDim, 0.38));
const WHITE = mat(mix(T.paper, T.steel, 0.65));
const BLUE = mat(mix(T.paper, T.brass, 0.45));
const PAD = mat(mix(T.sodium, T.brass, 0.4));
const WATER = lt(T.brass, 0.35);
const RUST = mat(dk(mix(T.amber, T.red, 0.5), 0.28));
const LAG = mat(mix(T.sodium, T.steel, 0.35));
const ROCK = dk(mix(T.amberDim, T.steel, 0.3), 0.3);

/** 4×3 leaf glyph in leaf green (the Green mark), top-left at (x, y). */
function leaf(g: Graphics, x: number, y: number, a = 1): void {
	px(g, x + 2, y, 2, 1, TREE.hi, a);
	px(g, x + 1, y + 1, 3, 1, TREE.mid, a);
	px(g, x, y + 2, 2, 1, TREE.lo, a);
	px(g, x + 2, y + 2, 1, 1, TREE.mid, a);
}

// ═══ Racks ═════════════════════════════════════════════════════════════
// Door interior of a 15 px cabinet: 8 × 22 px at (cx + 5, y + 4); the shared door frame, status strip and kick plate are drawn by the caller.
const DX = 5;
const DY = 4;
const DW = 8;

/** NM-1 chip mesh: 3 columns × 6 rows of 2×2 chips, 1 px apart. NM-2: 4 columns × 7 rows, edge to edge in a checker, traces between rows. */
const NM1_COLS = 3;
const NM1_ROWS = 6;
const NM2_COLS = 4;
const NM2_ROWS = 7;

/** Static door interior of a Green rack cabinet. `i` = cabinet index. */
export function rackDoorStatic(g: Graphics, s: "nm1" | "nm2" | "ph1" | "ph2", cx: number, y: number, i: number): void {
	const x0 = cx + DX;
	const y0 = y + DY;
	px(g, cx + 5, y + 2, 7, 1, TREE.mid); // leaf-green accent line at the head of the door
	if (s === "nm1") {
		for (let r = 0; r < NM1_ROWS; r++) {
			px(g, x0, y0 + 1 + r * 3 + 2, DW, 1, TRACE, 0.5);
			for (let q = 0; q < NM1_COLS; q++) {
				const cxp = x0 + q * 3;
				const cyp = y0 + 1 + r * 3;
				px(g, cxp, cyp, 2, 2, CHIP);
				px(g, cxp, cyp, 1, 1, CHIP_HI);
				if (q < NM1_COLS - 1) px(g, cxp + 2, cyp + 1, 1, 1, TRACE);
			}
		}
		leaf(g, x0 + 2, y0 + 19);
	} else if (s === "nm2") {
		for (let r = 0; r < NM2_ROWS; r++) {
			px(g, x0, y0 + r * 3 + 2, DW, 1, TRACE, 0.7);
			for (let q = 0; q < NM2_COLS; q++) {
				const cxp = x0 + q * 2;
				const cyp = y0 + r * 3;
				px(g, cxp, cyp, 2, 2, (q + r) & 1 ? CHIP_ALT : CHIP);
				px(g, cxp, cyp, 1, 1, CHIP_HI);
			}
		}
		// Leaf-green frame down the right edge of the array and a leaf pip.
		px(g, x0 + DW - 1, y0 + 21, 1, 1, TREE.mid);
		px(g, x0, y0 + 21, 2, 1, TREE.lo);
	} else if (s === "ph1") {
		px(g, x0, y0, DW, 22, GLASS_P);
		px(g, x0, y0, DW, 1, lt(GLASS_P, 0.3));
		px(g, x0, y0, 1, 22, lt(GLASS_P, 0.18));
		for (let k = 0; k < 5; k++) px(g, x0 + 6 - k, y0 + 1 + k, 1, 1, PAPER.hi, 0.35); // glass glint
		for (const by of PH_BEAMS) {
			px(g, x0 + 1, y0 + by - 1, DW - 2, 3, T.brass, 0.12);
			px(g, x0 + 1, y0 + by, DW - 2, 1, BEAM);
			px(g, x0, y0 + by - 1, 1, 3, T.brass, 0.55); // emitter
			px(g, x0, y0 + by, 1, 1, PAPER.hi);
			px(g, x0 + DW - 1, y0 + by - 1, 1, 3, T.brass, 0.55); // detector
			px(g, x0 + DW - 1, y0 + by, 1, 1, BRASS.hi);
		}
		leaf(g, x0 + 2, y0 + 19);
	} else {
		px(g, x0, y0, DW, 22, GLASS_P);
		px(g, x0, y0, DW, 1, lt(GLASS_P, 0.3));
		px(g, x0, y0, 1, 22, lt(GLASS_P, 0.18));
		// Woven fabric: two families of diagonal threads crossing every 8 rows, a bright node at each crossing, a weft beam through each node.
		for (let r = 0; r < 20; r++) {
			const k = r & 7;
			px(g, x0 + k, y0 + 1 + r, 1, 1, T.brass, 0.6);
			px(g, x0 + 7 - k, y0 + 1 + r, 1, 1, PAPER.mid, 0.5);
		}
		for (const ny of PH2_NODES) {
			px(g, x0 + 1, y0 + ny + 1, DW - 2, 1, BEAM);
			px(g, x0 + 3, y0 + ny, 2, 2, PAPER.hi);
		}
		if (i === 0) px(g, x0, y0 + 21, 3, 1, TREE.mid);
	}
}

const PH_BEAMS = [5, 11, 17] as const;
const PH2_NODES = [3, 11, 19] as const;

/** Beams of a photonic fabric threading through the 1 px gaps between cabinets (PH-2): static dim weft. */
export function rackSpansStatic(g: Graphics, s: "nm1" | "nm2" | "ph1" | "ph2", x: number, y: number, n: number): void {
	if (s !== "ph2") return;
	for (let i = 0; i < n - 1; i++) {
		const cx = x + i * 16 + 1;
		for (const ny of PH2_NODES) px(g, cx + DX + DW, y + DY + ny + 1, 16 - DW + 0, 1, BEAM);
	}
}

/**
 * Live blink of one cabinet's door. `p` = share of lit chips / strength 0..1 (from the rack's clock; 0 when idle), `on` = powered.
 * `calm` (reduced motion) freezes the pattern; lamps stay lit.
 */
export function rackDoorLive(g: Graphics, s: "nm1" | "nm2" | "ph1" | "ph2", cx: number, y: number, seed: number, t: number, calm: boolean, on: boolean, p: number): void {
	if (!on) return;
	const x0 = cx + DX;
	const y0 = y + DY;
	if (s === "nm1") {
		// Small chips blink steadily and out of step: about a third lit while busy.
		const lit = 0.1 + 0.4 * p;
		for (let r = 0; r < NM1_ROWS; r++)
			for (let q = 0; q < NM1_COLS; q++) {
				const k = r * 3 + q;
				const slot = calm ? 0 : Math.floor(t * 2.6 + hash(seed, k) * 5);
				if (hash(seed * 31 + k, slot) < lit) {
					px(g, x0 + q * 3, y0 + 1 + r * 3, 2, 2, TREE.mid);
					px(g, x0 + q * 3, y0 + 1 + r * 3, 1, 1, TREE.hi);
				}
			}
	} else if (s === "nm2") {
		// Sparse event lights: most of the mesh stays dark, a few chips fire a bright spike that lights the trace under it.
		const lit = 0.03 + 0.07 * p;
		for (let r = 0; r < NM2_ROWS; r++)
			for (let q = 0; q < NM2_COLS; q++) {
				const k = r * 4 + q;
				const slot = calm ? 0 : Math.floor(t * 7 + hash(seed, k) * 3);
				if (hash(seed * 37 + k, slot) < lit) {
					px(g, x0 + q * 2, y0 + r * 3, 2, 2, PAPER.hi);
					px(g, x0 + q * 2, y0 + r * 3, 1, 1, TREE.hi);
					px(g, x0 + q * 2, y0 + r * 3 + 2, 2, 1, TREE.hi);
				} else if (calm && hash(seed * 41 + k, 1) < 0.12) {
					px(g, x0 + q * 2, y0 + r * 3, 1, 1, TREE.mid);
				}
			}
	} else if (s === "ph1") {
		// A photon (bright dash with a glow) runs along each beam; the beams breathe.
		for (let b = 0; b < 3; b++) {
			const by = y0 + PH_BEAMS[b];
			const u = calm ? 0.5 : (t * (0.55 + 0.4 * p) + b * 0.33 + hash(seed, b) * 0.2) % 1;
			const bx = x0 + 1 + Math.floor(u * (DW - 4));
			px(g, bx, by - 1, 3, 3, T.brass, 0.2);
			px(g, bx, by, 3, 1, PAPER.hi);
			px(g, x0 + 1, by, DW - 2, 1, T.brass, calm ? 0.35 : 0.18 + 0.22 * (0.5 + 0.5 * Math.sin(t * 2.2 + b * 2)));
		}
	} else {
		// Nodes of the fabric shimmer in a wave that travels along the cabinet (the rack-wide wave is in `rackSpansLive`).
		for (let k = 0; k < 3; k++) {
			const w = calm ? 0.6 : 0.5 + 0.5 * Math.sin(t * 2.6 - (seed * 3 + k) * 0.9);
			const ny = y0 + PH2_NODES[k];
			px(g, x0 + 2, ny - 1, 4, 4, T.brass, 0.12 + 0.18 * w);
			px(g, x0 + 3, ny, 2, 2, PAPER.hi, 0.5 + 0.5 * w);
		}
	}
}

/** PH-2: bright dashes run along the weft beams across the whole rack, over the gaps between cabinets. */
export function rackSpansLive(g: Graphics, s: "nm1" | "nm2" | "ph1" | "ph2", x: number, y: number, n: number, seed: number, t: number, calm: boolean, on: boolean, p: number): void {
	if (s !== "ph2" || !on) return;
	const span = n * 16 - 6;
	for (let b = 0; b < 3; b++) {
		const u = calm ? (b + 0.5) / 3 : (t * (0.18 + 0.2 * p) + b * 0.31 + hash(seed, b + 9) * 0.1) % 1;
		const bx = x + 3 + Math.floor(u * span);
		const by = y + DY + PH2_NODES[b] + 1;
		px(g, bx, by - 1, 4, 3, T.brass, 0.22);
		px(g, bx, by, 4, 1, PAPER.hi);
	}
}

// ═══ Support items ═════════════════════════════════════════════════════

/** Cage wires drawn over spinning blades. */
function cage(g: Graphics, fx: number, fy: number, d: number): void {
	const m = Math.floor(d / 2);
	px(g, fx + m, fy + 1, 1, d - 2, STEEL.mid, 0.55);
	px(g, fx + 1, fy + m, d - 2, 1, STEEL.mid, 0.55);
}

/** Louvre bank with a leaf-green frame: `n` slats 3 px apart. */
function louvreBank(g: Graphics, x: number, y: number, w: number, h: number, c: ReturnType<typeof mat>): void {
	px(g, x, y, w, h, TREE.line);
	px(g, x + 1, y + 1, w - 2, h - 2, c.dk);
	for (let ly = y + 2; ly < y + h - 2; ly += 3) {
		px(g, x + 1, ly, w - 2, 1, c.hi);
		px(g, x + 1, ly + 1, w - 2, 1, c.mid);
	}
}

function econBody(g: Graphics, x: number, y: number, W: number): void {
	bevel(g, x + 1, y + 4, W - 2, 23, SHELL);
	px(g, x + 2, y + 3, W - 4, 1, TREE.mid); // rain-hood rail
	px(g, x + 2, y + 4, W - 4, 1, TREE.lo);
	px(g, x + 3, y + 27, 3, 3, HOUSING.line);
	px(g, x + W - 6, y + 27, 3, 3, HOUSING.line);
	px(g, x + 2, y + 27, W - 4, 1, HOUSING.mid);
	// Louvred damper bank (outside air in) under a hood.
	px(g, x + 3, y + 6, 21, 2, TREE.dk);
	px(g, x + 3, y + 6, 21, 1, TREE.mid);
	louvreBank(g, x + 4, y + 8, 19, 17, STEEL);
	// Fan cage and its backing plate.
	ring(g, x + 28, y + 7, 13, STEEL.line, dk(T.housing, 0.4));
	// Actuator, plate with the leaf mark.
	px(g, x + 28, y + 22, 13, 3, HOUSING.line);
	px(g, x + 29, y + 23, 5, 1, TREE.lo);
	px(g, x + 43, y + 7, 4, 4, HOUSING.line);
	leaf(g, x + 43, y + 8);
	px(g, x + 43, y + 20, 4, 5, HOUSING.line);
}

function econLive(g: Graphics, x: number, y: number, s: SupportLive): void {
	const spin = s.usable && !s.calm;
	fanBlades(g, x + 29, y + 8, 11, spin ? s.t * (6 + 10 * s.load) : 0.5, lt(T.steel, 0.35));
	cage(g, x + 28, y + 7, 13);
	// Chevrons of outside air slide in through the louvres.
	if (s.usable) {
		for (let k = 0; k < 2; k++) {
			const u = s.calm ? 0.25 + 0.5 * k : (s.t * 0.45 + k * 0.5) % 1;
			const cx = x + 5 + Math.floor(u * 14);
			const a = 0.9 * Math.min(1, u * 5, (1 - u) * 5);
			for (const [dx, dy] of CHEVRON) px(g, cx + dx, y + 13 + dy + k * 5, 1, 1, TREE.hi, a);
		}
	}
	lamp(g, x + 43, y + 21, s.usable ? T.green : T.amber, true, 0.25);
}

/** A 3×5 chevron ">" as pixel offsets. */
const CHEVRON: readonly (readonly [number, number])[] = [[0, 0], [1, 1], [2, 2], [1, 3], [0, 4]];

function adiabaticBody(g: Graphics, x: number, y: number, W: number): void {
	bevel(g, x + 1, y + 4, W - 2, 23, SHELL);
	px(g, x + 2, y + 3, W - 4, 1, TREE.mid);
	px(g, x + 3, y + 27, 3, 3, HOUSING.line);
	px(g, x + W - 6, y + 27, 3, 3, HOUSING.line);
	px(g, x + 2, y + 27, W - 4, 1, HOUSING.mid);
	// Wet pad: corrugated cellulose behind a leaf frame, a water trough with nozzles above, a sump below.
	px(g, x + 3, y + 8, 27, 18, TREE.line);
	for (let xx = x + 4; xx < x + 29; xx++) px(g, xx, y + 10, 1, 14, (xx - x) & 1 ? PAD.mid : PAD.lo);
	px(g, x + 4, y + 10, 25, 1, PAD.hi);
	px(g, x + 3, y + 6, 27, 2, BRASS.lo);
	for (let xx = x + 5; xx < x + 29; xx += 4) px(g, xx, y + 8, 1, 1, WATER);
	px(g, x + 4, y + 24, 25, 2, dk(T.brass, 0.5));
	px(g, x + 4, y + 24, 25, 1, T.brass, 0.5);
	// Return pipe from the sump up to the trough.
	px(g, x + 30, y + 6, 2, 20, BRASS.lo);
	px(g, x + 30, y + 6, 1, 20, BRASS.hi);
	// Two fan cages, a dial and the pump housing.
	for (const fx of [x + 34, x + 48]) ring(g, fx, y + 6, 13, STEEL.line, dk(T.housing, 0.4));
	dialFace(g, x + 36, y + 21, 5);
	px(g, x + 43, y + 22, 5, 3, HOUSING.line);
	px(g, x + 44, y + 23, 3, 1, TREE.mid);
	px(g, x + 50, y + 21, 10, 5, HOUSING.line);
	px(g, x + 51, y + 22, 8, 1, STEEL.mid);
	leaf(g, x + 54, y + 23);
}

function adiabaticLive(g: Graphics, x: number, y: number, s: SupportLive): void {
	const spin = s.usable && !s.calm;
	for (let k = 0; k < 2; k++) {
		const fx = x + 35 + k * 14;
		fanBlades(g, fx, y + 7, 11, spin ? s.t * (7 + 9 * s.load) : 0.4 + k, lt(T.steel, 0.35));
		cage(g, fx - 1, y + 6, 13);
	}
	if (s.usable) {
		// Water trickles down the pad and mist rises off the trough.
		for (let k = 0; k < 7; k++) {
			const u = s.calm ? hash(s.id, k + 20) : (s.t * 0.55 + hash(s.id, k)) % 1;
			px(g, x + 5 + Math.floor(hash(s.id, k + 8) * 24), y + 9 + Math.floor(u * 14), 1, 1, WATER, 0.85 * (1 - u * 0.5));
		}
		dither(g, x + 3, y + 1, 27, 5, T.paper, s.calm ? 0.12 : 0.1 + 0.08 * Math.sin(s.t * 1.7), 1, s.calm ? 0 : Math.floor(s.t * 2) & 1);
		for (let k = 0; k < 4; k++) {
			const u = s.calm ? hash(s.id, k + 30) : (s.t * 0.4 + hash(s.id, k + 3)) % 1;
			px(g, x + 6 + Math.floor(hash(s.id, k + 12) * 22), y + 6 - Math.round(u * 6), 1, 1, T.paper, 0.7 * (1 - u));
		}
	}
	lamp(g, x + 43, y + 17, s.usable ? T.green : T.amber, true, 0.2);
}

/** Modules per half of the adiabatic chiller and the left edge of module `k` (the right half starts after the control post). */
const MODS = 2;
const modX = (x: number, W: number, k: number): number => x + 3 + (k % MODS) * 30 + (k >= MODS ? Math.floor(W / 2) : 0);

function chillerBody(g: Graphics, x: number, y: number, W: number): void {
	bevel(g, x + 1, y + 3, W - 2, 25, WHITE);
	px(g, x + 2, y + 2, W - 4, 1, TREE.mid);
	px(g, x + 2, y + 28, W - 4, 2, HOUSING.line);
	for (let sx = x + 6; sx < x + W - 8; sx += 20) px(g, sx, y + 28, 4, 3, HOUSING.mid);
	// Two modules, a control post, two modules.
	for (let k = 0; k < MODS * 2; k++) module(g, modX(x, W, k), y);
	// Control post in the middle: dial, lamps and a leaf plate.
	const cxp = x + Math.floor(W / 2) - 3;
	px(g, cxp, y + 3, 6, 25, WHITE.lo);
	px(g, cxp, y + 3, 1, 25, WHITE.mid);
	dialFace(g, cxp, y + 8, 5);
	px(g, cxp + 1, y + 16, 4, 1, TREE.mid);
	leaf(g, cxp + 1, y + 19);
	// Pipe manifold along the foot with valves.
	px(g, x + 3, y + 25, W - 6, 1, BRASS.hi);
	px(g, x + 3, y + 26, W - 6, 1, BRASS.lo);
	for (let vx = x + 20; vx < x + W - 12; vx += 30) valveWheel(g, vx, y + 22, 0);
}

/** One 27 px cooling module of the adiabatic chiller: fan well on top, wet pad band, fin bank. */
function module(g: Graphics, mx: number, y: number): void {
	px(g, mx, y + 4, 27, 20, WHITE.line);
	px(g, mx + 1, y + 5, 25, 18, WHITE.lo);
	ring(g, mx + 7, y + 5, 13, STEEL.line, dk(T.housing, 0.45));
	px(g, mx + 1, y + 19, 25, 3, PAD.mid);
	px(g, mx + 1, y + 19, 25, 1, PAD.hi);
	for (let xx = mx + 1; xx < mx + 26; xx += 2) px(g, xx, y + 20, 1, 2, PAD.lo);
	for (let xx = mx + 1; xx < mx + 26; xx += 2) px(g, xx, y + 22, 1, 1, STEEL.hi);
	px(g, mx, y + 3, 27, 1, TREE.lo);
}

function chillerLive(g: Graphics, x: number, y: number, W: number, s: SupportLive): void {
	const spin = s.usable && !s.calm;
	for (let k = 0; k < MODS * 2; k++) {
		const mx = modX(x, W, k);
		fanBlades(g, mx + 8, y + 6, 11, spin ? s.t * (6 + 9 * s.load) + k : 0.3 + k * 0.7, lt(T.steel, 0.35));
		cage(g, mx + 7, y + 5, 13);
		if (s.usable) {
			// Mist drifting off the wet pad.
			dither(g, mx + 1, y + 17, 25, 3, WATER, s.calm ? 0.18 : 0.12 + 0.1 * Math.sin(s.t * 1.9 + k), 1, s.calm ? 0 : Math.floor(s.t * 2.5 + k) & 1);
			for (let j = 0; j < 2; j++) {
				const u = s.calm ? hash(s.id, k * 3 + j) : (s.t * 0.35 + hash(s.id, k * 3 + j)) % 1;
				px(g, mx + 3 + Math.floor(hash(s.id, k * 5 + j + 40) * 21), y + 19 - Math.round(u * 4), 1, 1, T.paper, 0.65 * (1 - u));
			}
		}
	}
	const cxp = x + Math.floor(W / 2) - 3;
	needle(g, cxp, y + 8, 5, s.usable ? s.load : 0);
	lamp(g, cxp + 2, y + 5, s.usable ? (s.load > 0.9 ? T.red : T.green) : T.amber, true, 0.22);
}

function fuelCellBody(g: Graphics, x: number, y: number): void {
	bevel(g, x + 1, y + 3, 30, 24, BLUE);
	px(g, x + 2, y + 2, 28, 1, TREE.mid);
	px(g, x + 3, y + 27, 3, 3, HOUSING.line);
	px(g, x + 26, y + 27, 3, 3, HOUSING.line);
	px(g, x + 2, y + 27, 28, 1, HOUSING.mid);
	// Stack window: seven cell plates.
	px(g, x + 3, y + 6, 17, 17, HOUSING.line);
	px(g, x + 4, y + 7, 15, 15, dk(T.housing, 0.3));
	for (let k = 0; k < 7; k++) px(g, x + 5 + k * 2, y + 8, 1, 13, dk(T.steel, 0.2));
	// H2 plate and gauge.
	px(g, x + 21, y + 6, 8, 9, HOUSING.line);
	px(g, x + 22, y + 7, 6, 7, dk(T.housing, 0.15));
	// "H2" in 2 x 5 glyphs.
	px(g, x + 22, y + 8, 1, 5, PAPER.mid);
	px(g, x + 24, y + 8, 1, 5, PAPER.mid);
	px(g, x + 23, y + 10, 1, 1, PAPER.mid);
	px(g, x + 26, y + 8, 2, 1, PAPER.mid);
	px(g, x + 27, y + 9, 1, 1, PAPER.mid);
	px(g, x + 26, y + 10, 2, 1, PAPER.mid);
	px(g, x + 26, y + 11, 1, 1, PAPER.mid);
	px(g, x + 26, y + 12, 2, 1, PAPER.mid);
	dialFace(g, x + 21, y + 17, 5);
	leaf(g, x + 24, y + 24);
	// Exhaust stub on top.
	px(g, x + 23, y + 0, 5, 2, HOUSING.line);
	px(g, x + 24, y + 0, 3, 1, STEEL.hi);
	// Cylinder bank: five tanks with domed shoulders, a green band, straps and a header pipe.
	px(g, x + 32, y + 4, 30, 2, BRASS.lo);
	px(g, x + 32, y + 4, 30, 1, BRASS.hi);
	for (let k = 0; k < 5; k++) {
		const cx = x + 33 + k * 6;
		px(g, cx + 1, y + 6, 3, 1, BLUE.line);
		px(g, cx + 1, y + 6, 3, 2, BLUE.line);
		px(g, cx + 2, y + 6, 1, 1, STEEL.hi);
		px(g, cx, y + 8, 5, 19, BLUE.line);
		px(g, cx + 1, y + 8, 3, 18, BLUE.mid);
		px(g, cx + 1, y + 8, 1, 18, BLUE.hi);
		px(g, cx + 3, y + 9, 1, 17, BLUE.lo);
		px(g, cx + 1, y + 14, 3, 2, TREE.mid);
		px(g, cx + 1, y + 14, 3, 1, TREE.hi);
	}
	px(g, x + 31, y + 12, 31, 1, STEEL.dk);
	px(g, x + 31, y + 22, 31, 1, STEEL.dk);
	px(g, x + 31, y + 27, 31, 1, HOUSING.mid);
}

function fuelCellLive(g: Graphics, x: number, y: number, s: SupportLive): void {
	if (s.usable) {
		// A bright plate sweeps along the stack; exhaust vapour puffs from the stub.
		const k = s.calm ? 3 : Math.floor(s.t * 5) % 7;
		px(g, x + 5 + k * 2, y + 8, 1, 13, T.brass, 0.85);
		px(g, x + 5 + k * 2, y + 8, 1, 2, PAPER.hi);
		if (k > 0) px(g, x + 3 + k * 2, y + 8, 1, 13, T.brass, 0.25);
		for (let j = 0; j < 3; j++) {
			const u = s.calm ? 0.2 + 0.3 * j : (s.t * 0.5 + j / 3) % 1;
			px(g, x + 25 + Math.floor(Math.sin(u * 6 + j) * 1.4) + 1, y - 1 - Math.round(u * 2), 1, 1, T.paper, 0.6 * (1 - u));
		}
		needle(g, x + 21, y + 17, 5, 0.45 + 0.4 * s.load);
	}
	lamp(g, x + 4, y + 24, s.usable ? T.green : T.amber, true, 0.25);
}

function ironAirBody(g: Graphics, x: number, y: number, W: number): void {
	bevel(g, x + 1, y + 4, W - 2, 23, RUST);
	px(g, x + 2, y + 3, W - 4, 1, TREE.mid);
	px(g, x + 2, y + 27, W - 4, 3, HOUSING.line);
	for (let sx = x + 6; sx < x + W - 8; sx += 18) px(g, sx, y + 27, 6, 3, HOUSING.mid);
	// Container ribs.
	for (let xx = x + 3; xx < x + W - 4; xx += 3) {
		px(g, xx, y + 6, 1, 19, RUST.lo);
		px(g, xx + 1, y + 6, 1, 19, RUST.hi, 0.5);
	}
	// Left: two exhaust vents and a leaf plate.
	px(g, x + 6, y + 8, 18, 1, RUST.line);
	for (let k = 0; k < 2; k++) {
		px(g, x + 6, y + 10 + k * 7, 18, 5, HOUSING.line);
		for (let ly = y + 11 + k * 7; ly < y + 14 + k * 7; ly += 2) px(g, x + 7, ly, 16, 1, STEEL.dk);
	}
	px(g, x + 6, y + 24, 6, 1, RUST.line);
	leaf(g, x + 8, y + 20);
	// Centre: the battery icon (outline and nub; segments are live).
	px(g, x + 29, y + 9, 27, 13, T.ink, 0.5);
	px(g, x + 30, y + 10, 25, 11, PAPER.mid);
	px(g, x + 31, y + 11, 23, 9, HOUSING.line);
	px(g, x + 55, y + 13, 3, 5, PAPER.mid);
	px(g, x + 56, y + 14, 1, 3, HOUSING.line);
	px(g, x + 30, y + 10, 25, 1, PAPER.hi);
	// Right: three air valves (iron-air cells breathe) and a door with lock bars.
	for (let k = 0; k < 3; k++) ring(g, x + 62 + k * 7, y + 11, 6, RUST.line, dk(T.housing, 0.3));
	px(g, x + W - 9, y + 7, 6, 18, RUST.line);
	px(g, x + W - 8, y + 8, 4, 16, RUST.mid);
	px(g, x + W - 7, y + 8, 1, 16, RUST.hi);
	px(g, x + W - 5, y + 14, 3, 2, STEEL.mid);
	// Rust bloom at the foot.
	dither(g, x + 3, y + 22, W - 6, 4, RUST.dk, 0.35, 1, 0);
}

function ironAirLive(g: Graphics, x: number, y: number, s: SupportLive): void {
	const ch = Math.max(0, Math.min(1, s.charge));
	const lit = Math.max(s.usable && ch > 0.02 ? 1 : 0, Math.ceil(ch * 4 - 0.001));
	for (let k = 0; k < 4; k++) {
		const sx = x + 32 + k * 6;
		if (k < lit && s.usable) {
			const top = k === lit - 1 && !s.calm && s.charging;
			const a = top ? 0.5 + 0.5 * Math.sin(s.t * 4) : 1;
			px(g, sx, y + 12, 5, 7, k === 0 && ch < 0.3 ? T.amber : T.green, a);
			px(g, sx, y + 12, 5, 1, lt(T.green, 0.5), a);
		} else px(g, sx, y + 12, 5, 7, dk(T.housing, 0.1));
	}
	for (let k = 0; k < 3; k++) {
		if (!s.usable) continue;
		const w = s.calm ? 0.5 : 0.5 + 0.5 * Math.sin(s.t * 1.6 - k * 1.2);
		px(g, x + 64 + k * 7, y + 13, 2, 2, TREE.hi, 0.35 + 0.55 * w);
	}
	lamp(g, x + 8, y + 5, s.usable ? T.green : T.amber, true, 0.22);
}

function geothermalBody(g: Graphics, x: number, y: number): void {
	// Concrete pad over rock, with the bore going down under the wellhead.
	px(g, x + 1, y + 26, 62, 2, HOUSING.line);
	px(g, x + 2, y + 26, 60, 1, HOUSING.hi);
	dither(g, x + 2, y + 28, 60, 3, ROCK, 0.7, 1, 0);
	px(g, x + 9, y + 28, 5, 3, T.ink);
	// Wellhead: base flange, thick casing, a mid flange, the valve block with its master wheel, a gauge.
	bevel(g, x + 6, y + 23, 11, 3, STEEL);
	px(g, x + 9, y + 12, 5, 11, STEEL.line);
	px(g, x + 10, y + 12, 3, 11, STEEL.mid);
	px(g, x + 10, y + 12, 1, 11, STEEL.hi);
	px(g, x + 12, y + 12, 1, 11, STEEL.lo);
	bevel(g, x + 7, y + 17, 9, 3, STEEL);
	bevel(g, x + 7, y + 8, 9, 5, STEEL);
	px(g, x + 11, y + 6, 1, 2, STEEL.mid);
	valveWheel(g, x + 9, y + 1, 0);
	dialFace(g, x + 1, y + 10, 5);
	// Steam header: a lagged pipe from the wellhead into the separator vessel.
	px(g, x + 16, y + 8, 31, 6, LAG.line);
	px(g, x + 16, y + 9, 31, 1, LAG.hi);
	px(g, x + 16, y + 10, 31, 2, LAG.mid);
	px(g, x + 16, y + 12, 31, 1, LAG.lo);
	for (let xx = x + 20; xx < x + 46; xx += 5) px(g, xx, y + 8, 1, 6, LAG.dk);
	// Pump skid: motor with cooling fins and a leaf plate, coupling, pump casing and a riser to the header.
	px(g, x + 19, y + 25, 26, 1, HOUSING.mid);
	bevel(g, x + 20, y + 16, 12, 9, SHELL);
	for (let xx = x + 22; xx < x + 30; xx += 2) px(g, xx, y + 18, 1, 5, SHELL.lo);
	px(g, x + 23, y + 18, 6, 5, HOUSING.line);
	leaf(g, x + 24, y + 19);
	px(g, x + 32, y + 19, 3, 3, STEEL.line);
	px(g, x + 32, y + 19, 3, 1, STEEL.hi);
	bevel(g, x + 35, y + 15, 8, 10, STEEL);
	px(g, x + 37, y + 14, 3, 1, LAG.mid);
	px(g, x + 37, y + 13, 3, 1, LAG.line);
	// Separator vessel with a leaf band, a level window and the stack that vents the steam.
	bevel(g, x + 46, y + 9, 14, 17, LAG);
	px(g, x + 47, y + 15, 12, 1, TREE.mid);
	px(g, x + 49, y + 18, 6, 6, HOUSING.line);
	px(g, x + 50, y + 19, 4, 4, dk(T.housing, 0.15));
	px(g, x + 50, y + 3, 5, 6, LAG.line);
	px(g, x + 51, y + 3, 3, 6, LAG.mid);
	px(g, x + 51, y + 3, 1, 6, LAG.hi);
	px(g, x + 49, y + 2, 7, 1, STEEL.line);
}

function geothermalLive(g: Graphics, x: number, y: number, s: SupportLive): void {
	if (s.usable) {
		for (let j = 0; j < 5; j++) {
			const u = s.calm ? j / 5 : (s.t * 0.45 + j / 5) % 1;
			const sway = s.calm ? 0 : Math.sin(s.t * 1.3 + j * 1.7) * 1.2;
			const r = 1 + Math.floor(u * 3);
			px(g, x + 51 + Math.round(sway) + Math.floor(u * 2), y + 1 - Math.round(u * 4), r, 1 + (u > 0.5 ? 1 : 0), T.paper, 0.6 * (1 - u * 0.6));
		}
		px(g, x + 32, y + 19 + (s.calm ? 0 : Math.floor(s.t * 14) & 1), 3, 1, PAPER.hi, 0.7); // coupling shimmer
		needle(g, x + 1, y + 10, 5, 0.55 + 0.3 * s.load);
		px(g, x + 50 + (s.calm ? 0 : Math.floor(s.t * 3) % 3), y + 20, 1, 2, T.brass, 0.8); // level
	}
	lamp(g, x + 30, y + 13, s.usable ? T.green : T.amber, true, 0.25);
}

function microgridBody(g: Graphics, x: number, y: number, W: number): void {
	// Panel: two rows of cells in a leaf-trimmed frame, on top of the cabinet.
	px(g, x + 1, y + 1, W - 2, 17, TREE.line);
	px(g, x + 2, y + 2, W - 4, 15, dk(T.putty, 0.4));
	for (let r = 0; r < 2; r++)
		for (let c = 0; c < 6; c++) {
			const qx = x + 3 + c * 10;
			const qy = y + 3 + r * 7;
			px(g, qx, qy, 9, 6, PVM.line);
			px(g, qx, qy, 8, 5, PVM.lo);
			px(g, qx + 2, qy + 1, 1, 3, PVM.mid, 0.6);
			px(g, qx + 5, qy + 1, 1, 3, PVM.mid, 0.6);
			px(g, qx, qy, 8, 1, PVM.mid);
		}
	// Cabinet with a leaf-bolt badge between two vented doors.
	bevel(g, x + 4, y + 18, W - 8, 10, SHELL);
	px(g, x + 3, y + 28, W - 6, 2, HOUSING.line);
	for (const dx of [x + 7, x + W - 25]) {
		for (let ly = y + 21; ly < y + 26; ly += 2) px(g, dx, ly, 18, 1, HOUSING.line);
	}
	const bx = x + Math.floor(W / 2) - 4;
	px(g, bx - 1, y + 17, 10, 1, TREE.line);
	ring(g, bx, y + 18, 9, TREE.line, TREE.mid);
	px(g, bx + 1, y + 19, 7, 1, TREE.hi, 0.7);
	// Leaf-bolt: a bolt zigzag cut out of the leaf.
	px(g, bx + 4, y + 19, 2, 1, T.ink);
	px(g, bx + 3, y + 20, 2, 1, T.ink);
	px(g, bx + 3, y + 21, 3, 1, T.ink);
	px(g, bx + 4, y + 22, 2, 1, T.ink);
	px(g, bx + 3, y + 23, 2, 1, T.ink);
}

const PVM = mat(dk(mix(T.verdigris, T.accent2, 0.3), 0.5));

function microgridLive(g: Graphics, x: number, y: number, W: number, s: SupportLive): void {
	const glow = solarGlow(s.minute, s.drought, s.usable);
	if (glow > 0.01) {
		const sky = lt(PVM.hi, 0.35);
		for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) px(g, x + 3 + c * 10, y + 3 + r * 7, 8, 5, sky, 0.45 * glow);
		if (!s.calm && glow > 0.3) {
			const k = Math.floor(s.t * 3) % 12;
			const qx = x + 3 + (k % 6) * 10;
			const qy = y + 3 + Math.floor(k / 6) * 7;
			px(g, qx, qy, 8, 1, T.paper, 0.7 * glow);
			px(g, qx, qy, 1, 5, T.paper, 0.5 * glow);
		}
	}
	const bx = x + Math.floor(W / 2) - 4;
	px(g, bx + 3, y + 20, 2, 1, s.usable && (s.calm || Math.floor(s.t * 1.4) % 2 === 0) ? T.sodium : T.ink);
	lamp(g, x + 7, y + 18, s.usable ? T.green : T.amber, true, 0.2);
}

// ═══ Entry points ══════════════════════════════════════════════════════

/** What the live pass knows about a support facility. */
export interface SupportLive {
	id: number;
	/** Enabled and not failed, tripped, unpowered or disabled. */
	usable: boolean;
	/** 0..1 load: heat removed over capacity (cooling), output share (power). */
	load: number;
	/** UPS charge 0..1 and whether it is charging. */
	charge: number;
	charging: boolean;
	minute: number;
	drought: boolean;
	calm: boolean;
	t: number;
}

/** Static body of a support sprite (not a rack). */
export function supportBody(g: Graphics, s: GreenSprite, x: number, y: number, W: number): void {
	switch (s) {
		case "econ":
			econBody(g, x, y, W);
			return;
		case "adiabatic":
			adiabaticBody(g, x, y, W);
			return;
		case "adiabatic_chiller":
			chillerBody(g, x, y, W);
			return;
		case "fuel_cell":
			fuelCellBody(g, x, y);
			return;
		case "iron_air":
			ironAirBody(g, x, y, W);
			return;
		case "geothermal":
			geothermalBody(g, x, y);
			return;
		case "microgrid":
			microgridBody(g, x, y, W);
			return;
		default:
			return;
	}
}

/** Live pass of a support sprite (not a rack). */
export function supportLive(g: Graphics, s: GreenSprite, x: number, y: number, W: number, l: SupportLive): void {
	switch (s) {
		case "econ":
			econLive(g, x, y, l);
			return;
		case "adiabatic":
			adiabaticLive(g, x, y, l);
			return;
		case "adiabatic_chiller":
			chillerLive(g, x, y, W, l);
			return;
		case "fuel_cell":
			fuelCellLive(g, x, y, l);
			return;
		case "iron_air":
			ironAirLive(g, x, y, l);
			return;
		case "geothermal":
			geothermalLive(g, x, y, l);
			return;
		case "microgrid":
			microgridLive(g, x, y, W, l);
			return;
		default:
			return;
	}
}
