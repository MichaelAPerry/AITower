import { loadContent } from "@aitower/content";
import { describe, expect, it } from "vitest";
import type { Sim } from "./api";
import { condHolds, lessonMetrics, lessonStars } from "./lesson/lesson";
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
const genset = (sim: Sim) => sim.submit({ type: "place", defId: "genset", floor: -1, x: 12 });

/** A scripted new player: rack, rack, genset, then wait out the day. */
function play(sim: Sim, opts: { genset?: boolean; wait?: number } = {}): void {
	run(sim, 3);
	expect(rack(sim, 11).ok).toBe(true);
	run(sim, 10);
	expect(rack(sim, 15).ok).toBe(true);
	run(sim, 40);
	if (opts.genset !== false) expect(genset(sim).ok).toBe(true);
	run(sim, opts.wait ?? 1700);
}

describe("lesson engine", () => {
	it("starts a quiet lesson: no offers, one feeder limit, nothing but the first rack buildable", () => {
		const sim = fresh();
		run(sim, 2);
		const v = sim.view();
		expect(v.lesson?.status).toBe("active");
		expect(v.offers).toHaveLength(0);
		expect(v.lesson?.allowed).toEqual([{ defId: "rack_air_gpu", max: 2 }]);
		expect(v.lesson?.capacityKw).toBe(120); // the 1.5 MW tie is limited by the utility to 120 kW
		expect(v.modifiers.map((m) => m.label)).toContain("Utility feeder limit 120 kW");
	});

	it("restricts the catalog to what the lesson needs, and the rest of the command set", () => {
		const sim = fresh();
		run(sim, 2);
		expect(genset(sim).ok).toBe(false);
		expect(sim.submit({ type: "place", defId: "crah_unit", floor: 1, x: 14 }).ok).toBe(false);
		expect(sim.submit({ type: "buildSlab", floor: 2, x0: 4, x1: 10 }).ok).toBe(false);
		expect(sim.submit({ type: "buyParts", count: 1 }).ok).toBe(false);
		expect(rack(sim, 11).ok).toBe(true);
		run(sim, 1);
		expect(rack(sim, 15).ok).toBe(true);
		run(sim, 1);
		// "max": a third rack is refused, and the generator only opens once the step is reached (here: it is, after rack 2).
		expect(rack(sim, 19).ok).toBe(false);
		expect(genset(sim).ok).toBe(true);
		expect(genset(sim).ok).toBe(false); // max 1
	});

	it("evaluates goal conditions on the values the sim tracks", () => {
		const sim = fresh() as SimImpl;
		run(sim, 2);
		const m = lessonMetrics(sim.state, content);
		expect(m.racks).toBe(0);
		expect(m.supplyKw).toBe(120);
		expect(condHolds({ metric: "headroomPct", op: ">", value: 10 }, m)).toBe(true);
		expect(condHolds({ metric: "racks", op: ">=", value: 1 }, m)).toBe(false);
		expect(condHolds({ metric: "shortKw", op: "<=", value: 0 }, m)).toBe(true);
	});

	it("scripts the designed failure: the second rack trips the feeder, one rack does not", () => {
		const sim = fresh();
		run(sim, 3);
		rack(sim, 11);
		run(sim, 30);
		expect(lesson(sim).beatsFired).toEqual(["job1"]);
		expect(lesson(sim).loadKw).toBeCloseTo(93, 0);
		expect(lesson(sim).headroomPct).toBeGreaterThan(20);
		expect(lesson(sim).stepsDone).toEqual(["rack1"]);
		rack(sim, 15);
		run(sim, 6);
		const l = lesson(sim);
		expect(l.beatsFired).toEqual(["job1", "job2", "trip"]);
		expect(l.capacityKw).toBe(0);
		expect(sim.view().facilities.filter((f) => f.defId === "rack_air_gpu").every((f) => f.status === "unpowered")).toBe(true);
		run(sim, 40); // the feeder comes back, but 133 kW still exceeds 120 kW
		expect(lesson(sim).capacityKw).toBe(120);
		expect(lesson(sim).headroomPct).toBeLessThan(0);
		expect(lesson(sim).stepsDone).toEqual(["rack1", "rack2"]);
	});

	it("is completable by a scripted player: win after one full day with headroom, with stars", () => {
		const sim = fresh();
		play(sim);
		const l = lesson(sim);
		expect(l.status).toBe("won");
		expect(l.stepsDone).toEqual(["rack1", "rack2", "genset", "day"]);
		expect(l.holdTicks).toBeGreaterThanOrEqual(l.holdGoal);
		expect(l.stars).toBeGreaterThanOrEqual(2);
		expect(l.endTick - l.startTick).toBeLessThan(2 * 1440);
		// Heat stays out of lesson 1: the racks never throttle.
		expect(sim.view().facilities.filter((f) => f.defId === "rack_air_gpu").every((f) => f.tempC < 80)).toBe(true);
		// A finished lesson stops restricting the site.
		expect(sim.view().lesson?.allowed).toEqual([]);
	});

	it("does not pass without the generator, and never wins on a brownout", () => {
		const sim = fresh();
		play(sim, { genset: false, wait: 2000 });
		expect(lesson(sim).status).toBe("active");
		expect(lesson(sim).holdTicks).toBe(0);
	});

	it("awards stars for headroom and uptime", () => {
		expect(lessonStars(def, { minHeadroom: 89, downTicks: 40 })).toBe(3);
		expect(lessonStars(def, { minHeadroom: 20, downTicks: 40 })).toBe(2);
		expect(lessonStars(def, { minHeadroom: 20, downTicks: 900 })).toBe(1);
	});

	it("round-trips through a snapshot mid-lesson and stays deterministic", () => {
		const a = fresh();
		run(a, 3);
		rack(a, 11);
		run(a, 20);
		const b = simFromSnapshot(content, a.snapshot());
		expect(b.hash()).toBe(a.hash());
		for (const s of [a, b]) {
			rack(s, 15);
			run(s, 60);
			genset(s);
			run(s, 200);
		}
		expect(b.hash()).toBe(a.hash());
		expect(lesson(b).stepsDone).toEqual(["rack1", "rack2", "genset"]);
	});

	it("leaves Free Build scenarios alone", () => {
		const sim = createSim(content, "starter", 1);
		expect(sim.view().lesson).toBeNull();
	});
});
