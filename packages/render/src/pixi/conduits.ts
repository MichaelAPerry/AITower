/**
 * Power cable (raised-floor tray) and coolant pipe pair (ceiling). Horizontal
 * runs join neighbouring cells; vertically adjacent cells are joined by risers.
 * Used for the cached normal layer and, with colour callbacks, for overlays.
 */
import type { SimView } from "@aitower/sim";
import type { Graphics } from "pixi.js";
import { floorTop } from "../camera";
import { shade } from "../color";
import { CABLE_H, CABLE_Y, FLOOR_H, PIPE_H, PIPE_RETURN_Y, PIPE_SUPPLY_Y, TILE } from "../constants";
import { px } from "./draw";

export const POWER_COLOR = 0xf5a623;
export const SUPPLY_COLOR = 0x3f8cff;
export const RETURN_COLOR = 0xff5a4a;

/** Riser column offsets within a tile. */
const POWER_RISER_X = 2;
const SUPPLY_RISER_X = 10;
const RETURN_RISER_X = 13;

type Colorer = (cellIndex: number) => number;

const at = (arr: Uint8Array, view: SimView, x: number, f: number): boolean =>
	x >= 0 && x < view.width && f >= view.floorMin && f <= view.floorMax && arr[(f - view.floorMin) * view.width + x] === 1;

export function drawPower(g: Graphics, view: SimView, color: Colorer = () => POWER_COLOR, width = CABLE_H): void {
	const arr = view.power;
	for (let f = view.floorMin; f <= view.floorMax; f++) {
		const top = floorTop(view, f);
		for (let x = 0; x < view.width; x++) {
			if (!at(arr, view, x, f)) continue;
			const i = (f - view.floorMin) * view.width + x;
			const c = color(i);
			const wx = x * TILE;
			const y = top + CABLE_Y;
			const l = at(arr, view, x - 1, f);
			const r = at(arr, view, x + 1, f);
			const x0 = l ? wx : wx + POWER_RISER_X;
			const x1 = r ? wx + TILE : wx + TILE - 3;
			px(g, x0, y, x1 - x0, width, c);
			px(g, x0, y, x1 - x0, 1, shade(c, 1.25));
			if (x % 2 === 0) px(g, wx + 6, y, 1, width, shade(c, 0.6)); // cable ties
			if (at(arr, view, x, f + 1) && !(at(arr, view, x - 1, f) && at(arr, view, x - 1, f + 1))) {
				// Riser (one per contiguous stretch of vertical links, to avoid clutter) up to the cable tray of the floor above.
				const upY = top - FLOOR_H + CABLE_Y;
				px(g, wx + POWER_RISER_X, upY, width, y - upY + width, c);
				px(g, wx + POWER_RISER_X, upY, 1, y - upY + width, shade(c, 1.25));
			}
			if (!l || !r) px(g, l ? x1 - 3 : x0, y - 1, 3, width + 2, shade(c, 0.7)); // end box
		}
	}
}

export function drawCoolant(
	g: Graphics,
	view: SimView,
	supply: Colorer = () => SUPPLY_COLOR,
	ret: Colorer = () => RETURN_COLOR,
	width = PIPE_H,
): void {
	const arr = view.coolant;
	for (let f = view.floorMin; f <= view.floorMax; f++) {
		const top = floorTop(view, f);
		for (let x = 0; x < view.width; x++) {
			if (!at(arr, view, x, f)) continue;
			const i = (f - view.floorMin) * view.width + x;
			const wx = x * TILE;
			const l = at(arr, view, x - 1, f);
			const r = at(arr, view, x + 1, f);
			const up = at(arr, view, x, f + 1) && !(at(arr, view, x - 1, f) && at(arr, view, x - 1, f + 1));
			const pipes: [number, number, number][] = [
				[supply(i), PIPE_SUPPLY_Y, SUPPLY_RISER_X],
				[ret(i), PIPE_RETURN_Y, RETURN_RISER_X],
			];
			for (const [c, py, rx] of pipes) {
				const y = top + py;
				const x0 = l ? wx : wx + 1;
				const x1 = r ? wx + TILE : wx + TILE - 1;
				px(g, x0, y, x1 - x0, width, c);
				px(g, x0, y, x1 - x0, 1, shade(c, 1.3));
				if (x % 3 === 0) px(g, wx + 8, y - 1, 1, width + 1, 0x8a9099); // hanger
				if (up) {
					// Riser through the slab to the ceiling pair of the floor above.
					const upY = top - FLOOR_H + py;
					px(g, wx + rx, upY, width, y - upY, c);
					px(g, wx + rx, upY, 1, y - upY, shade(c, 1.3));
				}
			}
			if (!l) px(g, wx, top + PIPE_SUPPLY_Y - 1, 2, PIPE_RETURN_Y - PIPE_SUPPLY_Y + width + 2, 0x8a9099);
			if (!r) px(g, wx + TILE - 2, top + PIPE_SUPPLY_Y - 1, 2, PIPE_RETURN_Y - PIPE_SUPPLY_Y + width + 2, 0x8a9099);
		}
	}
}
