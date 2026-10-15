/** Tiny drawing primitives over Pixi Graphics for pixel art (all axis-aligned rects, no anti-aliasing). */
import type { Graphics } from "pixi.js";
import { BRASS, type Mat, PAPER, T, dk, lt, mix } from "../palette";

/** Filled axis-aligned rect. */
export const px = (g: Graphics, x: number, y: number, w: number, h: number, color: number, alpha = 1): void => {
	if (w <= 0 || h <= 0) return;
	g.rect(x, y, w, h).fill({ color, alpha });
};

/** 1px rectangle outline drawn with filled rects (crisper than strokes). */
export const box = (g: Graphics, x: number, y: number, w: number, h: number, color: number, alpha = 1, t = 1): void => {
	px(g, x, y, w, t, color, alpha);
	px(g, x, y + h - t, w, t, color, alpha);
	px(g, x, y + t, t, h - 2 * t, color, alpha);
	px(g, x + w - t, y + t, t, h - 2 * t, color, alpha);
};

/** Half-width of row `i` of a pixel disc of diameter `d` (in whole pixels, same parity as d). */
const discRow = (d: number, i: number): number => {
	const r = d / 2;
	const yc = i + 0.5 - r;
	let w = Math.round(2 * Math.sqrt(Math.max(0, r * r - yc * yc)));
	if ((w & 1) !== (d & 1)) w += w < d ? 1 : -1;
	return Math.max(d & 1 ? 1 : 2, Math.min(d, w));
};

/** Pixel disc of diameter `d` with top-left at (x, y). */
export const disc = (g: Graphics, x: number, y: number, d: number, color: number, alpha = 1): void => {
	if (d <= 2) {
		px(g, x, y, d, d, color, alpha);
		return;
	}
	// Merge equal rows into runs to keep the rect count low.
	let i = 0;
	while (i < d) {
		const w = discRow(d, i);
		let j = i + 1;
		while (j < d && discRow(d, j) === w) j++;
		px(g, x + (d - w) / 2, y + i, w, j - i, color, alpha);
		i = j;
	}
};

/** Pixel ring (disc minus inner disc) — outline colour then fill. */
export const ring = (g: Graphics, x: number, y: number, d: number, rim: number, fill: number): void => {
	disc(g, x, y, d, rim);
	disc(g, x + 1, y + 1, d - 2, fill);
};

/** Brass rivet: 1px head with a highlight above-left when there is room. */
export const rivet = (g: Graphics, x: number, y: number, m: Mat = BRASS): void => {
	px(g, x, y, 1, 1, m.hi);
};

/**
 * Hardware silhouette: 1px dark outline, body fill, light rim on the top-left
 * edge and a shadow on the bottom-right (STYLE §4).
 */
export const bevel = (g: Graphics, x: number, y: number, w: number, h: number, m: Mat): void => {
	px(g, x, y, w, h, m.line);
	px(g, x + 1, y + 1, w - 2, h - 2, m.mid);
	px(g, x + 1, y + 1, w - 2, 1, m.hi);
	px(g, x + 1, y + 2, 1, h - 3, m.hi);
	px(g, x + 2, y + h - 2, w - 3, 1, m.lo);
	px(g, x + w - 2, y + 2, 1, h - 4, m.lo);
};

/** Riveted brass corner bracket (3×3 L) at a cabinet corner. `sx`/`sy` = ±1 pointing outward. */
export const cornerBracket = (g: Graphics, x: number, y: number, sx: 1 | -1, sy: 1 | -1): void => {
	const ox = sx < 0 ? x : x - 2;
	const oy = sy < 0 ? y : y - 2;
	px(g, ox, oy, 3, 3, BRASS.mid);
	px(g, sx < 0 ? ox : ox + 2, oy, 1, 3, BRASS.lo);
	px(g, ox, sy < 0 ? oy : oy + 2, 3, 1, BRASS.lo);
	px(g, ox + 1, oy + 1, 1, 1, BRASS.hi);
};

