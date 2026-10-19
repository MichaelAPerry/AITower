/**
 * Growths: hourly sprouting on empty, contaminated slab (own `growth` RNG stream) and the daily cull by culling rooms.
 * Growth failure/self-healing lives in `reliabilityStep`.
 */
import type { TickCtx } from "../core/context";
import { CULL_MINUTE_OF_DAY, TICKS_PER_HOUR } from "../core/constants";
import { nextRandom } from "../core/rng";
import { minuteOfDay } from "../core/time";
import { powerFactor } from "../power/powerSolve";
import { getDef } from "../world/defs";
import { addFacility, removeFacility } from "../world/entities";
import { ensureBioIndex } from "./index";

export function growthStep(ctx: TickCtx): void {
	cull(ctx);
	sprout(ctx);
}

function sprout(ctx: TickCtx): void {
	const { state, content, events } = ctx;
	if (state.tick % TICKS_PER_HOUR !== 0) return;
	const defs = ensureBioIndex(ctx).growthDefs;
	if (defs.length === 0) return;
	const bio = content.balance.bio;
	const p = bio.growthChancePerDay / 24;
	const w = state.width;
	const n = state.slab.length;
	for (let i = 0; i < n; i++) {
		if (!state.slab[i] || state.facilityAt[i] >= 0 || state.liftAt[i] >= 0 || state.contamination[i] < bio.growthThreshold) continue;
		if (nextRandom(state.rng, "growth") >= p) continue;
		const start = Math.min(defs.length - 1, Math.floor(nextRandom(state.rng, "growth") * defs.length));
		const x = i % w;
		const floor = Math.floor(i / w) + state.floorMin;
		for (let k = 0; k < defs.length; k++) {
			const d = defs[(start + k) % defs.length];
			if (x + d.width > w) continue;
			let fits = true;
			for (let c = 0; c < d.width; c++) {
				const j = i + c;
				if (!state.slab[j] || state.facilityAt[j] >= 0 || state.liftAt[j] >= 0) fits = false;
			}
			if (!fits) continue;
			const f = addFacility(state, content, d.id, floor, x);
			events.push({ type: "growthSprouted", facilityId: f.id });
			break;
		}
	}
}

/** Once a day (03:00) every enabled, powered culling room removes the growths within its reach, free of charge. */
function cull(ctx: TickCtx): void {
	const { state, content, events } = ctx;
	if (minuteOfDay(state.tick) !== CULL_MINUTE_OF_DAY) return;
	for (const s of ensureBioIndex(ctx).sterilizers) {
		const d = getDef(content, s.defId);
		if (!d.bio?.cullsGrowths || !s.enabled || powerFactor(s.sat) <= 0) continue;
		const r = d.bio.radius ?? 0;
		const doomed = state.facilities.filter((f) => f.grown && f.floor === s.floor && f.x + f.width - 1 >= s.x - r && f.x <= s.x + s.width - 1 + r);
		for (const f of doomed) {
			removeFacility(state, content, f);
			events.push({ type: "demolished", floor: f.floor, x: f.x });
		}
	}
}
