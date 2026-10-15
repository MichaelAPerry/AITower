/**
 * Lift shafts (cached: brass frame posts, cross-bracing, landing sills, head
 * house with a dial floor indicator) and cars (per frame, interpolated: open
 * brass cage, accordion gate when the doors are closed, dial needle, winding drum).
 */
import type { LiftView, SimView } from "@aitower/sim";
import { Graphics } from "pixi.js";
import { floorTop } from "../camera";
import { FAC_BOTTOM, FAC_TOP, FLOOR_H, SLAB_H, TILE } from "../constants";
import { BRASS, STEEL, T, dk, lt, mat, mix } from "../palette";
import { dialFace, lamp, px, ring } from "./draw";

const SHAFT = mix(T.ink, T.housing, 0.5);
const HEAD = mat(T.housing);
const HEAD_H = 9; // head house rows inside the top floor's ceiling zone
const DIAL_D = 9;

export const liftKey = (lifts: readonly LiftView[]): string => lifts.map((l) => `${l.id}:${l.x}:${l.floorMin}:${l.floorMax}`).join("|");

export class Lifts {
	readonly shafts = new Graphics();
	readonly cars = new Graphics();

	rebuildShafts(view: SimView): void {
		const g = this.shafts;
		g.clear();
		for (const l of view.lifts) {
			const x = l.x * TILE;
			const top = floorTop(view, l.floorMax);
			const bottom = floorTop(view, l.floorMin) + FLOOR_H;
			px(g, x + 1, top, TILE - 2, bottom - top, SHAFT);
			// Cross-bracing lattice behind the car.
			for (let y = top + HEAD_H; y < bottom; y++) {
				const k = (y - top) % 18;
				const d = k < 9 ? k : 17 - k;
				px(g, x + 3 + d, y, 1, 1, dk(T.steel, 0.55));
				px(g, x + 12 - d, y, 1, 1, dk(T.steel, 0.62));
			}
			// Guide rails.
			px(g, x + 4, top + HEAD_H, 1, bottom - top - HEAD_H, dk(T.steel, 0.4));
			px(g, x + TILE - 5, top + HEAD_H, 1, bottom - top - HEAD_H, dk(T.steel, 0.4));
			// Brass frame posts with rivets.
			for (const fx of [x + 1, x + TILE - 3]) {
				px(g, fx, top, 2, bottom - top, BRASS.lo);
				px(g, fx, top, 1, bottom - top, BRASS.mid);
				for (let y = top + 3; y < bottom; y += 6) px(g, fx, y, 1, 1, BRASS.hi);
			}
			for (let f = l.floorMin; f <= l.floorMax; f++) {
				const ft = floorTop(view, f);
				// Landing sill (brass edge) over the slab.
				const sy = ft + FLOOR_H - SLAB_H;
				px(g, x, sy, TILE, SLAB_H, dk(T.steel, 0.35));
				px(g, x, sy, TILE, 1, BRASS.mid);
				px(g, x + 3, sy + 2, 10, 1, dk(T.steel, 0.6));
				// Call-button plate beside the landing.
				px(g, x + TILE - 3, ft + 24, 2, 4, BRASS.line);
				px(g, x + TILE - 3, ft + 25, 1, 1, T.amber);
			}
			// Head house: housing box with the dial floor indicator (needle live).
			px(g, x - 1, top, TILE + 2, HEAD_H, HEAD.line);
			px(g, x, top, TILE, HEAD_H - 1, HEAD.mid);
			px(g, x, top, TILE, 1, HEAD.hi);
			dialFace(g, x + (TILE - DIAL_D) / 2, top + 1, DIAL_D);
			// Lower half of the dial is masked by the housing: a semicircular indicator.
			px(g, x + 3, top + 6, TILE - 6, 2, HEAD.mid);
			px(g, x + 3, top + 6, TILE - 6, 1, BRASS.mid);
			// Winding drum housing on the roof / slab above (drum spokes live).
			px(g, x + 2, top - 8, TILE - 4, 8, HEAD.line);
			px(g, x + 3, top - 7, TILE - 6, 6, HEAD.lo);
			ring(g, x + 4, top - 8, 8, BRASS.lo, dk(T.housing, 0.4));
		}
	}

