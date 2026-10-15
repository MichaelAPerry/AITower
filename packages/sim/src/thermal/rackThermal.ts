/**
 * Tick stage 5b: rack die temperatures, throttling and trips (ARCHITECTURE §4.4).
 * inlet = air mean of its cells, blended with coolant supply by liquidFraction;
 * die eases toward inlet + rackDeltaC × load (+ the liquid share again when noCoolant).
 */
import type { TickCtx } from "../core/context";
import { cellIdx } from "../core/grid";
import type { Facility } from "../core/state";
import { getDef } from "../world/defs";

function meanAir(ctx: TickCtx, f: Facility): number {
	const s = ctx.state;
	let sum = 0;
	for (let k = 0; k < f.width; k++) sum += s.airTemp[cellIdx(s, f.x + k, f.floor)];
	return sum / f.width;
}

export function rackThermalStep(ctx: TickCtx): void {
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
		const lf = d.rack.liquidFraction;
		const inlet = f.noCoolant || lf <= 0 ? air : (1 - lf) * air + lf * f.coolantC;
		const load = d.rack.powerKw > 0 ? f.powerKw / d.rack.powerKw : 0;
		const extra = f.noCoolant ? th.rackDeltaC * lf * load : 0;
		const target = inlet + th.rackDeltaC * load + extra;
		f.tempC += (target - f.tempC) * th.rackEase;
		if (f.tempC > maxRackC) maxRackC = f.tempC;

		// Throttle band.
		const span = th.throttleC - th.okC;
		const over = f.tempC - th.okC;
		f.thermalClock = over <= 0 ? 1 : 1 - (1 - th.minClock) * Math.min(1, span > 0 ? over / span : 1);
		const throttled = over > 0;
		if (throttled && !f.throttled && !f.tripped) events.push({ type: "rackThrottled", facilityId: f.id });
		f.throttled = throttled;

		// Trip → cool below trip − hysteresis → cooldown → recover.
		if (!f.tripped) {
			if (f.tempC >= th.tripC) {
				f.tripped = true;
				f.cooldown = -1;
				events.push({ type: "rackTripped", facilityId: f.id });
			}
		} else {
			if (f.cooldown < 0 && f.tempC < th.tripC - th.tripHysteresisC) f.cooldown = th.tripCooldownTicks;
			if (f.cooldown >= 0) {
				if (f.cooldown <= 0) {
					f.tripped = false;
					f.cooldown = -1;
					events.push({ type: "rackRecovered", facilityId: f.id });
				} else f.cooldown--;
			}
		}
	}
	state.metrics.maxRackC = Number.isFinite(maxRackC) ? maxRackC : state.ambientC;
}
