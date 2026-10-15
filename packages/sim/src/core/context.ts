import type { ContentDB } from "@aitower/content";
import type { SimEvent } from "../api";
import type { SimState } from "./state";

/** Reusable non-state buffers (never serialised; contents are meaningless between ticks). */
export interface Scratch {
	tempA: Float64Array;
	tempB: Float64Array;
	parent: Int32Array;
	label: Int32Array;
}

export function createScratch(cells: number): Scratch {
	return {
		tempA: new Float64Array(cells),
		tempB: new Float64Array(cells),
		parent: new Int32Array(cells),
		label: new Int32Array(cells),
	};
}

/** Everything a subsystem step needs. */
export interface TickCtx {
	state: SimState;
	content: ContentDB;
	events: SimEvent[];
	scratch: Scratch;
}
