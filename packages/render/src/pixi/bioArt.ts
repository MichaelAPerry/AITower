/**
 * Wetware art in the synthetic style: organoid jars, DNA tube vault, the neural pit, nutrient plant, sterile bay,
 * culling room, quarantine lock, bio-reactor and growths; plus the biotech stage overlays (damp, veins, flesh-tone panels,
 * bile, tissue) that are painted over any cached body, and the eyes drawn into status lights. Coordinates are world px:
 * `x` = left edge of the facility, `y` = top of its body (`top + FAC_TOP`). Nothing here imports `facilityArt.ts`.
 */
import type { Graphics } from "pixi.js";
import { FAC_BOTTOM, FAC_TOP } from "../constants";
import { type LiveFx, ditherOn, eyeClosed, hash2, isPlain, pupilOffset } from "../horror";
import { BILE, BLOOD, BRASS, FLESH, GLASS, type Mat, NUTRIENT, PALE_GREEN, STEEL, T, VERDI, dk, lt, mat, mix } from "../palette";
import type { SkinEffect } from "../skin";
import { bevel, dither, hash, px, ring, valveWheel } from "./draw";

const H = FAC_BOTTOM - FAC_TOP;
const HOUSING = mat(T.housing);
/** Pale, neutral "specimen" when horror is off. */
const PLAIN_M = mat(lt(T.putty, 0.35));
/** Cold ultraviolet glow: the accent pulled toward flesh (derived, not a token). */
export const UV = mix(T.brass, T.accent2, 0.6);
const STAINS = [BILE.mid, FLESH.mid, lt(BLOOD.mid, 0.2), VERDI.mid] as const;
const massMat = (plain: boolean): Mat => (plain ? PLAIN_M : FLESH);
const FLUID = mix(GLASS, PALE_GREEN, 0.4);

// ─── Organoids, DNA vault, neural pit ──────────────────────────────────

/** Glass jar (8×10) holding a lumpy pale mass; `i` varies the lumps. */
export function organoidJar(g: Graphics, x: number, y: number, i: number, plain: boolean): void {
	const M = massMat(plain);
	px(g, x, y, 8, 10, BRASS.line);
	px(g, x + 1, y + 1, 6, 8, GLASS);
	px(g, x + 1, y + 2, 6, 7, FLUID);
	const o = i % 2;
	px(g, x + 2, y + 4, 4, 4, M.lo);
	px(g, x + 1 + o, y + 5, 5, 2, M.mid);
	px(g, x + 3, y + 3, 2, 1, M.hi);
	px(g, x + 2, y + 4, 2, 1, M.hi);
	if (!plain) {
		px(g, x + 4, y + 5, 1, 2, BLOOD.mid);
		px(g, x + 3 - o, y + 7, 2, 1, BLOOD.mid);
	}
	px(g, x + 1, y + 1, 1, 7, lt(GLASS, 0.3), 0.8);
	px(g, x, y, 8, 1, BRASS.mid);
	px(g, x, y + 9, 8, 1, BRASS.lo);
}

/** Slow pulse of an organoid mass: it swells by one pixel for about half of a 3.2 s cycle (nothing when still). */
export function organoidPulse(g: Graphics, x: number, y: number, seed: number, t: number, moving: boolean, active: boolean): void {
	if (!moving || !active) return;
	if (Math.sin((Math.PI * 2 * t) / 3.2 + seed) < 0) return;
	px(g, x + 1, y + 4, 1, 3, FLESH.mid);
	px(g, x + 6, y + 4, 1, 3, FLESH.mid);
	px(g, x + 3, y + 2, 2, 1, FLESH.hi);
}