/** Round indicator lamp (2×2) with a soft glow halo when lit. */
export const lamp = (g: Graphics, x: number, y: number, color: number, on: boolean, glow = 0.32): void => {
	if (on) {
		px(g, x - 1, y, 4, 2, color, glow);
		px(g, x, y - 1, 2, 4, color, glow);
		px(g, x, y, 2, 2, color);
		px(g, x, y, 1, 1, lt(color, 0.6));
	} else {
		px(g, x, y, 2, 2, dk(color, 0.72));
		px(g, x, y, 1, 1, dk(color, 0.5));
	}
};

/**
 * Flickering CRT telemetry: scrolling bar graph inside a w×h screen at (x, y).
 * `lit`/`dim` are the phosphor pair; `level` 0..1 scales bar heights; `speed` scrolls (0 = frozen).
 */
export const crt = (
	g: Graphics,
	x: number,
	y: number,
	w: number,
	h: number,
	lit: number,
	dim: number,
	level: number,
	t: number,
	seed: number,
	speed: number,
	on: boolean,
): void => {
	if (!on) return;
	// 1–3 Hz brightness flicker: a stable pseudo-random slot per screen.
	const fl = hash(seed, Math.floor(t * 2.3)) < 0.18 ? 0.55 : 1;
	px(g, x, y, w, h, dim, 0.35 * fl);
	const shift = Math.floor(t * speed);
	for (let i = 0; i < w; i++) {
		const v = hash(seed + 7, i + shift);
		const bh = Math.max(1, Math.min(h, Math.round((0.25 + 0.75 * v) * level * h)));
		px(g, x + i, y + h - bh, 1, bh, lit, 0.9 * fl);
	}
	// Bright phosphor head on the newest column.
	px(g, x + w - 1, y, 1, h, lt(lit, 0.4), 0.5 * fl);
	// Scanlines.
	for (let sy = y + 1; sy < y + h; sy += 2) px(g, x, sy, w, 1, T.ink, 0.38);
};

/** Small integer hash in [0,1). */
export const hash = (a: number, b: number): number => {
	let h = Math.imul(a + 0x9e37, 0x85ebca6b) ^ Math.imul(b + 0x7f4a, 0xc2b2ae35);
	h ^= h >>> 15;
	h = Math.imul(h, 0x2c1b3c6d);
	h ^= h >>> 12;
	return (h >>> 0) / 4294967296;
};

/** Spinning desk-fan blades (3 pixel spokes) inside a cage of diameter d at (x, y). */
export const fanBlades = (g: Graphics, x: number, y: number, d: number, angle: number, blade: number): void => {
	const cx = x + d / 2;
	const cy = y + d / 2;
	const r = d / 2 - 1.5;
	for (let i = 0; i < 3; i++) {
		const a = angle + (i * Math.PI * 2) / 3;
		for (let s = 1; s <= Math.ceil(r); s++) {
			const k = Math.min(s, r);
			const bx = Math.floor(cx + Math.cos(a) * k);
			const by = Math.floor(cy + Math.sin(a) * k);
			px(g, bx, by, 1, 1, blade);
			// Blade width: a second pixel trailing the spoke.
			if (s > 1) px(g, Math.floor(cx + Math.cos(a - 0.45) * k), Math.floor(cy + Math.sin(a - 0.45) * k), 1, 1, dk(blade, 0.25));
		}
	}
	px(g, Math.floor(cx) - 1, Math.floor(cy) - 1, 2, 2, BRASS.mid);
	px(g, Math.floor(cx) - 1, Math.floor(cy) - 1, 1, 1, BRASS.hi);
};

/** Analog dial face (cream with brass bezel) of diameter d; needle drawn separately with `needle`. */
export const dialFace = (g: Graphics, x: number, y: number, d: number): void => {
	disc(g, x, y, d, BRASS.lo);
	disc(g, x + 1, y + 1, d - 2, PAPER.mid);
	if (d >= 7) {
		// Scale ticks along the inner rim of the sweep (8 o'clock → 4 o'clock), red zone at the end.
		const cx = x + d / 2;
		const cy = y + d / 2;
		const r = d / 2 - 1.6;
		const n = d >= 9 ? 6 : 4;
		for (let i = 0; i <= n; i++) {
			const a = Math.PI * (0.75 + (1.5 * i) / n);
			px(g, Math.floor(cx + Math.cos(a) * r), Math.floor(cy + Math.sin(a) * r), 1, 1, i >= n - 1 ? T.red : dk(T.paper, 0.55));
		}
	}
};

