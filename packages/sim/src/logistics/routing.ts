/**
 * Bot routing. Bots walk along contiguous slab on one floor; changing floors needs one lift whose
 * shaft spans both floors (single-transfer routes only). Positions are tile indices (x = 3 ⇒ centred
 * on tile 3).
 */
import { cellIdx, inBounds } from "../core/grid";
import type { SimState } from "../core/state";

/** Every tile between xa and xb (inclusive, rounded outward) on `floor` has slab. */
export function walkable(state: SimState, floor: number, xa: number, xb: number): boolean {
	const lo = Math.floor(Math.min(xa, xb));
	const hi = Math.ceil(Math.max(xa, xb));
	for (let x = lo; x <= hi; x++) {
		if (!inBounds(state, x, floor) || !state.slab[cellIdx(state, x, floor)]) return false;
	}
	return true;
}

export const WALK_DIRECT = -1;

/** Lift id to use, WALK_DIRECT, or null when unreachable. Ties → lowest lift id. */
export function planRoute(state: SimState, fromFloor: number, fromX: number, toFloor: number, toX: number): number | null {
	if (fromFloor === toFloor) return walkable(state, fromFloor, fromX, toX) ? WALK_DIRECT : null;
	let best: number | null = null;
	let bestCost = Number.POSITIVE_INFINITY;
	for (const lift of state.lifts) {
		if (fromFloor < lift.floorMin || fromFloor > lift.floorMax || toFloor < lift.floorMin || toFloor > lift.floorMax) continue;
		if (!walkable(state, fromFloor, fromX, lift.x) || !walkable(state, toFloor, lift.x, toX)) continue;
		const cost = Math.abs(fromX - lift.x) + Math.abs(lift.x - toX) + Math.abs(fromFloor - toFloor);
		if (cost < bestCost) {
			bestCost = cost;
			best = lift.id;
		}
	}
	return best;
}

/** Rough travel cost used to pick between depots (tiles + floors). */
export const travelCost = (fromFloor: number, fromX: number, toFloor: number, toX: number): number =>
	Math.abs(fromX - toX) + 4 * Math.abs(fromFloor - toFloor);
