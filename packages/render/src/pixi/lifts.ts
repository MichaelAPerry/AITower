/** Lift shafts (cached) and cars (per frame, interpolated). */
import type { LiftView, SimView } from "@aitower/sim";
import { Graphics } from "pixi.js";
import { floorTop } from "../camera";
import { FAC_BOTTOM, FAC_TOP, FLOOR_H, SLAB_H, TILE } from "../constants";
import { box, px } from "./draw";

const SHAFT = 0x14171c;
const RAIL = 0x4b525c;
const CAR = 0xc9ced6;
const CAR_DARK = 0x7a828d;

export const liftKey = (lifts: readonly LiftView[]): string => lifts.map((l) => `${l.id}:${l.x}:${l.floorMin}:${l.floorMax}`).join("|");

export class Lifts {
	readonly shafts = new Graphics();
	readonly cars = new Graphics();

	rebuildShafts(view: SimView): void {
		const g = this.shafts;
		g.clear();
		for (const l of view.lifts) {
			const x = l.x * TILE;
			const top = floorTop(view, l.floorMax) - 6;
			const bottom = floorTop(view, l.floorMin) + FLOOR_H;
			px(g, x + 1, top, TILE - 2, bottom - top, SHAFT);
			px(g, x + 2, top, 1, bottom - top, RAIL);
			px(g, x + TILE - 3, top, 1, bottom - top, RAIL);
			// Machine room cap.
			px(g, x, top - 4, TILE, 5, 0x5a616b);
			px(g, x + 6, top - 2, 4, 2, 0x2a2f36);
			for (let f = l.floorMin; f <= l.floorMax; f++) {
				const ft = floorTop(view, f);
				// Landing door frame and sill.
				box(g, x + 1, ft + FAC_TOP - 2, TILE - 2, FAC_BOTTOM - FAC_TOP + 2, 0x6b7380);
				px(g, x, ft + FLOOR_H - SLAB_H, TILE, SLAB_H, 0x7c838c);
				px(g, x + 6, ft + FAC_TOP - 6, 4, 2, 0x2a2f36); // floor indicator
			}
		}
	}

	/** `pos(id)` returns the interpolated carFloor. */
	drawCars(view: SimView, pos: (l: LiftView) => number, t: number): void {
		const g = this.cars;
		g.clear();
		for (const l of view.lifts) {
			const x = l.x * TILE;
			const cf = pos(l);
			const top = floorTop(view, cf);
			const y = top + FAC_TOP;
			const h = FAC_BOTTOM - FAC_TOP;
			// Cable.
			const shaftTop = floorTop(view, l.floorMax) - 6;
			px(g, x + 7, shaftTop, 2, y - shaftTop, 0x2b2f35);
			px(g, x + 2, y - 1, TILE - 4, h + 1, CAR_DARK);
			px(g, x + 3, y, TILE - 6, h - 1, CAR);
			if (l.doorsOpen) {
				px(g, x + 4, y + 2, TILE - 8, h - 4, 0xffe7a8); // lit interior
				px(g, x + 3, y + 2, 1, h - 4, CAR_DARK);
				px(g, x + TILE - 4, y + 2, 1, h - 4, CAR_DARK);
			} else {
				px(g, x + 4, y + 2, TILE - 8, h - 4, 0xaab1bb);
				px(g, x + 7, y + 2, 2, h - 4, CAR_DARK); // door seam
			}
			// Direction lamp.
			const lamp = l.dir === 0 ? 0x3a3f46 : Math.floor(t * 3) % 2 ? 0x3dff6e : 0x1a5a2a;
			px(g, x + 6, y - 4, 4, 2, lamp);
		}
	}
}