/** Rectangular panel meter (cream face, printed arc scale, red zone at the right); needle via `meterNeedle`. */
export const panelMeter = (g: Graphics, x: number, y: number, w: number, h: number): void => {
	px(g, x, y, w, h, BRASS.lo);
	px(g, x + 1, y + 1, w - 2, h - 2, PAPER.mid);
	px(g, x + 1, y + 1, w - 2, 1, PAPER.hi);
	// Scale: an arc of dots across the upper face.
	const n = w - 4;
	for (let i = 0; i < n; i++) {
		const u = i / (n - 1);
		const ay = y + 2 + Math.round(Math.abs(u - 0.5) * 2 * Math.min(2, h - 5));
		px(g, x + 2 + i, ay, 1, 1, u > 0.78 ? T.red : i % 2 ? dk(T.paper, 0.35) : dk(T.paper, 0.6));
	}
	px(g, x + Math.floor(w / 2) - 1, y + h - 2, 2, 1, T.ink); // pivot
};

/** Needle for `panelMeter`: pivots at the bottom centre, `v` 0..1 left → right. */
export const meterNeedle = (g: Graphics, x: number, y: number, w: number, h: number, v: number): void => {
	const cx = x + w / 2;
	const cy = y + h - 1.5;
	const a = Math.PI * (1.2 + 0.6 * Math.max(0, Math.min(1, v)));
	const len = h - 3.2;
	for (let s = 0.5; s <= len; s += 0.6) px(g, Math.floor(cx + Math.cos(a) * s), Math.floor(cy + Math.sin(a) * s), 1, 1, T.ink);
};

/** Dial needle from the dial centre; `v` 0..1 sweeps from 8 o'clock to 4 o'clock. */
export const needle = (g: Graphics, x: number, y: number, d: number, v: number, color: number = T.red): void => {
	const cx = x + d / 2;
	const cy = y + d / 2;
	const a = Math.PI * (0.75 + 1.5 * Math.max(0, Math.min(1, v)));
	const r = d / 2 - 1.2;
	for (let s = 0.5; s <= r; s += 0.7) px(g, Math.floor(cx + Math.cos(a) * s), Math.floor(cy + Math.sin(a) * s), 1, 1, color);
	px(g, Math.floor(cx - 0.5), Math.floor(cy - 0.5), 1, 1, T.ink);
};

/** Small brass valve wheel (5×5) with spokes; `phase` 0/1 rotates the spokes 45°. */
export const valveWheel = (g: Graphics, x: number, y: number, phase = 0): void => {
	ring(g, x, y, 5, BRASS.mid, BRASS.line);
	if (phase % 2 === 0) {
		px(g, x + 2, y + 1, 1, 3, BRASS.hi);
		px(g, x + 1, y + 2, 3, 1, BRASS.hi);
	} else {
		px(g, x + 1, y + 1, 1, 1, BRASS.hi);
		px(g, x + 3, y + 1, 1, 1, BRASS.hi);
		px(g, x + 1, y + 3, 1, 1, BRASS.hi);
		px(g, x + 3, y + 3, 1, 1, BRASS.hi);
		px(g, x + 2, y + 2, 1, 1, BRASS.hi);
	}
	px(g, x + 1, y, 1, 1, BRASS.hi);
};

/** Checkerboard dither over a rect (for 2-colour gradients). `step` is the pixel size. */
export const dither = (g: Graphics, x: number, y: number, w: number, h: number, color: number, alpha = 1, step = 1, phase = 0): void => {
	for (let j = 0; j < h; j += step) {
		const off = (((j / step) | 0) + phase) & 1 ? step : 0;
		for (let i = off; i < w; i += step * 2) px(g, x + i, y + j, Math.min(step, w - i), Math.min(step, h - j), color, alpha);
	}
};

export { mix };
