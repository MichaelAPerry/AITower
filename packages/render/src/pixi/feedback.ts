/**
 * In-world failure feedback (cosmetic, per frame): tripped racks vent steam under a red strobe; failed racks
 * show a wrench and sparks, and a small fire with smoke when hot; floors on a power net at satisfaction 0 go
 * dark under emergency lamps while a browning-out net flickers; overloaded coolant nets drip from their
 * conduit cells. `src/feedback.ts` decides what triggers what; reduced motion swaps every moving effect for a
 * static equivalent (steady tint, frozen steam cloud, fixed sparks and flames, hanging drop and puddle).
 */
import type { ContentDB } from "@aitower/content";
import type { RenderOptions } from "@aitower/shared";
import type { SimView } from "@aitower/sim";
import { Graphics } from "pixi.js";
import { floorTop } from "../camera";
import { alertColor } from "../color";
import { FAC_BOTTOM, FAC_TOP, FLOOR_H, SLAB_H, TILE } from "../constants";
import { DEFAULT_TRIP_C, type LeakDrip, type LightRun, facilityFx, leakDrips, lightRuns } from "../feedback";
import { BRASS, STEEL, T, dk, lt, mix } from "../palette";
import { hash, px } from "./draw";

interface Puff {
	x: number;
	y: number;
	vx: number;
	vy: number;
	life: number;
	max: number;
	color: number;
	/** 0 = spark (falls); otherwise the puff's start size (grows). */
	size: number;
	minY: number;
	alpha: number;
}

export interface Viewport {
	x0: number;
	x1: number;
	y0: number;
	y1: number;
}

const MAX_PARTS = 400;
const STEAM = lt(T.paper, 0.4);
const SMOKE = mix(T.housing, T.steel, 0.35);
const COOLANT = lt(T.copper, 0.3);
const STEAM_PERIOD = 2.4;
const H = FAC_BOTTOM - FAC_TOP;

export class Feedback {
	/** Lights-out / flicker darkness and emergency lamps; sits above the facility layer. */
	readonly dark = new Graphics();
	/** Strobes, wrenches, flames and particles; sits above the bots. */
	readonly g = new Graphics();
	private parts: Puff[] = [];
	private seed = 7;
	private runs: LightRun[] = [];
	private leaks: LeakDrip[] = [];
	private sat = new Map<number, number>();
	private lastBurst = new Map<number, number>();

	constructor(private readonly content: ContentDB) {}

	private rnd(): number {
		this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
		return this.seed / 4294967296;
	}

	private emit(p: Puff): void {
		if (this.parts.length < MAX_PARTS) this.parts.push(p);
	}

	/** Recompute the per-tick data: light runs, leak points and per-net satisfaction. */
	onTick(view: SimView): void {
		this.runs = lightRuns(view);
		const occupied = new Set<number>();
		for (const f of view.facilities) for (let k = 0; k < f.width; k++) occupied.add((f.floor - view.floorMin) * view.width + f.x + k);
		this.leaks = leakDrips(view, (x, fl) => occupied.has((fl - view.floorMin) * view.width + x), FAC_TOP - 1);
		this.sat.clear();
		for (const n of view.powerNets) this.sat.set(n.id, n.satisfaction);
	}

	update(view: SimView, vp: Viewport, dt: number, t: number, opt: RenderOptions): void {
		const g = this.g;
		g.clear();
		this.dark.clear();
		const step = Math.min(dt, 0.1);
		const calm = opt.reducedMotion;
		const tripC = this.content.balance?.thermal?.tripC ?? DEFAULT_TRIP_C;
		const hot = alertColor(opt.colorBlind);

		this.drawLights(view, vp, t, calm);

		for (const f of view.facilities) {
			const def = this.content.facilities[f.defId];
			if (!def) continue;
			const x = f.x * TILE;
			const W = def.width * TILE;
			const top = floorTop(view, f.floor);
			if (x > vp.x1 || x + W < vp.x0 || top > vp.y1 || top + FLOOR_H < vp.y0) continue;
			const fx = facilityFx(f, f.powerNet === null ? null : (this.sat.get(f.powerNet) ?? null), tripC);
			const y = top + FAC_TOP;
			if (fx.strobe) {
				const on = calm || Math.floor(t * 5 + f.id) % 2 === 0;
				px(g, x + 1, y, W - 2, H, hot, calm ? 0.2 : on ? 0.32 : 0.06);
				// Beacon on the cabinet top.
				const bx = x + Math.floor(W / 2) - 1;
				px(g, bx - 1, y - 3, 4, 2, BRASS.line);
				px(g, bx, y - 4, 2, 2, on ? lt(hot, 0.4) : dk(hot, 0.6));
				if (on) px(g, bx - 3, y - 6, 8, 6, hot, 0.22);
			}
			if (fx.steam) this.steam(f.id, x, W, y, t, calm);
			if (fx.wrench || fx.sparks) this.wrench(f.id, x + W - 6, y + H - 13, step, t, calm, fx.sparks);
			if (fx.fire) this.fire(f.id, x + 2, y, top, step, t, calm, fx.smoke);
		}

		this.drawLeaks(vp, t, calm);
		this.drawParticles(step);
	}

