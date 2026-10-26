/**
 * Plain-language numbers for the Insights panel (money, uptime, and the jargon behind a "details" fold).
 * Pure, so it is unit-tested. The wording is written here; every number comes from the sim view.
 */
import type { LedgerDay, SimView} from "@aitower/sim";
import { perHour } from "../calm/calm";
import { fmtMoney, fmtPct } from "../format";

const costs = (d: LedgerDay): number => d.energy + d.upkeep + d.penalties + (d.taxes ?? 0) + (d.interest ?? 0) + (d.fees ?? 0);

export interface MoneyFlow {
	/** Dollars per game-hour over about the last six hours; null before there is any ledger. */
	inPerHour: number | null;
	outPerHour: number | null;
	netPerHour: number | null;
	headline: string;
}

/** Money coming in and going out per hour (construction is a one-off investment, so it is left out). */
export function moneyFlow(view: Pick<SimView, "tick" | "day" | "ledger">): MoneyFlow {
	const inP = perHour(view, (d) => d.revenue);
	const outP = perHour(view, costs);
	const net = inP === null || outP === null ? null : inP - outP;
	const headline = net === null ? "No numbers yet. Take a job and let the clock run." : net >= 0 ? `You are making about ${fmtMoney(net)} an hour.` : `You are losing about ${fmtMoney(-net)} an hour.`;
	return { inPerHour: inP, outPerHour: outP, netPerHour: net, headline };
}

export interface UptimeVerdict {
	pct: string;
	target: string | null;
	ok: boolean;
	tone: "good" | "warn" | "bad";
	headline: string;
	sub: string;
}

/** Uptime (share of the last 24 h your racks were working) against the target for the current Level. */
export function uptimeVerdict(view: Pick<SimView, "uptime" | "uptimeTarget" | "facilities">): UptimeVerdict {
	const pct = fmtPct(view.uptime, 1);
	const t = view.uptimeTarget;
	const hasRacks = view.facilities.length > 0;
	if (!(t > 0)) return { pct, target: null, ok: true, tone: "good", headline: `Uptime ${pct}`, sub: "No uptime target yet. Later Levels ask you to keep racks working most of the time." };
	const target = fmtPct(t, 0);
	if (!hasRacks) return { pct, target, ok: true, tone: "good", headline: `Uptime ${pct}`, sub: `Target ${target}.` };
	const ok = view.uptime >= t;
	const gap = view.uptime >= t - 0.02;
	return {
		pct,
		target,
		ok,
		tone: ok ? "good" : gap ? "warn" : "bad",
		headline: `Uptime ${pct} · target ${target}`,
		sub: ok ? "Racks are working enough of the time. Keep it up." : "Racks are down too often. The quarterly audit grades uptime against the target.",
	};
}

/** What PUE means, with this player's number in it. */
export function pueExplain(pue: number): string {
	if (!(pue > 0)) return "How much extra electricity cooling and losses use on top of the computers. Not measured yet.";
	const extra = Math.max(0, pue - 1);
	return `For every $1 of power the computers use, cooling and losses add about $${extra.toFixed(2)} more. Lower is better; 1.00 would be perfect, and efficient real-world sites run about 1.1 to 1.2.`;
}
