/**
 * Achievements: the table and the pure checker (docs/ACHIEVEMENTS.md). Checks run in the UI on sim events; the sim knows nothing of them.
 * Names, texts and the hidden flag live in packages/content/src/data/achievements.json; this file adds the check, the moment and the icon.
 */
import { type AchievementText, achievementContent } from "@aitower/content";
import { ADVISOR_KEYS, type AdvisorKey, type Profile, loadLessonProgress, loadProfile, recordAchievement, recordBonds, recordEpilogue, recordOffDuty } from "@aitower/shared";
import type { SimView } from "@aitower/sim";

/** The moments the app checks (spec section 1). */
export type AchievementMoment = "dayClose" | "gameOver" | "quarterReport" | "decisionResolved" | "lessonEnd";

/** An icon: the id of a code-drawn sprite (icons.ts), or one cell of an image sheet (see `ICON_SHEETS` in sheets.ts). A row with none shows the "?" plate. */
export type IconRef = string | { sheet: string; col: number; row: number };

/** What a check may read besides the view. */
export interface AchEnv {
	profile: Profile;
	/** `balance.startingCash` (for Clean Books). */
	startingCash: number;
	/** Every lesson id, and the lessons finished so far. */
	lessonIds: readonly string[];
	lessonsDone: Readonly<Record<string, number>>;
}

export interface AchievementDef extends AchievementText {
	icon?: IconRef;
	when: AchievementMoment;
	check: (view: SimView, env: AchEnv) => boolean;
}

/** Days to win by (tools/sim-cli soulRun.ts `TARGET_DAYS`): Lattice 25, Flesh 40, Garden 38. */
export const FAST_WIN_DAYS: Readonly<Record<string, number>> = { singularity: 25, flesh: 40, garden: 38 };
const TICKS_PER_DAY = 1440;
/** Days of 99% uptime in a row for Month of Calm and Cass's portrait. */
export const CALM_DAYS = 20;

const winEnding = (v: SimView): string | undefined => (v.gameOver?.kind === "victory" ? v.gameOver.ending : undefined);
const bondValues = (v: SimView): number[] => (v.soul ? Object.values(v.soul.bonds) : []);

type Check = Pick<AchievementDef, "when" | "check" | "icon">;

const CHECKS: Readonly<Record<string, Check>> = {
	end_lattice: { icon: { sheet: "achievements", col: 0, row: 0 }, when: "gameOver", check: (v) => winEnding(v) === "singularity" },
	end_flesh: { icon: { sheet: "achievements", col: 1, row: 0 }, when: "gameOver", check: (v) => winEnding(v) === "flesh" },
	end_garden: { icon: { sheet: "achievements", col: 2, row: 0 }, when: "gameOver", check: (v) => winEnding(v) === "garden" },
	end_absorbed: { icon: { sheet: "achievements", col: 3, row: 0 }, when: "gameOver", check: (v) => v.gameOver?.kind === "absorbed" },
	end_bankrupt: { icon: { sheet: "achievements", col: 4, row: 0 }, when: "gameOver", check: (v) => v.gameOver?.kind === "bankrupt" },
	lvl_five: { icon: { sheet: "achievements", col: 5, row: 0 }, when: "dayClose", check: (v) => v.tier >= 5 },
	rung_top: { icon: { sheet: "achievements", col: 0, row: 1 }, when: "dayClose", check: (v) => !!v.soul && Object.values(v.soul.trees).some((t) => t.rung === 4) },
	fast_win: {
		icon: { sheet: "achievements", col: 1, row: 1 },
		when: "gameOver",
		check: (v) => {
			const end = winEnding(v);
			const limit = end ? FAST_WIN_DAYS[end] : undefined;
			return limit !== undefined && v.gameOver !== null && Math.floor(v.gameOver.tick / TICKS_PER_DAY) + 1 <= limit;
		},
	},
	clean_hands: {
		icon: { sheet: "achievements", col: 2, row: 1 },
		when: "gameOver",
		check: (v) => {
			const end = winEnding(v);
			if (!v.soul) return false;
			return (end === "flesh" && v.soul.seal.biotech < 30) || (end === "garden" && v.soul.seal.greentech < 30);
		},
	},
	open_hands: { icon: { sheet: "achievements", col: 3, row: 1 }, when: "gameOver", check: (v) => winEnding(v) === "singularity" && !!v.soul && v.soul.seal.biotech < v.soul.sealMax && v.soul.seal.greentech < v.soul.sealMax },
	cash_deep: { when: "dayClose", icon: { sheet: "achievements", col: 4, row: 1 }, check: (v) => v.cash >= 10_000_000 },
	books_clean: { icon: { sheet: "achievements", col: 5, row: 1 }, when: "gameOver", check: (v, e) => v.gameOver?.kind === "victory" && v.loan.principal === 0 && v.cash >= e.startingCash },
	perfect_qtr: {
		icon: { sheet: "achievements", col: 0, row: 2 },
		when: "quarterReport",
		check: (v) => {
			const r = v.reports[v.reports.length - 1];
			return !!r && r.grade === "A" && r.uptime >= 0.99;
		},
	},
	calm_month: { icon: { sheet: "achievements", col: 1, row: 2 }, when: "dayClose", check: (v) => v.uptimeStreak >= CALM_DAYS },
	bond_close: { icon: { sheet: "achievements", col: 2, row: 2 }, when: "dayClose", check: (v) => bondValues(v).length > 0 && Math.max(...bondValues(v)) >= 50 },
	bond_crew: { icon: { sheet: "achievements", col: 3, row: 2 }, when: "dayClose", check: (v) => bondValues(v).length > 0 && Math.min(...bondValues(v)) >= 40 },
	les_done: { icon: { sheet: "achievements", col: 4, row: 2 }, when: "lessonEnd", check: (_v, e) => e.lessonIds.length > 0 && e.lessonIds.every((id) => e.lessonsDone[id] !== undefined) },
	heard_out: { icon: { sheet: "achievements", col: 5, row: 2 }, when: "gameOver", check: (_v, e) => ADVISOR_KEYS.every((a) => e.profile.epilogues[a]) },
};

