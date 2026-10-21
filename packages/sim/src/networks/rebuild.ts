/** Tick stage 2: rebuild power/coolant/nutrient nets and attach facilities & lifts, only when dirty. */
import type { TickCtx } from "../core/context";
import { cellIdx } from "../core/grid";
import type { SimState } from "../core/state";
import { labelLayer } from "./unionFind";

/** Lowest net id under any of the given cells, or -1. */
function lowestNet(netOf: Int32Array, cells: number[]): number {
	let best = -1;
	for (const i of cells) {
		const n = netOf[i];
		if (n >= 0 && (best < 0 || n < best)) best = n;
	}
	return best;
}

export function attachToNets(state: SimState): void {
	for (const f of state.facilities) {
		const cells: number[] = [];
		for (let k = 0; k < f.width; k++) cells.push(cellIdx(state, f.x + k, f.floor));
		f.powerNet = lowestNet(state.powerNetOf, cells);
		f.coolantNet = lowestNet(state.coolantNetOf, cells);
		f.nutrientNet = lowestNet(state.nutrientNetOf, cells);
	}
	for (const lift of state.lifts) {
		const cells: number[] = [];
		// The car is wired into conduit running under its shaft or alongside it (one tile either side).
		for (let fl = lift.floorMin; fl <= lift.floorMax; fl++) {
			for (let dx = -1; dx <= 1; dx++) if (lift.x + dx >= 0 && lift.x + dx < state.width) cells.push(cellIdx(state, lift.x + dx, fl));
		}
		lift.powerNet = lowestNet(state.powerNetOf, cells);
	}
}

export function rebuildNetworks(ctx: TickCtx): void {
	const { state, scratch } = ctx;
	if (!state.netsDirty) return;
	state.powerNetCount = labelLayer(state, state.power, state.powerNetOf, scratch.parent, scratch.label);
	state.coolantNetCount = labelLayer(state, state.coolant, state.coolantNetOf, scratch.parent, scratch.label);
	state.nutrientNetCount = labelLayer(state, state.nutrient, state.nutrientNetOf, scratch.parent, scratch.label);
	attachToNets(state);
	state.netsDirty = false;
}
