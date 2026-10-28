/**
 * Living-thing and chrome pixel helpers shared by the Green, Bio and Synthetic sprites (docs/ART_DIRECTION.md).
 * Everything is axis-aligned rects from palette tokens and their shades, deterministic from a seed (`hash`), and only
 * called from the cached static pass or from live functions that use module constants and arithmetic (no allocation per frame).
 */
import type { Graphics } from "pixi.js";
import { T, TREE_GREEN, dk, lt, mat, mix } from "../palette";
import { hash, px } from "./draw";

// ─── Green: plant and fungus ───────────────────────────────────────────
export const LEAF = mat(TREE_GREEN);
export const MOSS = mat(mix(T.greenDim, TREE_GREEN, 0.28));
export const FERN = mat(mix(T.green, T.greenDim, 0.45));
export const BARK = mat(mix(T.amberDim, T.ink, 0.3));
export const SOIL = mat(mix(T.amberDim, T.ink, 0.62));
export const CAP = mat(mix(T.amber, T.flesh, 0.4));
export const SHROOM = mat(mix(T.paper, T.sodium, 0.45));
/** Mycelium thread colour and its glow. */
export const HYPHA = lt(T.sodium, 0.5);
export const SPORE = lt(T.green, 0.6);
/** Sunlight through leaves. */
export const SUN = lt(T.sodium, 0.35);

/** Scatter 1-px moss over a rect: `cover` 0..1 (denser toward the rect's top edge when `top` is set). Rows merge equal runs. */
export function scatter(g: Graphics, x: number, y: number, w: number, h: number, seed: number, cover: number, shades: readonly number[], top = false): void {
	for (let r = 0; r < h; r++) {
		const rowCover = top ? cover * (1 - (r / h) * 0.85) : cover;
		let runStart = -1;
		let runColor = 0;
		for (let c = 0; c <= w; c++) {
			let col = -1;
			if (c < w) {
				const v = hash(seed + c * 7, r * 13 + 1);
				if (v < rowCover) col = shades[Math.floor(hash(seed + c, r + 91) * shades.length)];
			}
			if (col !== runColor || c === w) {
				if (runStart >= 0 && runColor >= 0) px(g, x + runStart, y + r, c - runStart, 1, runColor);
				runStart = col >= 0 ? c : -1;
				runColor = col;
			}
		}
	}
}

/** Moss clump across a top edge: a lumpy cap `w` wide with a bright rim, shaded in three greens. */
export function mossCap(g: Graphics, x: number, y: number, w: number, seed: number, depth = 3): void {
	for (let c = 0; c < w; c++) {
		const d = 1 + Math.floor(hash(seed, c >> 1) * depth);
		px(g, x + c, y - 1 + (depth - d), 1, d + 1, MOSS.mid);
		px(g, x + c, y - 1 + (depth - d), 1, 1, hash(seed + 5, c) < 0.5 ? MOSS.hi : LEAF.mid);
		if (d > 1) px(g, x + c, y + depth - 1, 1, 1, MOSS.lo);
	}
}

/** A hanging vine: `len` px, wobbling one pixel, with a leaf every few rows. */
export function vine(g: Graphics, x: number, y: number, len: number, seed: number, bounds?: readonly [number, number]): void {
	let vx = x;
	const inside = (v: number): boolean => bounds === undefined || (v >= bounds[0] && v < bounds[1]);
	for (let r = 0; r < len; r++) {
		if (hash(seed, r) < 0.3) vx += hash(seed + 3, r) < 0.5 ? -1 : 1;
		if (inside(vx)) px(g, vx, y + r, 1, 1, r & 1 ? FERN.lo : FERN.mid);
		if (r % 4 === 2) {
			const s = hash(seed + 9, r) < 0.5 ? -1 : 1;
			if (inside(vx + s)) px(g, vx + s, y + r, 1, 1, LEAF.mid);
			if (inside(vx + s * 2)) px(g, vx + s * 2, y + r - 1 + (r % 8 === 2 ? 0 : 1), 1, 1, LEAF.hi);
		}
	}
}

/** A 3-px pair of leaves on a stem tip at (x, y): the symbol of "sprout". */
export function leafPair(g: Graphics, x: number, y: number): void {
	px(g, x - 2, y, 2, 1, LEAF.mid);
	px(g, x - 3, y - 1, 2, 1, LEAF.hi);
	px(g, x + 1, y, 2, 1, LEAF.mid);
	px(g, x + 2, y - 1, 2, 1, LEAF.hi);
	px(g, x, y, 1, 1, FERN.dk);
}