export const ACHIEVEMENTS: readonly AchievementDef[] = achievementContent.achievements.map((t) => {
	const c = CHECKS[t.id];
	if (!c) throw new Error(`achievements.json row ${t.id} has no check in achievements.ts`);
	return { ...t, ...c };
});

/** How many there are (100% = all of them, hidden ones included). */
export const ACHIEVEMENT_COUNT = ACHIEVEMENTS.length;

/** Only normal runs count: not lessons, not sandbox sites. `lessonEnd` is the one exception (Student is earned in lessons). */
export const countsForAchievements = (view: Pick<SimView, "lesson" | "sandbox">): boolean => !view.lesson && !view.sandbox;

// ─── Off-duty portraits (spec section 4) ─────────────────────────────────

export interface PortraitDef {
	advisor: AdvisorKey;
	when: AchievementMoment;
	check: (view: SimView) => boolean;
}

export const PORTRAITS: readonly PortraitDef[] = [
	{ advisor: "luci", when: "gameOver", check: (v) => winEnding(v) === "singularity" && v.loan.principal === 0 && (v.soul?.bonds.luci ?? 0) >= 50 },
	{ advisor: "mel", when: "gameOver", check: (v) => winEnding(v) === "flesh" && v.corruption < 0.5 && (v.soul?.bonds.mel ?? 0) >= 40 },
	{ advisor: "bea", when: "gameOver", check: (v) => winEnding(v) === "garden" && !!v.soul && v.soul.seal.greentech < 50 && v.soul.bonds.bea >= 50 },
	{ advisor: "cass", when: "dayClose", check: (v) => v.uptimeStreak >= CALM_DAYS },
];

/** The bed set: all of the achievements earned. */
export const bedComplete = (profile: Pick<Profile, "earned">, defs: readonly AchievementDef[] = ACHIEVEMENTS): boolean => defs.length > 0 && defs.every((d) => profile.earned[d.id]);

// ─── The checker ─────────────────────────────────────────────────────────

type Store = Parameters<typeof loadProfile>[0];

/** The environment for the checks, from the bundled content (pass `balance.startingCash` and the lesson ids) and the stored progress. */
export function achEnv(content: { balance?: { startingCash: number }; lessons?: readonly { id: string }[] } | undefined, storage?: Store): AchEnv {
	return {
		profile: loadProfile(storage),
		startingCash: content?.balance?.startingCash ?? 3_000_000,
		lessonIds: (content?.lessons ?? []).map((l) => l.id),
		lessonsDone: loadLessonProgress(storage).done,
	};
}

/** Pure: the defs for this moment that are met and not yet earned. */
export function evaluate(moment: AchievementMoment, view: SimView, env: AchEnv, defs: readonly AchievementDef[] = ACHIEVEMENTS): AchievementDef[] {
	if (moment !== "lessonEnd" && !countsForAchievements(view)) return [];
	return defs.filter((d) => d.when === moment && !env.profile.earned[d.id] && d.check(view, env));
}

export interface AwardResult {
	/** Achievements earned by this call (each is returned once, ever). */
	won: AchievementDef[];
	/** Casual off-duty portraits unlocked by this call. */
	portraits: AdvisorKey[];
	/** This call earned the last achievement: the bed set is open. */
	bed: boolean;
}

export interface AwardOptions {
	storage?: Store;
	defs?: readonly AchievementDef[];
	/** Content for `startingCash` and the lesson ids. */
	content?: Parameters<typeof achEnv>[0];
	/** Game over only: the advisor whose epilogue the ending screen shows (null for the narrated fallback). Recorded for Heard Her Out. */
	epilogue?: AdvisorKey | null;
}

/** Run the checks for a moment and latch what was met. */
export function awardFor(moment: AchievementMoment, view: SimView, opts: AwardOptions = {}): AwardResult {
	const { storage, defs = ACHIEVEMENTS } = opts;
	const out: AwardResult = { won: [], portraits: [], bed: false };
	if (moment !== "lessonEnd" && !countsForAchievements(view)) return out;
	const bedBefore = bedComplete(loadProfile(storage), defs);
	if (moment === "gameOver" && opts.epilogue) recordEpilogue(opts.epilogue, storage);
	if ((moment === "dayClose" || moment === "gameOver") && view.soul) recordBonds(view.soul.bonds, storage);
	const env = achEnv(opts.content, storage);
	const ending = view.gameOver ? (view.gameOver.ending ?? (view.gameOver.kind === "victory" ? null : view.gameOver.kind)) : null;
	for (const d of evaluate(moment, view, env, defs)) if (recordAchievement(d.id, view.day, ending, storage).first) out.won.push(d);
	if (moment !== "lessonEnd")
		for (const p of PORTRAITS) if (p.when === moment && !env.profile.offDuty[p.advisor].casual && p.check(view) && recordOffDuty(p.advisor, storage)) out.portraits.push(p.advisor);
	out.bed = !bedBefore && bedComplete(loadProfile(storage), defs);
	return out;
}
