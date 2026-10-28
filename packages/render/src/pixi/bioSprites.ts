/**
 * The Bio racks and support items (docs/ART_DIRECTION.md): the machine is flesh, in the manner of the card "Living Wall".
 *   OC-0/OC-1  a cabinet whose door is a wet membrane with a closed eye and veins
 *   OC-2       tissue lobes with two eyes, veins crossing the gaps between cabinets
 *   OC-3       a cortex: a great eye, a toothed mouth and tendrils; it watches the cursor
 *   OC-4       the wall itself: one huge eye over four cabinets of mouths and lobes
 * Same rules as the rest of the world art (axis-aligned rects, tokens and their shades). Static parts are cached; live passes only move
 * pupils, lids, a wet highlight and a pulse along the veins, from module constants and arithmetic (nothing allocated per frame).
 * Rack coordinates as in `greenRacks.ts`: a 15 px cabinet at `cx`, door glass 9 x 23 at (cx + 4, y + 3); `x`, `y`, `n` for the whole rack.
 */
import type { Graphics } from "pixi.js";
import type { GreenSprite } from "../art";
import { type LiveFx } from "../horror";
import { eyeClosed, pupilOffset } from "../horror";
import { T, dk, lt, mat, mix } from "../palette";
import { hash, px } from "./draw";
import { IRIS, PINK, SCLERA, TISSUE, VEIN, VEIN_HI, WET, eye, eyeBig, mound } from "./organic";
import type { SupportLive } from "./greenSprites";

export type BioRack = "oc1" | "oc2" | "oc3" | "oc4";

const GX = 4;
const GY = 3;
const GW = 9;
const GH = 23;
const DEEP = dk(TISSUE.dk, 0.35);
const TOOTH = mix(T.paper, T.flesh, 0.35);
const FLESH_SHELL = (k: number): number => mix(mix(T.blood, T.flesh, k), T.ink, 0.15);

/** Cabinet shell (the rack enamel): dark raw flesh, lighter and wetter the higher the rung. */
export const bioShell = (s: BioRack): number => FLESH_SHELL(s === "oc1" ? 0.2 : s === "oc2" ? 0.3 : s === "oc3" ? 0.4 : 0.5);

/** Trim of the Bio racks: a pink-magenta tissue ramp. */
export const bioTrim = (_s: BioRack): ReturnType<typeof mat> => mat(mix(T.flesh, T.accent2, 0.3));

interface Box {
	x0: number;
	x1: number;
	y0: number;
	y1: number;
}

/** A vein: a 1-px walk from (x, y) heading (dx, dy), clamped into `b`, forking once about halfway. Beads brighten every fifth pixel. */
function veinIn(g: Graphics, x: number, y: number, len: number, dx: number, dy: number, seed: number, b: Box, fork = true, a = 0.95): void {
	let vx = x;
	let vy = y;
	for (let k = 0; k < len; k++) {
		if (vx >= b.x0 && vx < b.x1 && vy >= b.y0 && vy < b.y1) px(g, vx, vy, 1, 1, k % 5 === 0 ? VEIN_HI : VEIN, a);
		const r = hash(seed, k);
		if (r < 0.55) {
			vx += dx;
			vy += dy;
		} else if (r < 0.8) vx += dx !== 0 ? 0 : hash(seed + 1, k) < 0.5 ? -1 : 1;
		else vy += dy !== 0 ? 0 : hash(seed + 2, k) < 0.5 ? -1 : 1;
		if (fork && k === (len >> 1)) veinIn(g, vx, vy, len >> 1, dx === 0 ? (hash(seed, 99) < 0.5 ? -1 : 1) : dx, dy === 0 ? 1 : dy, seed + 7, b, false, a * 0.85);
	}
}

/** The glass box of cabinet `cx`, `y` as a clamp for veins. */
const doorBox = (cx: number, y: number): Box => ({ x0: cx + GX, x1: cx + GX + GW, y0: y + GY, y1: y + GY + GH });

