/**
 * The Ministry Induction: a guided first session on the starter facility.
 * Pure data + predicates over GameState so the flow is unit-testable without React.
 *
 * Clock policy (owner feedback: "the game kept running behind the memo"):
 * - every step pauses the clock when it begins, and keeps it paused while the player does a task by hand;
 * - a step that needs game time to pass (waiting for an offer, waiting for compute) says `clock: "run"`
 *   (or a function of the state) and the induction runs the clock at 3× until the step no longer needs it.
 */
import type { ContentDB } from "@aitower/content";
import type { CellRef } from "@aitower/sim";
import type { Ghost, GameState, GameStore, Tool } from "@aitower/shared";

export interface TutorialCtx {
	content: ContentDB;
}

/** Values captured when a step begins, so "did the player do it" compares against that moment. */
export interface Baseline {
	racks: number;
	maxJobId: number;
}

/** The HUD-local state the induction needs in order to point at the right tab or card. */
export interface TutorialUi {
	paletteTab: string;
	/** The open edge drawer ("contracts", "gauges", ...) or null. */
	drawer: string | null;
	/** The full build palette popover is open. */
	paletteOpen: boolean;
	tool: Tool;
}

export type ClockMode = "pause" | "run";
export type Corner = "tl" | "tr" | "bl" | "br";

/** Speed the induction runs the clock at while a step needs time to pass. */
export const RUN_SPEED = 3;

export interface TutorialStep {
	id: string;
	/** Memo heading, typewritten. */
	title: string;
	/** Memo body. Short paragraphs; plain words first, Ministry flavour second. */
	body: string[];
	/** The one-line task shown with a checkbox: says exactly what to click and where. Absent = an informational memo. */
	task?: string;
	/** Numbered click-path under the task. `phase` says which item is current (earlier ones are struck through). */
	how?: string[];
	phase?: (s: GameState, ui: TutorialUi) => number;
	/** CSS selectors (inside the HUD) of the exact elements to highlight right now. */
	targets?: (s: GameState, ui: TutorialUi) => string[];
	/** Preferred corner for the memo; the memo moves to another corner if it would cover a target. */
	corner?: Corner;
	/** Clock policy; see the header. */
	clock: ClockMode | ((s: GameState) => ClockMode);
	/** Why time passes, shown while the clock runs ("so offers arrive"). */
	runReason?: string;
	/** Camera focus when the step starts. */
	focus?: CellRef;
	/** A ghost drawn in the world to mark the spot (kept in place while it applies). */
	ghost?: (s: GameState, ui: TutorialUi) => Ghost | null;
	/** Side effects when the step starts. */
	onEnter?: (store: GameStore) => void;
	/** Completion test for task steps. */
	done?: (s: GameState, base: Baseline, ctx: TutorialCtx) => boolean;
}

/** The clock mode a step wants for this state. */
export const stepClock = (step: TutorialStep, s: GameState): ClockMode => (typeof step.clock === "function" ? step.clock(s) : step.clock);

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

