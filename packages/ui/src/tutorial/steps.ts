/**
 * The first-session coach marks: five doing-steps on the starter site, each one short sentence in a bubble next to the thing
 * to click. A step completes when the player does the action. Pure data + predicates over GameState so the flow is
 * unit-testable without React. Just-in-time hints (heat, the first memo) live here too.
 *
 * Clock policy: the clock is left to the player ("free") except while building, which stops time so nothing happens
 * behind the player's clicks ("pause").
 */
import type { ContentDB } from "@aitower/content";
import type { CellRef } from "@aitower/sim";
import type { GameState, GameStore, Ghost, Tool } from "@aitower/shared";
import { perHour } from "../calm/calm";
import type { UiState } from "../components/context";
import type { Side } from "./placement";

export interface TutorialCtx {
	content: ContentDB;
}

/** Values captured when a step begins, so "did the player do it" compares against that moment. */
export interface Baseline {
	racks: number;
	maxJobId: number;
}

/** The HUD-local state the coach marks need in order to point at the right tab or card. */
export interface TutorialUi {
	paletteTab: string;
	/** The open edge drawer ("contracts", "gauges", ...) or null. */
	drawer: string | null;
	/** The full build palette popover is open. */
	paletteOpen: boolean;
	tool: Tool;
}

/** "pause": stop the clock on entry. "run": run it at 3x. "free": the player's clock is left alone. */
export type ClockMode = "pause" | "run" | "free";

/** Speed the clock runs at when a step asks for "run". */
export const RUN_SPEED = 3;

export interface TutorialStep {
	id: string;
	/** The one sentence in the bubble. May depend on what the player has done so far. */
	text: (s: GameState, ui: TutorialUi) => string;
	/** CSS selectors (inside the HUD) of the elements to pulse; the bubble anchors to the first one found. */
	targets: (s: GameState, ui: TutorialUi) => string[];
	/** Preferred sides for the bubble, in order. */
	sides?: Side[];
	clock: ClockMode;
	/** Camera focus when the step starts. */
	focus?: CellRef;
	/** A ghost drawn in the world to mark the spot (kept in place while it applies). */
	ghost?: (s: GameState, ui: TutorialUi) => Ghost | null;
	/** Side effects when the step starts. */
	onEnter?: (store: GameStore, setUi: (patch: Partial<UiState>) => void) => void;
	/** What the bubble says for a moment once the step is done (default: the same text with a tick). */
	doneText?: string;
	/** How long that moment lasts, in ms (default 700). */
	linger?: number;
	/** Completion test. Absent = the bubble has a "Got it" button instead. */
	done?: (s: GameState, base: Baseline, ctx: TutorialCtx) => boolean;
}

export const rackCount = (s: GameState, ctx: TutorialCtx): number =>
	s.view.facilities.filter((f) => ctx.content.facilities[f.defId]?.kind === "rack").length;

export const maxJobId = (s: GameState): number => s.view.jobs.reduce((m, j) => Math.max(m, j.id), -1);

export const baselineOf = (s: GameState, ctx: TutorialCtx): Baseline => ({ racks: rackCount(s, ctx), maxJobId: maxJobId(s) });

const t = (id: string): string => `[data-tut="${id}"]`;
/** Blueprint spot just right of the tape archive (x 16–17) on F1, two tiles wide like the cabinet. */
const RACK_SPOT: CellRef[] = [
	{ x: 18, floor: 1 },
	{ x: 19, floor: 1 },
];
const placing = (ui: TutorialUi, defId: string): boolean => ui.tool.kind === "place" && ui.tool.defId === defId;

/** Which of the build steps' four moves the player is on (0 menu, 1 tab, 2 card, 3 blueprint). */
export const buildPhase = (ui: TutorialUi): number => (placing(ui, "rack_air_gpu") ? 3 : !ui.paletteOpen ? 0 : ui.paletteTab !== "rack" ? 1 : 2);