/** A toothed mouth `w` wide at (x, y): dark slit, a row of teeth above and below, a wet tongue. */
function mouth(g: Graphics, x: number, y: number, w: number): void {
	px(g, x, y, w, 4, TISSUE.line);
	px(g, x + 1, y + 1, w - 2, 2, DEEP);
	for (let k = 1; k < w - 1; k += 2) {
		px(g, x + k, y + 1, 1, 1, TOOTH);
		px(g, x + k + 1 > x + w - 2 ? x + k : x + k + 1, y + 2, 1, 1, TOOTH);
	}
	px(g, x + 2, y + 2, Math.max(1, w - 4), 1, PINK.lo, 0.8);
}

export function bioDoorStatic(g: Graphics, s: BioRack, cx: number, y: number, i: number, n: number): void {
	const gx = cx + GX;
	const gy = y + GY;
	const b = doorBox(cx, y);
	const seed = 11 + i * 17;
	px(g, gx, gy, GW, GH, TISSUE.dk);
	if (s === "oc1") {
		// A membrane stretched over the glass, veins rising through it, a closed eye near the top.
		mound(g, gx, gy + 5, GW, 18, seed, PINK);
		px(g, gx, gy + 5, GW, 1, TISSUE.hi);
		veinIn(g, gx + 2 + i, gy + GH - 1, 14, 0, -1, seed + 3, b);
		veinIn(g, gx + 6, gy + GH - 1, 10, 0, -1, seed + 9, b);
		eye(g, gx + 2, gy + 6, 0, 0, true);
	} else if (s === "oc2") {
		// Two layers of lobes and two eyes, one high and one low, offset from cabinet to cabinet.
		mound(g, gx, gy + 1, GW, 12, seed, TISSUE);
		mound(g, gx, gy + 10, GW, 13, seed + 4, PINK);
		veinIn(g, gx + 1, gy + GH - 1, 16, 0, -1, seed + 3, b);
		veinIn(g, gx + 7, gy + GH - 1, 14, 0, -1, seed + 8, b);
		eye(g, gx + 1 + (i & 1) * 3, gy + 4, 0, 0, true);
		eye(g, gx + 3 - (i & 1) * 2, gy + 14, 0, 0, true);
	} else if (s === "oc3") {
		// A cortex: lobes with a great eye above a mouth, tendrils hanging out of the dark.
		mound(g, gx, gy + 2, GW, 21, seed, TISSUE);
		mound(g, gx, gy + 13, GW, 10, seed + 6, PINK);
		veinIn(g, gx + 4, gy + 12, 9, 0, -1, seed + 2, b);
		veinIn(g, gx + 2, gy + GH - 1, 8, 0, -1, seed + 5, b);
		veinIn(g, gx + 7, gy + GH - 1, 8, 0, -1, seed + 7, b);
		eyeBig(g, gx + 1, gy + 3, 0, 0, true);
		mouth(g, gx + 1, gy + 14, 7);
		for (let c = 1; c < GW - 1; c += 2) px(g, gx + c, gy + 19, 1, 2 + Math.floor(hash(seed, c) * 3), PINK.mid);
	} else {
		// The wall: each door is a mouth in dark flesh with lobes below; the great eye is drawn over the middle of the rack.
		mound(g, gx, gy + 11, GW, 12, seed, TISSUE);
		mouth(g, gx + 1, gy + 14, 7);
		mound(g, gx, gy + 19, GW, 4, seed + 3, PINK);
		veinIn(g, gx + 2, gy + GH - 1, 9, 0, -1, seed + 3, b);
		veinIn(g, gx + 7, gy + GH - 1, 7, 0, -1, seed + 4, b);
		if (i !== 1 && i !== 2) eye(g, gx + 2, gy + 3, 0, 0, true);
	}
	void n;
}

/** Eye centres of the lobed doors (door-relative), for the live eyes. */
const EYE_AT: Record<BioRack, readonly (readonly [number, number])[]> = {
	oc1: [[2, 6]],
	oc2: [[1, 4], [3, 14]],
	oc3: [[1, 3]],
	oc4: [[2, 3]],
};