export const TUTORIAL_STEPS: TutorialStep[] = [
	{
		id: "welcome",
		title: "Welcome, Superintendent",
		body: [
			"You run an AI datacenter for the Ministry of Computation. Labs pay to rent your racks; power and upkeep cost money every minute.",
			"Your job: keep the racks busy. The clock is stopped while you read.",
		],
		clock: "pause",
	},
	{
		id: "contract",
		title: "Take a contract",
		body: ["Money comes from contracts. Accept one your idle racks can start: those offers say “Fits your idle racks”."],
		task: "Press the green ACCEPT stamp on the highlighted offer",
		how: ["Open CONTRACTS on the right edge (key C)", "Press ACCEPT on the highlighted offer"],
		phase: (_s, ui) => (ui.drawer === "contracts" ? 1 : 0),
		targets: (s, ui) => (ui.drawer !== "contracts" ? [t("dtab-contracts")] : s.view.offers.length > 0 ? [t("accept")] : [".ui-drawer"]),
		// An empty board needs time to pass; the moment an offer is posted the clock stops again so the player can read it.
		clock: (s) => (s.view.offers.length > 0 ? "pause" : "run"),
		runReason: "so that an offer arrives",
		done: (s, b) => maxJobId(s) > b.maxJobId,
	},
	{
		id: "compute",
		title: "Watch it run",
		body: ["The racks pick up the job by themselves. Training pays at each checkpoint; inference pays every minute."],
		task: "Wait until the job is running: PER HOUR starts to move",
		targets: () => [t("perhour")],
		clock: "run",
		runReason: "so the racks start the job",
		focus: { x: 12, floor: 1 },
		done: (s) => s.view.pflops > 0,
	},
	{
		id: "orders",
		title: "What to do next",
		body: ["Lost? NEXT, at the top of the world, always says what to do. Click it to jump there. Numbers turn amber or red when they need you."],
		targets: () => [".ui-next"],
		corner: "br",
		clock: "pause",
	},
	{
		id: "clock",
		title: "Time is money",
		body: ["You control the clock. Faster speeds earn faster, and cost faster."],
		task: "Click the 3× button in the top bar, or press the 3 key",
		targets: () => [t("speed-3")],
		clock: "pause",
		done: (s) => s.speed >= 3,
	},
	{
		id: "build-rack",
		title: "Add a cabinet",
		body: ["More racks, more contracts. The marked spot on F1 already has floor, power and cooling. Press Esc afterwards."],
		task: "Build one more compute cabinet on F1",
		how: ["Press MORE in the build dock (bottom left)", "Click the RACKS tab", "Click the first card: Mk.I Air-Cooled Compute Cabinet", "Click the blue blueprint on F1"],
		phase: (_s, ui) => (placing(ui, "rack_air_gpu") ? 3 : !ui.paletteOpen ? 0 : ui.paletteTab !== "rack" ? 1 : 2),
		targets: (_s, ui) => (placing(ui, "rack_air_gpu") ? [] : !ui.paletteOpen ? [t("dock-more")] : ui.paletteTab !== "rack" ? [t("tab-rack")] : [t("card-rack_air_gpu")]),
		ghost: (_s, ui) => (placing(ui, "rack_air_gpu") ? { cells: RACK_SPOT, valid: true, defId: "rack_air_gpu", label: "CLICK HERE" } : null),
		clock: "pause",
		focus: { x: 19, floor: 1 },
		onEnter: (store) => store.setOverlay("normal"),
		done: (s, b, ctx) => rackCount(s, ctx) > b.racks,
	},
	{
		id: "heat",
		title: "Mind the heat",
		body: ["Racks make heat. The air handler cools about eight tiles around it. Red means too hot: racks slow down, then shut off."],
		task: "Open GAUGES (key I) and click HEAT, or just press H",
		how: ["Open GAUGES on the right edge (key I)", "Click HEAT under OVERLAYS"],
		phase: (_s, ui) => (ui.drawer === "gauges" ? 1 : 0),
		targets: (_s, ui) => (ui.drawer === "gauges" ? [t("overlay-heat")] : [t("dtab-gauges")]),
		clock: "pause",
		done: (s) => s.overlay === "heat",
	},
	{
		id: "memos",
		title: "Ministry memos",
		body: ["Memos arrive in the INBOX (top strip). Urgent ones pop up with their stamps; the figure on each stamp is its real cost. Unanswered memos are filed under the default stamp."],
		targets: () => [t("inbox"), t("standing")],
		clock: "pause",
	},
	{
		id: "finale",
		title: "Induction complete",
		body: [
			"Goal: Clearance 2 (120 PFLOPS installed) unlocks liquid cooling. The CLEARANCE bar in the top strip shows your progress; NEXT says what to do.",
			"Esc opens saves, settings and controls. Closing this memo starts the clock at 1×.",
		],
		targets: () => [t("clearance")],
		clock: "pause",
	},
];

/**
 * Shown once, the first time a Ministry memo is open while the induction is running. Not part of the numbered
 * steps: it interrupts the current step, and the clock is stopped while it is on screen.
 */
export const MEMO_EXPLAINER: TutorialStep = {
	id: "memo-explainer",
	title: "A memo from the Ministry",
	body: [
		"A memo just arrived. Urgent ones pop up at the top right; the rest wait in the INBOX. Each stamp shows what it costs.",
		"Ignored memos are filed under their default stamp when the countdown ends.",
	],
	targets: () => [t("inbox")],
	corner: "br",
	clock: "pause",
};

/** True when the first-memo explainer should interrupt the induction now. */
export function needsMemoExplainer(explained: boolean, done: boolean, openMemos: number): boolean {
	return !explained && !done && openMemos > 0;
}