/** Rack of stained tubes (6 tubes in a 9×15 window). */
export function dnaTubes(g: Graphics, x: number, y: number, w: number, h: number, i: number, plain: boolean): void {
	px(g, x, y, w, h, HOUSING.line);
	px(g, x + 1, y + 1, w - 2, h - 2, dk(T.housing, 0.1));
	for (let r = 0; r < 2; r++)
		for (let q = 0; q < 3; q++) {
			const tx = x + 1 + q * 3;
			const ty = y + 1 + r * 7;
			const stain = plain ? lt(T.steel, 0.3) : STAINS[(q + r * 3 + i) % STAINS.length];
			px(g, tx, ty, 2, 6, GLASS);
			px(g, tx, ty + 2, 2, 4, stain);
			px(g, tx, ty, 2, 1, BRASS.mid);
			px(g, tx, ty + 1, 1, 4, lt(GLASS, 0.3), 0.7);
		}
}

/** Height of the pit mass at column `k` (gyri). */
const pitHeight = (k: number, h: number): number => Math.max(3, Math.min(h - 5, Math.round(h / 2 - 1 + 2.5 * Math.sin(k * 0.9) + 1.5 * Math.sin(k * 0.37 + 1))));

/** The big neural pit: a wide glass vat across the lower half of the rack with a folded mass and feed cables. */
export function neuralPit(g: Graphics, x: number, y: number, w: number, h: number, plain: boolean): void {
	const M = massMat(plain);
	px(g, x, y, w, h, BRASS.line);
	px(g, x + 1, y + 1, w - 2, h - 2, GLASS);
	px(g, x + 1, y + 3, w - 2, h - 4, FLUID);
	for (let k = 2; k < w - 2; k++) {
		const hk = pitHeight(k, h);
		const top = y + h - 2 - hk;
		px(g, x + k, top, 1, hk, k % 3 === 0 ? M.lo : M.mid);
		px(g, x + k, top, 1, 1, M.hi);
		if (k % 6 === 4) px(g, x + k, top + 1, 1, Math.max(1, hk - 3), M.dk); // crease between folds
		if (!plain && k % 11 === 7) px(g, x + k, top + 2, 1, Math.max(1, Math.floor(hk / 2)), BLOOD.mid);
	}
	for (const k of [5, Math.floor(w / 2), w - 6]) {
		if (k < 2 || k >= w - 2) continue;
		px(g, x + k, y + 1, 1, Math.max(1, y + h - 2 - pitHeight(k, h) - (y + 1)), T.sodium, 0.7);
	}
	px(g, x + 1, y + 1, w - 2, 1, lt(GLASS, 0.25));
	px(g, x, y + h - 1, w, 1, BRASS.lo);
}

/** Highlights drifting across the folds (none when still). */
export function neuralPulse(g: Graphics, x: number, y: number, w: number, h: number, id: number, t: number, moving: boolean): void {
	if (!moving) return;
	const step = Math.floor(t * 0.8);
	for (let k = 2; k < w - 2; k += 2) if (((k >> 1) + step + id) % 5 === 0) px(g, x + k, y + h - 2 - pitHeight(k, h), 1, 1, lt(FLESH.hi, 0.35));
}

// ─── Eyes ──────────────────────────────────────────────────────────────

/**
 * Eyes (two 3×2 whites with a pupil) or a face (two dots, a smile) drawn in a status light at (x, y). Pupils ease toward the
 * cursor through `fx.cursor` (eased by the renderer); eyes blink only while the game is paused. `(ex, ey)` is the eye centre
 * in world px for the look direction. Reduced motion centres the pupils and never blinks.
 */
