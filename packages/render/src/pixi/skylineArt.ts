/**
 * Draws a skyline plan (`skyline.ts`) into shared `GraphicsContext`s, filled white and tinted per layer at draw time.
 * Besides the brutalist body, shade, windows and the AITOWER sign there are two path layers: `deco` (flesh, greenery,
 * glass) and `accent` (bright bits: pustules and eyes, turbine blades, light lines). Cranes, spires and turbine masts are
 * part of the body silhouette.
 */
import { GraphicsContext } from "pixi.js";
import { SIGN_ALT, SIGN_WORD } from "../horror";
import { CITY_SPAN, type SkyBuilding, type SkyStyle, planCity, rand } from "./skyline";

/** 5×7 block glyphs for the sign. */
const GLYPHS: Record<string, string[]> = {
	M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
	I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
	N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
	S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
	T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
	R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
	Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
	H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
	U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
	G: ["01110", "10001", "10000", "10111", "10001", "10001", "01110"],
	A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
	O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
	W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
	E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
};

export interface CityCtx {
	body: GraphicsContext;
	/** Recesses / shadow sides, tinted darker than the body. */
	shade: GraphicsContext;
	/** Window lights, visible at night. */
	lights: GraphicsContext;
	/** Path look: fleshy growths and tendrils, green roofs and vines, glass panels. */
	deco: GraphicsContext;
	/** Path highlights: pustules and eyes, turbine blades, light lines. */
	accent: GraphicsContext;
	/** Sign letters. */
	sign: GraphicsContext;
	/** The same sign showing the alternate word (stage 4 flicker). */
	alt: GraphicsContext;
	/** Aircraft lamp positions (tile-local world px). */
	lamps: { x: number; y: number; phase: number }[];
	/** Searchlight origins (tile-local). */
	beams: { x: number; y: number; phase: number }[];
}

const W = 0xffffff;

function crane(c: CityCtx, b: SkyBuilding, roofY: number, cx: number): void {
	const d = b.crane;
	const mh = 30 + (b.seed % 3) * 6;
	const top = roofY - mh;
	c.body.rect(cx, top, 2, mh).fill({ color: W }); // mast
	for (let k = 0; k < mh; k += 4) c.shade.rect(cx, top + k, 2, 1).fill({ color: W }); // lattice rungs
	c.body.rect(cx - (d > 0 ? 8 : 24), top - 2, 34, 2).fill({ color: W }); // jib + counter-jib
	c.body.rect(cx - 1, top - 6, 4, 4).fill({ color: W }); // cab
	const tip = cx + (d > 0 ? 26 : -22);
	c.body.rect(tip, top, 1, 12).fill({ color: W }); // hoist cable
	c.body.rect(tip - 1, top + 12, 3, 3).fill({ color: W }); // load
	c.body.rect(cx + (d > 0 ? -8 : 10), top, 3, 5).fill({ color: W }); // counterweight
	c.lamps.push({ x: cx, y: top - 7, phase: (b.seed % 6) + 0.5 });
}