export function bioDoorLive(g: Graphics, s: BioRack, cx: number, y: number, i: number, n: number, seed: number, t: number, calm: boolean, on: boolean, p: number, fx: LiveFx): void {
	if (!on) return;
	const gx = cx + GX;
	const gy = y + GY;
	const closed = !calm && eyeClosed(t, fx.paused, seed);
	const eyes = EYE_AT[s];
	for (let k = 0; k < eyes.length; k++) {
		if (s === "oc4" && (i === 1 || i === 2)) break;
		const ex = gx + eyes[k][0] + (s === "oc2" ? (k === 0 ? (i & 1) * 3 : -(i & 1) * 2) : 0);
		const ey = gy + eyes[k][1];
		const pp = calm || !fx.cursor ? { dx: 0, dy: 0 } : pupilOffset(ex + 2, ey + 2, fx.cursor.x, fx.cursor.y);
		if (s === "oc3") eyeBig(g, ex, ey, pp.dx, pp.dy, closed);
		else eye(g, ex, ey, pp.dx, pp.dy, closed);
	}
	// A pulse runs up the veins, and the wet highlight breathes.
	const u = calm ? 0.4 : (t * (0.35 + 0.5 * p) + hash(seed, 5)) % 1;
	px(g, gx + 2 + (seed & 1) * 3, gy + GH - 2 - Math.floor(u * 17), 1, 1, VEIN_HI);
	px(g, gx + 6, gy + GH - 2 - Math.floor(((u + 0.5) % 1) * 15), 1, 1, WET, 0.9);
	const breath = calm ? 0.5 : 0.5 + 0.5 * Math.sin(t * 1.6 + hash(seed, 9) * 6);
	px(g, gx + 1 + (i % 3), gy + 7 + (s === "oc1" ? 0 : 3), 1, 1, WET, 0.3 + 0.6 * breath);
	void n;
}

/** The great eye of OC-4: socket box and sclera (static) and iris, pupil and lid (live), centred over the rack. */
const BIG_W = 21;
const BIG_H = 11;

export function bioSpansStatic(g: Graphics, s: BioRack, x: number, y: number, n: number): void {
	const W = n * 16;
	// A fleshy cap along the top, lumpy, over the cornice; the foot is covered by a spill of tissue.
	for (let i = 0; i < n; i++) mound(g, x + i * 16 + 1, y - 3, 14, 5, 5 + i * 3, i & 1 ? TISSUE : PINK);
	mound(g, x + 1, y + 26, W - 2, 5, 31, TISSUE);
	// Veins cross the gaps between cabinets.
	for (let i = 0; i < n - 1; i++) {
		const gxp = x + (i + 1) * 16;
		veinIn(g, gxp - 4, y + (s === "oc1" ? 11 : 9), 8, 1, 0, 61 + i, { x0: gxp - 5, x1: gxp + 5, y0: y + 3, y1: y + 28 }, false);
		if (s !== "oc1") veinIn(g, gxp - 4, y + 19, 8, 1, 0, 71 + i, { x0: gxp - 5, x1: gxp + 5, y0: y + 3, y1: y + 28 }, false);
	}
	// Tendrils hanging off the top and over the front.
	const drips = s === "oc1" ? 2 : s === "oc2" ? 3 : 4;
	for (let k = 0; k < drips * (n - 1) + 2; k++) {
		const dx = 3 + Math.floor(hash(17, k) * (W - 6));
		const len = 3 + Math.floor(hash(18, k) * (s === "oc4" ? 9 : 6));
		px(g, x + dx, y + 1, 1, len, PINK.mid);
		px(g, x + dx, y + 1 + len, 1, 1, WET);
	}
	if (s === "oc4") {
		const ex = x + Math.floor((W - BIG_W) / 2);
		const ey = y + 5;
		px(g, ex - 1, ey - 1, BIG_W + 2, BIG_H + 2, TISSUE.line);
		px(g, ex, ey, BIG_W, BIG_H, SCLERA);
		px(g, ex, ey, BIG_W, 2, TISSUE.dk);
		px(g, ex, ey + BIG_H - 2, BIG_W, 2, TISSUE.dk);
		px(g, ex, ey + 2, 2, BIG_H - 4, PINK.lo);
		px(g, ex + BIG_W - 2, ey + 2, 2, BIG_H - 4, PINK.lo);
		px(g, ex + 4, ey + 3, 3, 1, VEIN, 0.7);
		px(g, ex + BIG_W - 8, ey + BIG_H - 4, 4, 1, VEIN, 0.7);
	}
}