export function statusEyes(
	g: Graphics,
	x: number,
	y: number,
	motif: "eyes" | "face",
	col: number,
	seed: number,
	t: number,
	fx: LiveFx,
	ex: number,
	ey: number,
	calm: boolean,
): void {
	const closed = !calm && eyeClosed(t, fx.paused, seed);
	if (motif === "face") {
		if (closed) {
			px(g, x + 1, y + 1, 1, 1, col);
			px(g, x + 5, y + 1, 1, 1, col);
		} else {
			px(g, x + 1, y, 1, 1, col);
			px(g, x + 5, y, 1, 1, col);
		}
		const wide = !calm && Math.floor(t * 0.5 + seed) % 2 === 0;
		px(g, x, y + 2, 1, 1, col);
		px(g, x + 6, y + 2, 1, 1, col);
		px(g, x + (wide ? 1 : 2), y + 3, wide ? 5 : 3, 1, col);
		return;
	}
	const p = calm || !fx.cursor ? { dx: 0, dy: 0 } : pupilOffset(ex, ey, fx.cursor.x, fx.cursor.y);
	for (const bx of [x, x + 4]) {
		if (closed) {
			px(g, bx, y + 1, 3, 1, dk(col, 0.3));
			continue;
		}
		px(g, bx, y, 3, 2, col);
		px(g, bx + 1 + p.dx, y + (p.dy < 0 ? 0 : 1), 1, 1, T.ink);
	}
}

// ─── Wetware plants ────────────────────────────────────────────────────

/** Nutrient plant: glass vats of pale-green feed over a manifold base. */
export function nutrientBody(g: Graphics, x: number, y: number, W: number, c: number): void {
	const m = mat(c);
	const n = Math.max(1, Math.floor((W - 6) / 9));
	const span = W - 6;
	for (let k = 0; k < n; k++) {
		const vx = x + 3 + Math.floor(((k + 0.5) * span) / n) - 3;
		px(g, vx, y + 3, 7, 20, BRASS.line);
		px(g, vx + 1, y + 4, 5, 18, GLASS);
		px(g, vx + 1, y + 7, 5, 15, FLUID);
		px(g, vx + 1, y + 7, 5, 1, lt(FLUID, 0.4));
		px(g, vx + 1, y + 4, 1, 17, lt(GLASS, 0.3), 0.8);
		px(g, vx, y + 3, 7, 1, BRASS.mid);
		for (let r = y + 9; r < y + 21; r += 4) px(g, vx + 6, r, 1, 1, BRASS.hi);
	}
	bevel(g, x + 1, y + 22, W - 2, H - 22, m);
	px(g, x + 3, y + 25, W - 6, 1, NUTRIENT.hi);
	px(g, x + 3, y + 26, W - 6, 1, NUTRIENT.mid);
	px(g, x + 3, y + 27, W - 6, 1, NUTRIENT.lo);
	valveWheel(g, x + Math.floor(W / 2) - 2, y + 22, 0);
}

/** Sterile bay: clinical white enamel, a row of UV tubes (glow is live) and a glass chamber of hanging trays. */
export function sterilizerBody(g: Graphics, x: number, y: number, W: number, c: number): void {
	const wm = mat(mix(T.paper, c, 0.18));
	bevel(g, x + 1, y + 3, W - 2, H - 3, wm);
	px(g, x + 3, y + 5, W - 6, 2, dk(UV, 0.55));
	px(g, x + 3, y + 5, W - 6, 1, dk(UV, 0.3));
	px(g, x + 3, y + 9, W - 6, 13, HOUSING.line);
	px(g, x + 4, y + 10, W - 8, 11, dk(UV, 0.8));
	for (let k = x + 6; k < x + W - 5; k += 4) {
		px(g, k, y + 11, 1, 8, lt(T.steel, 0.3));
		px(g, k - 1, y + 19, 3, 1, lt(T.steel, 0.15));
	}
	px(g, x + 3, y + 24, W - 6, 2, wm.lo);
	px(g, x + 2, y + H - 4, W - 4, 3, wm.dk);
}

