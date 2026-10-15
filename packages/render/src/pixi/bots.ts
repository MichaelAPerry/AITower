/**
 * Maintenance automatons (12×12 px): filing-cabinet body, riveted dome head with
 * one camera eye, treads, a stamped crate on the back when carrying, and a
 * welding torch while repairing. Interpolated per frame.
 */
import type { ContentDB } from "@aitower/content";
import type { BotView, SimView } from "@aitower/sim";
import { Graphics } from "pixi.js";
import { floorTop } from "../camera";
import { hex, satisfactionColor } from "../color";
import { FAC_BOTTOM, TILE } from "../constants";
import type { Sample } from "../interp";
import { BRASS, CRATE, STEEL, T, dk, lt, mat } from "../palette";
import { px } from "./draw";

export const BOT_W = 12;
export const BOT_H = 12;

/** World-space bounding box (left, top) of a bot at fractional tile x / floor. */
export const botBox = (view: Pick<SimView, "floorMax">, x: number, floor: number): { x: number; y: number } => ({
	x: Math.round((x + 0.5) * TILE - BOT_W / 2),
	y: Math.round(floorTop(view, floor) + FAC_BOTTOM - BOT_H),
});

export interface Torch {
	x: number;
	y: number;
}

export class Bots {
	readonly g = new Graphics();
	/** Welding-torch tips of repairing bots this frame (world px), for the sparks effect. */
	readonly torches: Torch[] = [];
	private facing = new Map<number, 1 | -1>();

	constructor(private readonly content: ContentDB) {}

	draw(view: SimView, pos: (b: BotView) => Sample, vel: (b: BotView) => Sample, t: number): void {
		const g = this.g;
		g.clear();
		this.torches.length = 0;
		for (const b of view.bots) {
			const p = pos(b);
			const v = vel(b);
			const { x, y } = botBox(view, p.x, p.y);
			const def = this.content.bots[b.defId];
			const m = mat(def ? hex(def.color) : T.steel);
			const moving = Math.abs(v.x) > 1e-4 || Math.abs(v.y) > 1e-4;
			if (v.x > 1e-4) this.facing.set(b.id, 1);
			else if (v.x < -1e-4) this.facing.set(b.id, -1);
			const face = this.facing.get(b.id) ?? 1;
			// Mirror helper: local x (from the back) → world x.
			const X = (lx: number, w = 1): number => (face > 0 ? x + lx : x + BOT_W - lx - w);
			const R = (lx: number, ly: number, w: number, h: number, c: number, a = 1): void => px(g, X(lx, w), y + ly, w, h, c, a);
			const repairing = b.state === "repairing";
			const bob = moving && Math.floor(t * 8) % 2 === 0 ? 1 : 0;

			// Carried crate strapped to the back.
			if (b.carrying) {
				R(0, 1 + bob, 5, 5, CRATE.lo);
				R(0, 1 + bob, 5, 1, CRATE.hi);
				R(0, 2 + bob, 4, 3, CRATE.mid);
				R(1, 3 + bob, 2, 1, CRATE.stamp);
			}
			// Dome head with brass collar.
			R(4, 0 + bob, 4, 1, m.line);
			R(3, 1 + bob, 6, 1, m.hi);
			R(2, 2 + bob, 8, 2, m.mid);
			R(2, 2 + bob, 1, 2, m.line);
			R(9, 2 + bob, 1, 2, m.line);
			R(3, 2 + bob, 2, 1, m.hi);
			R(5, -1 + bob, 1, 1, BRASS.hi); // knob
			R(1, 4 + bob, 10, 1, BRASS.mid);
			R(1, 4 + bob, 1, 1, BRASS.hi);
			// The eye: dark socket, glowing lens.
			const eye = repairing ? lt(T.amber, 0.6) : b.state === "charging" ? T.green : T.amber;
			R(7, 2 + bob, 3, 2, T.ink);
			R(8, 2 + bob, 1, 1, eye);
			if (Math.floor(t * 1.3 + b.id) % 7 !== 0) R(8, 3 + bob, 1, 1, dk(eye, 0.4));
			// Filing-cabinet body with two drawers.
			R(1, 5, 10, 4, m.line);
			R(2, 5, 8, 3, m.mid);
			R(2, 5, 8, 1, m.hi);
			R(2, 7, 8, 1, m.lo);
			R(5, 6, 2, 1, BRASS.mid);
			R(5, 8, 2, 1, BRASS.lo);
			// Arm + welding torch.
			if (repairing) {
				R(10, 6, 2, 1, STEEL.mid);
				R(12, 5, 1, 2, STEEL.hi);
				const tip = { x: X(13), y: y + 5 };
				this.torches.push(tip);
				if (Math.floor(t * 20) % 3 !== 0) {
					px(g, tip.x - 1, tip.y - 1, 3, 3, T.amber, 0.35);
					px(g, tip.x, tip.y, 1, 1, lt(T.amber, 0.8));
				}
			} else R(10, 6, 1, 2, STEEL.lo);
			// Treads with rolling links.
			R(0, 9, 12, 3, T.ink);
			R(1, 9, 10, 1, dk(T.steel, 0.35));
			const ph = moving ? Math.floor(t * 14) % 3 : 0;
			for (let k = 1 + ph; k < 11; k += 3) R(k, 11, 1, 1, STEEL.lo);
			for (const wx of [1, 5, 9]) R(wx, 10, 2, 1, STEEL.mid);
			// Battery gauge above the dome.
			const bw = Math.max(1, Math.round(6 * Math.max(0, Math.min(1, b.battery))));
			px(g, x + 3, y - 4, 6, 1, T.ink, 0.8);
			px(g, x + 3, y - 4, bw, 1, satisfactionColor(b.battery));
			if (b.state === "charging") px(g, x + 10, y - 5, 1, 3, Math.floor(t * 3) % 2 ? T.amber : T.amberDim);
		}
	}
}