	// ─── Lights ─────────────────────────────────────────────────────────

	private drawLights(view: SimView, vp: Viewport, t: number, calm: boolean): void {
		const d = this.dark;
		for (const r of this.runs) {
			const x = r.x0 * TILE;
			const w = (r.x1 - r.x0) * TILE;
			const top = floorTop(view, r.floor);
			if (x > vp.x1 || x + w < vp.x0 || top > vp.y1 || top + FLOOR_H < vp.y0) continue;
			const h = FLOOR_H - SLAB_H;
			if (r.satisfaction <= 0) {
				px(d, x, top, w, h, T.ink, 0.52);
				// Emergency lamps every ~6 tiles, alternating phase, each with a faint red wash.
				const n = Math.max(1, Math.round((r.x1 - r.x0) / 6));
				for (let k = 0; k < n; k++) {
					const lx = x + Math.round(((k + 0.5) * w) / n);
					const on = calm || Math.floor(t * 1.6 + k) % 2 === 0;
					px(d, lx - 1, top + 11, 4, 2, BRASS.line);
					px(d, lx, top + 12, 2, 2, on ? T.red : dk(T.red, 0.6));
					if (on) {
						px(d, lx - 4, top + 14, 10, 8, T.red, 0.1);
						px(d, lx - 7, top + 22, 16, 14, T.red, 0.06);
					}
				}
			} else {
				const level = 1 - r.satisfaction;
				const slot = Math.floor(t * 9);
				const dim = calm ? 0.12 + 0.25 * level : hash(slot, r.floor * 131 + r.x0) < level * 0.9 ? 0.18 + 0.4 * level : 0.04;
				px(d, x, top, w, h, T.ink, dim);
			}
		}
	}

	// ─── Per-facility effects ───────────────────────────────────────────

	private steam(id: number, x: number, W: number, y: number, t: number, calm: boolean): void {
		const vents = [x + 3, x + W - 5];
		if (calm) {
			// Static cloud frozen above each vent.
			for (const vx of vents) {
				px(this.g, vx - 1, y - 5, 6, 3, STEAM, 0.55);
				px(this.g, vx, y - 7, 4, 3, STEAM, 0.4);
				px(this.g, vx + 1, y - 9, 2, 2, STEAM, 0.28);
			}
			return;
		}
		const burst = Math.floor((t + hash(id, 3) * STEAM_PERIOD) / STEAM_PERIOD);
		if (this.lastBurst.get(id) === burst) return;
		this.lastBurst.set(id, burst);
		for (const vx of vents) {
			for (let k = 0; k < 6; k++) {
				this.emit({
					x: vx + this.rnd() * 3,
					y: y - 1,
					vx: (this.rnd() - 0.5) * 18,
					vy: -14 - this.rnd() * 14,
					life: 0,
					max: 0.8 + this.rnd() * 0.7,
					color: STEAM,
					size: 2,
					minY: y - FAC_TOP + 1,
					alpha: 0.7,
				});
			}
		}
	}

	private wrench(id: number, wx: number, wy: number, step: number, t: number, calm: boolean, sparks: boolean): void {
		const g = this.g;
		// A brass spanner left leaning on the cabinet: open jaw on top, handle running down-left.
		px(g, wx - 1, wy - 1, 5, 4, T.ink, 0.5);
		px(g, wx, wy, 1, 2, BRASS.hi);
		px(g, wx + 2, wy, 1, 2, BRASS.hi);
		px(g, wx, wy + 2, 3, 1, BRASS.mid);
		for (let k = 0; k < 5; k++) {
			px(g, wx + 1 - k, wy + 3 + k, 2, 1, k % 2 ? STEEL.hi : BRASS.mid);
		}
		if (!sparks) return;
		if (calm) {
			px(g, wx - 1, wy - 2, 1, 1, T.amber);
			px(g, wx + 3, wy - 3, 1, 1, lt(T.amber, 0.75));
			px(g, wx + 4, wy - 1, 1, 1, T.amber);
			return;
		}
		if (this.rnd() < step * 16 + hash(id, Math.floor(t * 4)) * 0.02) {
			for (let k = 0; k < 3; k++) {
				this.emit({
					x: wx + 1,
					y: wy,
					vx: (this.rnd() - 0.5) * 50,
					vy: -this.rnd() * 40,
					life: 0,
					max: 0.2 + this.rnd() * 0.35,
					color: this.rnd() < 0.5 ? T.amber : lt(T.amber, 0.75),
					size: 0,
					minY: -1e9,
					alpha: 1,
				});
			}
		}
	}

