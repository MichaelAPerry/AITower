/** The daily Absorbed check (the tree wins live in progression/soul.ts). */
import type { TickCtx } from "../core/context";
import { setGameOver } from "../progression/gameOver";

/** Last tick of a day: Absorbed (corruption at the limit, from the `ascension.minTier` Level on). */
export function endingsStep(ctx: TickCtx): void {
	const { state, content, events } = ctx;
	const e = content.balance.endings;
	if (state.tier >= content.balance.ascension.minTier && state.corruption >= e.absorbed.corruption) setGameOver(state, "absorbed", events, "absorbed");
}
