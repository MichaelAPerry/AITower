/**
 * The person who walks out of the lift into the pod of a Consciousness Transfer Unit (docs/ART_DIRECTION.md). One entry per
 * `consciousnessTransferred` event, a fixed pool of 6: timing comes from `transferAnim.ts`, which the pod reads too.
 * The walker is drawn on its own layer in front of the bots; it vanishes as the pod door shuts behind it.
 */
import type { SimEvent, SimView } from "@aitower/sim";
import { Graphics } from "pixi.js";
import { floorTop } from "../camera";
import { FAC_BOTTOM, TILE } from "../constants";
import { T, dk, lt } from "../palette";
import { STAND_SECONDS, startTransfer, transferPhase, walkSeconds } from "../transferAnim";
import { hash, px } from "./draw";
import { POD_CENTRE_X } from "./synthSprites";

interface Walker {
	id: number;
	floor: number;
	/** World x of the lift door and of the pod centre, px. */
	x0: number;
	x1: number;
	seed: number;
}

const POOL = 6;
const SHIRTS = [T.brass, T.amber, T.accent2, T.green, T.paper] as const;
const SKIN = lt(T.flesh, 0.25);
const HAIR = dk(T.amberDim, 0.2);
const LEG = dk(T.steel, 0.35);

export class Transfers {
	readonly g = new Graphics();
	private readonly walkers: Walker[] = [];

	/** Start a walk for each transfer event, from the nearest lift that serves the unit's floor. */
	push(events: readonly SimEvent[], view: SimView | null, t: number): void {
		if (!view) return;
		for (const ev of events) {
			if (ev.type !== "consciousnessTransferred") continue;
			const f = view.facilities.find((q) => q.id === ev.facilityId);
			if (!f) continue;
			const x1 = f.x * TILE + POD_CENTRE_X;
			let x0 = f.x * TILE - 20;
			let best = Number.POSITIVE_INFINITY;
			for (const l of view.lifts) {
				if (f.floor < l.floorMin || f.floor > l.floorMax) continue;
				const lx = l.x * TILE + TILE / 2;
				const d = Math.abs(lx - x1);
				if (d < best) {
					best = d;
					x0 = lx;
				}
			}
			startTransfer(f.id, t, walkSeconds(x1 - x0));
			if (this.walkers.length >= POOL) this.walkers.shift();
			this.walkers.push({ id: f.id, floor: f.floor, x0, x1, seed: hash(f.id, view.tick) });
		}
	}

	update(view: SimView, t: number): void {
		const g = this.g;
		g.clear();
		for (let i = this.walkers.length - 1; i >= 0; i--) {
			const w = this.walkers[i];
			const ph = transferPhase(w.id, t);
			if (!ph) {
				this.walkers.splice(i, 1);
				continue;
			}
			if (ph.s >= ph.walk + STAND_SECONDS) continue;
			const u = Math.min(1, ph.s / ph.walk);
			const x = Math.round(w.x0 + (w.x1 - w.x0) * u);
			const feet = floorTop(view, w.floor) + FAC_BOTTOM - 1;
			drawPerson(g, x, feet, w.seed, ph.s < ph.walk ? Math.floor(ph.s * 6) & 1 : 2, w.x1 >= w.x0 ? 1 : -1, Math.min(1, ph.s / 0.3));
		}
	}
}

/** Draw a person for the previews: `step` 0/1 walking, 2 standing. */
export function drawPerson(g: Graphics, cx: number, feet: number, seed: number, step: number, dir: 1 | -1, a = 1): void {
	const shirt = SHIRTS[Math.floor(hash(seed, 1) * SHIRTS.length)];
	px(g, cx - 2, feet - 10, 4, 1, HAIR, a);
	px(g, cx - 2, feet - 9, 4, 3, SKIN, a);
	px(g, cx - 2 + (dir > 0 ? 3 : 0), feet - 9, 1, 2, HAIR, a);
	px(g, cx - 2, feet - 6, 4, 4, shirt, a);
	px(g, cx - 2, feet - 6, 4, 1, lt(shirt, 0.3), a);
	if (step === 2) {
		px(g, cx - 2, feet - 2, 2, 2, LEG, a);
		px(g, cx, feet - 2, 2, 2, LEG, a);
	} else {
		px(g, cx - 2, feet - 2, 2, step === 0 ? 2 : 1, LEG, a);
		px(g, cx, feet - 2, 2, step === 0 ? 1 : 2, LEG, a);
	}
}
