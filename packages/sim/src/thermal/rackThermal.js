import { cellIdx } from "../core/grid";
import { INCUBATOR_COOL_C, INCUBATOR_LIFT_C, MIN_POWERED_SATISFACTION } from "../core/constants";
import { failRack } from "../reliability/reliabilityStep";
import { getDef, organoidSpec } from "../world/defs";
function meanAir(ctx, f) {
    const s = ctx.state;
    let sum = 0;
    for (let k = 0; k < f.width; k++)
        sum += s.airTemp[cellIdx(s, f.x + k, f.floor)];
    return sum / f.width;
}
export function rackThermalStep(ctx) {
    const { state, content, events } = ctx;
    const th = content.balance.thermal;
    let maxRackC = Number.NEGATIVE_INFINITY;
    for (const f of state.facilities) {
        const d = getDef(content, f.defId);
        const air = meanAir(ctx, f);
        if (d.kind !== "rack" || !d.rack) {
            f.tempC = air;
            continue;
        }
        if (d.growth) {
            // Growths ignore temperature: always at full clock, never throttled.
            f.tempC = air;
            f.thermalClock = 1;
            f.throttled = false;
            f.tooCold = false;
            continue;
        }
        const bio = organoidSpec(d);
        if (bio) {
            // An incubator regulates its own tissue temperature while powered: it holds targetC as long as the room air is
            // within [targetC − INCUBATOR_LIFT_C, targetC + INCUBATOR_COOL_C] (scaled by power satisfaction), and drifts with
            // the air beyond that. Unpowered, the tissue simply follows the air. (GPU heat math would cook or chill it.)
            const powered = f.enabled && !f.failed && f.sat >= MIN_POWERED_SATISFACTION;
            const lift = INCUBATOR_LIFT_C * Math.min(1, f.sat);
            const cool = INCUBATOR_COOL_C * Math.min(1, f.sat);
            const want = !powered ? air : air < bio.targetC - lift ? air + lift : air > bio.targetC + cool ? air - cool : bio.targetC;
            f.tempC += (want - f.tempC) * th.rackEase;
            if (f.tempC > maxRackC)
                maxRackC = f.tempC;
            organoidBand(ctx, f, bio, want);
            continue;
        }
        const lf = d.rack.liquidFraction;
        const inlet = f.noCoolant || lf <= 0 ? air : (1 - lf) * air + lf * f.coolantC;
        const load = d.rack.powerKw > 0 ? f.powerKw / d.rack.powerKw : 0;
        const extra = f.noCoolant ? th.rackDeltaC * lf * load : 0;
        const target = inlet + th.rackDeltaC * load + extra;
        f.tempC += (target - f.tempC) * th.rackEase;
        if (f.tempC > maxRackC)
            maxRackC = f.tempC;
        // Throttle band.
        const span = th.throttleC - th.okC;
        const over = f.tempC - th.okC;
        f.thermalClock = over <= 0 ? 1 : 1 - (1 - th.minClock) * Math.min(1, span > 0 ? over / span : 1);
        const throttled = over > 0;
        if (throttled && !f.throttled && !f.tripped)
            events.push({ type: "rackThrottled", facilityId: f.id });
        f.throttled = throttled;
        // Trip → cool below trip − hysteresis → cooldown → recover.
        if (!f.tripped) {
            if (f.tempC >= th.tripC) {
                f.tripped = true;
                f.cooldown = -1;
                events.push({ type: "rackTripped", facilityId: f.id });
            }
        }
        else {
            if (f.cooldown < 0 && f.tempC < th.tripC - th.tripHysteresisC)
                f.cooldown = th.tripCooldownTicks;
            if (f.cooldown >= 0) {
                if (f.cooldown <= 0) {
                    f.tripped = false;
                    f.cooldown = -1;
                    events.push({ type: "rackRecovered", facilityId: f.id });
                }
                else
                    f.cooldown--;
            }
        }
    }
    state.metrics.maxRackC = Number.isFinite(maxRackC) ? maxRackC : state.ambientC;
}
/**
 * Organoid tissue band: full clock within targetC ± toleranceC, linear down to `minClock` at ±2× tolerance (flat beyond),
 * and beyond ±3× (and settling there) the tissue fails like a component (work order). Too cold sets `tooCold`, too hot `throttled`.
 */
export function organoidBand(ctx, f, bio, settleC = f.tempC) {
    const { state, content, events } = ctx;
    const minClock = content.balance.thermal.minClock;
    const dev = f.tempC - bio.targetC;
    const a = Math.abs(dev) / Math.max(bio.toleranceC, 1e-6);
    f.thermalClock = a <= 1 ? 1 : a >= 2 ? minClock : 1 - (1 - minClock) * (a - 1);
    const out = a > 1;
    const cold = out && dev < 0;
    const hot = out && dev > 0;
    if (out && !f.throttled && !f.tooCold && !f.failed)
        events.push({ type: "rackThrottled", facilityId: f.id });
    f.throttled = hot;
    f.tooCold = cold;
    // Tissue dies only when it is beyond ±3× AND heading there (`settleC`): warming up after placement or a repair is safe,
    // a power cut (settling to room air) or a room the incubator cannot hold is not.
    const settled = Math.abs(settleC - bio.targetC) / Math.max(bio.toleranceC, 1e-6);
    if (a > 3 && settled > 3 && !f.failed)
        failRack(state, f, events);
}
