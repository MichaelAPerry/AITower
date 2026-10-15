/** Facility placement rules (also exposed as the pure `canPlace`). */
import { cellIdx, inBounds } from "../core/grid";
import { needsPower } from "../world/defs";
import { addFacility } from "../world/entities";
import { accept, type Plan, type PlanCtx, reject } from "./plan";

export interface PlaceOptions {
	/** Scenario setup: skip tier gating. */
	ignoreTier?: boolean;
}

export function planPlace(ctx: PlanCtx, defId: string, floor: number, x: number, opts: PlaceOptions = {}): Plan {
	const s = ctx.state;
	const d = ctx.content.facilities[defId];
	if (!d) return reject(`unknown facility '${defId}'`);
	if (!inBounds(s, x, floor) || !inBounds(s, x + d.width - 1, floor)) return reject("out of bounds");
	const p = d.placement ?? {};
	if (p.minFloor !== undefined && floor < p.minFloor) return reject(`must be on floor ${p.minFloor} or above`);
	if (p.maxFloor !== undefined && floor > p.maxFloor) return reject(`must be on floor ${p.maxFloor} or below`);
	if (!opts.ignoreTier && d.unlockTier > s.tier) return reject(`requires tier ${d.unlockTier}`);
	let hasPower = false;
	let hasCoolant = false;
	for (let cx = x; cx < x + d.width; cx++) {
		const i = cellIdx(s, cx, floor);
		if (!s.slab[i]) return reject("needs floor slab under every tile");
		if (s.facilityAt[i] >= 0) return reject("overlaps another facility");
		if (s.liftAt[i] >= 0) return reject("overlaps a lift shaft");
		if (s.power[i]) hasPower = true;
		if (s.coolant[i]) hasCoolant = true;
	}
	if (needsPower(d) && !hasPower) return reject("needs a power conduit under it");
	if (p.needsCoolant && !hasCoolant) return reject("needs a coolant conduit under it");
	return accept(d.cost, (events) => {
		addFacility(s, ctx.content, defId, floor, x);
		events.push({ type: "built", what: "facility", floor, x });
	});
}

/** Validates a scenario facility; throws on content errors. */
export function placeScenarioFacility(ctx: PlanCtx, defId: string, floor: number, x: number): void {
	const plan = planPlace(ctx, defId, floor, x, { ignoreTier: true });
	if (!plan.ok) throw new Error(`scenario facility ${defId} at (${x}, ${floor}): ${plan.reason}`);
	plan.apply([]);
}