export const TUTORIAL_STEPS: TutorialStep[] = [
	{
		id: "accept",
		text: (s, ui) => (ui.drawer !== "contracts" ? "Open Contracts to see who wants to rent your racks." : s.view.offers.length > 0 ? "Accept this contract to start earning." : "Waiting for an offer to arrive."),
		targets: (s, ui) => (ui.drawer !== "contracts" ? [t("dtab-contracts")] : s.view.offers.length > 0 ? [t("accept")] : [".ui-drawer"]),
		sides: ["below"],
		clock: "free",
		onEnter: (_store, setUi) => setUi({ drawer: "contracts" }),
		done: (s, b) => maxJobId(s) > b.maxJobId,
	},
	{
		id: "play",
		text: () => "Press play so time passes: 1× is normal speed, 3× is faster.",
		targets: () => [t("speed-1"), t("speed-3")],
		sides: ["below"],
		clock: "free",
		done: (s) => s.speed > 0,
	},
	{
		id: "income",
		text: (s) => (s.speed === 0 ? "Time is stopped. Press play and watch PER HOUR." : "Your racks are working. Wait for PER HOUR to turn green."),
		targets: (s) => (s.speed === 0 ? [t("speed-1")] : [t("perhour")]),
		sides: ["below"],
		clock: "free",
		doneText: "PER HOUR is green: you are earning.",
		linger: 2200,
		done: (s) => (perHour(s.view) ?? -1) > 0,
	},
	{
		id: "build",
		text: (_s, ui) => ["Open the build menu to add a rack.", "Pick the RACKS tab.", "Choose the air-cooled rack.", "Click the blue spot to place it."][buildPhase(ui)],
		targets: (_s, ui) => [[t("dock-more")], [t("tab-rack")], [t("card-rack_air_gpu")], []][buildPhase(ui)],
		sides: ["right", "above"],
		ghost: (_s, ui) => (placing(ui, "rack_air_gpu") ? { cells: RACK_SPOT, valid: true, defId: "rack_air_gpu", label: "CLICK HERE" } : null),
		clock: "pause",
		focus: { x: 19, floor: 1 },
		onEnter: (store) => store.setOverlay("normal"),
		done: (s, b, ctx) => rackCount(s, ctx) > b.racks,
	},
	{
		id: "goals",
		text: () => "Your goals live here. Follow them from now on.",
		targets: () => [t("goals")],
		sides: ["right"],
		clock: "free",
		// Close the build menu and put the tool down so nothing covers the card.
		onEnter: (store, setUi) => {
			store.setTool({ kind: "select" });
			setUi({ paletteOpen: false });
		},
	},
];

// ─── Just-in-time hints ──────────────────────────────────────────────────

export type HintId = "heat" | "memo";
export type HintsSeen = Partial<Record<HintId, boolean>>;

export interface Hint {
	id: HintId;
	text: string;
	targets: string[];
	sides: Side[];
}

export const HINTS: Record<HintId, Hint> = {
	heat: { id: "heat", text: "Too hot: add an air handler nearby.", targets: [], sides: ["above"] },
	memo: { id: "memo", text: "A memo arrived. Answer it here, or open the inbox.", targets: [".ui-memo-pop", t("inbox")], sides: ["left", "below"] },
};

/** The rack that is running hot (slowed down), if any. */
export const hotRack = (s: GameState, ctx: TutorialCtx): GameState["view"]["facilities"][number] | undefined =>
	s.view.facilities.find((f) => f.enabled && f.status === "throttled" && ctx.content.facilities[f.defId]?.kind === "rack");

/** The hint to show now: the first one whose moment has come and that the player has not seen. */
export function activeHint(s: GameState, seen: HintsSeen, ctx: TutorialCtx): HintId | null {
	if (!seen.heat && hotRack(s, ctx)) return "heat";
	if (!seen.memo && s.view.memos.length > 0) return "memo";
	return null;
}
