import { loadContent } from "@aitower/content";
import { describe, expect, it } from "vitest";
import type { Sim } from "./api";
import { condHolds, lessonMetrics } from "./lesson/lesson";
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

/** The UI marks `les:<step>` when the player does what a speed step asks (the sim cannot see the speed controls). */
const tip = (sim: Sim, step: string) => sim.submit({ type: "markTip", tipId: `les:${step}` });

/** A scripted new player: press Play, rack, grid intake, air handler, then pause, speed up and wait out the three hours. */
function play(sim: Sim, wait = 400): void {
	run(sim, 3);
	tip(sim, "clock");
	run(sim, 1);
	expect(rack(sim, 11).ok).toBe(true);
	run(sim, 10);
	expect(tie(sim).ok).toBe(true);
	run(sim, 10);
	expect(crah(sim).ok).toBe(true);
	run(sim, 100);
	tip(sim, "pause");
	run(sim, 1);
	tip(sim, "fast");
	run(sim, wait);
}

describe("lesson engine", () => {
	it("starts a quiet lesson with no offers", () => {
		const sim = fresh();
		run(sim, 2);
		const v = sim.view();
		expect(v.lesson?.status).toBe("active");
		expect(v.offers).toHaveLength(0);
		expect(v.modifiers.map((m) => m.label)).toContain("Lesson hall: nothing breaks today");
	});

	it("does not restrict the game: the whole catalog and command set are open", () => {
		const sim = fresh();
		run(sim, 2);
		expect(tie(sim).ok).toBe(true);
		expect(crah(sim).ok).toBe(true);
		expect(rack(sim, 11).ok).toBe(true);
		expect(rack(sim, 15).ok).toBe(true);
		expect(sim.submit({ type: "buildSlab", floor: 2, x0: 4, x1: 10 }).ok).toBe(true);
	});

	it("a step that waits for the player's speed choice is not done until the UI reports it", () => {
		const sim = fresh();
		run(sim, 3);
		expect(lesson(sim).stepsDone).toEqual([]);
		tip(sim, "clock");
		run(sim, 1);
		expect(lesson(sim).stepsDone).toEqual(["clock"]);
	});

	it("a step finished while the clock is stopped is ticked off without a tick", () => {
		const sim = fresh();
		run(sim, 3);
		tip(sim, "clock");
		run(sim, 1);
		rack(sim, 11);
		sim.flush();
		expect(lesson(sim).stepsDone).toEqual(["clock", "rack"]);
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
		expect(l.stepsDone).toEqual(["clock", "rack", "power", "cool", "run", "pause", "fast", "hold"]);
		expect(l.holdTicks).toBeGreaterThanOrEqual(l.holdGoal);
		expect(sim.view().facilities.filter((f) => f.defId === "rack_air_gpu").every((f) => f.tempC < 80)).toBe(true);
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

	it("round-trips through a snapshot mid-lesson and stays deterministic", () => {
		const a = fresh();
		run(a, 3);
		tip(a, "clock");
		run(a, 1);
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
		expect(lesson(b).stepsDone).toEqual(["clock", "rack", "power", "cool", "run"]);
	});

	it("leaves Free Build scenarios alone", () => {
		const sim = createSim(content, "starter", 1);
		expect(sim.view().lesson).toBeNull();
	});
});