/** Decorate one building with the path look. */
function decorate(c: CityCtx, b: SkyBuilding, path: NonNullable<SkyStyle["path"]>, stage: number, roofY: number, rx: number, rw: number): void {
	const q = rand(b.seed);
	const left = b.x - 1;
	const right = b.x + b.w;
	if (path === "biotech") {
		// Growths bulging over the roofline.
		const n = 1 + Math.floor(stage / 2) + (q() < 0.5 ? 1 : 0);
		for (let i = 0; i < n; i++) {
			const gx = rx + 3 + Math.floor(q() * Math.max(1, rw - 12));
			const gw = 6 + Math.floor(q() * 6) + stage;
			const gh = 3 + Math.floor(q() * 3) + stage;
			c.deco.rect(gx, roofY - gh + 1, gw, gh).fill({ color: W });
			c.deco.rect(gx + 1, roofY - gh - 1, gw - 2, 2).fill({ color: W });
			c.deco.rect(gx + 2, roofY - gh - 2, Math.max(1, gw - 5), 1).fill({ color: W });
			if (stage >= 3 && q() < 0.7) c.accent.rect(gx + Math.floor(gw / 2) - 1, roofY - gh + 1, 3, 2).fill({ color: W }); // an eye
		}
		// Tendrils hanging down the flanks.
		const t = 1 + Math.floor(stage / 2);
		for (let i = 0; i < t; i++) {
			const ex = q() < 0.5 ? left : right;
			const len = 10 + stage * 7 + Math.floor(q() * 18);
			const ph = q() * 6;
			for (let j = 0; j < len; j++) c.deco.rect(ex + Math.round(Math.sin(j * 0.55 + ph) * 1.6), roofY + 2 + j, j % 7 < 3 ? 2 : 1, 1).fill({ color: W });
		}
		// Weeping pustules on the facade.
		for (let i = 0; i < stage; i++) c.accent.rect(b.x + 3 + Math.floor(q() * (b.w - 8)), -b.h + 6 + Math.floor(q() * Math.max(1, b.h - 16)), 2, 2).fill({ color: W });
	} else if (path === "greentech") {
		// Green roof with tufts.
		c.deco.rect(rx, roofY - 2, rw, 2).fill({ color: W });
		for (let k = rx + 1; k < rx + rw - 1; k += 3) if (q() < 0.6) c.deco.rect(k, roofY - 3 - Math.floor(q() * (1 + stage)), 1, 2).fill({ color: W });
		// Vines down the sides.
		const v = 1 + Math.floor(stage / 2);
		for (let i = 0; i < v; i++) {
			const ex = q() < 0.5 ? b.x + 1 : right - 2;
			const len = 12 + stage * 8 + Math.floor(q() * 24);
			for (let j = 0; j < len; j++) {
				if (j % 6 === 5) continue;
				c.deco.rect(ex, roofY + j, 1, 1).fill({ color: W });
				if (j % 4 === 1) c.deco.rect(ex + (j % 8 < 4 ? 1 : -1), roofY + j, 1, 1).fill({ color: W });
			}
		}
		if (b.turbine) {
			const mx = rx + Math.floor(rw / 2);
			const hy = roofY - 18;
			c.body.rect(mx, hy, 1, 18).fill({ color: W });
			const a0 = q() * 2.1;
			for (let k = 0; k < 3; k++) {
				const a = a0 + k * 2.094;
				for (let r = 1; r <= 9; r++) c.accent.rect(mx + Math.round(Math.cos(a) * r), hy + Math.round(Math.sin(a) * r), 1, 1).fill({ color: W });
			}
			c.accent.rect(mx - 1, hy - 1, 3, 2).fill({ color: W });
		}
	} else {
		// Synthetic: a glass skin with a diagonal glint, a tapered crown and light lines.
		c.deco.rect(b.x + 2, -b.h + 2, b.w - 5, b.h - 4).fill({ color: W });
		c.accent.rect(rx, roofY, rw, 1).fill({ color: W });
		c.accent.rect(right - 2, -b.h, 1, b.h).fill({ color: W });
		for (let k = 0; k < stage; k++) c.accent.rect(b.x + 2, -Math.floor(((k + 1) * b.h) / (stage + 1)), b.w - 5, 1).fill({ color: W });
		if (stage >= 2) {
			const cx = rx + Math.floor(rw / 2);
			for (let k = 0; k < 7; k++) c.body.rect(cx - 5 + k, roofY - 1 - k * 2, 11 - k * 2, 2).fill({ color: W });
			c.accent.rect(cx, roofY - 17, 1, 8).fill({ color: W });
		}
	}
}