	/** `pos(id)` returns the interpolated carFloor. */
	drawCars(view: SimView, pos: (l: LiftView) => number, t: number): void {
		const g = this.cars;
		g.clear();
		for (const l of view.lifts) {
			const x = l.x * TILE;
			const cf = pos(l);
			const shaftTop = floorTop(view, l.floorMax);
			const y = floorTop(view, cf) + FAC_TOP;
			const h = FAC_BOTTOM - FAC_TOP;
			const moving = l.dir !== 0;

			// Dial needle: sweeps 8 o'clock → 4 o'clock across the served floors (upper half only).
			const span = Math.max(1, l.floorMax - l.floorMin);
			const v = (cf - l.floorMin) / span;
			const dx = x + (TILE - DIAL_D) / 2;
			const cx = dx + DIAL_D / 2;
			const cy = shaftTop + 1 + DIAL_D / 2;
			const ang = Math.PI * (1 + Math.max(0, Math.min(1, v)));
			for (let s = 0.5; s < 3.6; s += 0.6) px(g, Math.floor(cx + Math.cos(ang) * s), Math.floor(cy + Math.sin(ang) * s), 1, 1, T.red);
			px(g, Math.floor(cx) - 1, Math.floor(cy), 2, 1, T.ink);

			// Winding drum spokes.
			const da = moving ? t * 6 * l.dir : 0;
			for (let k = 0; k < 2; k++) {
				const a = da + (k * Math.PI) / 2;
				for (let s = -2; s <= 2; s++) px(g, Math.floor(x + 8 + Math.cos(a) * s), Math.floor(shaftTop - 4 + Math.sin(a) * s), 1, 1, BRASS.mid);
			}

			// Hoist cable.
			px(g, x + 7, shaftTop + HEAD_H, 1, y - 2 - (shaftTop + HEAD_H), STEEL.lo);
			px(g, x + 8, shaftTop + HEAD_H, 1, y - 2 - (shaftTop + HEAD_H), dk(T.steel, 0.6));

			// Cage: crosshead, floor, posts.
			px(g, x + 2, y - 2, TILE - 4, 3, BRASS.line);
			px(g, x + 3, y - 2, TILE - 6, 1, BRASS.hi);
			px(g, x + 3, y - 1, TILE - 6, 1, BRASS.lo);
			px(g, x + 6, y - 3, 4, 1, STEEL.mid); // shackle
			px(g, x + 3, y + h - 3, TILE - 6, 3, STEEL.line);
			px(g, x + 3, y + h - 3, TILE - 6, 1, STEEL.hi);
			// Interior: back cage bars and a bare bulb.
			px(g, x + 4, y + 1, TILE - 8, h - 4, dk(T.housing, 0.25));
			for (let bx = x + 5; bx < x + TILE - 4; bx += 2) px(g, bx, y + 1, 1, h - 4, dk(T.steel, 0.35));
			const bulbOn = l.doorsOpen || moving;
			px(g, x + 7, y + 1, 2, 1, STEEL.mid);
			px(g, x + 7, y + 2, 2, 2, bulbOn ? lt(T.sodium, 0.5) : dk(T.paper, 0.5));
			if (bulbOn) px(g, x + 4, y + 2, TILE - 8, 8, T.sodium, 0.18);
			// Side posts.
			px(g, x + 2, y, 2, h - 2, BRASS.mid);
			px(g, x + 2, y, 1, h - 2, BRASS.hi);
			px(g, x + TILE - 4, y, 2, h - 2, BRASS.lo);

			// Accordion gate.
			if (l.doorsOpen) {
				// Folded to the left: a tight bundle of bars.
				for (let k = 0; k < 3; k++) px(g, x + 4 + k, y + 1, 1, h - 4, k % 2 ? BRASS.lo : BRASS.mid);
			} else {
				const bars = [x + 4, x + 7, x + 10];
				for (const bx of bars) px(g, bx, y + 1, 1, h - 4, BRASS.mid);
				px(g, x + TILE - 5, y + 1, 1, h - 4, BRASS.mid);
				// Scissor links between the bars.
				for (let r = 0; r < h - 4; r++) {
					const z = r % 6 < 3 ? r % 3 : 3 - (r % 3);
					for (const bx of bars) px(g, bx + z, y + 1 + r, 1, 1, BRASS.lo);
				}
			}
			// Direction lamp on the crosshead.
			const on = moving && Math.floor(t * 3) % 2 === 0;
			lamp(g, x + 11, y - 5, l.dir === 0 ? T.amberDim : T.amber, on || l.dir === 0, 0.3);
		}
	}
}

