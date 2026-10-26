/**
 * Tick stage 10: tier rating, evaluated on the last tick of each day. Tier n needs installed
 * PFLOPS ≥ tiers.pflops[n-1] and at least tiers.techs[n-1] researched nodes; each new tier pays its reward. (Uptime is no longer a gate:
 * `tiers.uptime` is the operating target the quarterly audit grades.)
 * Tiers never decrease. Midnight order: tier rating (its reward is revenue), loan interest, the levy on the day's profit, then
 * the day is recorded for the quarterly audit (filed when the day is the last of a period, graded against the clearance held
 * during the day, i.e. before a tier-up at this midnight).
 */
import { installedPflops } from "../compute/allocation";
import type { TickCtx } from "../core/context";
import { isLastTickOfDay } from "../core/time";
import { endingsStep } from "../bio/path";
import { closeAuditDay } from "../economy/audit";
import { midnightCredit } from "../economy/credit";
import { earn } from "../economy/ledger";
import { MIN_POWERED_SATISFACTION } from "../core/constants";
import { researchedCount } from "../research/research";
import { getDef } from "../world/defs";

/** Midnight: every enabled, powered carbon facility earns `creditsPerDay` × `creditPrice`. */
function carbonCredits(ctx: TickCtx): void {
	const { state, content } = ctx;
	for (const f of state.facilities) {
		const d = getDef(content, f.defId);
		if (d.kind !== "carbon" || !f.enabled || f.sat < MIN_POWERED_SATISFACTION) continue;
		earn(state, (d.green?.creditsPerDay ?? 0) * content.balance.green.creditPrice);
	}
}

export function progressionStep(ctx: TickCtx): void {
	const { state, content, events } = ctx;
	if (!isLastTickOfDay(state.tick)) return;
	const tiers = content.balance.tiers;
	const pflops = installedPflops(state, content);
	const before = state.tier;
	const techsDone = researchedCount(state, content);
	while (state.tier < tiers.pflops.length) {
		const n = state.tier + 1;
		if (pflops < tiers.pflops[n - 1] || techsDone < (tiers.techs?.[n - 1] ?? 0)) break;
		state.tier = n;
		const reward = tiers.reward[n - 1] ?? 0;
		earn(state, reward);
		events.push({ type: "tierUp", tier: n, reward });
	}
	carbonCredits(ctx); // carbon credits are revenue of the day, so the levy and the audit see them
	endingsStep(ctx); // reaching the top tier is no longer a win: the path endings decide
	midnightCredit(ctx); // interest, then the levy on everything the day earned (tier reward included)
	closeAuditDay(ctx, before); // record the closed day; file the quarterly audit when one is due
}
