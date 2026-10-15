/**
 * Tick stage 7: component failures. Per rack per tick:
 * hazard = failurePerDay / 1440 × (1 + hazardPerDegree × max(0, T − okC)).
 * One RNG draw per eligible rack (enabled, not failed), in id order.
 */
import type { ContentDB } from "@aitower/content";
import type { SimEvent } from "../api";
import { TICKS_PER_DAY } from "../api";
import type { TickCtx } from "../core/context";
import { nextRandom } from "../core/rng";
import type { Facility, SimState } from "../core/state";
import { getDef } from "../world/defs";

/** Mark a rack failed and open a work order (also used by tests to inject failures). */
export function failRack(state: SimState, f: Facility, events: SimEvent[]): void {
	if (f.failed) return;
	f.failed = true;
	f.health = 0;
	state.workOrders.push({ id: state.nextId.workOrder++, facilityId: f.id, botId: -1, createdAt: state.tick });
	events.push({ type: "componentFailed", facilityId: f.id });
}

export function rackHazard(content: ContentDB, f: Facility): number {
	const d = getDef(content, f.defId);
	if (!d.rack) return 0;
	const th = content.balance.thermal;
	return (d.rack.failurePerDay / TICKS_PER_DAY) * (1 + th.hazardPerDegree * Math.max(0, f.tempC - th.okC));
}

export function reliabilityStep(ctx: TickCtx): void {
	const { state, content, events } = ctx;
	for (const f of state.facilities) {
		if (!f.enabled || f.failed) continue;
		const d = getDef(content, f.defId);
		if (d.kind !== "rack") continue;
		if (nextRandom(state.rng, "reliability") < rackHazard(content, f)) failRack(state, f, events);
	}
}
