/**
 * Tick stage 10: tier rating, evaluated on the last tick of each day. Tier n needs installed
 * PFLOPS ≥ tiers.pflops[n-1] and rolling uptime ≥ tiers.uptime[n-1]; each new tier pays its reward.
 * Tiers never decrease.
 */
import { installedPflops } from "../compute/allocation";
import type { TickCtx } from "../core/context";
import { isLastTickOfDay } from "../core/time";
import { earn } from "../economy/ledger";

export function progressionStep(ctx: TickCtx): void {
	const { state, content, events } = ctx;
	if (!isLastTickOfDay(state.tick)) return;
	const tiers = content.balance.tiers;
	const pflops = installedPflops(state, content);
	while (state.tier < tiers.pflops.length) {
		const n = state.tier + 1;
		if (pflops < tiers.pflops[n - 1] || state.metrics.uptime < tiers.uptime[n - 1]) break;
		state.tier = n;
		const reward = tiers.reward[n - 1] ?? 0;
		earn(state, reward);
		events.push({ type: "tierUp", tier: n, reward });
	}
}
