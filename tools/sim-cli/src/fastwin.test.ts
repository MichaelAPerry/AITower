/**
 * Opt-in measurement for the `fast_win` achievement (docs/ACHIEVEMENTS.md): how fast can the scripted player of
 * tools/sim-cli/src/player.ts win each tree, counted exactly as the achievement counts it (floor(gameOver.tick / 1440) + 1)?
 * Skipped unless FASTWIN is set, so `npm run check` stays fast.
 *
 *   FASTWIN=1 npx vitest run tools/sim-cli/src/fastwin.test.ts
 *   FASTWIN=1 FASTWIN_SEEDS=1-30 npx vitest run tools/sim-cli/src/fastwin.test.ts     (seed list "1,2,3" or range "1-30")
 *
 * It changes no balance and no target. The achievement's days are the ones in packages/ui/src/achievements/achievements.ts.
 */
import { loadContent } from "@aitower/content";
import { describe, expect, it } from "vitest";
import type { Tree } from "./player";
import { scriptedRun } from "./soulRun";

const ENABLED = !!process.env.FASTWIN;
/** Win-by days (owner decision: 25 / 40 / 38). */
const WIN_BY: Record<Tree, number> = { synthetic: 25, biotech: 40, greentech: 38 };

function seeds(): number[] {
	const s = process.env.FASTWIN_SEEDS ?? "1-8";
	const range = /^(\d+)-(\d+)$/.exec(s);
	if (range) return Array.from({ length: Number(range[2]) - Number(range[1]) + 1 }, (_, i) => Number(range[1]) + i);
	return s.split(",").map(Number);
}

describe.skipIf(!ENABLED)("fast_win: best scripted win day per tree (opt-in, slow)", () => {
	const content = loadContent();
	for (const tree of ["synthetic", "biotech", "greentech"] as Tree[]) {
		it(
			tree,
			() => {
				const days: number[] = [];
				for (const seed of seeds()) {
					const run = scriptedRun(content, "starter", tree, seed, WIN_BY[tree] * 2);
					const over = run.sim?.view().gameOver;
					if (over?.kind === "victory") days.push(Math.floor(over.tick / 1440) + 1);
				}
				days.sort((a, b) => a - b);
				const best = days[0];
				const median = days[Math.floor(days.length / 2)];
				console.log(`fast_win ${tree}: target ${WIN_BY[tree]}, wins ${days.length}/${seeds().length}, best ${best}, median ${median}, all ${days.join(",")}`);
				expect(days.length, "scripted player should win").toBeGreaterThan(0);
			},
			30 * 60_000,
		);
	}
});
