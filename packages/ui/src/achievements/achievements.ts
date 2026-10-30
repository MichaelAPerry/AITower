/**
 * Achievements: the table and the pure checker (docs/ACHIEVEMENTS.md). Checks run in the UI on sim events; the sim knows nothing of them.
 * Sample build: only `cash_deep` is registered. The other 17 are added as rows of `ACHIEVEMENTS`.
 */
import { type Profile, loadProfile, recordAchievement } from "@aitower/shared";
import type { SimView } from "@aitower/sim";

/** The moments the app checks (spec section 1): day close now; game over, quarter report and lesson end are added with their rows. */
export type AchievementMoment = "dayClose";

export interface AchievementDef {
	id: string;
	name: string;
	/** Player-facing text. */
	text: string;
	/** Sprite id in `ICONS` (icons.ts). */
	icon: string;
	when: AchievementMoment;
	/** Hidden until earned (the failure endings). */
	hidden?: boolean;
	check: (view: SimView) => boolean;
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
	{ id: "cash_deep", icon: "vault_bars", name: "Deep Pockets", text: "Have $10M in the bank at day end.", when: "dayClose", check: (v) => v.cash >= 10_000_000 },
];

/** Only normal runs count: not lessons, not sandbox sites. */
export const countsForAchievements = (view: Pick<SimView, "lesson" | "sandbox">): boolean => !view.lesson && !view.sandbox;

/** Pure: the defs for this moment that are met and not yet earned. */
export function evaluate(moment: AchievementMoment, view: SimView, profile: Profile, defs: readonly AchievementDef[] = ACHIEVEMENTS): AchievementDef[] {
	if (!countsForAchievements(view)) return [];
	return defs.filter((d) => d.when === moment && !profile.earned[d.id] && d.check(view));
}

type Store = Parameters<typeof loadProfile>[0];

/** Run the checks for a moment and latch what was met. Returns the newly earned (each is returned once, ever). */
export function awardFor(moment: AchievementMoment, view: SimView, storage?: Store, defs: readonly AchievementDef[] = ACHIEVEMENTS): AchievementDef[] {
	const profile = loadProfile(storage);
	const won: AchievementDef[] = [];
	for (const d of evaluate(moment, view, profile, defs)) {
		const ending = view.gameOver && "ending" in view.gameOver ? (view.gameOver.ending ?? null) : null;
		if (recordAchievement(d.id, view.day, ending, storage).first) won.push(d);
	}
	return won;
}
