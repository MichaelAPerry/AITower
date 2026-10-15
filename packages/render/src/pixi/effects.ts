/**
 * Purely cosmetic, per frame: chiller steam puffs (∝ heatKw), genset exhaust
 * smoke, welding sparks from repairing bots, heat shimmer above racks, and
 * slow drips from the coolant pipes.
 */
import type { ContentDB } from "@aitower/content";
import type { SimView } from "@aitower/sim";
import { Graphics } from "pixi.js";
import { floorTop } from "../camera";
import { clamp01 } from "../color";
import { CABLE_Y, FAC_TOP, TILE } from "../constants";
import { T, dk, lt, mix } from "../palette";
import type { Torch } from "./bots";
import { hash, px } from "./draw";

interface Particle {
	x: number;
	y: number;
	vx: number;
	vy: number;
	life: number;
	max: number;
	color: number;
	/** 0 = spark (1 px, falls), else start size of a puff that grows. */
	size: number;
	/** Ceiling: puffs spread sideways instead of rising through the slab. */
	minY: number;
	alpha: number;
}

const MAX_PARTICLES = 700;
const STEAM = lt(T.paper, 0.4);
const SMOKE = mix(T.housing, T.steel, 0.35);

export interface Drip {
	x: number;
	y: number;
	/** Floor y the drop falls to. */
	floorY: number;
}

export class Effects {
	readonly g = new Graphics();
	private parts: Particle[] = [];
	private seed = 1;
	private drips: Drip[] = [];

	constructor(private readonly content: ContentDB) {}

	setDrips(drips: Drip[]): void {
		this.drips = drips;
	}

	private rnd(): number {
		this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
		return this.seed / 4294967296;
	}

	private emit(p: Particle): void {
		if (this.parts.length < MAX_PARTICLES) this.parts.push(p);
	}

	update(view: SimView, torches: readonly Torch[], dt: number, t: number): void {
		const g = this.g;
		g.clear();
		const step = Math.min(dt, 0.1);

		for (const f of view.facilities) {
			const def = this.content.facilities[f.defId];
			if (!def) continue;
			const top = floorTop(view, f.floor);
			const x = f.x * TILE;
			const on = f.enabled && f.status !== "unpowered" && f.status !== "disabled" && f.status !== "failed";
			if (def.kind === "rack" && f.heatKw > 0.5) {
				// Heat shimmer: a few wavy pixels rising off the cabinet tops.
				const k = clamp01(f.heatKw / 120);
				const n = Math.ceil(1 + k * 4) * def.width;
				for (let i = 0; i < n; i++) {
					const ph = (t * (0.6 + k) + i * 0.37) % 1;
					const sx = x + 2 + ((i * 7) % (def.width * TILE - 4)) + Math.round(Math.sin(t * 5 + i) * 1.5);
					const sy = top + FAC_TOP - 1 - Math.round(ph * 5);
					px(g, sx, sy, 1, 1, k > 0.6 ? T.sodium : T.paper, (1 - ph) * (0.15 + 0.4 * k));
				}
			}
			if (def.kind === "chiller" && on) {
				// Steam vent: puffs proportional to the heat removed.
				const load = clamp01(f.heatKw / (def.cooling?.capacityKw ?? 600));
				if (load > 0.02 && this.rnd() < step * (2 + 22 * load)) {
					this.emit({
						x: x + 33 + this.rnd() * 2,
						y: top + 1,
						vx: 4 + this.rnd() * 10,
						vy: -6 - this.rnd() * 6,
						life: 0,
						max: 0.9 + this.rnd() * 0.9,
						color: STEAM,
						size: 2,
						minY: top + 1,
						alpha: 0.4 + 0.35 * load,
					});
				}
			}
			if (def.kind === "genset" && f.running && this.rnd() < step * 14) {
				this.emit({
					x: x + 42 + this.rnd() * 2,
					y: top + 3,
					vx: -6 - this.rnd() * 10,
					vy: -8 - this.rnd() * 8,
					life: 0,
					max: 1.4 + this.rnd(),
					color: this.rnd() < 0.3 ? dk(SMOKE, 0.4) : SMOKE,
					size: 2,
					minY: top + 1,
					alpha: 0.6,
				});
			}
		}

		// Welding sparks.
		for (const tip of torches) {
			if (this.rnd() < step * 45) {
				for (let i = 0; i < 3; i++) {
					this.emit({
						x: tip.x,
						y: tip.y,
						vx: (this.rnd() - 0.5) * 60,
						vy: -this.rnd() * 45,
						life: 0,
						max: 0.25 + this.rnd() * 0.35,
						color: this.rnd() < 0.5 ? T.amber : lt(T.amber, 0.75),
						size: 0,
						minY: -1e9,
						alpha: 1,
					});
				}
			}
		}

		// Drips: a drop swells under the return pipe, falls, and splashes on the floor.
		for (const d of this.drips) {
			const period = 3 + hash(d.x, d.y) * 5;
			const ph = (t / period + hash(d.y, d.x)) % 1;
			if (ph < 0.75) {
				if (ph > 0.35) px(g, d.x, d.y, 1, 1, lt(T.verdigris, 0.5), (ph - 0.35) * 2);
			} else if (ph < 0.92) {
				const u = (ph - 0.75) / 0.17;
				px(g, d.x, Math.round(d.y + (d.floorY - d.y) * u * u), 1, 2, lt(T.verdigris, 0.55), 0.85);
			} else {
				px(g, d.x - 1, d.floorY - 1, 1, 1, lt(T.verdigris, 0.5), 0.7);
				px(g, d.x + 1, d.floorY - 1, 1, 1, lt(T.verdigris, 0.5), 0.7);
			}
		}

		let w = 0;
		for (const p of this.parts) {
			p.life += step;
			if (p.life >= p.max) continue;
			p.x += p.vx * step;
			p.y += p.vy * step;
			if (p.size === 0) p.vy += 140 * step; // sparks fall
			else if (p.y < p.minY) {
				p.y = p.minY;
				p.vy = 0;
				p.vx *= 1 + step; // spread along the ceiling
			}
			const u = p.life / p.max;
			const a = 1 - u;
			if (p.size === 0) px(g, Math.round(p.x), Math.round(p.y), 1, 1, p.color, a);
			else {
				const sz = Math.round(p.size + u * 4);
				const sx = Math.round(p.x - sz / 2);
				const sy = Math.round(p.y - sz / 2);
				// Chunky puff: a plus-shaped blob.
				px(g, sx, sy + 1, sz, Math.max(1, sz - 2), p.color, a * p.alpha);
				px(g, sx + 1, sy, Math.max(1, sz - 2), sz, p.color, a * p.alpha);
			}
			this.parts[w++] = p;
		}
		this.parts.length = w;
	}
}

/** Floor y (world) for a drip at a given floor top. */
export const dripFloorY = (top: number): number => top + CABLE_Y;