export function bioSpansLive(g: Graphics, s: BioRack, x: number, y: number, n: number, seed: number, t: number, calm: boolean, on: boolean, p: number, fx: LiveFx): void {
	if (!on) return;
	const W = n * 16;
	if (s === "oc4") {
		const ex = x + Math.floor((W - BIG_W) / 2);
		const ey = y + 5;
		const closed = !calm && eyeClosed(t, fx.paused, seed);
		if (closed) {
			px(g, ex, ey, BIG_W, BIG_H, TISSUE.mid);
			px(g, ex + 2, ey + BIG_H / 2, BIG_W - 4, 1, TISSUE.dk);
			return;
		}
		const pp = calm || !fx.cursor ? { dx: 0, dy: 0 } : pupilOffset(ex + BIG_W / 2, ey + BIG_H / 2, fx.cursor.x, fx.cursor.y);
		const ix = ex + 6 + pp.dx * 3;
		const iy = ey + 2 + (pp.dy > 0 ? 1 : 0) - (pp.dy < 0 ? 1 : 0);
		px(g, ix, iy, 9, 7, IRIS);
		px(g, ix + 1, iy + 1, 7, 5, lt(IRIS, 0.18));
		px(g, ix + 3, iy + 1, 3, 5, T.ink);
		px(g, ix + 3, iy + 1, 1, 1, T.paper);
	}
	// A bead of light runs along the spill of tissue at the foot, and the top breathes.
	const u = calm ? 0.5 : (t * (0.18 + 0.2 * p) + hash(seed, 4)) % 1;
	px(g, x + 3 + Math.floor(u * (W - 8)), y + 27, 3, 1, WET, 0.7);
	px(g, x + 2 + Math.floor(hash(seed + 1, calm ? 0 : Math.floor(t * 1.2)) * (W - 5)), y - 2, 1, 1, WET, calm ? 0.8 : 0.9);
}

// ═══ Support items ═════════════════════════════════════════════════════

const SHELLM = mat(mix(T.blood, T.flesh, 0.3));
const BROTH = mix(mix(T.flesh, T.accent2, 0.3), T.ink, 0.45);
const BROTH_HI = mix(BROTH, T.paper, 0.25);
const GLASSB = mix(T.housingHi, T.flesh, 0.25);

/** A perfusion window: glass box with broth, a surface line and tissue lobes sunk in it. */
function bathWindow(g: Graphics, x: number, y: number, w: number, h: number, seed: number): void {
	px(g, x, y, w, h, TISSUE.line);
	px(g, x + 1, y + 1, w - 2, h - 2, BROTH);
	px(g, x + 1, y + 1, w - 2, 1, GLASSB);
	px(g, x + 1, y + 3, w - 2, 1, BROTH_HI, 0.6);
	mound(g, x + 3, y + h - 9, Math.min(11, w - 6), 8, seed, PINK);
	if (w > 22) mound(g, x + w - 15, y + h - 7, 12, 6, seed + 5, TISSUE);
	px(g, x + 1, y + h - 2, w - 2, 1, TISSUE.dk);
}

function bathBody(g: Graphics, x: number, y: number, W: number): void {
	// Enamel plinth and tube feed over a wide tank.
	px(g, x + 1, y + 4, W - 2, 26, SHELLM.line);
	px(g, x + 2, y + 5, W - 4, 24, SHELLM.mid);
	px(g, x + 2, y + 5, W - 4, 1, SHELLM.hi);
	px(g, x + 2, y + 27, W - 4, 2, SHELLM.lo);
	bathWindow(g, x + 4, y + 8, W - 8, 17, 21);
	for (const tx of [x + 7, x + W - 9]) {
		px(g, tx, y, 3, 6, TISSUE.line);
		px(g, tx + 1, y, 1, 6, VEIN_HI);
	}
	veinIn(g, x + 4, y + 26, W - 10, 1, 0, 5, { x0: x + 3, x1: x + W - 3, y0: y + 25, y1: y + 29 }, false, 0.7);
}

function bathLive(g: Graphics, x: number, y: number, W: number, s: SupportLive): void {
	if (!s.usable) return;
	for (let k = 0; k < 4; k++) {
		const u = s.calm ? 0.2 + 0.2 * k : (s.t * 0.3 + k * 0.27) % 1;
		px(g, x + 7 + Math.floor(hash(s.id, k) * (W - 16)), y + 21 - Math.floor(u * 11), 1, 1, BROTH_HI, 1 - u);
	}
	const beat = s.calm ? 0 : Math.floor(s.t * 1.6) % 2;
	px(g, x + 6 + beat, y + 17, 5, 1, WET, 0.5);
}

