/** Particles (sparks, exhaust) and heat shimmer above racks. Purely cosmetic, per frame. */
import type { ContentDB } from "@aitower/content";
import type { BotView, SimView } from "@aitower/sim";
import { Graphics } from "pixi.js";
import { floorTop } from "../camera";
import { clamp01 } from "../color";
import { FAC_TOP, TILE } from "../constants";
import type { Sample } from "../interp";
import { botBox } from "./bots";
import { px } from "./draw";

interface Particle {
	x: number;
	y: number;
	vx: number;
	vy: number;
	life: number;
	max: number;
	color: number;
	size: number;
}

const MAX_PARTICLES = 600;

export class Effects {
	readonly g = new Graphics();
	private parts: Particle[] = [];
	private seed = 1;

	constructor(private readonly content: ContentDB) {}

	private rnd(): number {
		this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
		return this.seed / 4294967296;
	}

	private emit(p: Particle): void {
		if (this.parts.length < MAX_PARTICLES) this.parts.push(p);
	}

	update(view: SimView, botPos: (b: BotView) => Sample, dt: number, t: number): void {
		const g = this.g;
		g.clear();
		const step = Math.min(dt, 0.1);

		for (const f of view.facilities) {
			const def = this.content.facilities[f.defId];
			if (!def) continue;
			const top = floorTop(view, f.floor);
			const x = f.x * TILE;
			if (def.kind === "rack" && f.heatKw > 0.5) {
				// Heat shimmer: wavy pixels rising above the cabinets, density ∝ heat.
				const k = clamp01(f.heatKw / 120);
				const n = Math.ceil(2 + k * 6) * def.width;
				for (let i = 0; i < n; i++) {
					const ph = (t * (0.6 + k) + i * 0.37) % 1;
					const sx = x + 2 + ((i * 7) % (def.width * TILE - 4)) + Math.round(Math.sin(t * 5 + i) * 1.5);
					const sy = top + FAC_TOP - 1 - Math.round(ph * 7);
					px(g, sx, sy, 1, 1, k > 0.6 ? 0xffb080 : 0xffe0c0, (1 - ph) * (0.25 + 0.5 * k));
				}
			}
			if (def.kind === "genset" && f.running && this.rnd() < step * 12) {
				this.emit({
					x: x + def.width * TILE - 7,
					y: top + FAC_TOP - 6,
					vx: (this.rnd() - 0.3) * 6,
					vy: -10 - this.rnd() * 8,
					life: 0,
					max: 1.2 + this.rnd(),
					color: 0x8a8f96,
					size: 2,
				});
			}
		}

		for (const b of view.bots) {
			if (b.state !== "repairing") continue;
			const p = botPos(b);
			const bb = botBox(view, p.x, p.y);
			if (this.rnd() < step * 40) {
				for (let i = 0; i < 3; i++) {
					this.emit({
						x: bb.x + 9,
						y: bb.y + 3,
						vx: (this.rnd() - 0.5) * 50,
						vy: -this.rnd() * 40,
						life: 0,
						max: 0.25 + this.rnd() * 0.3,
						color: this.rnd() < 0.5 ? 0xffe14a : 0xffffff,
						size: 1,
					});
				}
			}
		}

		let w = 0;
		for (const p of this.parts) {
			p.life += step;
			if (p.life >= p.max) continue;
			p.x += p.vx * step;
			p.y += p.vy * step;
			if (p.size === 1) p.vy += 120 * step; // sparks fall
			const a = 1 - p.life / p.max;
			const sz = p.size === 1 ? 1 : Math.round(p.size + (p.life / p.max) * 3);
			px(g, Math.round(p.x), Math.round(p.y), sz, sz, p.color, p.size === 1 ? a : a * 0.55);
			this.parts[w++] = p;
		}
		this.parts.length = w;
	}
}
