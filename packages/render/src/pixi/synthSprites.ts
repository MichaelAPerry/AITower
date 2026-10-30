/**
 * The Synthetic racks and support items (docs/ART_DIRECTION.md): chrome. Mirror-polished panels (sky-white top, a dark horizon line,
 * a light bounce below: `chromeRow`), cold cyan seams and a sweeping specular glint; nothing is painted, everything is polished.
 *   LC-2  a chrome door with a coolant sight tube     LC-3  seams, a display and clamps     LC-4  etched traces and a lit core
 *   ML-1  one seamless monolith over three cabinets with a single cold slit
 * Support: CDU skids (chrome tanks under a header), chrome chillers with caged fans and coils, and the CT-1 Consciousness Transfer
 * Unit (a console and a chrome pod; the walk-in and upload animation is `transferAnim.ts`, the walker `transfers.ts`).
 * Static parts are cached; live passes only sweep a glint, spin fans and run beads, from module constants and arithmetic.
 */
import type { Graphics } from "pixi.js";
import type { GreenSprite } from "../art";
import type { LiveFx } from "../horror";
import { T, dk, lt, mat, mix } from "../palette";
import { transferPhase, uploadFraction, doorOpen } from "../transferAnim";
import { fanBlades, hash, px, ring } from "./draw";
import { CHROME, chromePipe, chromeRect, chromeTube, coldLed, glint } from "./organic";
import type { SupportLive } from "./greenSprites";

export type SynthRack = "lc2" | "lc3" | "lc4" | "ml1";

const GX = 4;
const GY = 3;
const GW = 9;
const GH = 23;
const COLD = CHROME.cold;
const COLD_HI = lt(COLD, 0.5);
const DEEP_C = mix(T.ink, T.brassDk, 0.35);
const GLOW = mix(T.brassDk, T.brass, 0.5);

/** Cabinet frame of the Synthetic racks: polished steel, brighter with the rung. */
export const synthShell = (s: SynthRack): number => mix(T.steel, T.paper, s === "lc2" ? 0.22 : s === "lc3" ? 0.3 : s === "lc4" ? 0.38 : 0.46);

/** Trim of the Synthetic racks: cold chrome. */
export const synthTrim = (): ReturnType<typeof mat> => mat(CHROME.mid);

const SEAM_ROWS = [6, 17] as const;

export function synthDoorStatic(g: Graphics, s: SynthRack, cx: number, y: number, i: number, n: number): void {
	const gx = cx + GX;
	const gy = y + GY;
	if (s === "ml1") {
		// The monolith: one polished slab over the whole cabinet; the slit is drawn over the middle of the rack.
		chromeRect(g, cx + 1, y + 1, 13, 29);
		if (i > 0) px(g, cx + 1, y + 1, 1, 29, CHROME.hi);
		return;
	}
	chromeRect(g, gx, gy, GW, GH);
	if (s === "lc2") {
		// Coolant sight tube between two clamps.
		px(g, gx + 3, gy + 3, 3, 17, CHROME.line);
		px(g, gx + 4, gy + 3, 1, 17, DEEP_C);
		for (const cy of [gy + 7, gy + 15]) {
			px(g, gx + 2, cy, 5, 2, CHROME.line);
			px(g, gx + 3, cy, 3, 1, CHROME.sky);
		}
		px(g, gx + 4, gy + 9, 1, 11, COLD, 0.85);
		px(g, gx + 4, gy + 9, 1, 1, COLD_HI);
	} else if (s === "lc3") {
		// Cold seams across the door, a small display between them, bolts at the corners.
		for (const r of SEAM_ROWS) {
			px(g, gx + 1, gy + r, GW - 2, 1, CHROME.line);
			px(g, gx + 1, gy + r + 1, GW - 2, 1, COLD, 0.7);
		}
		px(g, gx + 2, gy + 9, 5, 6, CHROME.line);
		px(g, gx + 3, gy + 10, 3, 4, DEEP_C);
		px(g, gx + 3, gy + 11, 3, 1, COLD, 0.7);
		for (const [bx, by] of [[1, 1], [7, 1], [1, 20], [7, 20]] as const) px(g, gx + bx, gy + by, 1, 1, CHROME.line);
	} else {
		// LC-4: etched traces that fork from a lit core line down the middle.
		px(g, gx + 4, gy + 1, 1, GH - 2, COLD, 0.9);
		px(g, gx + 3, gy + 1, 1, GH - 2, COLD, 0.2);
		px(g, gx + 5, gy + 1, 1, GH - 2, COLD, 0.2);
		for (let r = 3; r < GH - 2; r += 4) {
			const dir = hash(i * 5 + 2, r) < 0.5 ? -1 : 1;
			const len = 2 + Math.floor(hash(i + 7, r) * 2);
			px(g, gx + (dir < 0 ? 4 - len : 5), gy + r, len, 1, CHROME.line);
			px(g, gx + (dir < 0 ? 4 - len : 4 + len), gy + r + 1, 1, 2, CHROME.line);
		}
		px(g, gx + 4, gy + 1, 1, 1, COLD_HI);
	}
	void n;
}

