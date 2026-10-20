/** Ascension: the `choosePath` command and the daily ending checks. */
import type { AscensionPath, Balance, EndingId } from "@aitower/content";
import { accept, type Plan, type PlanCtx, reject } from "../commands/plan";
import type { TickCtx } from "../core/context";
import type { SimState } from "../core/state";
import { setGameOver } from "../ministry/standing";

export function planChoosePath(ctx: PlanCtx, path: AscensionPath): Plan {
	const { state, content } = ctx;
	if (state.path !== null) return reject("a path has already been chosen");
	if (state.tier < content.balance.ascension.minTier) return reject(`requires Clearance ${content.balance.ascension.minTier}`);
	const def = content.paths.find((p) => p.id === path);
	if (!def) return reject(`unknown path '${String(path)}'`);
	if (!def.available) return reject(`${def.name} is not available yet`);
	return accept(0, (events) => {
		state.path = path;
		events.push({ type: "pathChosen", path });
	});
}

/** Last tick of a day: absorbed, then the path endings (each must hold at every daily check, consecutively). */
export function endingsStep(ctx: TickCtx): void {
	const { state, content, events } = ctx;
	const e = content.balance.endings;
	const org = state.metrics.organoidPflops;
	const c = state.corruption;
	if (state.tier >= content.balance.ascension.minTier && c >= e.absorbed.corruption) setGameOver(state, "absorbed", events, "absorbed");
	const biotech = state.path === "biotech";
	state.endingDays.livingTower = biotech && c >= e.livingTower.minCorruption && org >= e.livingTower.pflops ? state.endingDays.livingTower + 1 : 0;
	state.endingDays.cleanTower = biotech && c <= e.cleanTower.maxCorruption && org >= e.cleanTower.pflops ? state.endingDays.cleanTower + 1 : 0;
	// Greentech and Synthetic endings (their balance entries are optional: an absent one never counts).
	const pf = state.metrics.pflops;
	const g = e.greenExemplar;
	state.endingDays.greenExemplar = g && state.path === "greentech" && state.greenScore >= g.minScore && pf >= g.pflops ? state.endingDays.greenExemplar + 1 : 0;
	const mm = e.millionMinds;
	state.endingDays.millionMinds = mm && state.path === "synthetic" && state.refinement >= mm.minScore && pf >= mm.pflops ? state.endingDays.millionMinds + 1 : 0;
	if (state.endingDays.livingTower >= e.livingTower.days) setGameOver(state, "victory", events, "livingTower");
	else if (state.endingDays.cleanTower >= e.cleanTower.days) setGameOver(state, "victory", events, "cleanTower");
	else if (g && state.endingDays.greenExemplar >= g.days) setGameOver(state, "victory", events, "greenExemplar");
	else if (mm && state.endingDays.millionMinds >= mm.days) setGameOver(state, "victory", events, "millionMinds");
}

/**
 * The path's ending whose condition is closest (most of its days held; biotech ties by corruption distance), for the UI.
 * Greentech has one ending (greenExemplar), Synthetic one (millionMinds); null when the path is unset or its ending is absent.
 */
export function leadingEnding(state: SimState, e: Balance["endings"]): { ending: EndingId; days: number; needed: number } | null {
	if (state.path === "greentech") return e.greenExemplar ? { ending: "greenExemplar", days: state.endingDays.greenExemplar, needed: e.greenExemplar.days } : null;
	if (state.path === "synthetic") return e.millionMinds ? { ending: "millionMinds", days: state.endingDays.millionMinds, needed: e.millionMinds.days } : null;
	if (state.path !== "biotech") return null;
	const l = { ending: "livingTower" as const, days: state.endingDays.livingTower, needed: e.livingTower.days };
	const k = { ending: "cleanTower" as const, days: state.endingDays.cleanTower, needed: e.cleanTower.days };
	const rl = l.needed > 0 ? l.days / l.needed : 0;
	const rk = k.needed > 0 ? k.days / k.needed : 0;
	if (rl !== rk) return rl > rk ? l : k;
	return Math.abs(state.corruption - e.livingTower.minCorruption) <= Math.abs(state.corruption - e.cleanTower.maxCorruption) ? l : k;
}
