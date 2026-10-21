/** Lifetime statistics and the per-period job counters used by the quarterly audit. */
import type { LifetimeStats } from "../api";
import type { SimState } from "../core/state";

export const emptyStats = (): LifetimeStats => ({
	revenue: 0,
	pflopHours: 0,
	jobsCompleted: 0,
	jobsFailed: 0,
	peakPflops: 0,
	facilitiesBuilt: 0,
	componentFailures: 0,
	repairs: 0,
	decisionsMade: 0,
	researchPointsEarned: 0,
});

export function recordJobOutcome(state: SimState, outcome: "completed" | "failed"): void {
	if (outcome === "completed") {
		state.stats.jobsCompleted++;
		state.audit.jobsCompleted++;
	} else {
		state.stats.jobsFailed++;
		state.audit.jobsFailed++;
	}
}
