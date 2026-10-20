import { fmtMoney } from "../format";
import { installedPflops } from "../objective/objective";
/** How many goals the card shows at once. */
export const VISIBLE_GOALS = 3;
/** Fixed money and compute milestones. */
export const FIRST_EARNINGS = 50_000;
export const BIG_EARNINGS = 250_000;
export const ROOMY_COMPUTE = 100;
const count = (id, title, have, need) => ({ id, title, have: Math.min(have, need), need, progress: `${Math.min(have, need)} / ${need}`, done: have >= need });
const money = (id, title, have, need) => ({ id, title, have: Math.min(have, need), need, progress: `${fmtMoney(Math.min(have, need))} / ${fmtMoney(need)}`, done: have >= need });
const compute = (id, title, have, need) => ({ id, title, have: Math.min(have, need), need, progress: `${Math.round(Math.min(have, need))} / ${need} PF compute`, done: have >= need });
/** Every goal, in order, each with its own done flag (a later goal can be done before an earlier one). */
export function goalLadder(view, content) {
    const pf = installedPflops(view, content);
    const running = view.jobs.some((j) => j.status === "queued" || j.status === "running" || j.status === "stalled");
    const earned = view.stats?.revenue ?? 0;
    const goals = [
        count("contract", "Accept your first contract", running || (view.stats?.jobsCompleted ?? 0) > 0 ? 1 : 0, 1),
        money("earn-first", "Earn your first $50k", earned, FIRST_EARNINGS),
        compute("more-compute", "Add a rack", pf, ROOMY_COMPUTE),
        count("research", "Finish your first research", view.techResearched.length, 1),
    ];
    const pflops = content.balance.tiers.pflops;
    // One goal per Level still to climb, in order; each is done once the tower's Level has reached it.
    for (let tier = 1; tier < pflops.length; tier++) {
        const target = tier + 1;
        goals.push({ ...compute(`level-${target}`, `Reach Level ${target}`, pf, pflops[tier]), done: view.tier >= target });
        if (target === 2)
            goals.push(money("earn-big", "Earn $250k in total", earned, BIG_EARNINGS));
    }
    return goals;
}
/** The goals to show: the first VISIBLE_GOALS that are neither done now nor latched as done earlier. */
export function visibleGoals(ladder, latched) {
    return ladder.filter((g) => !g.done && !latched.has(g.id)).slice(0, VISIBLE_GOALS);
}
/** Goals that just became done: done now, not in `before`. */
export function newlyDone(ladder, before) {
    return ladder.filter((g) => g.done && !before.has(g.id));
}
