/**
 * Plain-language numbers for the Insights panel (money, uptime, reputation, and the jargon behind a "details" fold).
 * Pure, so it is unit-tested. The wording is written here; every number comes from the sim view.
 */
import type { LedgerDay, SimView, StandingLogEntry } from "@aitower/sim";
import { perHour } from "../calm/calm";
import { clockText } from "../contracts/contractText";
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
		sub: ok ? "Racks are working enough of the time. Keep it up." : "Racks are down too often. Reputation drops while uptime stays under the target.",
	};
}

const CAUSE: Record<StandingLogEntry["cause"], string> = {
	job: "A job result",
	"daily-uptime": "Daily uptime check",
	audit: "Quarterly audit",
	memo: "A memo decision",
};

export interface WhyRow {
	key: string;
	when: string;
	delta: number;
	deltaText: string;
	cause: string;
	detail: string;
}

export const signedPts = (n: number): string => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(Math.round(n * 10) / 10)}`;

/** The "Why did it change?" list: newest first. */
export function reputationWhy(view: Pick<SimView, "standingLog">, limit = 8): WhyRow[] {
	return [...view.standingLog]
		.reverse()
		.slice(0, limit)
		.map((e, i) => ({ key: `${e.tick}:${i}`, when: clockText(e.tick), delta: e.delta, deltaText: signedPts(e.delta), cause: CAUSE[e.cause] ?? e.cause, detail: e.detail }));
}

/** "Down 6 points in the last two days" / "Steady". */
export function reputationTrend(view: Pick<SimView, "standingLog" | "tick">): { delta: number; text: string; tone: "good" | "warn" | "dim" } {
	const since = view.tick - 2 * 1440;
	const delta = view.standingLog.filter((e) => e.tick >= since).reduce((s, e) => s + e.delta, 0);
	const r = Math.round(delta * 10) / 10;
	if (r === 0) return { delta: 0, text: "Steady over the last two days.", tone: "dim" };
	return { delta: r, text: `${r > 0 ? "Up" : "Down"} ${Math.abs(r)} point${Math.abs(r) === 1 ? "" : "s"} in the last two days.`, tone: r > 0 ? "good" : "warn" };
}

/** What PUE means, with this player's number in it. */
export function pueExplain(pue: number): string {
	if (!(pue > 0)) return "How much extra electricity cooling and losses use on top of the computers. Not measured yet.";
	const extra = Math.max(0, pue - 1);
	return `For every $1 of power the computers use, cooling and losses add about $${extra.toFixed(2)} more. Lower is better; 1.00 would be perfect, and efficient real-world sites run about 1.1 to 1.2.`;
}
