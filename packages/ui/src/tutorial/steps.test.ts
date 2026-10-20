import type { ContentDB } from "@aitower/content";
import type { GameState } from "@aitower/shared";
import { describe, expect, it } from "vitest";
import { activeHint, buildPhase, HINTS, TUTORIAL_STEPS, type TutorialUi, baselineOf } from "./steps";

const content = { facilities: { rack_air_gpu: { kind: "rack" }, crah_unit: { kind: "crah" } } } as unknown as ContentDB;
const ctx = { content };

function state(p: { offers?: number; speed?: number; overlay?: string; racks?: number; jobs?: number[]; pflops?: number; slabF2?: boolean; powerF2?: boolean; select?: number | null; ledger?: { revenue: number; costs: number }; status?: string; memos?: number }): GameState {
	const width = 4;
	const floorMin = -1;
	const floors = 4; // -1..2
	const slab = new Uint8Array(width * floors);
	const power = new Uint8Array(width * floors);
	if (p.slabF2) slab[(2 - floorMin) * width + 1] = 1;
	if (p.powerF2) power[(2 - floorMin) * width + 1] = 1;
	const facilities = [
		{ id: 100, defId: "crah_unit" },
		...Array.from({ length: p.racks ?? 4 }, (_, i) => ({ id: i + 1, defId: "rack_air_gpu", enabled: true, status: p.status ?? "ok", x: 12, floor: 1 })),
	];
	return {
		speed: p.speed ?? 1,
		overlay: p.overlay ?? "normal",
		selection: p.select == null ? null : { kind: "facility", id: p.select },
		view: { offers: Array.from({ length: p.offers ?? 0 }, (_, i) => ({ id: i })), width, floorMin, floorMax: 2, slab, power, facilities, jobs: (p.jobs ?? []).map((id) => ({ id })), pflops: p.pflops ?? 0, memos: Array.from({ length: p.memos ?? 0 }, (_, i) => ({ id: i })), tick: 600, day: 0, ledger: p.ledger ? [{ day: 0, revenue: p.ledger.revenue, energy: p.ledger.costs, upkeep: 0, penalties: 0 }] : [] },
	} as unknown as GameState;
}

const ui = (p: Partial<TutorialUi> = {}): TutorialUi => ({ paletteTab: "structure", drawer: null, paletteOpen: false, tool: { kind: "select" }, ...p });

const step = (id: string) => {
	const s = TUTORIAL_STEPS.find((t) => t.id === id);
	if (!s) throw new Error(`no step ${id}`);
	return s;
};

describe("coach-mark steps", () => {
	it("are five doing-steps with unique ids, ending on the Goals card", () => {
		expect(TUTORIAL_STEPS.map((s) => s.id)).toEqual(["accept", "play", "income", "build", "goals"]);
		expect(TUTORIAL_STEPS.at(-1)?.done).toBeUndefined();
		for (const s of TUTORIAL_STEPS) {
			for (const u of [ui(), ui({ drawer: "contracts" }), ui({ paletteOpen: true, paletteTab: "rack" })]) {
				const text = s.text(state({ offers: 1 }), u);
				expect(text.split(/\s+/).length, s.id).toBeLessThanOrEqual(16);
			}
		}
	});

	it("only the build step stops the clock; the others leave it to the player", () => {
		expect(TUTORIAL_STEPS.filter((s) => s.clock === "pause").map((s) => s.id)).toEqual(["build"]);
	});

	it("accept points at the tab, then Take job, and counts only new jobs", () => {
		const s = step("accept");
		expect(s.targets(state({ offers: 1 }), ui())).toEqual(['[data-tut="dtab-contracts"]']);
		expect(s.targets(state({ offers: 1 }), ui({ drawer: "contracts" }))).toEqual(['[data-tut="take"]']);
		const b = baselineOf(state({ jobs: [0, 1] }), ctx);
		expect(s.done?.(state({ jobs: [0, 1] }), b, ctx)).toBe(false);
		expect(s.done?.(state({ jobs: [0, 1, 2] }), b, ctx)).toBe(true);
	});

	it("play is done once the clock runs; income once PER HOUR is positive", () => {
		const b = baselineOf(state({}), ctx);
		expect(step("play").done?.(state({ speed: 0 }), b, ctx)).toBe(false);
		expect(step("play").done?.(state({ speed: 1 }), b, ctx)).toBe(true);
		expect(step("income").done?.(state({ speed: 1, ledger: { revenue: 10_000, costs: 30_000 } }), b, ctx)).toBe(false);
		expect(step("income").done?.(state({ speed: 1, ledger: { revenue: 40_000, costs: 30_000 } }), b, ctx)).toBe(true);
		// stopped: it points at play again
		expect(step("income").targets(state({ speed: 0 }), ui())).toEqual(['[data-tut="speed-1"]']);
	});

	it("build is two clicks then the blueprint; the ghost shows only once the tool is armed", () => {
		const s = step("build");
		const st = state({});
		const armed = ui({ paletteOpen: true, paletteTab: "rack", tool: { kind: "place", defId: "rack_air_gpu" } });
		expect(s.targets(st, ui())).toEqual(['[data-tut="cat-rack"]']);
		expect(s.targets(st, ui({ paletteOpen: true, paletteTab: "structure" }))).toEqual(['[data-tut="cat-rack"]']);
		expect(s.targets(st, ui({ paletteOpen: true, paletteTab: "rack" }))).toEqual(['[data-tut="card-rack_air_gpu"]']);
		expect(s.targets(st, armed)).toEqual([]);
		expect([ui(), ui({ paletteOpen: true, paletteTab: "rack" }), armed].map(buildPhase)).toEqual([0, 1, 2]);
		expect(s.ghost?.(st, ui({ paletteTab: "rack" }))).toBeNull();
		expect(s.ghost?.(st, armed)).toMatchObject({ valid: true, defId: "rack_air_gpu" });
		const b = baselineOf(state({ racks: 4 }), ctx);
		expect(s.done?.(state({ racks: 4 }), b, ctx)).toBe(false);
		expect(s.done?.(state({ racks: 5 }), b, ctx)).toBe(true);
	});
});

describe("just-in-time hints", () => {
	it("point at a hot rack once, and at the inbox once, then never again", () => {
		expect(activeHint(state({ status: "throttled" }), {}, ctx)).toBe("heat");
		expect(activeHint(state({ status: "throttled" }), { heat: true }, ctx)).toBeNull();
		expect(activeHint(state({ memos: 1 }), {}, ctx)).toBe("memo");
		expect(activeHint(state({ memos: 1 }), { memo: true }, ctx)).toBeNull();
		expect(activeHint(state({}), {}, ctx)).toBeNull();
		expect(HINTS.heat.text).toBe("Too hot: add an air handler nearby.");
	});
});