/** A sprout: stem `h` tall growing from (x, y) upward with a leaf pair on top. */
export function sprout(g: Graphics, x: number, y: number, h: number): void {
	px(g, x, y - h, 1, h, FERN.mid);
	px(g, x, y - h, 1, 1, FERN.hi);
	leafPair(g, x, y - h);
	if (h > 4) px(g, x + 1, y - 3, 2, 1, LEAF.mid);
}

/** A fern frond: `n` leaflet pairs arching up and out from (x, y), `dir` = ±1. */
export function frond(g: Graphics, x: number, y: number, n: number, dir: 1 | -1): void {
	for (let k = 0; k < n; k++) {
		const fx = x + dir * Math.round(k * 0.9);
		const fy = y - k - Math.floor((k * k) / 7);
		px(g, fx, fy, 1, 1, FERN.mid);
		px(g, fx - 1, fy - 1, 1, 1, k & 1 ? LEAF.mid : FERN.hi);
		px(g, fx + 1, fy - 1, 1, 1, k & 1 ? FERN.hi : LEAF.mid);
		if (k > 0 && k < n - 1) px(g, fx + dir, fy, 1, 1, FERN.lo);
	}
}

/** Bracket (shelf) fungus: `n` stacked half-discs from (x, y) growing out to `dir`, cream top, orange underside. */
export function bracket(g: Graphics, x: number, y: number, n: number, dir: 1 | -1, size = 5): void {
	for (let k = 0; k < n; k++) {
		const w = Math.max(3, size - k);
		const sy = y + k * 3;
		const sx = dir > 0 ? x : x - w;
		px(g, sx, sy, w, 1, SHROOM.hi);
		px(g, sx + (dir > 0 ? 0 : 1), sy + 1, w - 1, 1, SHROOM.mid);
		px(g, sx + (dir > 0 ? 0 : 2), sy + 2, Math.max(1, w - 2), 1, CAP.lo);
	}
}

/** A toadstool 5 px tall with a 5-wide red-orange cap, a pale stem and white flecks. */
export function toadstool(g: Graphics, x: number, y: number, big = true): void {
	if (big) {
		px(g, x + 2, y + 2, 1, 3, SHROOM.mid);
		px(g, x + 1, y, 3, 1, CAP.hi);
		px(g, x, y + 1, 5, 1, CAP.mid);
		px(g, x, y + 1, 1, 1, CAP.lo);
		px(g, x + 2, y + 1, 1, 1, SHROOM.hi);
	} else {
		px(g, x + 1, y + 2, 1, 2, SHROOM.mid);
		px(g, x, y + 1, 3, 1, CAP.mid);
		px(g, x + 1, y, 1, 1, CAP.hi);
	}
}

/** Mycelium: a thread random-walking from (x, y) for `len` px in direction (dx, dy) with side branches. */
export function hypha(g: Graphics, x: number, y: number, len: number, dx: number, dy: number, seed: number, alpha = 0.9, bounds?: readonly [number, number]): void {
	let hx = x;
	let hy = y;
	for (let k = 0; k < len; k++) {
		if (bounds === undefined || (hx >= bounds[0] && hx < bounds[1])) px(g, hx, hy, 1, 1, HYPHA, alpha * (1 - (k / len) * 0.5));
		const r = hash(seed, k);
		if (r < 0.45) hx += dx;
		else if (r < 0.9) hy += dy;
		else {
			hx += dx;
			hy += dy;
		}
		if (k % 6 === 4 && len - k > 4) hypha(g, hx, hy, Math.floor((len - k) / 2), dy === 0 ? 0 : dx, dx === 0 ? 0 : dy, seed + k * 3 + 1, alpha * 0.7, bounds);
	}
}

/** A round leaf clump (canopy blob) of diameter `d` at (x, y): three greens, lit top-left. */
export function clump(g: Graphics, x: number, y: number, d: number, seed: number): void {
	const r = d / 2;
	for (let j = 0; j < d; j++) {
		const yy = j + 0.5 - r;
		const half = Math.sqrt(Math.max(0, r * r - yy * yy));
		const w = Math.round(half * 2);
		if (w <= 0) continue;
		const sx = x + Math.round(r - half);
		px(g, sx, y + j, w, 1, j < d * 0.35 ? LEAF.mid : j < d * 0.7 ? FERN.mid : FERN.lo);
		// Notches and highlights make the edge leafy rather than round.
		if (hash(seed, j) < 0.55) px(g, sx, y + j, 1, 1, LEAF.hi);
		if (hash(seed + 4, j) < 0.4) px(g, sx + w - 1, y + j, 1, 1, FERN.dk);
		if (j > 1 && j < d - 1 && hash(seed + 9, j) < 0.6) px(g, sx + 1 + Math.floor(hash(seed + 2, j) * Math.max(1, w - 2)), y + j, 1, 1, hash(seed + 7, j) < 0.5 ? LEAF.hi : FERN.dk);
	}
}