export function buildCity(seed: number, minH: number, maxH: number, withSign: boolean, style: SkyStyle, far = false): CityCtx {
	const c: CityCtx = {
		body: new GraphicsContext(),
		shade: new GraphicsContext(),
		lights: new GraphicsContext(),
		deco: new GraphicsContext(),
		accent: new GraphicsContext(),
		sign: new GraphicsContext(),
		alt: new GraphicsContext(),
		lamps: [],
		beams: [],
	};
	const { body, shade, lights, sign, alt, lamps, beams } = c;
	for (const b of planCity(seed, minH, maxH, withSign, style, far)) {
		const { x, w, h, kind } = b;
		const r = rand(b.seed);
		body.rect(x, -h, w, h).fill({ color: W });
		shade.rect(x + w - 3, -h, 3, h).fill({ color: W });
		let roofY = -h;
		let rx = x;
		let rw = w;
		if (kind === 0) {
			body.rect(x - 4, -h - b.extra, w + 8, b.extra).fill({ color: W });
			shade.rect(x - 4, -h - 2, w + 8, 2).fill({ color: W });
			shade.rect(x + w + 1, -h - b.extra, 3, b.extra).fill({ color: W });
			roofY = -h - b.extra;
			rx = x - 4;
			rw = w + 8;
		} else if (kind === 1) {
			body.rect(x + 6, -h - 12, w - 12, 12).fill({ color: W });
			body.rect(x + 2, -h - 20, 7, 20).fill({ color: W });
			roofY = -h - 12;
			rx = x + 6;
			rw = w - 12;
		}
		// Horizontal strip windows (recessed) every 6 px.
		for (let wy = -h + 6; wy < -6; wy += 6) {
			shade.rect(x + 2, wy, w - 5, 2).fill({ color: W });
			for (let wx = x + 3; wx < x + w - 4; wx += 3) if (r() < b.lit) lights.rect(wx, wy, 2, 2).fill({ color: W });
		}
		if (b.mast) {
			const ax = x + Math.floor(w / 2);
			const ay = kind === 0 ? -h - 32 : -h - 20;
			body.rect(ax, ay - b.mast, 1, b.mast).fill({ color: W });
			body.rect(ax - 2, ay - Math.floor(b.mast / 2), 5, 1).fill({ color: W });
			lamps.push({ x: ax, y: ay - b.mast - 1, phase: r() * 6 });
		}
		if (b.beam) beams.push({ x: x + Math.floor(w / 2), y: -h - 2, phase: r() * 6 });
		if (b.crane) crane(c, b, roofY, x + Math.floor(w / 2));
		if (style.path && b.deco) decorate(c, b, style.path, style.stage, roofY, rx, rw);
		if (b.sign) {
			// Scaffold + letters on the roof.
			const text = SIGN_WORD;
			const S = 2; // giant: 2× block glyphs
			const sw = text.length * 6 * S + 2;
			const sx = x + Math.floor((w - sw) / 2);
			const sy = -h - 7 * S - 10;
			for (let k = sx; k < sx + sw; k += 8) body.rect(k, sy + 7 * S, 1, 10).fill({ color: W });
			body.rect(sx, sy + 7 * S + 2, sw, 1).fill({ color: W });
			body.rect(sx, sy + 7 * S + 7, sw, 1).fill({ color: W });
			for (let k = sx; k < sx + sw - 8; k += 8) for (let d = 0; d < 5; d++) body.rect(k + d + 1, sy + 7 * S + 2 + d, 1, 1).fill({ color: W });
			const letters = (ctx: GraphicsContext, word: string): void => {
				// Centre a shorter word inside the same eight slots.
				let lx = sx + 2 + Math.floor((text.length - word.length) / 2) * 6 * S;
				for (const ch of word) {
					const gl = GLYPHS[ch];
					for (let gy = 0; gy < 7; gy++) for (let gx = 0; gx < 5; gx++) if (gl[gy][gx] === "1") ctx.rect(lx + gx * S, sy + gy * S, S, S).fill({ color: W });
					lx += 6 * S;
				}
			};
			letters(sign, text);
			letters(alt, SIGN_ALT);
			lamps.push({ x: sx - 1, y: sy - 2, phase: 0 });
			lamps.push({ x: sx + sw, y: sy - 2, phase: 3 });
			beams.push({ x: x + 6, y: -h - 1, phase: 1.2 });
		}
	}
	return c;
}

export { CITY_SPAN };
