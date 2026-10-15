/** demolish: facility ▸ lift ▸ conduit(s) ▸ slab, refunding 50 %. */
import type { ConduitLayer } from "../api";
import { DEMOLISH_REFUND } from "../core/constants";
import { cellIdx, findById, inBounds } from "../core/grid";
import { getDef } from "../world/defs";
import { removeFacility, removeLift } from "../world/entities";
import { accept, type Plan, type PlanCtx, reject } from "./plan";
import { conduitCost, liftCost, slabCost } from "./structure";

export function planDemolish(ctx: PlanCtx, floor: number, x: number, layer?: ConduitLayer): Plan {
	const s = ctx.state;
	if (!inBounds(s, x, floor)) return reject("out of bounds");
	const i = cellIdx(s, x, floor);
	const done = (events: Parameters<Extract<Plan, { ok: true }>["apply"]>[0]): void => {
		events.push({ type: "demolished", floor, x });
	};

	const facId = s.facilityAt[i];
	if (facId >= 0) {
		const f = findById(s.facilities, facId);
		if (!f) return reject("internal: dangling facility cell");
		return accept(-getDef(ctx.content, f.defId).cost * DEMOLISH_REFUND, (events) => {
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

	const layers: ConduitLayer[] = (layer ? [layer] : ["power", "coolant"]).filter((l) =>
		l === "power" ? s.power[i] === 1 : s.coolant[i] === 1,
	);
	if (layers.length > 0) {
		const refund = layers.reduce((sum, l) => sum + conduitCost(ctx, l), 0) * DEMOLISH_REFUND;
		return accept(-refund, (events) => {
			for (const l of layers) (l === "power" ? s.power : s.coolant)[i] = 0;
			s.netsDirty = true;
			done(events);
		});
	}
	if (s.power[i] || s.coolant[i]) return reject("remove the conduits on this tile first");

	if (s.slab[i]) {
		if (floor + 1 <= s.floorMax && floor + 1 > 0 && s.slab[cellIdx(s, x, floor + 1)]) return reject("slab supports the floor above");
		return accept(-slabCost(ctx, floor) * DEMOLISH_REFUND, (events) => {
			s.slab[i] = 0;
			done(events);
		});
	}
	return reject("nothing to demolish");
}