/** Cold light on a door: the glint sweep and the sight-tube / core pulse. */
export function synthDoorLive(g: Graphics, s: SynthRack, cx: number, y: number, i: number, _n: number, seed: number, t: number, calm: boolean, on: boolean, p: number): void {
	const gx = cx + GX;
	const gy = y + GY;
	if (s === "ml1") {
		const u = calm ? 0.3 : (t * 0.12 + i * 0.33 + hash(seed, 1) * 0.1) % 1.4;
		glint(g, cx + 2, y + 2, 11, 27, Math.min(1, u / 1.4), 0.55);
		return;
	}
	const u = calm ? 0.3 : (t * 0.16 + hash(seed, 1)) % 1.5;
	glint(g, gx, gy, GW, GH, Math.min(1, u / 1.5), 0.6);
	if (!on) return;
	if (s === "lc2") {
		// Coolant beads climb the sight tube.
		for (let k = 0; k < 3; k++) {
			const f = calm ? 0.2 + 0.3 * k : (t * (0.4 + 0.5 * p) + k / 3) % 1;
			px(g, gx + 4, gy + 18 - Math.floor(f * 15), 1, 1, COLD_HI);
		}
	} else if (s === "lc3") {
		const slot = calm ? 0 : Math.floor(t * 3 + hash(seed, 2) * 4);
		for (let q = 0; q < 3; q++) if (hash(seed + q, slot) < 0.3 + 0.5 * p) px(g, gx + 3 + q, gy + 12, 1, 1, COLD_HI);
	} else {
		const f = calm ? 0.4 : (t * (0.3 + 0.4 * p) + hash(seed, 3)) % 1;
		px(g, gx + 4, gy + GH - 2 - Math.floor(f * (GH - 4)), 1, 2, T.paper);
	}
}

export function synthSpansStatic(g: Graphics, s: SynthRack, x: number, y: number, n: number): void {
	const W = n * 16;
	if (s === "ml1") {
		// Join the slabs across the gaps, round the top and foot, and cut the slit.
		for (let i = 0; i < n - 1; i++) chromeRect(g, x + (i + 1) * 16 - 2, y + 4, 4, 22);
		px(g, x + 1, y, W - 2, 1, CHROME.sky);
		const mx = x + Math.floor(W / 2);
		px(g, mx - 2, y + 6, 4, 18, CHROME.line);
		px(g, mx - 1, y + 7, 2, 16, DEEP_C);
		px(g, mx - 1, y + 8, 2, 14, COLD, 0.55);
		px(g, mx - 3, y + 6, 1, 18, COLD, 0.2);
		px(g, mx + 2, y + 6, 1, 18, COLD, 0.2);
		return;
	}
	// Chrome pipes bridge the cabinets at the top and the foot; lc4 adds a cold bus between them.
	for (let i = 0; i < n - 1; i++) {
		const gxp = x + (i + 1) * 16;
		chromeTube(g, gxp - 3, y + 5, 6, 3);
		chromeTube(g, gxp - 3, y + 24, 6, 3);
		if (s === "lc4") px(g, gxp - 2, y + 15, 4, 1, COLD, 0.8);
	}
}