	private fire(id: number, fx: number, y: number, top: number, step: number, t: number, calm: boolean, smoke: boolean): void {
		const g = this.g;
		const heights = [3, 5, 6, 4, 2];
		px(g, fx - 3, y - 9, 11, 9, T.sodium, 0.12);
		for (let c = 0; c < 5; c++) {
			const jitter = calm ? 0 : Math.floor(hash(id + c, Math.floor(t * 8)) * 3) - 1;
			const h = Math.max(2, heights[c] + jitter);
			px(g, fx + c, y - h, 1, h, T.red);
			px(g, fx + c, y - h + 1, 1, Math.max(1, h - 2), T.sodium);
			if (h >= 5) px(g, fx + c, y - h, 1, 1, T.amber);
		}
		px(g, fx + 1, y - 1, 3, 1, lt(T.amber, 0.7));
		if (!smoke) return;
		if (calm) {
			px(g, fx + 1, y - 11, 4, 3, SMOKE, 0.5);
			px(g, fx, y - 14, 4, 3, SMOKE, 0.38);
			px(g, fx + 1, y - 17, 3, 2, SMOKE, 0.26);
			return;
		}
		if (this.rnd() < step * 12) {
			this.emit({
				x: fx + 1 + this.rnd() * 3,
				y: y - 6,
				vx: 2 + this.rnd() * 6,
				vy: -9 - this.rnd() * 7,
				life: 0,
				max: 1.3 + this.rnd() * 0.9,
				color: this.rnd() < 0.35 ? dk(SMOKE, 0.45) : SMOKE,
				size: 2,
				minY: top + 1,
				alpha: 0.65,
			});
		}
	}

	// ─── Leaks ──────────────────────────────────────────────────────────

	private drawLeaks(vp: Viewport, t: number, calm: boolean): void {
		const g = this.g;
		for (const d of this.leaks) {
			if (d.x < vp.x0 || d.x > vp.x1 || d.y < vp.y0 || d.y > vp.y1 + FLOOR_H) continue;
			// A wet streak down the wall from the joint to where the drops land.
			px(g, d.x, d.y, 1, d.floorY - d.y, COOLANT, 0.12);
			if (calm) {
				// Frozen: a hanging drop and a puddle where it lands.
				px(g, d.x, d.y, 2, 2, COOLANT, 0.95);
				px(g, d.x - 2, d.floorY - 1, 6, 1, COOLANT, 0.75);
				px(g, d.x - 1, d.floorY, 4, 1, dk(COOLANT, 0.3), 0.7);
				continue;
			}
			const period = 0.8 + hash(d.x, d.y) * 0.9;
			const ph = (t / period + hash(d.y, d.x)) % 1;
			if (ph < 0.35) px(g, d.x, d.y, 2, 1 + Math.round(ph * 4), COOLANT, 0.55 + ph);
			else if (ph < 0.8) {
				const u = (ph - 0.35) / 0.45;
				px(g, d.x, Math.round(d.y + (d.floorY - d.y) * u * u), 2, 3, COOLANT, 0.95);
			} else {
				px(g, d.x - 1, d.floorY - 1, 1, 1, COOLANT, 0.85);
				px(g, d.x + 2, d.floorY - 1, 1, 1, COOLANT, 0.85);
			}
			// A puddle under the leak.
			px(g, d.x - 2, d.floorY, 6, 1, dk(COOLANT, 0.3), 0.6);
		}
	}

	// ─── Particles ──────────────────────────────────────────────────────

	private drawParticles(step: number): void {
		const g = this.g;
		let w = 0;
		for (const p of this.parts) {
			p.life += step;
			if (p.life >= p.max) continue;
			p.x += p.vx * step;
			p.y += p.vy * step;
			if (p.size === 0) p.vy += 140 * step;
			else if (p.y < p.minY) {
				p.y = p.minY;
				p.vy = 0;
				p.vx *= 1 + step;
			}
			const u = p.life / p.max;
			const a = 1 - u;
			if (p.size === 0) px(g, Math.round(p.x), Math.round(p.y), 1, 1, p.color, a);
			else {
				const sz = Math.round(p.size + u * 4);
				const sx = Math.round(p.x - sz / 2);
				const sy = Math.round(p.y - sz / 2);
				px(g, sx, sy + 1, sz, Math.max(1, sz - 2), p.color, a * p.alpha);
				px(g, sx + 1, sy, Math.max(1, sz - 2), sz, p.color, a * p.alpha);
			}
			this.parts[w++] = p;
		}
		this.parts.length = w;
	}
}