/** Culling room: a heavy steel hatch with a hazard band, a slit window (red glow is live) and a drain. */
export function cullingBody(g: Graphics, x: number, y: number, W: number, c: number): void {
	const m = mat(dk(c, 0.15));
	bevel(g, x + 1, y + 2, W - 2, H - 2, m);
	px(g, x + 2, y + 4, W - 4, 2, T.ink);
	for (let k = x + 2; k < x + W - 4; k += 4) px(g, k, y + 4, 2, 2, T.amber);
	px(g, x + 3, y + 9, W - 6, 3, T.ink);
	for (let k = y + 15; k < y + 24; k += 2) px(g, x + 3, k, W - 6, 1, m.lo);
	valveWheel(g, x + Math.floor(W / 2) - 2, y + 14, 1);
	px(g, x + 3, y + H - 5, W - 6, 2, dk(T.bile, 0.5));
	px(g, x + 3, y + H - 5, W - 6, 1, dk(T.bile, 0.3));
}

/** Quarantine lock: a thick vault door with hinge blocks, chevrons and an interlock wheel. */
export function quarantineBody(g: Graphics, x: number, y: number, W: number, c: number): void {
	const m = mat(c);
	bevel(g, x, y + 1, W, H - 1, m);
	bevel(g, x + 2, y + 3, W - 4, H - 6, mat(dk(c, 0.2)));
	for (let r = y + 5; r < y + H - 6; r += 4) {
		px(g, x + 3, r, 2, 2, T.amber);
		px(g, x + W - 5, r, 2, 2, T.amber);
	}
	const cx = x + Math.floor(W / 2);
	ring(g, cx - 3, y + 11, 7, BRASS.mid, BRASS.line);
	px(g, cx, y + 12, 1, 5, BRASS.hi);
	px(g, cx - 2, y + 14, 5, 1, BRASS.hi);
	px(g, cx - 4, y + 5, 8, 2, HOUSING.line);
	for (const hy of [y + 8, y + 20]) px(g, x + 1, hy, 2, 4, STEEL.line);
}

/** Bio-reactor: a riveted-free steel vessel with a sight glass onto the culture, a gauge and a stack. */
export function bioreactorBody(g: Graphics, x: number, y: number, W: number, c: number, plain: boolean): void {
	const m = mat(c);
	const M = massMat(plain);
	px(g, x + 1, y + H - 3, W - 2, 3, STEEL.line);
	const vx = x + 3;
	const vw = W - 6;
	for (let k = 0; k < 23; k++) {
		const u = (k + 0.5) / 23;
		px(g, vx, y + 3 + k, vw, 1, k === 0 || k === 22 ? m.line : u < 0.2 ? m.hi : u < 0.6 ? m.mid : u < 0.85 ? m.lo : m.dk);
	}
	px(g, vx + 2, y + 7, vw - 4, 10, HOUSING.line);
	px(g, vx + 3, y + 8, vw - 6, 8, FLUID);
	px(g, vx + 3, y + 8, vw - 6, 1, lt(FLUID, 0.35));
	px(g, vx + 4, y + 11, Math.max(2, vw - 8), 4, M.mid);
	px(g, vx + 5, y + 10, Math.max(1, vw - 10), 1, M.hi);
	px(g, vx + 4, y + 14, Math.max(2, vw - 8), 1, M.lo);
	px(g, x + W - 6, y - 6, 2, 9, STEEL.lo);
	px(g, x + W - 7, y - 6, 4, 1, STEEL.hi);
	px(g, vx + 2, y + 19, vw - 4, 1, mix(NUTRIENT.mid, c, 0.5));
}

/** A growth: a lumpy mound of tissue on the slab (neutral beige-grey "asset" when horror is off). */
export function growthBody(g: Graphics, x: number, y: number, W: number, plain: boolean, seed: number): void {
	const M = massMat(plain);
	const base = y + H - 1;
	for (let k = 0; k < W; k++) {
		const edge = Math.min(1, (k + 2) / 5, (W - k + 1) / 5);
		const hk = Math.max(3, Math.min(24, Math.round((9 + 6 * Math.sin(k * 0.45 + seed) + 3 * Math.sin(k * 0.9 + 2)) * edge)));
		const top = base - hk + 1;
		px(g, x + k, top, 1, hk, k % 4 === 0 ? M.lo : M.mid);
		px(g, x + k, top, 1, 1, M.line);
		if (k % 3 === 0) px(g, x + k, top + 1, 1, 1, M.hi);
		px(g, x + k, base - 1, 1, 2, M.lo);
		if (!plain && hk >= 8 && k % 7 === 3) px(g, x + k, top + 2, 1, Math.floor(hk / 2), BLOOD.mid);
		if (hk >= 6 && hash(seed + k, 9) < 0.06) px(g, x + k, top + 4, 1, 1, M.dk);
	}
}