export function synthSpansLive(g: Graphics, s: SynthRack, x: number, y: number, n: number, seed: number, t: number, calm: boolean, on: boolean, p: number): void {
	if (!on) return;
	const W = n * 16;
	if (s === "ml1") {
		// The slit breathes, and a bright bead runs down it.
		const mx = x + Math.floor(W / 2);
		const b = calm ? 0.7 : 0.55 + 0.45 * Math.sin(t * 1.5 + hash(seed, 1) * 6);
		px(g, mx - 1, y + 8, 2, 14, COLD_HI, 0.3 * b);
		const f = calm ? 0.5 : (t * (0.25 + 0.3 * p)) % 1;
		px(g, mx - 1, y + 8 + Math.floor(f * 12), 2, 2, T.paper);
		return;
	}
	for (let i = 0; i < n - 1; i++) {
		const f = calm ? 0.5 : (t * 0.5 + i * 0.37 + hash(seed, i)) % 1;
		px(g, x + (i + 1) * 16 - 3 + Math.floor(f * 5), y + 6, 1, 1, COLD_HI);
	}
}

// ═══ Support items ═════════════════════════════════════════════════════

const PLINTH = mat(CHROME.steel);

/** CDU skid: chrome tanks side by side under a header, each with a cold sight window. */
function cduBody(g: Graphics, x: number, y: number, W: number): void {
	const tanks = Math.max(1, Math.floor((W - 6) / 14));
	chromeRect(g, x + 1, y + 24, W - 2, 6);
	chromeTube(g, x + 2, y + 2, W - 4, 5);
	const gap = (W - 4 - tanks * 11) / (tanks + 1);
	for (let k = 0; k < tanks; k++) {
		const tx = x + 2 + Math.round(gap * (k + 1) + k * 11);
		chromePipe(g, tx, y + 7, 11, 18);
		// Sight window with the coolant level.
		px(g, tx + 3, y + 10, 5, 11, CHROME.line);
		px(g, tx + 4, y + 11, 3, 9, DEEP_C);
		px(g, tx + 4, y + 14, 3, 6, COLD, 0.75);
		// Header drop, clamp and a bolt.
		px(g, tx + 4, y + 6, 3, 2, CHROME.line);
		px(g, tx, y + 21, 11, 1, CHROME.line);
	}
	px(g, x + 3, y + 3, 2, 1, CHROME.sky);
	px(g, x + W - 5, y + 3, 2, 3, CHROME.line);
	px(g, x + W - 5, y + 4, 2, 1, COLD);
}

function cduLive(g: Graphics, x: number, y: number, W: number, s: SupportLive): void {
	const tanks = Math.max(1, Math.floor((W - 6) / 14));
	glint(g, x + 3, y + 8, W - 6, 16, s.calm ? 0.3 : (s.t * 0.14 + s.id * 0.2) % 1, 0.45);
	if (!s.usable) return;
	const gap = (W - 4 - tanks * 11) / (tanks + 1);
	for (let k = 0; k < tanks; k++) {
		const tx = x + 2 + Math.round(gap * (k + 1) + k * 11);
		const f = s.calm ? 0.4 : (s.t * (0.4 + 0.6 * s.load) + k * 0.31) % 1;
		px(g, tx + 4 + (k & 1), y + 19 - Math.floor(f * 6), 1, 1, COLD_HI);
	}
	const u = s.calm ? 0.5 : (s.t * 0.7) % 1;
	px(g, x + 3 + Math.floor(u * (W - 8)), y + 4, 2, 1, T.paper, 0.9);
}

