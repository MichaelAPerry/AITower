import type { ContentDB } from "@aitower/content";
import type { SimEvent } from "../api";
import { createNav, type Nav } from "../logistics/routing";
import type { Facility, SimState } from "./state";

/** One power net's facilities, grouped by role (reused across ticks by the power solve). */
export interface PowerBucket {
	loads: Facility[];
	liftKw: number;
	grids: Facility[];
	gensets: Facility[];
	upses: Facility[];
}

/** Reusable non-state buffers (never serialised; contents are meaningless between ticks). */
export interface Scratch {
	tempA: Float64Array;
	tempB: Float64Array;
	parent: Int32Array;
	label: Int32Array;
	/** Bot routing / facility-index caches, rebuilt when `topologyRev` changes. */
	nav: Nav;
	/** Power-solve buffers (cleared every tick, never reallocated unless the net count grows). */
	power: { buckets: PowerBucket[]; gensetOut: number[] };
}

export function createScratch(cells: number): Scratch {
	return {
		tempA: new Float64Array(cells),
		tempB: new Float64Array(cells),
		parent: new Int32Array(cells),
		label: new Int32Array(cells),
		nav: createNav(cells),
		power: { buckets: [], gensetOut: [] },
	};
}

/** Everything a subsystem step needs. */
export interface TickCtx {
	state: SimState;
	content: ContentDB;
	events: SimEvent[];
	scratch: Scratch;
}
