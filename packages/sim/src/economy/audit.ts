/**
 * Quarterly Ministry audit. Every tick samples the rolling uptime / PUE; at the midnight that closes the last day of
 * a period (`balance.audit.periodDays`) the closed days are graded and a `QuarterReport` is filed.
 */
import type { AuditGrade, QuarterReport } from "../api";
import type { TickCtx } from "../core/context";
import type { AuditTracker, SimState } from "../core/state";
import { dayOf } from "../core/time";
import { changeStanding } from "../ministry/standing";
import { dayCosts, earn, spend } from "./ledger";

export const MAX_REPORTS = 8;

/** Grade inputs (spec constants, no `Balance` field). */
export const AUDIT_UPTIME_PENALTY = 30;
export const AUDIT_FAILED_JOB_PENALTY = 10;
export const AUDIT_FAILED_JOB_CAP = 40;
export const AUDIT_PENALTY_SHARE_LIMIT = 0.1;
export const AUDIT_PENALTY_SHARE_POINTS = 20;
export const AUDIT_PUE_LIMIT = 1.6;
export const AUDIT_PUE_POINTS = 10;
export const AUDIT_LOSS_POINTS = 20;

const GRADES: readonly AuditGrade[] = ["A", "B", "C", "D", "E"];

export const emptyAudit = (): AuditTracker => ({ samples: 0, uptimeSum: 0, pueSum: 0, days: [], jobsCompleted: 0, jobsFailed: 0 });

/** One dry sentence per grade. */
export const REMARKS: Record<AuditGrade, string> = {
	A: "The Ministry has reviewed your quarter and, after some effort, found nothing to object to; this has been noted as unusual.",
	B: "Performance is satisfactory, which is the highest praise this office is authorised to issue.",
	C: "The quarter meets the minimum, and the Ministry reminds you that the minimum is a floor, not a destination.",
	D: "The Ministry is disappointed, and has prepared a form to record that disappointment.",
	E: "The quarter is hereby classified as an incident; please do not repeat it, and consider framing the correspondence.",
};

export interface AuditInputs {
	uptime: number;
	/** Uptime target of the current tier. */
	uptimeTarget: number;
	pue: number;
	jobsFailed: number;
	revenue: number;
	penalties: number;
	/** revenue − costs. */
	profit: number;
}

export function gradeFor(score: number): AuditGrade {
	return score >= 90 ? "A" : score >= 75 ? "B" : score >= 55 ? "C" : score >= 35 ? "D" : "E";
}

/** 100 − 30 (mean uptime below target) − 10 per failed job (max 40) − 20 (penalties > 10 % of revenue) − 10 (PUE > 1.6) − 20 (loss). */
export function auditScore(i: AuditInputs): number {
	let score = 100;
	if (i.uptime < i.uptimeTarget) score -= AUDIT_UPTIME_PENALTY;
	score -= Math.min(AUDIT_FAILED_JOB_CAP, AUDIT_FAILED_JOB_PENALTY * i.jobsFailed);
	if (i.penalties > AUDIT_PENALTY_SHARE_LIMIT * i.revenue) score -= AUDIT_PENALTY_SHARE_POINTS;
	if (i.pue > AUDIT_PUE_LIMIT) score -= AUDIT_PUE_POINTS;
	if (i.profit < 0) score -= AUDIT_LOSS_POINTS;
	return score;
}

/** Tick stage 9 (economy): fold this tick's rolling uptime / PUE into today's mean. */
export function sampleAudit(state: SimState): void {
	const a = state.audit;
	a.samples++;
	a.uptimeSum += state.metrics.uptime;
	a.pueSum += state.metrics.pue;
}

/** Last tick of a day, once the day's charges are in (`tier` = clearance held during the day): record the day's means and totals, then file the audit if due. */
export function closeAuditDay(ctx: TickCtx, tier: number): void {
	const { state, content, events } = ctx;
	const a = state.audit;
	const day = dayOf(state.tick);
	const t = state.today;
	a.days.push({
		day,
		uptime: a.samples > 0 ? a.uptimeSum / a.samples : state.metrics.uptime,
		pue: a.samples > 0 ? a.pueSum / a.samples : state.metrics.pue,
		revenue: t.revenue,
		costs: dayCosts(t),
		penalties: t.penalties,
	});
	a.samples = 0;
	a.uptimeSum = 0;
	a.pueSum = 0;

	const cfg = content.balance.audit;
	const period = Math.max(1, Math.floor(cfg.periodDays));
	if ((day + 1) % period !== 0) return;

	const fromDay = day - period + 1;
	const days = a.days.filter((d) => d.day >= fromDay && d.day <= day);
	let revenue = 0;
	let costs = 0;
	let penalties = 0;
	let uptime = 0;
	let pue = 0;
	for (const d of days) {
		revenue += d.revenue;
		costs += d.costs;
		penalties += d.penalties;
		uptime += d.uptime;
		pue += d.pue;
	}
	uptime = days.length > 0 ? uptime / days.length : state.metrics.uptime;
	pue = days.length > 0 ? pue / days.length : state.metrics.pue;

	const uptimeTarget = content.balance.tiers.uptime[tier - 1] ?? 0;
	const grade = gradeFor(auditScore({ uptime, uptimeTarget, pue, jobsFailed: a.jobsFailed, revenue, penalties, profit: revenue - costs }));
	const gi = GRADES.indexOf(grade);

	const standingBefore = state.standing;
	changeStanding(state, cfg.standingByGrade[gi] ?? 0, events);
	const cashDelta = (cfg.cashShareByGrade[gi] ?? 0) * revenue + 0; // + 0 turns -0 into 0
	if (cashDelta > 0) earn(state, cashDelta);
	else if (cashDelta < 0) spend(state, "penalties", -cashDelta);

	const report: QuarterReport = {
		quarter: (day + 1) / period,
		fromDay,
		toDay: day,
		revenue,
		costs,
		uptime,
		pue,
		jobsCompleted: a.jobsCompleted,
		jobsFailed: a.jobsFailed,
		penalties,
		grade,
		standingDelta: state.standing - standingBefore,
		cashDelta,
		remark: REMARKS[grade],
	};
	state.reports.push(report);
	if (state.reports.length > MAX_REPORTS) state.reports.splice(0, state.reports.length - MAX_REPORTS);
	a.days = [];
	a.jobsCompleted = 0;
	a.jobsFailed = 0;
	events.push({ type: "quarterReport", quarter: report.quarter, grade });
}
