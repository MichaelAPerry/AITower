import type { ContentDB } from "@aitower/content";
import type { GameState } from "@aitower/shared";
import { describe, expect, it } from "vitest";
import { TUTORIAL_STEPS, baselineOf } from "./steps";

const content = { facilities: { rack_air_gpu: { kind: "rack" }, crah_unit: { kind: "crah" } } } as unknown as ContentDB;
const ctx = { content };

function state(p: { speed?: number; overlay?: string; racks?: number; jobs?: number[]; pflops?: number; slabF2?: boolean; powerF2?: boolean; select?: number | null }): GameState {
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
		view: { width, floorMin, floorMax: 2, slab, power, facilities, jobs: (p.jobs ?? []).map((id) => ({ id })), pflops: p.pflops ?? 0 },
	} as unknown as GameState;
}

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
});
