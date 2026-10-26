/** Facility placement rules (also exposed as the pure `canPlace`). */
import { scarOnPlace } from "../progression/soul";
import { lessonBlocksPlace } from "../lesson/lesson";
import { cellIdx, inBounds } from "../core/grid";
import { techGate } from "../research/research";
import { needsPower } from "../world/defs";
import { addFacility } from "../world/entities";
import { accept, type Plan, type PlanCtx, reject } from "./plan";

export interface PlaceOptions {
	/** Scenario setup: skip tier and research gating (and the facilities-built statistic). */
	ignoreTier?: boolean;
}

export function planPlace(ctx: PlanCtx, defId: string, floor: number, x: number, opts: PlaceOptions = {}): Plan {
	const s = ctx.state;
	const d = Object.hasOwn(ctx.content.facilities, defId) ? ctx.content.facilities[defId] : undefined;
	if (!d) return reject(`unknown facility '${defId}'`);
	if (!opts.ignoreTier) {
		const blocked = lessonBlocksPlace(s, ctx.content, defId);
		if (blocked) return reject(blocked);
	}
	if (d.growth && !opts.ignoreTier) return reject("growths cannot be built");
	if (d.retired && !opts.ignoreTier) return reject(`${d.name} is no longer built`);
	if (!inBounds(s, x, floor) || !inBounds(s, x + d.width - 1, floor)) return reject("out of bounds");
	const p = d.placement ?? {};
	if (p.minFloor !== undefined && floor < p.minFloor) return reject(`must be on floor ${p.minFloor} or above`);
	if (p.maxFloor !== undefined && floor > p.maxFloor) return reject(`must be on floor ${p.maxFloor} or below`);
	if (!opts.ignoreTier && d.unlockTier > s.tier) return reject(`requires tier ${d.unlockTier}`);
	if (!opts.ignoreTier) {
		const gate = techGate(s, ctx.content, d.tech);
		if (gate) return reject(gate);
	}
	let hasPower = false;
	let hasCoolant = false;
	let hasNutrient = false;
	for (let cx = x; cx < x + d.width; cx++) {
		const i = cellIdx(s, cx, floor);
		if (!s.slab[i]) return reject("needs floor slab under every tile");
		if (s.facilityAt[i] >= 0) return reject("overlaps another facility");
		if (s.liftAt[i] >= 0) return reject("overlaps a lift shaft");
		if (s.power[i]) hasPower = true;
		if (s.coolant[i]) hasCoolant = true;
		if (s.nutrient[i]) hasNutrient = true;
	}
	if (needsPower(d) && !hasPower) return reject("needs a power conduit under it");
	if (p.needsCoolant && !hasCoolant) return reject("needs a coolant conduit under it");
	if (p.needsNutrient && !hasNutrient) return reject("needs a nutrient conduit under it");
	return accept(d.cost, (events) => {
		addFacility(s, ctx.content, defId, floor, x);
		scarOnPlace(s, d);
		if (!opts.ignoreTier) s.stats.facilitiesBuilt++;
		events.push({ type: "built", what: "facility", floor, x });
	});
}

/** Validates a scenario facility; throws on content errors. */
export function placeScenarioFacility(ctx: PlanCtx, defId: string, floor: number, x: number): void {
	const plan = planPlace(ctx, defId, floor, x, { ignoreTier: true });
	if (!plan.ok) throw new Error(`scenario facility ${defId} at (${x}, ${floor}): ${plan.reason}`);
	plan.apply([]);
}
