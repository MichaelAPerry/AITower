import { TICKS_PER_DAY } from "../api";
import { facilityContamination } from "../bio/index";
import { GROWTH_RECOVER_TICKS } from "../core/constants";
import { nextRandom } from "../core/rng";
import { modFactor } from "../ministry/modifiers";
import { getDef } from "../world/defs";
import { perk } from "../research/research";
/** Mark a rack failed and open a work order (also used by tests to inject failures). */
export function failRack(state, f, events) {
    if (f.failed)
        return;
    f.failed = true;
    f.health = 0;
    state.stats.componentFailures++;
    state.workOrders.push({ id: state.nextId.workOrder++, facilityId: f.id, botId: -1, createdAt: state.tick, attempts: 0, retryAt: 0, retryRev: 0 });
    events.push({ type: "componentFailed", facilityId: f.id });
}
/** `contamination`: level at the rack; the hazard grows by `hazardPerContamination` per unit. */
/** A growth fails without a work order and comes back by itself after `GROWTH_RECOVER_TICKS`. */
function failGrowth(state, f, events) {
    f.failed = true;
    f.health = 0;
    f.recoverAt = state.tick + GROWTH_RECOVER_TICKS;
    events.push({ type: "componentFailed", facilityId: f.id });
}
export function rackHazard(content, f, factor = 1, contamination = 0) {
    const d = getDef(content, f.defId);
    if (!d.rack)
        return 0;
    const th = content.balance.thermal;
    return (d.rack.failurePerDay / TICKS_PER_DAY) * (1 + th.hazardPerDegree * Math.max(0, f.tempC - th.okC)) * (1 + content.balance.bio.hazardPerContamination * contamination) * factor;
}
export function reliabilityStep(ctx) {
    const { state, content, events } = ctx;
    const factor = modFactor(state, "failureRate") * perk(state, content, "failureRate");
    for (const f of state.facilities) {
        const d = getDef(content, f.defId);
        if (f.grown && f.failed && f.recoverAt >= 0 && state.tick >= f.recoverAt) {
            // A growth heals itself, no work order needed.
            f.failed = false;
            f.health = 1;
            f.recoverAt = -1;
            events.push({ type: "rackRecovered", facilityId: f.id });
        }
        if (!f.enabled || f.failed)
            continue;
        if (d.kind !== "rack")
            continue;
        if (nextRandom(state.rng, "reliability") < rackHazard(content, f, factor, facilityContamination(state, f))) {
            if (f.grown)
                failGrowth(state, f, events);
            else
                failRack(state, f, events);
        }
    }
}