/** Approximate mound height at column k (used by live eyes). */
export const growthTop = (W: number, seed: number): number => {
	const k = Math.floor(W / 2);
	return Math.max(3, Math.min(24, Math.round(9 + 6 * Math.sin(k * 0.45 + seed) + 3 * Math.sin(k * 0.9 + 2))));
};

// ─── Stage overlays (static, painted into the cached body) ─────────────

export interface SkinPaint {
	effects: ReadonlySet<SkinEffect>;
	/** 0.5 mild, 1 full. */
	alpha: number;
	seed: number;
}

/**
 * Biotech stage overlays on a body: damp streaks (1), veins + flesh-tone panels + bile (2), tissue (4). Breathing and
 * eyes are live. Cheap and deterministic: a few rects per device, cached with the body (per device x stage).
 */
export function skinBody(g: Graphics, x: number, y: number, W: number, p: SkinPaint, coolant: boolean): void {
	const a = p.alpha;
	const e = p.effects;
	if (e.has("damp")) {
		for (let k = 0; k < Math.max(1, Math.floor(W / 14)); k++) {
			const sx = x + 3 + Math.floor(hash2(p.seed, k) * (W - 6));
			const len = 6 + Math.floor(hash2(p.seed, k + 9) * 9);
			px(g, sx, y + 1, 1, len, T.ink, 0.3 * a);
			dither(g, sx - 1, y + len - 1, 3, 2, T.ink, 0.25 * a, 1, k);
		}
	}
	if (e.has("flesh")) {
		px(g, x + 1, y + 5, 1, H - 12, T.flesh, 0.45 * a);
		px(g, x + W - 2, y + 5, 1, H - 12, T.flesh, 0.45 * a);
		dither(g, x + 3, y + H - 13, W - 6, 8, T.flesh, 0.4 * a, 2);
	}
	if (e.has("bile") && coolant) dither(g, x + 2, y + 3, W - 4, 10, T.bile, 0.5 * a, 2);
	if (e.has("veins")) {
		const n = Math.max(1, Math.floor(W / 20));
		for (let k = 0; k < n; k++) {
			let vx = x + 3 + Math.floor(hash2(p.seed, k + 30) * (W - 6));
			for (let r = y + H - 4; r > y + H - 22; r--) {
				if (hash2(vx, r) < 0.3) vx += hash2(r, vx) < 0.5 ? -1 : 1;
				vx = Math.max(x + 1, Math.min(x + W - 2, vx));
				px(g, vx, r, 1, 1, T.blood, 0.8 * a);
			}
		}
	}
	if (e.has("tissue")) {
		for (let by = 0; by < Math.floor(H / 2); by++)
			for (let bx = 0; bx < Math.floor(W / 2); bx++) {
				const v = hash2(p.seed + bx, by);
				if (ditherOn(bx, by, 0.4 * a) && v < 0.85) px(g, x + bx * 2, y + by * 2, 2, 2, v < 0.4 ? FLESH.mid : v < 0.7 ? FLESH.lo : FLESH.hi, 0.75 * a);
			}
		for (let k = 0; k < Math.max(2, Math.floor(W / 8)); k++) {
			const vx = x + 2 + Math.floor(hash2(p.seed, k + 70) * (W - 4));
			px(g, vx, y + 4, 1, H - 9, T.blood, 0.9 * a);
		}
	}
}

