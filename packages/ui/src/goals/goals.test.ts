import type { ContentDB } from "@aitower/content";
import type { SimView } from "@aitower/sim";
import { describe, expect, it } from "vitest";
import { goalLadder, newlyDone, VISIBLE_GOALS, visibleGoals } from "./goals";

const content = {
	facilities: { rack_air_gpu: { rack: { pflops: 20 } } },
	balance: { tiers: { pflops: [0, 120, 400, 900], uptime: [0, 0.95, 0.97, 0.98], reward: [0, 1, 2, 3] } },
} as unknown as ContentDB;

const racks = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i, defId: "rack_air_gpu", enabled: true, status: "ok" }));
const view = (p: Partial<Record<keyof SimView, unknown>> = {}): SimView =>
	({ tier: 1, jobs: [], facilities: racks(4), techResearched: [], stats: { revenue: 0, jobsCompleted: 0 }, ...p }) as unknown as SimView;
const ids = (v: SimView) =>
	visibleGoals(goalLadder(v, content), new Set())
		.map((g) => g.id);

describe("goal ladder", () => {
	it("starts with the first contract, then the first $50k, then more compute", () => {
		expect(ids(view())).toEqual(["contract", "earn-first", "more-compute"]);
	});

	it("shows at most three goals and moves on as goals are done", () => {
		expect(ids(view()).length).toBeLessThanOrEqual(VISIBLE_GOALS);
		const running = view({ jobs: [{ status: "running" }] });
		expect(ids(running)).toEqual(["earn-first", "more-compute", "research"]);
		expect(ids(view({ jobs: [{ status: "running" }], stats: { revenue: 60_000, jobsCompleted: 1 }, facilities: racks(5) }))).toEqual(["research", "level-2", "earn-big"]);
	});

	it("reports progress in plain words", () => {
		const g = goalLadder(view({ stats: { revenue: 12_000, jobsCompleted: 0 } }), content);
		expect(g.find((x) => x.id === "earn-first")?.progress).toBe("$12k / $50k");
		expect(g.find((x) => x.id === "level-2")?.progress).toBe("80 / 120 PF compute");
		expect(g.find((x) => x.id === "contract")?.done).toBe(false);
	});

	it("climbs one Level at a time and finishes at the top tier", () => {
		const top = view({ tier: 4, jobs: [{ status: "running" }], techResearched: ["a"], stats: { revenue: 9e6, jobsCompleted: 5 }, facilities: racks(50) });
		expect(ids(top)).toEqual([]);
		expect(ids(view({ tier: 2, jobs: [{ status: "running" }], techResearched: ["a"], stats: { revenue: 9e6, jobsCompleted: 5 }, facilities: racks(7) }))).toEqual(["level-3", "level-4"]);
	});

	it("a latched goal stays hidden, and a goal that just became done is reported once", () => {
		const ladder = goalLadder(view({ jobs: [{ status: "running" }] }), content);
		expect(newlyDone(ladder, new Set()).map((g) => g.id)).toEqual(["contract"]);
		expect(newlyDone(ladder, new Set(["contract"]))).toEqual([]);
		expect(visibleGoals(ladder, new Set(["earn-first"])).map((g) => g.id)).toEqual(["more-compute", "research", "level-2"]);
	});
});
