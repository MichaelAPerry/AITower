import type { ContentDB } from "@aitower/content";
import type { GameState } from "@aitower/shared";
import { describe, expect, it } from "vitest";
import { MEMO_EXPLAINER, needsMemoExplainer, stepClock, TUTORIAL_STEPS, type TutorialUi, baselineOf } from "./steps";

const content = { facilities: { rack_air_gpu: { kind: "rack" }, crah_unit: { kind: "crah" } } } as unknown as ContentDB;
const ctx = { content };

function state(p: { offers?: number; speed?: number; overlay?: string; racks?: number; jobs?: number[]; pflops?: number; slabF2?: boolean; powerF2?: boolean; select?: number | null }): GameState {
	const width = 4;
	const floorMin = -1;
	const floors = 4; // -1..2
	const slab = new Uint8Array(width * floors);
	const power = new Uint8Array(width * floors);
	if (p.slabF2) slab[(2 - floorMin) * width + 1] = 1;
	if (p.powerF2) power[(2 - floorMin) * width + 1] = 1;
	const facilities = [
		{ id: 100, defId: "crah_unit" },
		...Array.from({ length: p.racks ?? 4 }, (_, i) => ({ id: i + 1, defId: "rack_air_gpu" })),
	];
	return {
		speed: p.speed ?? 1,
		overlay: p.overlay ?? "normal",
		selection: p.select == null ? null : { kind: "facility", id: p.select },
		view: { offers: Array.from({ length: p.offers ?? 0 }, (_, i) => ({ id: i })), width, floorMin, floorMax: 2, slab, power, facilities, jobs: (p.jobs ?? []).map((id) => ({ id })), pflops: p.pflops ?? 0 },
	} as unknown as GameState;
}

const ui = (p: Partial<TutorialUi> = {}): TutorialUi => ({ paletteTab: "structure", bottomTab: "contracts", bottomOpen: true, tool: { kind: "select" }, ...p });

const step = (id: string) => {
	const s = TUTORIAL_STEPS.find((t) => t.id === id);
	if (!s?.done) throw new Error(`no task step ${id}`);
	return s;
};

