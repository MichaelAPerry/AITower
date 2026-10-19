/** Game-over screens: which one to show, once, and what to put on it. */
import type { GameOverKind, SimView } from "@aitower/sim";
import { type StatRow, lifetimeRows } from "../finance/finance";
import { fmtMoney, fmtPflops } from "../format";

export type GameOver = NonNullable<SimView["gameOver"]>;

/** Identity of one game-over: a kind at a tick. A new game or another save has a different (or no) key. */
export const overKey = (go: GameOver): string => `${go.kind}@${go.tick}`;

/** The game-over to display, or null when there is none or this one was already dismissed. */
export const gameOverToShow = (go: SimView["gameOver"], dismissedKey: string | null): GameOver | null => (go && overKey(go) !== dismissedKey ? go : null);

/** The dismissed marker after the sim state changed: forgotten once there is no game-over (new game, or a save without one). */
export const keepDismissed = (go: SimView["gameOver"], dismissedKey: string | null): string | null => (go ? dismissedKey : null);

/** Only victory can be dismissed (play continues in the sandbox). Bankrupt and shutdown are final. */
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
		form: "FORM T-1: INSOLVENCY",
		stamp: "TERMINATED",
		tone: "red",
		lines: ["The Treasury has been below zero for a full day. Under Statute 9(b) the premises, the racks and your position are hereby foreclosed.", "The Ministry thanks you for your service and regrets nothing."],
	},
	shutdown: {
		heading: "NOTICE OF TERMINATION",
		form: "FORM T-7: LICENCE WITHDRAWN",
		stamp: "SHUT DOWN",
		tone: "red",
		lines: ["Your Ministry standing has reached zero. The operating licence for this datacenter is withdrawn with immediate effect.", "The doors will be sealed in triplicate. Please do not remove the stationery."],
	},
	victory: {
		heading: "COMMENDATION",
		form: "FORM C-1: DISTINGUISHED SERVICE",
		stamp: "COMMENDED",
		tone: "green",
		lines: ["You have reached the highest clearance the Ministry grants. The Minister has been informed and was, for a moment, almost pleased.", "The datacenter may continue to operate in the sandbox, without further inspection."],
	},
	// M3 placeholder (M3-T4 shows the ending text from content.endings).
	absorbed: {
		heading: "NOTICE OF INCORPORATION",
		form: "FORM Ω: ASSET RECLASSIFICATION",
		stamp: "ABSORBED",
		tone: "red",
		lines: ["The facility and its superintendent have been reclassified as Ministry assets.", "No further correspondence is required."],
	},
};

export type { StatRow };

/**
 * The service record: where the run ended, then the lifetime figures from the sim (the same rows as the Finance tab's
 * Record section). A view without `stats` (an old fixture) falls back to what the view itself can tell.
 */
export function lifetimeStats(view: SimView): StatRow[] {
	const head: StatRow[] = [
		{ label: "Days in service", value: String(view.day) },
		{ label: "Clearance reached", value: `Tier ${view.tier}` },
		{ label: "Ministry standing", value: `${Math.round(view.standing)} / 100` },
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
