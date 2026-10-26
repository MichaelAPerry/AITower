/**
 * upgradeFacility: swap a facility for the next item down its tree, in place. Costs `new cost − 50 % of the old cost` (the
 * normal demolish refund), keeps the tile when the new item fits (a wider one takes a free tile beside it, to the right first,
 * then to the left); when it does not fit the player demolishes and rebuilds at the normal refund.
 */
import { upgradeCost, upgradesTo, type FacilityDef } from "@aitower/content";
import { DEMOLISH_REFUND } from "../core/constants";
import { findById } from "../core/grid";
import { placeBlock } from "../progression/access";
import { getDef } from "../world/defs";
import { addFacility, removeFacility } from "../world/entities";
import { accept, type Plan, type PlanCtx, reject } from "./plan";
import { afterPlace, siteBlock } from "./placement";

/** The items `facilityId` can be upgraded to (upgrade targets of its def), with the reason each is not available now (null = open). */
export function upgradeOptions(ctx: PlanCtx, facilityId: number): { def: FacilityDef; block: string | null }[] {
	const f = findById(ctx.state.facilities, facilityId);
	if (!f || f.grown) return [];
	return upgradesTo(ctx.content, f.defId).map((def) => ({ def, block: placeBlock(ctx.state, ctx.content, def) }));
}

/** Anchor columns to try for a footprint of width `w` replacing one of width `old` at `x`: same left edge, then growing to the left. */
function anchors(x: number, old: number, w: number): number[] {
	const out = [x];
	for (let shift = 1; shift <= Math.max(0, w - old); shift++) out.push(x - shift);
	return out;
}

export function planUpgrade(ctx: PlanCtx, facilityId: number, toDefId?: string): Plan {
	const { state: s, content } = ctx;
	const f = findById(s.facilities, facilityId);
	if (!f) return reject("no such facility");
	if (f.grown) return reject("a growth cannot be upgraded");
	const from = getDef(content, f.defId);
	const options = upgradeOptions(ctx, facilityId);
	if (options.length === 0) return reject(`${from.name} has no upgrade`);
	let pick: { def: FacilityDef; block: string | null } | undefined;
	if (toDefId !== undefined) {
		pick = options.find((o) => o.def.id === toDefId);
		if (!pick) return reject(`${from.name} does not upgrade to '${toDefId}'`);
	} else pick = options.find((o) => o.block === null) ?? options[0];
	if (pick.block) return reject(pick.block);
	const to = pick.def;
	if (to.growth || to.retired) return reject(`${to.name} is no longer built`);
	// The old footprint's cells are free for the new one; try the same tile first.
	let at: number | null = null;
	let why = "";
	for (const x of anchors(f.x, f.width, to.width)) {
		const block = siteBlock(s, to, f.floor, x, f.id);
		if (!block) {
			at = x;
			break;
		}
		if (!why) why = block;
	}
	if (at === null) return reject(`${to.name} does not fit here: ${why}. Demolish and rebuild instead`);
	const x = at;
	return accept(upgradeCost(from, to, DEMOLISH_REFUND), (events) => {
		removeFacility(s, content, f);
		addFacility(s, content, to.id, f.floor, x);
		afterPlace(s, to, false);
		events.push({ type: "built", what: "facility", floor: f.floor, x });
	});
}
