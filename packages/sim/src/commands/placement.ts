/** Facility placement rules (also exposed as the pure `canPlace`). */
import { type FacilityDef, isRetrofitOnly } from "@aitower/content";
import { placeBlock } from "../progression/access";
import { scarOnPlace } from "../progression/soul";
import { lessonBlocksPlace } from "../lesson/lesson";
import { cellIdx, inBounds } from "../core/grid";
import type { SimState } from "../core/state";
import { needsPower } from "../world/defs";
import { addFacility } from "../world/entities";
import { accept, type Plan, type PlanCtx, reject } from "./plan";

export interface PlaceOptions {
	/** Scenario setup: skip tier and research gating (and the facilities-built statistic). */
	ignoreTier?: boolean;
}

/**
 * Site rules for `d` with its left edge at `x` on `floor`: bounds, floors, roof / exterior / basement flags, slab, overlaps, conduits.
 * `except` is a facility id whose own cells do not count as occupied (an upgrade replacing it). Returns the reason or null.
 */
export function siteBlock(s: SimState, d: FacilityDef, floor: number, x: number, except = -1): string | null {
	if (!inBounds(s, x, floor) || !inBounds(s, x + d.width - 1, floor)) return "out of bounds";
	const p = d.placement ?? {};
	if (p.minFloor !== undefined && floor < p.minFloor) return `must be on floor ${p.minFloor} or above`;
	if (p.maxFloor !== undefined && floor > p.maxFloor) return `must be on floor ${p.maxFloor} or below`;
	if (p.basementOnly && floor >= 0) return "must go in a basement";
	if (p.roofOnly) {
		// The roof: nothing is built above any tile of it.
		if (floor + 1 <= s.floorMax) for (let cx = x; cx < x + d.width; cx++) if (s.slab[cellIdx(s, cx, floor + 1)]) return "must stand on the roof (nothing built above it)";
	}
	if (p.exteriorOnly) {
		const edge = (cx: number): boolean => cx < 0 || cx >= s.width || !s.slab[cellIdx(s, cx, floor)];
		if (!edge(x - 1) && !edge(x + d.width)) return "must stand at the edge of the floor, on an exterior wall";
	}
	let hasPower = false;
	let hasCoolant = false;
	let hasNutrient = false;
	for (let cx = x; cx < x + d.width; cx++) {
		const i = cellIdx(s, cx, floor);
		if (!s.slab[i]) return "needs floor slab under every tile";
		if (s.facilityAt[i] >= 0 && s.facilityAt[i] !== except) return "overlaps another facility";
		if (s.liftAt[i] >= 0) return "overlaps a lift shaft";
		if (s.power[i]) hasPower = true;
		if (s.coolant[i]) hasCoolant = true;
		if (s.nutrient[i]) hasNutrient = true;
	}
	if (needsPower(d) && !hasPower) return "needs a power conduit under it";
	if (p.needsCoolant && !hasCoolant) return "needs a coolant conduit under it";
	if (p.needsNutrient && !hasNutrient) return "needs a nutrient conduit under it";
	return null;
}

/** What placing `d` does to the world beyond adding it: scars, bond rewards, statistics. */
export function afterPlace(s: SimState, d: FacilityDef, ignoreTier: boolean): void {
	scarOnPlace(s, d);
	if (!ignoreTier) s.stats.facilitiesBuilt++;
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
	if (isRetrofitOnly(d) && !opts.ignoreTier) return reject(`${d.name} is reached by retrofitting a rack, not built from scratch`);
	// Out-of-bounds first (the tier and research messages assume a legal tile).
	if (!inBounds(s, x, floor) || !inBounds(s, x + d.width - 1, floor)) return reject("out of bounds");
	if (!opts.ignoreTier) {
		const gate = placeBlock(s, ctx.content, d);
		if (gate) return reject(gate);
	}
	const site = siteBlock(s, d, floor, x);
	if (site) return reject(site);
	return accept(d.cost, (events) => {
		addFacility(s, ctx.content, defId, floor, x);
		afterPlace(s, d, opts.ignoreTier === true);
		events.push({ type: "built", what: "facility", floor, x });
	});
}

/** Validates a scenario facility; throws on content errors. */
export function placeScenarioFacility(ctx: PlanCtx, defId: string, floor: number, x: number): void {
	const plan = planPlace(ctx, defId, floor, x, { ignoreTier: true });
	if (!plan.ok) throw new Error(`scenario facility ${defId} at (${x}, ${floor}): ${plan.reason}`);
	plan.apply([]);
}
