/**
 * The Ministry Induction: a guided first session on the starter facility.
 * Pure data + predicates over GameState so the flow is unit-testable without React.
 */
import type { ContentDB } from "@aitower/content";
import type { CellRef } from "@aitower/sim";
import type { GameState, GameStore } from "@aitower/shared";

export interface TutorialCtx {
	content: ContentDB;
}

/** Values captured when a step begins, so "did the player do it" compares against that moment. */
export interface Baseline {
	racks: number;
	maxJobId: number;
}

export interface TutorialStep {
	id: string;
	/** Memo heading, typewritten. */
	title: string;
	/** Memo body. Short paragraphs; plain words first, Ministry flavour second. */
	body: string[];
	/** The one-line task shown with a checkbox. Absent = an informational memo with a Continue button. */
	task?: string;
	/** CSS selector (inside the HUD) to spotlight while this step is active. */
	target?: string;
	/** Camera focus when the step starts. */
	focus?: CellRef;
	/** Side effects when the step starts (e.g. pause the clock). */
	onEnter?: (store: GameStore) => void;
	/** Completion test for task steps. */
	done?: (s: GameState, base: Baseline, ctx: TutorialCtx) => boolean;
}

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

export const TUTORIAL_STEPS: TutorialStep[] = [
	{
		id: "welcome",
		title: "Appointment of Facility Superintendent",
		body: [
			"Congratulations. You now run a three-floor AI datacenter on behalf of the Ministry of Computation.",
			"AI labs rent your compute. You keep the racks powered, cooled and repaired, and you keep the Treasury out of the red.",
			"The clock is paused while you read. This induction takes about five minutes.",
		],
		onEnter: (store) => store.setSpeed(0),
	},
	{
		id: "camera",
		title: "Surveying the Premises",
		body: [
			"Drag with the right or middle mouse button, or use WASD or the arrow keys, to pan. Scroll to zoom.",
			"The starter facility has four GPU cabinets, an air handler and a tape archive on floor F1, a parts cage and robot dock on G, and the grid intake in the basement.",
		],
		focus: { x: 19, floor: 0 },
	},
	{
		id: "clock",
		title: "Time Is Money",
		body: ["One tick is one game-minute. Use the speed buttons, or the keys 1–5, to run the clock. Space pauses and resumes."],
		task: "Set the speed to 3×",
		target: ".ui-speeds",
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
		target: ".ui-gauges",
	},
	{
		id: "contract",
		title: "Form AT-7: Contract Requisition",
		body: [
			"Labs post contracts in the bottom panel. Training and fine-tune jobs pay when finished. Inference jobs pay per minute while you supply the compute they asked for.",
			"Accept only what your idle racks can serve. Missed deadlines and unserved inference cost penalties.",
			"If the board is empty, run the clock; new offers arrive every few hours.",
		],
		task: "Accept a contract (stamp it APPROVED)",
		target: ".ui-bottom",
		done: (s, b) => maxJobId(s) > b.maxJobId,
	},
	{
		id: "compute",
		title: "Computation Commences",
		body: [
			"Idle racks are assigned to the job automatically. Their CRT panels scroll green while they work.",
			"Track progress in the Jobs tab of the bottom panel.",
		],
		task: "Wait until the facility is delivering compute",
		target: ".ui-statbank",
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
		task: "Click a GPU cabinet on floor F1",
		focus: { x: 10, floor: 1 },
		done: (s, _b, ctx) => s.selection?.kind === "facility" && ctx.content.facilities[s.view.facilities.find((f) => f.id === s.selection?.id)?.defId ?? ""]?.kind === "rack",
	},
	{
		id: "heat",
		title: "Thermal Surveillance",
		body: [
			"Every watt a rack draws becomes heat, and heat rises to the floor above. The heat overlay shows air temperature: blue is cool, amber warm, red dangerous.",
			"The air handler can only cool cabinets within about eight tiles of it.",
		],
		task: "Switch on the heat overlay (H)",
		target: ".ui-overlay",
		done: (s) => s.overlay === "heat",
	},
	{
		id: "build-rack",
		title: "Requisition of Additional Capacity",
		body: [
			"Open the Racks tab in the left panel and choose the Mk.I Air-Cooled Compute Cabinet. Click an empty spot on F1 just right of the tape archive (where the blueprint turns blue).",
			"Equipment needs a floor, power cable underneath, and cooling nearby. Press Esc to put the tool away.",
		],
		task: "Build one more compute cabinet",
		target: ".ui-palette",
		focus: { x: 20, floor: 1 },
		onEnter: (store) => store.setOverlay("normal"),
		done: (s, b, ctx) => rackCount(s, ctx) > b.racks,
	},
	{
		id: "repairs",
		title: "Concerning Breakdowns",
		body: [
			"Hardware fails routinely: roughly one cabinet a day at this size. Each failure files a work order.",
			"The maintenance automaton fetches a spare part from the requisition cage, rides the lift and swaps the part. Keep spare parts stocked (bottom-left of the build panel), and buy a second automaton as you grow.",
		],
		target: ".ui-palette",
	},
	{
		id: "slab",
		title: "Vertical Expansion",
		body: [
			"Towers grow upward. In the Build tab, choose Floor slab and drag along the empty level above F1.",
			"A new floor must sit on an existing one, so start above F1's slab.",
		],
		task: "Build floor slab on F2",
		target: ".ui-palette",
		focus: { x: 20, floor: 2 },
		done: (s) => anyOnFloor(s, s.view.slab, 2),
	},
	{
		id: "conduit",
		title: "Extending the Mains",
		body: [
			"Choose Power conduit and drag along F2. Conduit that touches the conduit on the floor below joins the same power network automatically.",
			"Turn on the power overlay (P) to see which network each cable belongs to.",
		],
		task: "Lay power conduit on F2",
		target: ".ui-palette",
		focus: { x: 20, floor: 2 },
		done: (s) => anyOnFloor(s, s.view.power, 2),
	},
	{
		id: "finale",
		title: "Induction Complete",
		body: [
			"Your standing orders: reach Clearance 2 (120 PFLOPS installed, 95% uptime) to unlock liquid cooling.",
			"F2 still needs an air handler before you fill it with cabinets. Watch PUE, keep parts stocked, and file your contracts promptly.",
			"Press Esc (or MENU in the top bar) for saves, settings and controls. RESTART INDUCTION there reopens this memo.",
		],
		target: ".ui-tier",
	},
];
