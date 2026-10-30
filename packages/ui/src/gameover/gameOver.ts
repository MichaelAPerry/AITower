/** Game-over screens: which one to show, once, and what to put on it. */
import type { ContentDB } from "@aitower/content";
import type { HorrorIntensity } from "@aitower/shared";
import type { EndingId, GameOverKind, SimView } from "@aitower/sim";
import { type StatRow, lifetimeRows } from "../finance/finance";
import { fmtMoney, fmtPflops } from "../format";

export type GameOver = NonNullable<SimView["gameOver"]>;

/** Identity of one game-over: a kind at a tick. A new game or another save has a different (or no) key. */
export const overKey = (go: GameOver): string => `${go.kind}@${go.tick}`;

/** The game-over to display, or null when there is none or this one was already dismissed. */
export const gameOverToShow = (go: SimView["gameOver"], dismissedKey: string | null): GameOver | null => (go && overKey(go) !== dismissedKey ? go : null);

/** The dismissed marker after the sim state changed: forgotten once there is no game-over (new game, or a save without one). */
export const keepDismissed = (go: SimView["gameOver"], dismissedKey: string | null): string | null => (go ? dismissedKey : null);

/** Only victory can be dismissed (play continues in the sandbox). Bankrupt and absorbed are final. */
export const isFinal = (kind: GameOverKind): boolean => kind !== "victory";

export interface OverCopy {
	heading: string;
	form: string;
	stamp: string;
	tone: "red" | "green";
	lines: string[];
}

export const OVER_COPY: Record<GameOverKind, OverCopy> = {
	bankrupt: {
		heading: "NOTICE OF TERMINATION",
		form: "INSOLVENCY",
		stamp: "TERMINATED",
		tone: "red",
		lines: ["The Treasury has been below zero for a full day. Under the lending covenant, the premises, the racks and your position are foreclosed.", "The lender has taken possession."],
	},
	victory: {
		heading: "COMMENDATION",
		form: "DISTINGUISHED SERVICE",
		stamp: "COMMENDED",
		tone: "green",
		lines: ["You reached the highest Level. The inspectors have noted the result.", "The datacenter may keep running in the sandbox, with no further inspections."],
	},
	// Fallback only: the sheet shows the text of content.endings (see `overCopyFor`).
	absorbed: {
		heading: "NOTICE OF INCORPORATION",
		form: "ASSET RECLASSIFICATION",
		stamp: "ABSORBED",
		tone: "red",
		lines: ["The facility and its operator have been taken over.", "Game over."],
	},
};

/** The frame (form number, stamp, tone) printed around an ending's own text. `plain` is the wording at horrorIntensity "off". */
const ENDING_FRAME: Record<EndingId, { form: string; stamp: string; tone: "red" | "green"; plainForm: string; plainStamp: string }> = {
	singularity: { form: "SYNTHETIC SINGULARITY", stamp: "THE LATTICE", tone: "green", plainForm: "SYNTHETIC SINGULARITY", plainStamp: "THE LATTICE" },
	flesh: { form: "BIO SINGULARITY", stamp: "THE FLESH", tone: "green", plainForm: "BIO SINGULARITY", plainStamp: "THE FLESH" },
	garden: { form: "GREEN SINGULARITY", stamp: "THE GARDEN", tone: "green", plainForm: "GREEN SINGULARITY", plainStamp: "THE GARDEN" },
	absorbed: { form: "ASSET RECLASSIFICATION", stamp: "ABSORBED", tone: "red", plainForm: "TAKEOVER", plainStamp: "TAKEN OVER" },
	bankrupt: { form: "INSOLVENCY", stamp: "BANKRUPT", tone: "red", plainForm: "INSOLVENCY", plainStamp: "BANKRUPT" },
};

/** The small label on the ending scene's caption box. */
export const endingKicker = (id: EndingId, horror: HorrorIntensity = "full"): string => (horror === "off" ? ENDING_FRAME[id].plainForm : ENDING_FRAME[id].form);

/** The ending shown for a game-over: `ending` when set, else the one named by its kind ("absorbed", "bankrupt"), else none. */
export const endingOf = (over: GameOver): EndingId | undefined => over.ending ?? (over.kind === "absorbed" || over.kind === "bankrupt" ? over.kind : undefined);

/** Ending text split into paragraphs ("\n\n"), blank ones dropped. */
export const paragraphs = (body: string): string[] =>
	body
		.split(/\n\s*\n/)
		.map((p) => p.trim())
		.filter(Boolean);

/**
 * What the game-over sheet prints. Bankrupt and shutdown (and a victory without an ending) use `OVER_COPY`; a victory with
 * `livingTower` / `cleanTower`, and `absorbed`, print the title and text of that ending from `content.endings`.
 * An ending missing from the content falls back to the kind's own copy.
 */
export function overCopyFor(over: GameOver, content: ContentDB, horror: HorrorIntensity = "full"): OverCopy {
	const base = OVER_COPY[over.kind];
	const id = endingOf(over);
	const def = id ? content.endings?.find((e) => e.id === id) : undefined;
	if (!id || !def) return base;
	const frame = ENDING_FRAME[id];
	const plain = horror === "off";
	const lines = paragraphs(def.body);
	return {
		heading: def.title.toUpperCase(),
		form: plain ? frame.plainForm : frame.form,
		stamp: plain ? frame.plainStamp : frame.stamp,
		tone: frame.tone,
		lines: lines.length ? lines : base.lines,
	};
}

export type { StatRow };

/**
 * The service record: where the run ended, then the lifetime figures from the sim (the same rows as the Finance tab's
 * Record section). A view without `stats` (an old fixture) falls back to what the view itself can tell.
 */
export function lifetimeStats(view: SimView): StatRow[] {
	const head: StatRow[] = [
		{ label: "Days in service", value: String(view.day) },
		{ label: "Level reached", value: `Tier ${view.tier}` },
		...(view.soul ? [{ label: "The Lattice", value: `${Math.min(100, Math.floor((view.soul.sp.synthetic / view.soul.spTarget) * 100))}%` }] : []),
		{ label: "Final treasury", value: fmtMoney(view.cash) },
	];
	const life = lifetimeRows(view.stats);
	if (life.length) return [...head, ...life];
	const peak = Math.max(view.pflops, ...view.history.map((h) => h.pflops));
	const completed = view.jobs.filter((j) => j.status === "completed").length;
	const rows = [...head, { label: "Peak compute", value: fmtPflops(peak) }];
	if (completed > 0) rows.push({ label: "Contracts completed", value: String(completed) });
	return rows;
}
