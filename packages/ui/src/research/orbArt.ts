/**
 * The orb's pixel art, drawn in code (no images): a dithered radial glow, and per tree its flora growing outward
 * (Lattice circuits and crystals, Flesh veins and cells, Garden vines, leaves and flowers).
 * Art pixel = ART.U world units. The canvases cover ART.x0..x0+w by ART.y0..y0+h in world space; the stage scales them.
 */
import { TREES } from "./orbModel";

export const ART = { U: 4, x0: -720, y0: -540, w: 1440, h: 1080 };
const W = ART.w / ART.U;
const H = ART.h / ART.U;
export const ART_PX = { w: W, h: H };
const RAD_X = 560;
const RAD_Y = 395;

function rng(seed: number): () => number {
	let s = seed >>> 0;
	return () => {
		s = (Math.imul(s ^ (s >>> 15), 2246822507) + 1013904223) >>> 0;
		return s / 4294967296;
	};
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const PAL = ["#04041c", "#070730", "#0a0a44", "#0e0e58", "#13136c"];
const rad = (d: number): number => (d * Math.PI) / 180;
const angDiff = (a: number, b: number): number => Math.abs((((((a - b + 540) % 360) + 360) % 360) - 180));
/** World coordinates of an art pixel. */
const wx = (x: number): number => x * ART.U + ART.x0 + ART.U / 2;
const wy = (y: number): number => y * ART.U + ART.y0 + ART.U / 2;
const rho = (x: number, y: number): number => Math.hypot(wx(x) / RAD_X, wy(y) / RAD_Y);

export function drawBackdrop(canvas: HTMLCanvasElement): void {
	const ctx = canvas.getContext("2d");
	if (!ctx) return;
	canvas.width = W;
	canvas.height = H;
	for (let y = 0; y < H; y++)
		for (let x = 0; x < W; x++) {
			const r = rho(x, y);
			let v = Math.max(0, 1 - r * 0.95);
			v = v * v * 0.95 + (r < 1.02 ? 0.06 : 0);
			const idx = Math.min(4, Math.floor(v * 4.2 + BAYER[(y & 3) * 4 + (x & 3)] / 16));
			ctx.fillStyle = PAL[idx];
			ctx.fillRect(x, y, 1, 1);
		}
}

export function drawFlora(canvas: HTMLCanvasElement): void {
	const fc = canvas.getContext("2d");
	if (!fc) return;
	canvas.width = W;
	canvas.height = H;
	const px = (x: number, y: number, c: string, a = 1): void => {
		const X = Math.round(x);
		const Y = Math.round(y);
		if (X < 0 || Y < 0 || X >= W || Y >= H) return;
		fc.globalAlpha = a;
		fc.fillStyle = c;
		fc.fillRect(X, Y, 1, 1);
	};
	const inWedge = (deg: number, w: number, x: number, y: number, pad = 0): boolean => {
		const a = ((Math.atan2(wy(y) / RAD_Y, wx(x) / RAD_X) * 180) / Math.PI + 360) % 360;
		return angDiff(a, deg) <= w / 2 + pad;
	};
	const start = (deg: number, w: number, r: () => number, k: number): [number, number] => {
		const a = rad(deg + (r() - 0.5) * w * 0.95);
		return [(Math.cos(a) * RAD_X * k - ART.x0) / ART.U, (Math.sin(a) * RAD_Y * k - ART.y0) / ART.U];
	};
	const ang = (x: number, y: number): number => Math.atan2(wy(y) / RAD_Y, wx(x) / RAD_X);

	{
		const T = TREES.lattice;
		const r = rng(7);
		const c = T.color;
		for (let i = 0; i < 46; i++) {
			let [x, y] = start(T.deg, T.w, r, 0.3 + r() * 0.25);
			x |= 0;
			y |= 0;
			let dir = [[1, 0], [0, 1], [-1, 0], [0, -1]][(r() * 4) | 0];
			const steps = 10 + r() * 46;
			for (let s = 0; s < steps; s++) {
				const k = rho(x, y);
				if (k > 1.12 || !inWedge(T.deg, T.w, x, y, 8)) break;
				px(x, y, c, 0.16 + k * 0.26);
				if (s % 9 === 8 && r() < 0.7) {
					const a = ang(x, y);
					const opts = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
					const sc = (p: number[]): number => Math.cos(a) * p[0] * (RAD_X / ART.U) + Math.sin(a) * p[1] * (RAD_Y / ART.U);
					opts.sort((p, q) => sc(q) - sc(p));
					dir = opts[(r() * 3) | 0];
				}
				x += dir[0];
				y += dir[1];
			}
			px(x, y, "#bff3ff", 0.8);
			px(x + 1, y, c, 0.6);
			px(x - 1, y, c, 0.6);
			px(x, y + 1, c, 0.6);
			px(x, y - 1, c, 0.6);
		}
		for (let i = 0; i < 20; i++) {
			let [x, y] = start(T.deg, T.w, r, 0.6 + r() * 0.45);
			x |= 0;
			y |= 0;
			const h = 4 + ((r() * 9) | 0);
			for (let j = 0; j < h; j++) {
				const w = Math.max(0, Math.round((h - Math.abs(j - h * 0.45) * 1.4) * 0.45));
				for (let q = -w; q <= w; q++) px(x + q, y - j, q === 0 ? "#e6fbff" : c, 0.35 + 0.35 * (1 - j / h));
			}
			px(x, y - h, "#ffffff", 0.8);
		}
	}
	{
		const T = TREES.flesh;
		const r = rng(11);
		const vein = (x: number, y: number, a: number, len: number, w: number, depth: number): void => {
			for (let s = 0; s < len; s++) {
				if (!inWedge(T.deg, T.w, x, y, 10) || rho(x, y) > 1.12) return;
				const k = rho(x, y);
				for (let q = 0; q < w; q++) px(x, y + q, q === 0 ? "#ff9ab0" : "#c2243f", 0.14 + k * 0.22);
				a += (r() - 0.5) * 0.55;
				x += Math.cos(a);
				y += Math.sin(a);
				if (depth < 3 && r() < 0.05) vein(x, y, a + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.6), (len * 0.65) | 0, Math.max(1, w - 1), depth + 1);
			}
		};
		for (let i = 0; i < 12; i++) {
			const [x, y] = start(T.deg, T.w, r, 0.36 + r() * 0.1);
			vein(x, y, rad(T.deg + (r() - 0.5) * T.w), 90 + r() * 60, 3, 0);
		}
		for (let i = 0; i < 14; i++) {
			const [x0, y0] = start(T.deg, T.w, r, 0.55 + r() * 0.5);
			const rx = 2 + r() * 5;
			const ry = 2 + r() * 4;
			for (let y = -ry - 1; y <= ry + 1; y++)
				for (let x = -rx - 1; x <= rx + 1; x++) {
					const d = (x * x) / (rx * rx) + (y * y) / (ry * ry);
					if (d <= 1) {
						const e = d > 0.62;
						if (e || BAYER[((Math.round(y) + 40) & 3) * 4 + ((Math.round(x) + 40) & 3)] / 16 < 0.55) px(x0 + x, y0 + y, e ? "#ff6f8c" : "#7a1530", e ? 0.24 : 0.22);
					}
				}
			px(x0, y0, "#ffd0da", 0.7);
		}
	}
	{
		const T = TREES.garden;
		const r = rng(23);
		const c = "#9be564";
		const leaf = (x: number, y: number, dx: number, dy: number): void => {
			px(x + dx, y + dy, "#5fbf3f", 0.7);
			px(x + dx * 2, y + dy * 2 - (dy ? 0 : 1), c, 0.75);
			px(x + dx * 2, y + dy * 2, "#d4ff9a", 0.6);
			px(x + dx * 3, y + dy * 2 - (dy ? 0 : 1), c, 0.55);
		};
		for (let i = 0; i < 20; i++) {
			const [x, y] = start(T.deg, T.w, r, 0.3 + r() * 0.2);
			const a0 = ang(x, y);
			const ph = r() * 6;
			const amp = 2 + r() * 3.5;
			const len = 60 + r() * 90;
			const ux = Math.cos(a0) * (RAD_X / ART.U);
			const uy = Math.sin(a0) * (RAD_Y / ART.U);
			const L = Math.hypot(ux, uy);
			const nx = -uy / L;
			const ny = ux / L;
			for (let s = 0; s < len; s++) {
				const wob = Math.sin(s * 0.22 + ph) * amp;
				const X = Math.round(x + (ux / L) * s + nx * wob);
				const Y = Math.round(y + (uy / L) * s + ny * wob);
				if (!inWedge(T.deg, T.w, X, Y, 10) || rho(X, Y) > 1.12) break;
				px(X, Y, "#4aa83a", 0.22 + rho(X, Y) * 0.3);
				if (s % 7 === 3) leaf(X, Y, s % 14 < 7 ? 1 : -1, -1);
			}
		}
		for (let i = 0; i < 24; i++) {
			const [x0, y0] = start(T.deg, T.w, r, 0.62 + r() * 0.5);
			const x = x0 | 0;
			const y = y0 | 0;
			const h = 4 + ((r() * 7) | 0);
			for (let j = 0; j < h; j++) px(x, y - j, "#4aa83a", 0.8);
			leaf(x, y - (h >> 1), 1, -1);
			leaf(x, y - (h >> 2), -1, -1);
			const fl = ["#ffd75e", "#ff9ad5", "#ffffff"][i % 3];
			if (i % 2 === 0) {
				px(x, y - h, fl, 0.95);
				px(x - 1, y - h, fl, 0.7);
				px(x + 1, y - h, fl, 0.7);
				px(x, y - h - 1, fl, 0.7);
				px(x, y - h + 1, "#ffd75e", 0.8);
			} else {
				px(x, y - h, c, 0.9);
				px(x + 1, y - h - 1, c, 0.8);
				px(x - 1, y - h - 1, "#d4ff9a", 0.8);
			}
		}
	}
	fc.globalAlpha = 1;
}
