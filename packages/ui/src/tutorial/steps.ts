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
	bottomTab: string;
	bottomOpen: boolean;
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

const anyOnFloor = (s: GameState, layer: Uint8Array, floor: number): boolean => {
	const { width, floorMin, floorMax } = s.view;
	if (floor < floorMin || floor > floorMax) return false;
	const row = (floor - floorMin) * width;
	for (let x = 0; x < width; x++) if (layer[row + x]) return true;
	return false;
};

const t = (id: string): string => `[data-tut="${id}"]`;
/** Blueprint spot just right of the tape archive (x 16–17) on F1, two tiles wide like the cabinet. */
const RACK_SPOT: CellRef[] = [
	{ x: 18, floor: 1 },
	{ x: 19, floor: 1 },
];
const f2Run = (x0: number, x1: number): CellRef[] => Array.from({ length: x1 - x0 + 1 }, (_, i) => ({ x: x0 + i, floor: 2 }));
const placing = (ui: TutorialUi, defId: string): boolean => ui.tool.kind === "place" && ui.tool.defId === defId;
const bottomShows = (ui: TutorialUi, tab: string): boolean => ui.bottomOpen && ui.bottomTab === tab;

export const TUTORIAL_STEPS: TutorialStep[] = [
	{
		id: "welcome",
		title: "Appointment of Facility Superintendent",
		body: [
			"Congratulations. You now run a three-floor AI datacenter on behalf of the Ministry of Computation.",
			"AI labs rent your compute. You keep the racks powered, cooled and repaired, and you keep the Treasury out of the red.",
			"The clock stays stopped while you read. This induction takes about five minutes, and you can close it any time with the CLOSE button.",
		],
		clock: "pause",
	},
	{
		id: "camera",
		title: "Surveying the Premises",
		body: [
			"Drag with the right or middle mouse button, or use WASD or the arrow keys, to pan. Scroll to zoom.",
			"The starter facility has four GPU cabinets, an air handler and a tape archive on floor F1, a parts cage and robot dock on G, and the grid intake in the basement.",
		],
		clock: "pause",
		focus: { x: 19, floor: 0 },
	},
	{
		id: "clock",
		title: "Time Is Money",
		body: ["One tick is one game-minute. Nothing in the datacenter moves while the clock is stopped, as it is now."],
		task: "Click the 3× button in the top bar (right of the pause button), or press the 3 key",
		targets: () => [t("speed-3")],
		clock: "pause",
		done: (s) => s.speed >= 3,
	},
	{
		id: "gauges",
		title: "Reading the Instruments",
		body: [
			"PUE: total facility power divided by IT power. 1.0 is perfect; most real datacenters sit near 1.5. Lower means a smaller electricity bill.",
			"IT LOAD: what your racks draw, against total facility draw. NET TODAY: today's income minus spending.",
			"CLEARANCE lamps show your tier. Higher clearance unlocks better hardware.",
		],
		targets: () => [".ui-gauges"],
		clock: "pause",
	},
	{
		id: "contract",
		title: "Form AT-7: Contract Requisition",
		body: [
			"Labs post contracts in the CONTRACTS form at the bottom. Training and fine-tune jobs pay when finished; inference pays per minute while you serve it.",
			"Offers tagged LIQUID need liquid cooling you do not have yet. Missed deadlines cost penalties.",
		],
		task: "In the CONTRACTS form at the bottom, press the green ACCEPT stamp on the highlighted offer",
		how: ["Open the CONTRACTS tab at the bottom of the screen", "Press ACCEPT on the highlighted offer (it needs nothing your site lacks)"],
		phase: (_s, ui) => (bottomShows(ui, "contracts") ? 1 : 0),
		targets: (s, ui) => (!bottomShows(ui, "contracts") ? [t("btab-contracts")] : s.view.offers.length > 0 ? [t("accept")] : [".ui-bottom"]),
		// An empty board needs time to pass; the moment an offer is posted the clock stops again so the player can read it.
		clock: (s) => (s.view.offers.length > 0 ? "pause" : "run"),
		runReason: "so that an offer arrives (new ones appear every few hours)",
		done: (s, b) => maxJobId(s) > b.maxJobId,
	},
	{
		id: "compute",
		title: "Computation Commences",
		body: [
			"Idle racks are assigned to the job automatically. Their CRT panels scroll green while they work.",
			"Track progress in the JOBS tab of the bottom panel. Nothing for you to click: this ticks off by itself.",
		],
		task: "Wait until COMPUTE in the top bar rises above 0 PF",
		targets: () => [".ui-statbank"],
		clock: "run",
		runReason: "so the racks pick up the job",
		focus: { x: 12, floor: 1 },
		done: (s) => s.view.pflops > 0,
	},
	{
		id: "inspect",
		title: "Form IN-3: Equipment Dossier",
		body: [
			"Click any machine to open its dossier on the right: temperature, clock speed, health, power draw and current job.",
			"Racks slow down above 80 °C and shut off at 95 °C.",
		],
		task: "Click one of the GPU cabinets on floor F1 (the outlined cabinet, left of the tape archive)",
		focus: { x: 10, floor: 1 },
		ghost: () => ({ cells: [{ x: 10, floor: 1 }, { x: 11, floor: 1 }], valid: true, label: "CLICK HERE" }),
		clock: "pause",
		done: (s, _b, ctx) => s.selection?.kind === "facility" && ctx.content.facilities[s.view.facilities.find((f) => f.id === s.selection?.id)?.defId ?? ""]?.kind === "rack",
	},
	{
		id: "heat",
		title: "Thermal Surveillance",
		body: [
			"Every watt a rack draws becomes heat, and heat rises to the floor above. The heat overlay shows air temperature: blue is cool, amber warm, red dangerous.",
			"The air handler can only cool cabinets within about eight tiles of it.",
		],
		task: "Click the HEAT button in the strip at the top-left of the world view, or press the H key",
		targets: () => [t("overlay-heat")],
		clock: "pause",
		done: (s) => s.overlay === "heat",
	},
	{
		id: "build-rack",
		title: "Requisition of Additional Capacity",
		body: [
			"Equipment needs a floor, power cable underneath and cooling nearby; the marked spot on F1 has all three. Afterwards press Esc to put the tool away.",
		],
		task: "Build one more compute cabinet on F1, just right of the tape archive",
		how: ["Click the RACKS tab in the left panel", "Click the first card: Mk.I Air-Cooled Compute Cabinet", "Click on F1 just right of the tape archive (the blue blueprint)"],
		phase: (_s, ui) => (ui.paletteTab !== "rack" ? 0 : placing(ui, "rack_air_gpu") ? 2 : 1),
		targets: (_s, ui) => (ui.paletteTab !== "rack" ? [t("tab-rack")] : placing(ui, "rack_air_gpu") ? [] : [t("card-rack_air_gpu")]),
		ghost: (_s, ui) => (placing(ui, "rack_air_gpu") ? { cells: RACK_SPOT, valid: true, defId: "rack_air_gpu", label: "CLICK HERE" } : null),
		clock: "pause",
		focus: { x: 19, floor: 1 },
		onEnter: (store) => store.setOverlay("normal"),
		done: (s, b, ctx) => rackCount(s, ctx) > b.racks,
	},
	{
		id: "repairs",
		title: "Concerning Breakdowns",
		body: [
			"Hardware fails routinely: roughly one cabinet a day at this size. Each failure files a work order.",
			"The maintenance automaton fetches a spare part from the requisition cage, rides the lift and swaps the part. Keep spare parts stocked (the highlighted STORES REQUISITION box), and buy a second automaton as you grow.",
		],
		targets: () => [".ui-supplies"],
		clock: "pause",
	},
	{
		id: "slab",
		title: "Vertical Expansion",
		body: [
			"Towers grow upward. A new floor must sit on an existing one, so you build on the empty row directly above F1.",
		],
		task: "Build floor slab on F2: drag along the blue strip above F1",
		how: ["Click the BUILD tab in the left panel", "Click the Floor slab card", "Press on F2 at the left end of the blue strip and drag right to its end"],
		phase: (_s, ui) => (ui.paletteTab !== "structure" ? 0 : ui.tool.kind === "slab" ? 2 : 1),
		targets: (_s, ui) => (ui.paletteTab !== "structure" ? [t("tab-structure")] : ui.tool.kind === "slab" ? [] : [t("card-slab")]),
		ghost: (_s, ui) => (ui.tool.kind === "slab" ? { cells: f2Run(18, 25), valid: true, label: "DRAG ALONG HERE" } : null),
		clock: "pause",
		focus: { x: 21, floor: 2 },
		done: (s) => anyOnFloor(s, s.view.slab, 2),
	},
	{
		id: "conduit",
		title: "Extending the Mains",
		body: [
			"Power conduit that touches the conduit on the floor below joins the same power network automatically. Press P afterwards to see the networks.",
		],
		task: "Lay power conduit on F2: drag along the blue strip on the new slab",
		how: ["Click the BUILD tab in the left panel", "Click the Power conduit card", "Press on F2 at the left end of the blue strip and drag right to its end"],
		phase: (_s, ui) => (ui.paletteTab !== "structure" ? 0 : ui.tool.kind === "conduit" && ui.tool.layer === "power" ? 2 : 1),
		targets: (_s, ui) =>
			ui.paletteTab !== "structure" ? [t("tab-structure")] : ui.tool.kind === "conduit" && ui.tool.layer === "power" ? [] : [t("card-bolt-power")],
		ghost: (_s, ui) => (ui.tool.kind === "conduit" && ui.tool.layer === "power" ? { cells: f2Run(18, 25), valid: true, label: "DRAG ALONG HERE" } : null),
		clock: "pause",
		focus: { x: 21, floor: 2 },
		done: (s) => anyOnFloor(s, s.view.power, 2),
	},
	{
		id: "memos",
		title: "Ministry Memoranda",
		body: [
			"From time to time the Ministry sends a memo to the INBOX lamp at the top right of the top bar. A memo does not stop the clock: it carries a countdown, and an unanswered memo is filed under its default stamp.",
			"Each stamp shows what it will cost or pay, in plain numbers. Your MINISTRY STANDING meter moves with your choices. At zero the Ministry shuts you down.",
		],
		targets: () => [t("inbox"), t("standing")],
		clock: "pause",
	},
	{
		id: "finale",
		title: "Induction Complete",
		body: [
			"Your standing orders: reach Clearance 2 (120 PFLOPS installed, 95% uptime) to unlock liquid cooling.",
			"F2 still needs an air handler before you fill it with cabinets. Watch PUE, keep parts stocked, and file your contracts promptly.",
			"Press Esc (or MENU in the top bar) for saves, settings and controls. RESTART INDUCTION there reopens this memo. Closing this memo starts the clock at 1×.",
		],
		targets: () => [".ui-tier"],
		clock: "pause",
	},
];

/**
 * Shown once, the first time a Ministry memo is open while the induction is running. Not part of the numbered
 * steps: it interrupts the current step, and the clock is stopped while it is on screen.
 */
export const MEMO_EXPLAINER: TutorialStep = {
	id: "memo-explainer",
	title: "A Memo from the Ministry",
	body: [
		"A paper memo has just landed at the top of the screen, and the INBOX lamp in the top bar is lit. Each memo asks a question and offers a few rubber stamps.",
		"Read the small print under each stamp: it states the real numbers. Press the stamp you want. The clock does not stop for memos in play, but it is stopped now while you read.",
		"Ignore a memo and it is filed under its default stamp when the countdown ends. Your MINISTRY STANDING meter moves with your answers.",
	],
	targets: () => [t("inbox"), ".ui-memo-pop"],
	corner: "br",
	clock: "pause",
};

/** True when the first-memo explainer should interrupt the induction now. */
export function needsMemoExplainer(explained: boolean, done: boolean, openMemos: number): boolean {
	return !explained && !done && openMemos > 0;
}