/** Chrome chiller: a polished casing, one caged fan per two tiles on top and chrome coils with a cold glow below. */
function chillerBody(g: Graphics, x: number, y: number, W: number): void {
	chromeRect(g, x + 1, y + 13, W - 2, 17);
	chromeRect(g, x + 1, y + 28, W - 2, 3);
	const fans = Math.floor(W / 32) * 2 || 1;
	const step = Math.floor((W - 4) / fans);
	for (let k = 0; k < fans; k++) {
		const fx = x + 2 + k * step + Math.floor((step - 13) / 2);
		px(g, fx - 1, y + 9, 15, 5, CHROME.line);
		ring(g, fx, y + 1, 13, CHROME.line, CHROME.deep);
		px(g, fx + 6, y + 2, 1, 11, CHROME.dark, 0.7);
		px(g, fx + 1, y + 7, 11, 1, CHROME.dark, 0.7);
	}
	// Coil bank: stacked chrome fins with cold gaps.
	px(g, x + 4, y + 16, W - 8, 10, CHROME.line);
	for (let r = 0; r < 4; r++) {
		px(g, x + 5, y + 17 + r * 2, W - 10, 1, CHROME.hi);
		px(g, x + 5, y + 18 + r * 2, W - 10, 1, DEEP_C);
	}
	px(g, x + 4, y + 26, W - 8, 1, COLD, 0.55);
	void PLINTH;
}

function chillerLive(g: Graphics, x: number, y: number, W: number, s: SupportLive): void {
	const fans = Math.floor(W / 32) * 2 || 1;
	const step = Math.floor((W - 4) / fans);
	for (let k = 0; k < fans; k++) {
		const fx = x + 2 + k * step + Math.floor((step - 13) / 2);
		const spin = s.usable && !s.calm;
		fanBlades(g, fx + 1, y + 2, 11, spin ? s.t * (5 + 12 * s.load) + k : 0.4 + k, CHROME.hi);
	}
	glint(g, x + 3, y + 14, W - 6, 14, s.calm ? 0.3 : (s.t * 0.12 + s.id * 0.3) % 1, 0.5);
	if (!s.usable) return;
	const u = s.calm ? 0.4 : (s.t * 0.5) % 1;
	px(g, x + 5 + Math.floor(u * (W - 12)), y + 25, 3, 1, COLD_HI, 0.9);
	coldLed(g, x + W - 4, y + 15, s.calm || Math.floor(s.t * 1.5) % 2 === 0);
}

// ─── CT-1 Consciousness Transfer Unit ──────────────────────────────────
const POD_X = 16;
const POD_W = 30;
const WIN_X = 20;
const WIN_W = 22;
const WIN_Y = 5;
const WIN_H = 19;

function transferBody(g: Graphics, x: number, y: number, W: number): void {
	// Plinth and the console on the lift side.
	chromeRect(g, x + 1, y + 26, W - 2, 5);
	chromeRect(g, x + 2, y + 8, 13, 18);
	px(g, x + 4, y + 10, 9, 7, CHROME.line);
	px(g, x + 5, y + 11, 7, 5, DEEP_C);
	px(g, x + 5, y + 12, 7, 1, COLD, 0.35);
	for (let k = 0; k < 3; k++) {
		px(g, x + 4 + k * 3, y + 19, 2, 2, CHROME.line);
		px(g, x + 4 + k * 3, y + 19, 2, 1, k === 1 ? COLD : CHROME.dark);
	}
	px(g, x + 4, y + 23, 9, 1, CHROME.line);
	// The pod: a polished capsule with a domed cap, a dark cold-lit interior and a grating floor.
	chromeRect(g, x + POD_X, y + 2, POD_W, 25);
	chromeRect(g, x + POD_X + 3, y, POD_W - 6, 4);
	px(g, x + WIN_X - 1, y + WIN_Y - 1, WIN_W + 2, WIN_H + 2, CHROME.line);
	px(g, x + WIN_X, y + WIN_Y, WIN_W, WIN_H, DEEP_C);
	for (let r = 0; r < WIN_H; r += 2) px(g, x + WIN_X, y + WIN_Y + r, WIN_W, 1, GLOW, 0.1 + (r / WIN_H) * 0.25);
	px(g, x + WIN_X, y + WIN_Y + WIN_H - 2, WIN_W, 2, CHROME.dark);
	for (let c = 0; c < WIN_W; c += 3) px(g, x + WIN_X + c, y + WIN_Y + WIN_H - 2, 1, 1, CHROME.line);
	// Conduits down the right side.
	chromePipe(g, x + W - 4, y + 4, 3, 24);
	px(g, x + POD_X + POD_W - 3, y + 20, 3, 2, CHROME.line);
}

