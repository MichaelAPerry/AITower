/** Luci's remarks on the quarterly inspection sheet. All placeholder text (listed in docs/PLACEHOLDER_TEXT.md). */
import type { QuarterReport } from "@aitower/sim";
import type { Expression } from "../art";

export type QuipKind = "passed" | "warning" | "failed" | "failedJobs" | "penalties" | "lowUptime" | "hotHall" | "loss";

export const AUDIT_QUIPS: Record<QuipKind, readonly string[]> = {
	passed: ["Clean sheet. The Ministry can't find a thing to fine you for.", "Good quarter. Enjoy the grant, and don't touch anything."],
	warning: ["Not a disaster. Not a compliment either.", "They let you off with a warning. I'd fix it before next quarter."],
	failed: ["That went badly. I'll put the kettle on and we'll go through it.", "A fine. Well. It was bound to happen sooner or later."],
	failedJobs: ["Failed jobs on the sheet. Clients remember those."],
	penalties: ["Penalties paid. Look at where they came from first."],
	lowUptime: ["Uptime is where the inspector looked hardest. So should we."],
	hotHall: ["The PUE is high. Too much power is going to cooling, not work."],
	loss: ["We spent more than we earned. Check the ledger before the next audit."],
};

/** Which pool fits the report: the worst finding first, then the grade. */
export function quipKind(r: QuarterReport): QuipKind {
	if (r.grade === "D" || r.grade === "E") return "failed";
	if (r.jobsFailed > 0 && r.grade !== "A") return "failedJobs";
	if (r.penalties > 0 && r.grade !== "A") return "penalties";
	if (r.uptime < 0.95 && r.grade !== "A") return "lowUptime";
	if (r.pue > 1.8 && r.grade !== "A") return "hotHall";
	if (r.revenue < r.costs && r.grade !== "A") return "loss";
	return r.grade === "C" ? "warning" : "passed";
}

/** One quip for this report; the quarter number picks within the pool, so the same report always gets the same line. */
export function pickQuip(r: QuarterReport): string {
	const pool = AUDIT_QUIPS[quipKind(r)];
	return pool[Math.abs(Math.trunc(r.quarter)) % pool.length];
}

/** Luci's face for the grade. */
export const quipMood = (r: QuarterReport): Expression => (r.grade === "A" || r.grade === "B" ? "pleased" : r.grade === "C" ? "neutral" : "displeased");