// ─── Bio: flesh ────────────────────────────────────────────────────────
export const PINK = mat(mix(T.flesh, T.accent2, 0.22));
export const TISSUE = mat(mix(T.flesh, T.red, 0.18));
export const VEIN = mix(T.blood, T.red, 0.25);
export const VEIN_HI = mix(T.red, T.blood, 0.35);
export const WET = lt(T.flesh, 0.55);
export const SCLERA = mix(T.paper, T.flesh, 0.25);
export const IRIS = mix(T.amber, T.green, 0.25);

/** A branching vein: a 1-px walk from (x, y) heading (dx, dy), `len` long, forking now and then. */
export function vein(g: Graphics, x: number, y: number, len: number, dx: number, dy: number, seed: number, alpha = 0.9): void {
	let vx = x;
	let vy = y;
	for (let k = 0; k < len; k++) {
		px(g, vx, vy, 1, 1, k % 5 === 0 ? VEIN_HI : VEIN, alpha);
		const r = hash(seed, k);
		if (r < 0.55) {
			vx += dx;
			vy += dy;
		} else if (r < 0.8) vx += dx || (hash(seed + 1, k) < 0.5 ? -1 : 1);
		else vy += dy || (hash(seed + 2, k) < 0.5 ? -1 : 1);
		if (k % 7 === 5 && len - k > 4) vein(g, vx, vy, Math.floor((len - k) / 2), dx === 0 ? (hash(seed + k, 3) < 0.5 ? -1 : 1) : dx, dy === 0 ? 1 : dy, seed + k * 5 + 2, alpha * 0.8);
	}
}

/** A lumpy flesh mound: `w` wide, rising to `h`, drawn as rows with a wet highlight and shadowed lower edge. */
export function mound(g: Graphics, x: number, y: number, w: number, h: number, seed: number, base = PINK): void {
	for (let c = 0; c < w; c++) {
		const u = (c + 0.5) / w;
		const dome = Math.sqrt(Math.max(0, 1 - (2 * u - 1) ** 2));
		const hk = Math.max(1, Math.round(h * dome * (0.8 + 0.3 * hash(seed, c >> 1))));
		const top = y + h - hk;
		px(g, x + c, top, 1, hk, c % 3 === 0 ? base.lo : base.mid);
		px(g, x + c, top, 1, 1, base.hi);
		if (hk > 3 && hash(seed + 3, c) < 0.25) px(g, x + c, top + 1, 1, 1, WET);
		px(g, x + c, y + h - 1, 1, 1, base.dk);
	}
}

/** An eye of 5 × 4 px (sclera, iris, pupil, lid line). `dx`, `dy` in -1..1 move the pupil; `closed` draws the lid. */
export function eye(g: Graphics, x: number, y: number, dx: number, dy: number, closed: boolean, iris: number = IRIS): void {
	if (closed) {
		px(g, x, y + 2, 5, 1, TISSUE.dk);
		px(g, x + 1, y + 3, 3, 1, TISSUE.lo);
		return;
	}
	px(g, x + 1, y, 3, 1, TISSUE.dk);
	px(g, x, y + 1, 5, 2, SCLERA);
	px(g, x + 1, y + 3, 3, 1, TISSUE.dk);
	px(g, x + 1 + dx, y + 1 + (dy < 0 ? 0 : 0), 2, 2, iris);
	px(g, x + 2 + dx, y + 1 + (dy > 0 ? 1 : 0), 1, 1, T.ink);
	px(g, x, y + 1, 1, 1, TISSUE.lo);
	px(g, x + 4, y + 2, 1, 1, TISSUE.lo);
}

/** Bigger eye, 7 × 5. */
export function eyeBig(g: Graphics, x: number, y: number, dx: number, dy: number, closed: boolean, iris: number = IRIS): void {
	if (closed) {
		px(g, x, y + 2, 7, 1, TISSUE.dk);
		px(g, x + 1, y + 3, 5, 1, TISSUE.lo);
		px(g, x + 2, y + 1, 3, 1, TISSUE.lo);
		return;
	}
	px(g, x + 2, y, 3, 1, TISSUE.dk);
	px(g, x + 1, y + 1, 5, 1, TISSUE.lo);
	px(g, x, y + 2, 7, 2, SCLERA);
	px(g, x + 1, y + 1, 5, 1, SCLERA);
	px(g, x + 1, y + 4, 5, 1, TISSUE.dk);
	px(g, x + 2 + dx, y + 1 + dy, 3, 3, iris);
	px(g, x + 3 + dx, y + 2 + dy, 1, 1, T.ink);
	px(g, x + 2 + dx, y + 1 + dy, 1, 1, lt(iris, 0.5));
}

