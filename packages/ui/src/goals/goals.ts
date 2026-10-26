/**
 * The Goals card's ladder: an ordered list of concrete goals derived purely from the sim view.
 * Plain words on the surface ("Level", "PF compute"); the card shows the first few that are not done.
 */
import type { ContentDB } from "@aitower/content";
import type { SimView } from "@aitower/sim";
import { fmtMoney } from "../format";
import { installedPflops } from "../objective/objective";

export interface Goal {
	id: string;
	/** Imperative, one line. */
	title: string;
	have: number;
	need: number;
	/** Progress as read by the player, e.g. "$12k / $50k". */
	progress: string;
	done: boolean;
}

/** How many goals the card shows at once. */
export const VISIBLE_GOALS = 3;
/** Fixed money and compute milestones. */
export const FIRST_EARNINGS = 50_000;
export const BIG_EARNINGS = 250_000;
export const ROOMY_COMPUTE = 100;

const count = (id: string, title: string, have: number, need: number): Goal => ({ id, title, have: Math.min(have, need), need, progress: `${Math.min(have, need)} / ${need}`, done: have >= need });
const money = (id: string, title: string, have: number, need: number): Goal => ({ id, title, have: Math.min(have, need), need, progress: `${fmtMoney(Math.min(have, need))} / ${fmtMoney(need)}`, done: have >= need });
const compute = (id: string, title: string, have: number, need: number): Goal => ({ id, title, have: Math.min(have, need), need, progress: `${Math.round(Math.min(have, need))} / ${need} PF compute`, done: have >= need });

/** Every goal, in order, each with its own done flag (a later goal can be done before an earlier one). */
export function goalLadder(view: SimView, content: ContentDB): Goal[] {
	const pf = installedPflops(view, content);
	const running = view.jobs.some((j) => j.status === "queued" || j.status === "running" || j.status === "stalled");
	const earned = view.stats?.revenue ?? 0;
	const goals: Goal[] = [
		count("contract", "Accept your first contract", running || (view.stats?.jobsCompleted ?? 0) > 0 ? 1 : 0, 1),
		money("earn-first", "Earn your first $50k", earned, FIRST_EARNINGS),
		compute("more-compute", "Add a rack", pf, ROOMY_COMPUTE),
		count("research", "Finish your first research", view.techResearched.length, 1),
	];
	const pflops = content.balance.tiers.pflops;
	// One goal per Level still to climb, in order; each is done once the tower's Level has reached it.
	for (let tier = 1; tier < pflops.length; tier++) {
		const target = tier + 1;
		const techs = content.balance.tiers.techs?.[tier] ?? 0;
		const done = view.techResearched.length;
		const g = compute(`level-${target}`, `Reach Level ${target}`, pf, pflops[tier]);
		// The Level also asks for researched nodes: say so on the card, and count it in the bar.
		goals.push({ ...g, progress: techs > 0 ? `${g.progress} · ${Math.min(done, techs)} / ${techs} research` : g.progress, done: view.tier >= target });
		if (target === 2) goals.push(money("earn-big", "Earn $250k in total", earned, BIG_EARNINGS));
	}
	return goals;
}

/** The goals to show: the first VISIBLE_GOALS that are neither done now nor latched as done earlier. */
export function visibleGoals(ladder: Goal[], latched: ReadonlySet<string>): Goal[] {
	return ladder.filter((g) => !g.done && !latched.has(g.id)).slice(0, VISIBLE_GOALS);
}

/** Goals that just became done: done now, not in `before`. */
export function newlyDone(ladder: Goal[], before: ReadonlySet<string>): Goal[] {
	return ladder.filter((g) => g.done && !before.has(g.id));
}