/** The door of the pod: a chrome shutter that slides down over the window (`open` 0..1 is how much of the window shows). */
function podDoor(g: Graphics, x: number, y: number, open: number): void {
	const h = Math.round((1 - open) * WIN_H);
	if (h <= 0) return;
	if (h >= 3) chromeRect(g, x + WIN_X, y + WIN_Y, WIN_W, h);
	else px(g, x + WIN_X, y + WIN_Y, WIN_W, h, CHROME.hi);
	if (h >= WIN_H - 1) {
		px(g, x + WIN_X + 10, y + WIN_Y + 2, 2, WIN_H - 4, CHROME.line);
		px(g, x + WIN_X + 11, y + WIN_Y + 3, 1, WIN_H - 6, COLD, 0.5);
	}
}

/** A 5 x 9 ghost of a person in cold light, standing with its feet at (cx, feet). */
export function ghost(g: Graphics, cx: number, feet: number, a: number): void {
	px(g, cx - 1, feet - 9, 3, 3, COLD_HI, a);
	px(g, cx - 2, feet - 6, 5, 4, COLD, a);
	px(g, cx - 2, feet - 2, 2, 2, COLD, a * 0.8);
	px(g, cx + 1, feet - 2, 2, 2, COLD, a * 0.8);
}

function transferLive(g: Graphics, x: number, y: number, s: SupportLive): void {
	const ph = transferPhase(s.id, s.t);
	const feet = y + WIN_Y + WIN_H - 3;
	const cxp = x + WIN_X + Math.floor(WIN_W / 2);
	const open = ph ? doorOpen(ph) : 0;
	// Scan lines of the console display.
	if (s.usable) {
		const f = s.calm ? 0.6 : (s.t * 0.25) % 1;
		px(g, x + 5, y + 14, Math.max(1, Math.floor(f * 7)), 1, COLD_HI);
	}
	if (ph && open > 0) {
		// While the door is open the interior is lit and the person stands in it until the door closes.
		px(g, x + WIN_X, y + WIN_Y, WIN_W, WIN_H, GLOW, 0.2 * open);
		if (ph.s >= ph.walk && ph.s < ph.walk + 0.5) ghost(g, cxp, feet, 0.35);
	}
	podDoor(g, x, y, open);
	if (!ph) {
		glint(g, x + WIN_X, y + WIN_Y, WIN_W, WIN_H, s.calm ? 0.3 : (s.t * 0.1 + s.id * 0.2) % 1, 0.5);
		if (s.usable) {
			px(g, x + WIN_X + 11, y + WIN_Y + 3, 1, WIN_H - 6, COLD, 0.6);
			coldLed(g, x + POD_X + POD_W / 2, y + 2, s.calm || Math.floor(s.t * 1.5) % 2 === 0);
		}
		return;
	}
	const u = uploadFraction(ph);
	if (u > 0 && u < 1) {
		// Upload: the shutter glows from inside, the person rises as data over the pod and the interior floods with cold light.
		const flood = Math.sin(u * Math.PI);
		px(g, x + WIN_X, y + WIN_Y, WIN_W, WIN_H, COLD, 0.35 * flood);
		px(g, x + WIN_X + 9, y + WIN_Y + 1, 4, WIN_H - 2, COLD_HI, 0.55 * flood);
		for (let k = 0; k < 9; k++) {
			const f = (u * 3 + k / 9 + hash(s.id, k)) % 1;
			px(g, x + WIN_X + 3 + Math.floor(hash(s.id + 3, k) * (WIN_W - 6)), y + WIN_Y + WIN_H - 2 - Math.floor(f * (WIN_H - 2)), 1, 2, T.paper, 0.9);
		}
		ghost(g, cxp, feet - Math.floor(u * (WIN_H - 8)), 0.6 * (1 - u));
		// The cap flares and a column of bits shoots up out of the roof.
		px(g, x + POD_X + 5, y, POD_W - 10, 1, COLD_HI, 0.9);
		for (let k = 0; k < 4; k++) {
			const f = (u * 4 + k * 0.25) % 1;
			px(g, cxp - 1 + (k % 2) * 2, y - 1 - Math.floor(f * 8), 1, 2, COLD_HI, 1 - f);
		}
	}
}

