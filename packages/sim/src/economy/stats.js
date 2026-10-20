export const emptyStats = () => ({
    revenue: 0,
    pflopHours: 0,
    jobsCompleted: 0,
    jobsFailed: 0,
    peakPflops: 0,
    facilitiesBuilt: 0,
    componentFailures: 0,
    repairs: 0,
    memosAnswered: 0,
    researchPointsEarned: 0,
});
export function recordJobOutcome(state, outcome) {
    if (outcome === "completed") {
        state.stats.jobsCompleted++;
        state.audit.jobsCompleted++;
    }
    else {
        state.stats.jobsFailed++;
        state.audit.jobsFailed++;
    }
}
