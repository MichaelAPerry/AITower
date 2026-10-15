/** Tick stage 11: advance time; at day change roll the ledger and emit `newDay`. */
import { TICKS_PER_DAY } from "../api";
import type { TickCtx } from "../core/context";
import { dayOf } from "../core/time";
import { rollLedger } from "../economy/ledger";

export function advanceTime(ctx: TickCtx): void {
	const { state, events } = ctx;
	state.tick++;
	if (state.tick % TICKS_PER_DAY === 0) {
		const day = dayOf(state.tick);
		rollLedger(state, day);
		events.push({ type: "newDay", day });
	}
}
