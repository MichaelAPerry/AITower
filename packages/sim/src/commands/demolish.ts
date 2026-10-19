/** demolish: facility ▸ lift ▸ conduit(s) ▸ slab, refunding 50 %. */
import type { ConduitLayer, SimEvent } from "../api";
import { DEMOLISH_REFUND } from "../core/constants";
import { cellIdx, findById, inBounds } from "../core/grid";
import { getDef } from "../world/defs";
import { removeFacility, removeLift } from "../world/entities";
import { accept, type Plan, type PlanCtx, reject } from "./plan";
import { conduitCost, layerGrid, liftCost, slabCost } from "./structure";

export function planDemolish(ctx: PlanCtx, floor: number, x: number, layer?: ConduitLayer): Plan {
	const s = ctx.state;
	if (!inBounds(s, x, floor)) return reject("out of bounds");
	const i = cellIdx(s, x, floor);
	const done = (events: SimEvent[]): void => {
		events.push({ type: "demolished", floor, x });
	};

	const facId = s.facilityAt[i];
	if (facId >= 0) {
		const f = findById(s.facilities, facId);
		if (!f) return reject("internal: dangling facility cell");
		// A growth is free: demolishing it refunds nothing.
		return accept(f.grown ? 0 : -getDef(ctx.content, f.defId).cost * DEMOLISH_REFUND, (events) => {
			removeFacility(s, ctx.content, f);
			done(events);
		});
	}

	const liftId = s.liftAt[i];
	if (liftId >= 0) {
		const lift = findById(s.lifts, liftId);
		if (!lift) return reject("internal: dangling lift cell");
		return accept(-liftCost(ctx, lift.floorMax - lift.floorMin + 1) * DEMOLISH_REFUND, (events) => {
			removeLift(s, lift);
			done(events);
		});
	}

	const layers: ConduitLayer[] = (layer ? [layer] : (["power", "coolant", "nutrient"] as ConduitLayer[])).filter((l) => layerGrid(s, l)[i] === 1);
	if (layers.length > 0) {
		const refund = layers.reduce((sum, l) => sum + conduitCost(ctx, l), 0) * DEMOLISH_REFUND;
		return accept(-refund, (events) => {
			for (const l of layers) layerGrid(s, l)[i] = 0;
			s.netsDirty = true;
			done(events);
		});
	}
	if (s.power[i] || s.coolant[i] || s.nutrient[i]) return reject("remove the conduits on this tile first");

	if (s.slab[i]) {
		if (floor + 1 <= s.floorMax && floor + 1 > 0 && s.slab[cellIdx(s, x, floor + 1)]) return reject("slab supports the floor above");
		return accept(-slabCost(ctx, floor) * DEMOLISH_REFUND, (events) => {
			s.slab[i] = 0;
			s.topologyRev++;
			done(events);
		});
	}
	return reject("nothing to demolish");
}