// ─── Live (per frame) ──────────────────────────────────────────────────

/** Per-frame bits for the wetware plants and growths. `active` = running. */
export function bioLive(
	g: Graphics,
	art: "nutrient" | "sterilizer" | "culling_room" | "quarantine" | "bioreactor" | "growth",
	seed: number,
	x: number,
	y: number,
	W: number,
	t: number,
	active: boolean,
	calm: boolean,
	fx: LiveFx,
	eyes: boolean,
): void {
	const still = calm || isPlain(fx);
	switch (art) {
		case "nutrient": {
			if (!active) break;
			const n = Math.max(1, Math.floor((W - 6) / 9));
			const span = W - 6;
			for (let k = 0; k < n; k++) {
				const vx = x + 3 + Math.floor(((k + 0.5) * span) / n) - 3;
				for (let b = 0; b < 3; b++) {
					const ph = calm ? hash(seed + k, b) : (t * 0.5 + hash(seed + k, b)) % 1;
					px(g, vx + 1 + ((b * 2 + k) % 5), y + 21 - Math.round(ph * 13), 1, 1, lt(PALE_GREEN, 0.5), 0.8 * (1 - ph * 0.5));
				}
			}
			break;
		}
		case "sterilizer": {
			const glow = !active ? 0.1 : calm ? 0.32 : 0.28 + 0.1 * Math.sin(t * 2.2);
			px(g, x + 3, y + 5, W - 6, 2, UV, 0.7 * glow + 0.2);
			px(g, x + 4, y + 10, W - 8, 11, UV, glow * 0.55);
			px(g, x + 2, y + 7, W - 4, 2, UV, glow * 0.25);
			break;
		}
		case "culling_room": {
			const on = active && (calm || Math.floor(t * 1.5) % 2 === 0);
			px(g, x + 3, y + 10, W - 6, 1, T.red, on ? 0.9 : 0.25);
			if (on) px(g, x + 3, y + 9, W - 6, 3, T.red, 0.18);
			break;
		}
		case "quarantine": {
			const cx = x + Math.floor(W / 2);
			px(g, cx - 3, y + 5, 2, 2, T.amber, active ? 1 : 0.4);
			px(g, cx + 1, y + 5, 2, 2, T.red, active && (calm || Math.floor(t * 1.2) % 2 === 0) ? 0.2 : 0.9);
			break;
		}
		case "bioreactor": {
			if (active && !calm) {
				const vw = W - 6;
				for (let b = 0; b < 4; b++) {
					const ph = (t * 0.6 + hash(seed, b)) % 1;
					px(g, x + 6 + ((b * 3) % Math.max(1, vw - 6)), y + 16 - Math.round(ph * 7), 1, 1, lt(PALE_GREEN, 0.6), 0.8 * (1 - ph));
				}
			}
			if (!still && active && Math.sin(t * 2) > 0) px(g, x + 6, y + 10, 1, 4, FLESH.hi, 0.7);
			if (eyes) statusEyes(g, x + Math.floor(W / 2) - 3, y + 21, "eyes", lt(PALE_GREEN, 0.5), seed, t, fx, x + Math.floor(W / 2), y + 22, calm);
			break;
		}
		case "growth": {
			if (!still && Math.sin(t * 1.9 + seed) > 0.2) {
				const top = y + H - growthTop(W, seed);
				px(g, x + Math.floor(W / 2) - 2, top - 1, 5, 1, FLESH.mid);
				px(g, x + 2, top + 4, 1, 4, FLESH.hi, 0.6);
				px(g, x + W - 3, top + 5, 1, 4, FLESH.hi, 0.6);
			}
			if (eyes) {
				const top = y + H - growthTop(W, seed);
				statusEyes(g, x + Math.floor(W / 2) - 3, top + 3, "eyes", lt(FLESH.hi, 0.5), seed, t, fx, x + Math.floor(W / 2), top + 4, calm);
			}
			break;
		}
	}
}