/** Cryo chillers: the chrome chiller under a rime of frost with icicles along the coil bank. */
function cryoBody(g: Graphics, x: number, y: number, W: number): void {
	chillerBody(g, x, y, W);
	const FROST = lt(T.paper, 0.1);
	for (let c = 2; c < W - 2; c++) {
		const d = 1 + Math.floor(hash(7, c) * 3);
		px(g, x + c, y + 13, 1, d, FROST, 0.85);
	}
	for (let c = 5; c < W - 5; c += 3) {
		const len = 1 + Math.floor(hash(9, c) * 2);
		px(g, x + c, y + 27, 1, len, lt(COLD, 0.55), 0.9);
		px(g, x + c, y + 27 + len, 1, 1, T.paper);
	}
	for (let k = 0; k < Math.floor(W / 6) - 1; k++) px(g, x + 4 + k * 6 + Math.floor(hash(3, k) * 3), y + 15 + Math.floor(hash(4, k) * 11), 2, 1, FROST, 0.7);
}

function cryoLive(g: Graphics, x: number, y: number, W: number, s: SupportLive): void {
	chillerLive(g, x, y, W, s);
	if (!s.usable) return;
	// Cold mist falls off the coils.
	for (let k = 0; k < 4; k++) {
		const u = s.calm ? 0.3 : (s.t * 0.25 + k * 0.25) % 1;
		px(g, x + 6 + Math.floor(hash(s.id, k) * (W - 14)), y + 26 + Math.floor(u * 4), 3, 1, T.paper, 0.35 * (1 - u));
	}
}

/** Static body of a Synthetic support sprite. */
export function synthSupportBody(g: Graphics, s: GreenSprite, x: number, y: number, W: number): void {
	if (s === "cdu") cduBody(g, x, y, W);
	else if (s === "syn_chiller") chillerBody(g, x, y, W);
	else if (s === "cryo") cryoBody(g, x, y, W);
	else if (s === "transfer") transferBody(g, x, y, W);
}

/** Live pass of a Synthetic support sprite. */
export function synthSupportLive(g: Graphics, s: GreenSprite, x: number, y: number, W: number, l: SupportLive): void {
	if (s === "cdu") cduLive(g, x, y, W, l);
	else if (s === "syn_chiller") chillerLive(g, x, y, W, l);
	else if (s === "cryo") cryoLive(g, x, y, W, l);
	else if (s === "transfer") transferLive(g, x, y, l);
}

/** Where the pod door is, for the walker: the pod's centre x relative to the unit's left edge. */
export const POD_CENTRE_X = WIN_X + Math.floor(WIN_W / 2);
export type { LiveFx };