const HEART_SEEDS = [3, 9, 15] as const;

function vascularBody(g: Graphics, x: number, y: number, W: number): void {
	px(g, x + 1, y + 20, W - 2, 10, SHELLM.line);
	px(g, x + 2, y + 21, W - 4, 8, SHELLM.mid);
	px(g, x + 2, y + 21, W - 4, 1, SHELLM.hi);
	px(g, x + 2, y + 27, W - 4, 2, SHELLM.lo);
	// Great vessels run from the pump out to both ends and down into the skid.
	for (const [vx, c] of [[x + 3, VEIN], [x + W - 6, VEIN_HI]] as const) {
		px(g, vx, y + 6, 3, 15, TISSUE.line);
		px(g, vx + 1, y + 6, 1, 15, c);
	}
	px(g, x + 3, y + 6, 22, 3, TISSUE.line);
	px(g, x + 3, y + 7, 22, 1, VEIN);
	px(g, x + W - 25, y + 6, 22, 3, TISSUE.line);
	px(g, x + W - 25, y + 7, 22, 1, VEIN_HI);
	// The pump: a glass dome holding a lumpy organ.
	const mx = x + Math.floor(W / 2);
	px(g, mx - 15, y + 8, 30, 14, GLASSB);
	px(g, mx - 14, y + 9, 28, 12, BROTH);
	mound(g, mx - 12, y + 10, 12, 11, HEART_SEEDS[0], PINK);
	mound(g, mx - 1, y + 9, 13, 12, HEART_SEEDS[1], TISSUE);
	mound(g, mx - 7, y + 12, 14, 9, HEART_SEEDS[2], PINK);
	veinIn(g, mx - 3, y + 20, 8, 0, -1, 41, { x0: mx - 14, x1: mx + 14, y0: y + 9, y1: y + 21 });
	px(g, mx - 15, y + 8, 30, 1, lt(GLASSB, 0.3));
	veinIn(g, x + 6, y + 21, W - 14, 1, 0, 77, { x0: x + 3, x1: x + W - 3, y0: y + 21, y1: y + 28 }, true, 0.7);
	mound(g, x + 2, y + 27, W - 4, 4, 13, TISSUE);
}

function vascularLive(g: Graphics, x: number, y: number, W: number, s: SupportLive): void {
	if (!s.usable) return;
	const mx = x + Math.floor(W / 2);
	// Lub-dub: the pump swells twice, a pulse runs along each great vessel.
	const ph = s.calm ? 0 : (s.t * (0.8 + 0.8 * s.load)) % 1;
	const beat = ph < 0.12 || (ph > 0.22 && ph < 0.3);
	if (beat) {
		px(g, mx - 6, y + 11, 12, 1, WET, 0.8);
		px(g, mx - 11, y + 13, 2, 5, PINK.hi, 0.7);
		px(g, mx + 8, y + 13, 2, 5, PINK.hi, 0.7);
	}
	const u = s.calm ? 0.3 : ph;
	px(g, x + 4 + Math.floor(u * 20), y + 7, 2, 1, T.paper, 0.9);
	px(g, x + W - 5 - Math.floor(u * 20), y + 7, 2, 1, T.paper, 0.9);
	px(g, x + 4, y + 8 + Math.floor(u * 12), 1, 1, T.paper, 0.9);
	px(g, x + W - 5, y + 8 + Math.floor(u * 12), 1, 1, T.paper, 0.9);
}

/** Static body of a Bio support sprite. */
export function bioSupportBody(g: Graphics, s: GreenSprite, x: number, y: number, W: number): void {
	if (s === "bath") bathBody(g, x, y, W);
	else if (s === "vascular") vascularBody(g, x, y, W);
}

/** Live pass of a Bio support sprite. */
export function bioSupportLive(g: Graphics, s: GreenSprite, x: number, y: number, W: number, l: SupportLive, _fx: LiveFx): void {
	if (s === "bath") bathLive(g, x, y, W, l);
	else if (s === "vascular") vascularLive(g, x, y, W, l);
}
