/** Pure logic for the Finance tab: ledger net, loans, quarterly audit copy, lifetime stats. */
import type { AuditGrade, LedgerDay, LifetimeStats, QuarterReport, SimView } from "@aitower/sim";
import { fmtMoney, fmtPct, fmtPflops } from "../format";

/** Everything that leaves the Treasury in a day, including the Authority levy, loan interest and clerk fees. */
export const ledgerCosts = (d: LedgerDay): number => d.energy + d.upkeep + d.construction + d.penalties + (d.taxes ?? 0) + (d.interest ?? 0) + (d.fees ?? 0);

/** Revenue less all costs: the Finance tab's Net column and the NET TODAY gauge. */
export const ledgerNet = (d: LedgerDay): number => d.revenue - ledgerCosts(d);

// ─── Loans ───────────────────────────────────────────────────────────

export interface LoanInfo {
	principal: number;
	/** Limit at the current clearance. */
	max: number;
	dailyRate: number;
	/** How much more can be borrowed. */
	headroom: number;
	interestPerDay: number;
}

export function loanInfo(loan: SimView["loan"] | undefined): LoanInfo {
	const principal = Math.max(0, loan?.principal ?? 0);
	const max = Math.max(0, loan?.max ?? 0);
	const dailyRate = Math.max(0, loan?.dailyRate ?? 0);
	return { principal, max, dailyRate, headroom: Math.max(0, max - principal), interestPerDay: principal * dailyRate };
}

export interface LoanPreset {
	label: string;
	amount: number;
	/** Plain reason the button is disabled; null when it can be pressed. */
	disabled: string | null;
}

const FRACTIONS: [string, number][] = [
	["25 %", 0.25],
	["50 %", 0.5],
	["ALL", 1],
];

/** TAKE presets: 25 %, 50 % and all of the remaining limit (whole dollars, never above the headroom). */
export function takePresets(info: LoanInfo): LoanPreset[] {
	return FRACTIONS.map(([label, f]) => {
		const amount = f === 1 ? info.headroom : Math.floor(info.headroom * f);
		return { label, amount, disabled: amount <= 0 ? (info.max <= 0 ? "No credit at this level" : "Credit limit reached") : null };
	});
}

/** REPAY presets: 25 %, 50 % and all of the principal; each needs that much cash on hand. */
export function repayPresets(info: LoanInfo, cash: number): LoanPreset[] {
	return FRACTIONS.map(([label, f]) => {
		const amount = f === 1 ? info.principal : Math.floor(info.principal * f);
		const disabled = amount <= 0 ? "Nothing to repay" : amount > cash ? `Needs ${fmtMoney(amount)} in the Treasury` : null;
		return { label, amount, disabled };
	});
}

export const fmtDailyRate = (r: number): string => `${(Math.round(r * 10000) / 100).toString()} %/day`;

// ─── Quarterly audit ─────────────────────────────────────────────────

export const gradeTone = (g: AuditGrade): "green" | "amber" | "red" => (g === "A" || g === "B" ? "green" : g === "C" ? "amber" : "red");

export const signed = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "±0");

/** Grant or fine line: "Grant +$50k", "Fine −$20k" or "No grant or fine". */
export function cashDeltaText(d: number): string {
	if (d > 0.5) return `Grant +${fmtMoney(d)}`;
	if (d < -0.5) return `Fine −${fmtMoney(-d)}`;
	return "No grant or fine";
}

export interface ReportRow {
	label: string;
	value: string;
	tone?: "good" | "bad";
}

/** The figures on the audit sheet. */
export function reportRows(r: QuarterReport): ReportRow[] {
	const profit = r.revenue - r.costs;
	return [
		{ label: "Period", value: r.fromDay === r.toDay ? `Day ${r.fromDay}` : `Days ${r.fromDay}–${r.toDay}` },
		{ label: "Revenue", value: fmtMoney(r.revenue) },
		{ label: "Costs", value: fmtMoney(r.costs) },
		{ label: "Profit", value: fmtMoney(profit), tone: profit < 0 ? "bad" : "good" },
		{ label: "Uptime", value: fmtPct(r.uptime, 2) },
		{ label: "PUE", value: r.pue.toFixed(2) },
		{ label: "Jobs completed", value: String(r.jobsCompleted) },
		{ label: "Jobs failed", value: String(r.jobsFailed), tone: r.jobsFailed > 0 ? "bad" : undefined },
		{ label: "Penalties paid", value: fmtMoney(r.penalties) },
	];
}

/** Sheet headline numbers: Authority standing and cash change. */
export function auditOutcome(r: QuarterReport): { standing: string; cash: string } {
	return { standing: `Reputation ${signed(Math.round(r.standingDelta))}`, cash: cashDeltaText(r.cashDelta) };
}

// ─── Lifetime stats ──────────────────────────────────────────────────

export interface StatRow {
	label: string;
	value: string;
}

/** Lifetime figures; the same rows on the Finance tab and the game-over screen. */
export function lifetimeRows(s: LifetimeStats | undefined): StatRow[] {
	if (!s) return [];
	return [
		{ label: "Lifetime revenue", value: fmtMoney(s.revenue) },
		{ label: "Compute delivered", value: `${Math.round(s.pflopHours).toLocaleString("en-US")} PF·h` },
		{ label: "Jobs completed", value: String(s.jobsCompleted) },
		{ label: "Jobs failed", value: String(s.jobsFailed) },
		{ label: "Peak compute", value: fmtPflops(s.peakPflops) },
		{ label: "Facilities built", value: String(s.facilitiesBuilt) },
		{ label: "Component failures", value: String(s.componentFailures) },
		{ label: "Repairs done", value: String(s.repairs) },
		{ label: "Memos answered", value: String(s.memosAnswered) },
		{ label: "Research points earned", value: Math.floor(s.researchPointsEarned).toLocaleString("en-US") },
	];
}
