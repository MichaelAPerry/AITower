/** Biotech facility indices (non-state cache, rebuilt when `topologyRev` changes) and shared load helpers. */
import type { ContentDB, FacilityDef } from "@aitower/content";
import { IDLE_RACK_POWER_FRACTION } from "../core/constants";
import type { TickCtx } from "../core/context";
import type { Facility, SimState } from "../core/state";
import { getDef, isGrowth, isNutrientConsumer, isStorageRack, organoidSpec } from "../world/defs";

export interface BioIndex {
	rev: number;
	/** kind nutrient. */
	plants: Facility[];
	/** Organoid racks and bioreactors that draw nutrients. */
	consumers: Facility[];
	/** Contamination sources: organoid racks, bioreactors, growths. */
	emitters: Facility[];
	sterilizers: Facility[];
	quarantines: Facility[];
	reactors: Facility[];
	/** Growth defs, sorted by id. */
	growthDefs: FacilityDef[];
	/** Scratch: 1 on cells under an active quarantine. */
	mask: Uint8Array;
}

export function ensureBioIndex(ctx: Pick<TickCtx, "state" | "content" | "scratch">): BioIndex {
	const { state, content } = ctx;
	const b = ctx.scratch.bio;
	if (b.rev === state.topologyRev) return b;
	b.rev = state.topologyRev;
	b.plants = [];
	b.consumers = [];
	b.emitters = [];
	b.sterilizers = [];
	b.quarantines = [];
	b.reactors = [];
	for (const f of state.facilities) {
		const d = getDef(content, f.defId);
		if (d.kind === "nutrient") b.plants.push(f);
		if (d.kind === "sterilizer") b.sterilizers.push(f);
		if (d.kind === "quarantine") b.quarantines.push(f);
		if (d.kind === "bioreactor") b.reactors.push(f);
		if (isNutrientConsumer(d)) b.consumers.push(f);
		if (isGrowth(d) || d.kind === "bioreactor" || organoidSpec(d)) b.emitters.push(f);
	}
	b.growthDefs = Object.values(content.facilities)
		.filter((d) => d.growth === true)
		.sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
	return b;
}

/** Utilisation 0..1 of a rack: down = 0, busy = 1, otherwise the idle share (storage racks follow the storage load). */
export function rackLoad(state: SimState, content: ContentDB, f: Facility): number {
	if (!f.enabled || f.failed || f.tripped) return 0;
	const d = getDef(content, f.defId);
	if (isStorageRack(d)) return Math.max(IDLE_RACK_POWER_FRACTION, state.storageUtil);
	return f.busy ? 1 : IDLE_RACK_POWER_FRACTION;
}

/** Highest contamination over a facility's cells. */
export function facilityContamination(state: SimState, f: Pick<Facility, "x" | "width" | "floor">): number {
	let m = 0;
	const base = (f.floor - state.floorMin) * state.width + f.x;
	for (let k = 0; k < f.width; k++) if (state.contamination[base + k] > m) m = state.contamination[base + k];
	return m;
}

/** Contamination at a (fractional) bot position. */
export function contaminationAt(state: SimState, x: number, floor: number): number {
	const cx = Math.round(x);
	const cf = Math.round(floor);
	if (cx < 0 || cx >= state.width || cf < state.floorMin || cf > state.floorMax) return 0;
	return state.contamination[(cf - state.floorMin) * state.width + cx];
}
