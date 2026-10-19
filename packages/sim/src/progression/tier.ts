/**
 * Tick stage 10: tier rating, evaluated on the last tick of each day. Tier n needs installed
 * PFLOPS ≥ tiers.pflops[n-1] and rolling uptime ≥ tiers.uptime[n-1]; each new tier pays its reward.
 * Tiers never decrease. Midnight order: daily standing, tier rating (its reward is revenue), loan interest, the levy on the day's profit, then
 * the day is recorded for the quarterly audit (filed when the day is the last of a period, graded against the clearance held
 * during the day, i.e. before a tier-up at this midnight).
 */
import { installedPflops } from "../compute/allocation";
import type { TickCtx } from "../core/context";
import { isLastTickOfDay } from "../core/time";
import { endingsStep } from "../bio/path";
import { dailyStanding } from "../ministry/standing";
import { closeAuditDay } from "../economy/audit";
import { midnightCredit } from "../economy/credit";
import { earn } from "../economy/ledger";

export function progressionStep(ctx: TickCtx): void {
	const { state, content, events } = ctx;
	if (!isLastTickOfDay(state.tick)) return;
	dailyStanding(ctx);
	const tiers = content.balance.tiers;
	const pflops = installedPflops(state, content);
	const before = state.tier;
	while (state.tier < tiers.pflops.length) {
		const n = state.tier + 1;
		if (pflops < tiers.pflops[n - 1] || state.metrics.uptime < tiers.uptime[n - 1]) break;
		state.tier = n;
		const reward = tiers.reward[n - 1] ?? 0;
		earn(state, reward);
		events.push({ type: "tierUp", tier: n, reward });
	}
	endingsStep(ctx); // reaching the top tier is no longer a win: the path endings decide
	midnightCredit(ctx); // interest, then the levy on everything the day earned (tier reward included)
	closeAuditDay(ctx, before); // record the closed day; file the quarterly audit when one is due
}