describe("Ministry induction steps", () => {
	it("has unique ids and ends with an informational memo", () => {
		expect(new Set(TUTORIAL_STEPS.map((s) => s.id)).size).toBe(TUTORIAL_STEPS.length);
		expect(TUTORIAL_STEPS.at(-1)?.task).toBeUndefined();
	});

	it("speed step needs 3× or faster", () => {
		const s = step("clock");
		const b = baselineOf(state({}), ctx);
		expect(s.done?.(state({ speed: 1 }), b, ctx)).toBe(false);
		expect(s.done?.(state({ speed: 3 }), b, ctx)).toBe(true);
	});

	it("contract step only counts jobs accepted after the step began", () => {
		const s = step("contract");
		const b = baselineOf(state({ jobs: [0, 1] }), ctx);
		expect(s.done?.(state({ jobs: [0, 1] }), b, ctx)).toBe(false);
		expect(s.done?.(state({ jobs: [0, 1, 2] }), b, ctx)).toBe(true);
	});

	it("inspect step needs a rack selected, not other machines", () => {
		const s = step("inspect");
		const b = baselineOf(state({}), ctx);
		expect(s.done?.(state({ select: 100 }), b, ctx)).toBe(false);
		expect(s.done?.(state({ select: 2 }), b, ctx)).toBe(true);
	});

	it("build-rack step compares rack count to the baseline", () => {
		const s = step("build-rack");
		const b = baselineOf(state({ racks: 4 }), ctx);
		expect(s.done?.(state({ racks: 4 }), b, ctx)).toBe(false);
		expect(s.done?.(state({ racks: 5 }), b, ctx)).toBe(true);
	});

	it("expansion steps look at floor F2", () => {
		const b = baselineOf(state({}), ctx);
		expect(step("slab").done?.(state({}), b, ctx)).toBe(false);
		expect(step("slab").done?.(state({ slabF2: true }), b, ctx)).toBe(true);
		expect(step("conduit").done?.(state({ slabF2: true }), b, ctx)).toBe(false);
		expect(step("conduit").done?.(state({ powerF2: true }), b, ctx)).toBe(true);
	});

	it("heat and compute steps", () => {
		const b = baselineOf(state({}), ctx);
		expect(step("heat").done?.(state({ overlay: "heat" }), b, ctx)).toBe(true);
		expect(step("compute").done?.(state({ pflops: 20 }), b, ctx)).toBe(true);
		expect(step("compute").done?.(state({ pflops: 0 }), b, ctx)).toBe(false);
	});

	it("every task step says what to click; every step has a clock policy", () => {
		for (const t of TUTORIAL_STEPS) {
			expect(t.clock, t.id).toBeDefined();
			if (t.task) expect(t.task.length, t.id).toBeGreaterThan(20);
		}
	});

	it("steps pause the clock unless they need time to pass (owner feedback: the game kept running)", () => {
		const idle = state({ offers: 1 });
		const running = TUTORIAL_STEPS.filter((t) => stepClock(t, state({})) === "run").map((t) => t.id);
		expect(running).toEqual(["contract", "compute"]);
		// hands-on steps never run the clock
		for (const id of ["clock", "inspect", "heat", "build-rack", "slab", "conduit"]) expect(stepClock(TUTORIAL_STEPS.find((t) => t.id === id)!, idle)).toBe("pause");
		// the first two memos are read with the clock stopped
		expect(stepClock(TUTORIAL_STEPS[0], idle)).toBe("pause");
		expect(stepClock(MEMO_EXPLAINER, idle)).toBe("pause");
	});

	it("contract step runs the clock only while the board is empty, and pauses once an offer is posted", () => {
		const s = TUTORIAL_STEPS.find((t) => t.id === "contract");
		expect(s && stepClock(s, state({ offers: 0 }))).toBe("run");
		expect(s && stepClock(s, state({ offers: 2 }))).toBe("pause");
		expect(s?.runReason).toBeTruthy();
	});

	it("the contract step points at the tab, then the exact ACCEPT stamp", () => {
		const s = TUTORIAL_STEPS.find((t) => t.id === "contract");
		expect(s?.targets?.(state({ offers: 1 }), ui({ bottomTab: "jobs" }))).toEqual(['[data-tut="btab-contracts"]']);
		expect(s?.targets?.(state({ offers: 1 }), ui({ bottomOpen: false }))).toEqual(['[data-tut="btab-contracts"]']);
		expect(s?.targets?.(state({ offers: 1 }), ui())).toEqual(['[data-tut="accept"]']);
		expect(s?.phase?.(state({}), ui({ bottomTab: "jobs" }))).toBe(0);
		expect(s?.phase?.(state({}), ui())).toBe(1);
	});

	it("build-rack walks tab, then card, then the world; the ghost marks the spot only once the tool is armed", () => {
		const s = TUTORIAL_STEPS.find((t) => t.id === "build-rack");
		const st = state({});
		expect(s?.targets?.(st, ui({ paletteTab: "structure" }))).toEqual(['[data-tut="tab-rack"]']);
		expect(s?.targets?.(st, ui({ paletteTab: "rack" }))).toEqual(['[data-tut="card-rack_air_gpu"]']);
		const armed = ui({ paletteTab: "rack", tool: { kind: "place", defId: "rack_air_gpu" } });
		expect(s?.targets?.(st, armed)).toEqual([]);
		expect(s?.phase?.(st, ui({ paletteTab: "structure" }))).toBe(0);
		expect(s?.phase?.(st, ui({ paletteTab: "rack" }))).toBe(1);
		expect(s?.phase?.(st, armed)).toBe(2);
		expect(s?.ghost?.(st, ui({ paletteTab: "rack" }))).toBeNull();
		expect(s?.ghost?.(st, armed)).toMatchObject({ valid: true, defId: "rack_air_gpu", cells: [{ x: 18, floor: 1 }, { x: 19, floor: 1 }] });
		expect(s?.task).toContain("just right of the tape archive");
		expect(s?.how?.[0]).toContain("RACKS tab");
	});

	it("slab and conduit steps highlight the matching palette card and mark F2", () => {
		const slab = TUTORIAL_STEPS.find((t) => t.id === "slab");
		const conduit = TUTORIAL_STEPS.find((t) => t.id === "conduit");
		expect(slab?.targets?.(state({}), ui({ paletteTab: "rack" }))).toEqual(['[data-tut="tab-structure"]']);
		expect(slab?.targets?.(state({}), ui())).toEqual(['[data-tut="card-slab"]']);
		expect(slab?.ghost?.(state({}), ui({ tool: { kind: "slab" } }))?.cells.every((c) => c.floor === 2)).toBe(true);
		expect(conduit?.targets?.(state({}), ui())).toEqual(['[data-tut="card-bolt-power"]']);
		expect(conduit?.ghost?.(state({}), ui({ tool: { kind: "conduit", layer: "coolant" } }))).toBeNull();
		expect(conduit?.ghost?.(state({}), ui({ tool: { kind: "conduit", layer: "power" } }))).not.toBeNull();
	});

	it("the memo explainer interrupts only once, only while the induction is live and a memo is open", () => {
		expect(needsMemoExplainer(false, false, 1)).toBe(true);
		expect(needsMemoExplainer(true, false, 1)).toBe(false);
		expect(needsMemoExplainer(false, true, 1)).toBe(false);
		expect(needsMemoExplainer(false, false, 0)).toBe(false);
	});
});
