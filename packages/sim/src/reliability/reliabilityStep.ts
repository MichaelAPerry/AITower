/**
 * Tick stage 7: component failures. Per rack per tick:
 * hazard = failurePerDay / 1440 × (1 + hazardPerDegree × max(0, T − okC)).
 * One RNG draw per eligible rack (enabled, not failed), in id order.
 */
import type { ContentDB } from "@aitower/content";
import type { SimEvent } from "../api";
import { TICKS_PER_DAY } from "../api";
import { facilityContamination } from "../bio/index";
import { GROWTH_RECOVER_TICKS } from "../core/constants";
import type { TickCtx } from "../core/context";
import { nextRandom } from "../core/rng";
import type { Facility, SimState } from "../core/state";
import { modFactor } from "../ministry/modifiers";
import { getDef } from "../world/defs";
import { perk } from "../research/research";

/** Mark a rack failed and open a work order (also used by tests to inject failures). */
export function failRack(state: SimState, f: Facility, events: SimEvent[]): void {
	if (f.failed) return;
	f.failed = true;
	f.health = 0;
	state.stats.componentFailures++;
	state.workOrders.push({ id: state.nextId.workOrder++, facilityId: f.id, botId: -1, createdAt: state.tick, attempts: 0, retryAt: 0, retryRev: 0 });
	events.push({ type: "componentFailed", facilityId: f.id });
}

/** `contamination`: level at the rack; the hazard grows by `hazardPerContamination` per unit. */
/** A growth fails without a work order and comes back by itself after `GROWTH_RECOVER_TICKS`. */
function failGrowth(state: SimState, f: Facility, events: SimEvent[]): void {
	f.failed = true;
	f.health = 0;
	f.recoverAt = state.tick + GROWTH_RECOVER_TICKS;
	events.push({ type: "componentFailed", facilityId: f.id });
}

export function rackHazard(content: ContentDB, f: Facility, factor = 1, contamination = 0): number {
	const d = getDef(content, f.defId);
	if (!d.rack) return 0;
	const th = content.balance.thermal;
	return (d.rack.failurePerDay / TICKS_PER_DAY) * (1 + th.hazardPerDegree * Math.max(0, f.tempC - th.okC)) * (1 + content.balance.bio.hazardPerContamination * contamination) * factor;
}

/** Failure-rate multiplier from cold rooms (`cooling.failureFactor`) whose reach covers a rack: the best one counts, they do not stack. */
export function coldRoomFactor(state: SimState, content: ContentDB, rack: Facility): number {
	let best = 1;
	for (const c of state.facilities) {
		if (!c.enabled || c.failed || c.floor !== rack.floor) continue;
		const cs = getDef(content, c.defId).cooling;
		if (!cs || cs.failureFactor === undefined || cs.failureFactor >= best) continue;
		const reach = cs.radius ?? 0;
		if (Math.max(0, rack.x - (c.x + c.width - 1), c.x - (rack.x + rack.width - 1)) <= reach) best = cs.failureFactor;
	}
	return best;
}

export function reliabilityStep(ctx: TickCtx): void {
	const { state, content, events } = ctx;
	const factor = modFactor(state, "failureRate") * perk(state, content, "failureRate");
	const anyColdRoom = state.facilities.some((c) => getDef(content, c.defId).cooling?.failureFactor !== undefined);
	for (const f of state.facilities) {
		const d = getDef(content, f.defId);
		if (f.grown && f.failed && f.recoverAt >= 0 && state.tick >= f.recoverAt) {
			// A growth heals itself, no work order needed.
			f.failed = false;
			f.health = 1;
			f.recoverAt = -1;
			events.push({ type: "rackRecovered", facilityId: f.id });
		}
		if (!f.enabled || f.failed) continue;
		if (d.kind !== "rack") continue;
		const cold = anyColdRoom ? coldRoomFactor(state, content, f) : 1;
		if (nextRandom(state.rng, "reliability") < rackHazard(content, f, factor * cold, facilityContamination(state, f))) {
			if (f.grown) failGrowth(state, f, events);
			else failRack(state, f, events);
		}
	}
}
