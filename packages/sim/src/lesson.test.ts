import { loadContent } from "@aitower/content";
import { describe, expect, it } from "vitest";
import type { Sim } from "./api";
import { condHolds, lessonMetrics, lessonStars } from "./lesson/lesson";
import type { LessonMetrics } from "./lesson/lesson";
import { type SimImpl, createSim, simFromSnapshot } from "./sim";

const content = loadContent();
const def = content.lessons[0];
const fresh = (): Sim => createSim(content, "lesson_first_watt", 7);
const run = (sim: Sim, n: number): void => {
	for (let i = 0; i < n; i++) sim.step();
};
const lesson = (sim: Sim) => {
	const l = sim.view().lesson;
	if (!l) throw new Error("no lesson");
	return l;
};
const rack = (sim: Sim, x: number) => sim.submit({ type: "place", defId: "rack_air_gpu", floor: 1, x });
const tie = (sim: Sim) => sim.submit({ type: "place", defId: "grid_tie", floor: -1, x: 6 });
const crah = (sim: Sim) => sim.submit({ type: "place", defId: "crah_unit", floor: 1, x: 8 });

/** A scripted new player: rack, grid intake, air handler, then wait out the three hours. */
function play(sim: Sim, wait = 400): void {
	run(sim, 3);
	expect(rack(sim, 11).ok).toBe(true);
	run(sim, 10);
	expect(tie(sim).ok).toBe(true);
	run(sim, 10);
	expect(crah(sim).ok).toBe(true);
	run(sim, wait);
}

describe("lesson engine", () => {
	it("starts a quiet lesson: no offers, nothing but the first rack buildable", () => {
		const sim = fresh();
		run(sim, 2);
		const v = sim.view();
		expect(v.lesson?.status).toBe("active");
		expect(v.offers).toHaveLength(0);
		expect(v.lesson?.allowed).toEqual([{ defId: "rack_air_gpu", max: 1 }]);
		expect(v.modifiers.map((m) => m.label)).toContain("Lesson hall: nothing breaks today");
	});

	it("restricts the catalog to what the step needs, and the rest of the command set", () => {
		const sim = fresh();
		run(sim, 2);
		expect(tie(sim).ok).toBe(false);
		expect(crah(sim).ok).toBe(false);
		expect(sim.submit({ type: "buildSlab", floor: 2, x0: 4, x1: 10 }).ok).toBe(false);
		expect(sim.submit({ type: "buyParts", count: 1 }).ok).toBe(false);
		expect(sim.submit({ type: "research", techId: "batch_cards" }).ok).toBe(false);
		expect(rack(sim, 11).ok).toBe(true);
		run(sim, 1);
		// max 1: a second rack is refused, and the intake opens once the first step is done.
		expect(rack(sim, 15).ok).toBe(false);
		expect(tie(sim).ok).toBe(true);
		expect(tie(sim).ok).toBe(false);
	});

	it("evaluates goal conditions on the values the sim tracks", () => {
		const sim = fresh() as SimImpl;
		run(sim, 2);
		const m = lessonMetrics(sim.state, content);
		expect(m.racks).toBe(0);
		expect(m.supplyKw).toBe(0);
		expect(condHolds({ metric: "headroomPct", op: "<", value: 0 }, m)).toBe(true);
		expect(condHolds({ metric: "racks", op: ">=", value: 1 }, m)).toBe(false);
		expect(condHolds({ metric: "racksDark", op: "<=", value: 0 }, m)).toBe(true);
	});

	it("is completable by a scripted player: win after three hours running", () => {
		const sim = fresh();
		play(sim);
		const l = lesson(sim);
		expect(l.status).toBe("won");
		expect(l.stepsDone).toEqual(["rack", "power", "cool", "run", "hold"]);
		expect(l.holdTicks).toBeGreaterThanOrEqual(l.holdGoal);
		expect(l.stars).toBe(3);
		expect(l.star2 && l.star3).toBe(true);
		expect(sim.view().facilities.filter((f) => f.defId === "rack_air_gpu").every((f) => f.tempC < 80)).toBe(true);
		// A finished lesson stops restricting the site.
		expect(sim.view().lesson?.allowed).toEqual([]);
	});

	it("nothing breaks in the lesson hall: every seed finishes", () => {
		for (let seed = 1; seed <= 12; seed++) {
			const sim = createSim(content, "lesson_first_watt", seed);
			play(sim, 600);
			expect(lesson(sim).status, `seed ${seed}`).toBe("won");
		}
	}, 30_000);

	it("does not pass without the air handler", () => {
		const sim = fresh();
		run(sim, 3);
		rack(sim, 11);
		run(sim, 10);
		tie(sim);
		run(sim, 1500);
		expect(lesson(sim).status).toBe("active");
		expect(lesson(sim).stepsDone).not.toContain("cool");
	});

	it("awards one star for passing and one for each star rule that holds", () => {
		const d = { ...def, stars2: [{ metric: "minHeadroom" as const, op: ">=" as const, value: 50 }], stars3: [{ metric: "downTicks" as const, op: "<=" as const, value: 100 }] };
		const m = (minHeadroom: number, downTicks: number) => ({ minHeadroom, downTicks }) as LessonMetrics;
		expect(lessonStars(d, m(89, 40))).toBe(3);
		expect(lessonStars(d, m(20, 40))).toBe(2);
		expect(lessonStars(d, m(89, 900))).toBe(2);
		expect(lessonStars(d, m(20, 900))).toBe(1);
	});

	it("round-trips through a snapshot mid-lesson and stays deterministic", () => {
		const a = fresh();
		run(a, 3);
		rack(a, 11);
		run(a, 20);
		const b = simFromSnapshot(content, a.snapshot());
		expect(b.hash()).toBe(a.hash());
		for (const s of [a, b]) {
			tie(s);
			run(s, 20);
			crah(s);
			run(s, 100);
		}
		expect(b.hash()).toBe(a.hash());
		expect(lesson(b).stepsDone).toEqual(["rack", "power", "cool", "run"]);
	});

	it("leaves Free Build scenarios alone", () => {
		const sim = createSim(content, "starter", 1);
		expect(sim.view().lesson).toBeNull();
	});
});