// ─── Synthetic: chrome ─────────────────────────────────────────────────
/** Chrome ramp: sky-white, cool light, mid steel, dark horizon, ground bounce. */
export const CHROME = {
	sky: lt(T.brass, 0.78),
	hi: mix(T.paper, T.brass, 0.3),
	mid: mix(T.steel, T.paper, 0.45),
	steel: mix(T.steel, T.paper, 0.15),
	dark: mix(T.housing, T.steel, 0.45),
	deep: mix(T.ink, T.steel, 0.2),
	ground: mix(T.brassDk, T.paper, 0.4),
	line: dk(T.housing, 0.4),
	cold: T.brass,
} as const;

/** Vertical chrome banding for a surface of height `h`: the row colour at row `r` (a mirror of sky above, dark horizon, light ground). */
export const chromeRow = (r: number, h: number): number => {
	const u = h <= 1 ? 0 : r / (h - 1);
	if (u < 0.08) return CHROME.sky;
	if (u < 0.28) return CHROME.hi;
	if (u < 0.46) return CHROME.mid;
	if (u < 0.56) return CHROME.dark;
	if (u < 0.62) return CHROME.deep;
	if (u < 0.8) return CHROME.ground;
	if (u < 0.92) return CHROME.mid;
	return CHROME.steel;
};

/** A flat chrome panel: banded rows, 1-px dark outline, bright left rim. */
export function chromeRect(g: Graphics, x: number, y: number, w: number, h: number): void {
	px(g, x, y, w, h, CHROME.line);
	for (let r = 1; r < h - 1; r++) px(g, x + 1, y + r, w - 2, 1, chromeRow(r - 1, h - 2));
	px(g, x + 1, y + 1, 1, h - 2, CHROME.sky, 0.55);
	px(g, x + w - 2, y + 1, 1, h - 2, CHROME.deep, 0.5);
}

/** A chrome cylinder lying on its side (horizontal), `h` tall: bands run across the width instead, lit top. */
export function chromeTube(g: Graphics, x: number, y: number, w: number, h: number): void {
	px(g, x, y, w, h, CHROME.line);
	for (let r = 1; r < h - 1; r++) px(g, x + 1, y + r, w - 2, 1, chromeRow(r - 1, h - 2));
	px(g, x + 1, y + 1, w - 2, 1, CHROME.sky);
}

/** A vertical chrome cylinder / pipe `w` wide: bands run across x (light, mid, dark, bounce). */
export function chromePipe(g: Graphics, x: number, y: number, w: number, h: number): void {
	px(g, x, y, w, h, CHROME.line);
	for (let c = 1; c < w - 1; c++) {
		const u = w <= 3 ? (c - 1) / Math.max(1, w - 3) : (c - 1) / (w - 3);
		px(g, x + c, y, 1, h, u < 0.2 ? CHROME.sky : u < 0.45 ? CHROME.hi : u < 0.7 ? CHROME.dark : CHROME.ground);
	}
}

/** A bright diagonal specular streak across a rect: `u` 0..1 is where it sits (swept slowly in live passes). */
export function glint(g: Graphics, x: number, y: number, w: number, h: number, u: number, a = 0.7): void {
	const span = w + h;
	const p = Math.floor(u * span);
	for (let r = 0; r < h; r++) {
		const c = p - r;
		if (c >= 0 && c < w) {
			px(g, x + c, y + r, 1, 1, CHROME.sky, a);
			if (c + 1 < w) px(g, x + c + 1, y + r, 1, 1, CHROME.hi, a * 0.45);
		}
	}
}

/** Cold-light pip with a halo. */
export function coldLed(g: Graphics, x: number, y: number, on: boolean, a = 1): void {
	if (!on) {
		px(g, x, y, 1, 1, CHROME.dark);
		return;
	}
	px(g, x - 1, y, 3, 1, CHROME.cold, 0.25 * a);
	px(g, x, y - 1, 1, 3, CHROME.cold, 0.25 * a);
	px(g, x, y, 1, 1, lt(CHROME.cold, 0.5), a);
}
