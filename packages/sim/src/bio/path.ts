/** Ascension: the `choosePath` command and the daily Absorbed check (the tree wins live in progression/soul.ts). */
import type { AscensionPath } from "@aitower/content";
import { accept, type Plan, type PlanCtx, reject } from "../commands/plan";
import type { TickCtx } from "../core/context";
import type { SimState } from "../core/state";
import { setGameOver } from "../progression/gameOver";
import { commitBlock } from "../progression/soul";

export function planChoosePath(ctx: PlanCtx, path: AscensionPath): Plan {
	const { state, content } = ctx;
	if (state.path !== null) return reject("a path has already been chosen");
	if (state.tier < content.balance.ascension.minTier) return reject(`requires Level ${content.balance.ascension.minTier}`);
	const def = content.paths.find((p) => p.id === path);
	if (!def) return reject(`unknown path '${String(path)}'`);
	if (!def.available) return reject(`${def.name} is not available yet`);
	const block = commitBlock(state, content, path);
	if (block) return reject(block);
	return accept(0, (events) => commitPath(state, path, events));
}

/** Commit to a tree (FORM A-5, or a story choice). No-op once a path is set. */
export function commitPath(state: SimState, path: AscensionPath, events: TickCtx["events"]): void {
	if (state.path !== null) return;
	state.path = path;
	events.push({ type: "pathChosen", path });
}

/** Last tick of a day: Absorbed (corruption at the limit, from the commit Level on). */
export function endingsStep(ctx: TickCtx): void {
	const { state, content, events } = ctx;
	const e = content.balance.endings;
	if (state.tier >= content.balance.ascension.minTier && state.corruption >= e.absorbed.corruption) setGameOver(state, "absorbed", events, "absorbed");
}
