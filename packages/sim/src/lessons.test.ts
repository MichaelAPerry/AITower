/**
 * The lesson set (docs/DIALOGUE.md, "Lessons"): each lesson is played to its end through the real sim, doing exactly what its
 * checklist asks, in order. If a lesson can be won only by luck, or cannot be won, these fail.
 */
import { loadContent } from "@aitower/content";
import { describe, expect, it } from "vitest";
import type { Sim, SimCommand } from "./api";
import { createSim } from "./sim";

const content = loadContent();

const lessonOf = (sim: Sim) => {
	const l = sim.view().lesson;
	if (!l) throw new Error("no lesson");
	return l;
};
const run = (sim: Sim, n: number): void => {
	for (let i = 0; i < n; i++) sim.step();
};
/** Step until `done` holds (at most `max` ticks); fail loudly if it never does. */
function until(sim: Sim, what: string, done: () => boolean, max = 4000): void {
	for (let i = 0; i < max; i++) {
		if (done()) return;
		sim.step();
	}
	throw new Error(`never happened: ${what} (tick ${sim.view().tick}, steps done: ${lessonOf(sim).stepsDone.join(",")})`);
}
function ok(sim: Sim, cmd: SimCommand): void {
	const r = sim.submit(cmd);
	expect(r, JSON.stringify(cmd)).toEqual({ ok: true });
}
const stepNow = (sim: Sim): string => content.lessons.find((l) => l.id === lessonOf(sim).id)?.steps[lessonOf(sim).current]?.id ?? "(done)";
/** The player does the action the current step asks for, then waits for the step to count. */
function doStep(sim: Sim, id: string, act: () => void): void {
	expect(stepNow(sim), `expected to be on step ${id}`).toBe(id);
	act();
	until(sim, `step ${id} done`, () => lessonOf(sim).stepsDone.includes(id) || lessonOf(sim).status === "won");
}

describe("every lesson in the content is scripted below", () => {
	it("lists exactly these lessons, numbered 1 to n, each with its own scenario", () => {
		expect(content.lessons.map((l) => l.id)).toEqual(["first_watt", "earn_your_keep", "grow_the_tower", "the_three_trees", "lights_out"]);
		// Lesson 5 (Going Liquid) is not built yet, so the numbers skip it.
		content.lessons.forEach((l, i) => {
			expect(l.number).toBe(i < 4 ? i + 1 : 6);
			expect(content.scenarios[l.scenario]?.lesson).toBe(l.id);
		});
	});
});

describe("Lesson 1: your first rack", () => {
	it("is won by placing a rack, a grid intake and an air handler, then running three hours", () => {
		const sim = createSim(content, "lesson_first_watt", 7);
		run(sim, 3);
		expect(lessonOf(sim).status).toBe("active");
		// The catalog is locked to the step: the intake is refused before its step.
		expect(sim.submit({ type: "place", defId: "grid_tie", floor: -1, x: 6 }).ok).toBe(false);
		doStep(sim, "rack", () => ok(sim, { type: "place", defId: "rack_air_gpu", floor: 1, x: 11 }));
		// A rack with no power is dark: the checklist does not move.
		run(sim, 30);
		expect(lessonOf(sim).stepsDone).toEqual(["rack"]);
		expect(sim.view().facilities.find((f) => f.defId === "rack_air_gpu")?.jobId).toBeNull();
		doStep(sim, "power", () => ok(sim, { type: "place", defId: "grid_tie", floor: -1, x: 6 }));
		doStep(sim, "cool", () => ok(sim, { type: "place", defId: "crah_unit", floor: 1, x: 8 }));
		// The scripted job arrives once the rack is cooled, and the rack picks it up.
		doStep(sim, "run", () => undefined);
		expect(lessonOf(sim).beatsFired).toContain("job");
		until(sim, "the lesson is won", () => lessonOf(sim).status === "won", 600);
		expect(lessonOf(sim).stars).toBe(3);
	});
});

describe("Lesson 2: earn your keep", () => {
	it("is won by taking two contracts, adding storage, buying parts and a bot", () => {
		const sim = createSim(content, "lesson_earn", 7);
		run(sim, 3);
		expect(sim.view().offers.length).toBe(1);
		doStep(sim, "accept", () => ok(sim, { type: "acceptContract", contractId: sim.view().offers[0].id }));
		doStep(sim, "paid", () => undefined);
		expect(sim.view().cash).toBeGreaterThan(2_000_000 - 100_000);
		// The training contract arrives, and is refused until the data has a home.
		until(sim, "the training offer", () => sim.view().offers.length > 0);
		const training = sim.view().offers[0];
		expect(training.storageTB).toBe(1000);
		const refused = sim.submit({ type: "acceptContract", contractId: training.id });
		expect(refused.ok).toBe(false);
		doStep(sim, "storage", () => ok(sim, { type: "place", defId: "rack_storage", floor: 1, x: 14 }));
		doStep(sim, "train", () => ok(sim, { type: "acceptContract", contractId: training.id }));
		doStep(sim, "parts", () => ok(sim, { type: "buyParts", count: 5 }));
		doStep(sim, "bot", () => ok(sim, { type: "buyBot", defId: "rover" }));
		until(sim, "the lesson is won", () => lessonOf(sim).status === "won", 6000);
		expect(sim.view().stats.jobsCompleted).toBeGreaterThanOrEqual(2);
		// Both contracts paid, cash above the 2 million start, and the data always had room: three stars.
		expect(sim.view().cash).toBeGreaterThan(2_000_000);
		expect(lessonOf(sim).stars).toBe(3);
	});
});

describe("Lesson 3: grow the tower", () => {
	it("is won by researching two ideas, reaching Level 2 and switching on the Foreman", () => {
		const sim = createSim(content, "lesson_grow", 7);
		run(sim, 3);
		expect(sim.view().researchPoints).toBeGreaterThanOrEqual(1500);
		// Only the two ideas the lesson teaches can be bought.
		expect(sim.submit({ type: "research", techId: "batch_cards" }).ok).toBe(false);
		expect(sim.submit({ type: "setAutomation", policy: { ...sim.view().automation.policy, foreman: { ...sim.view().automation.policy.foreman, enabled: true } } }).ok).toBe(false);
		doStep(sim, "research1", () => ok(sim, { type: "research", techId: "contracts_clerk" }));
		doStep(sim, "research2", () => ok(sim, { type: "research", techId: "works_foreman" }));
		doStep(sim, "racks", () => {
			ok(sim, { type: "place", defId: "rack_air_gpu", floor: 1, x: 18 });
			ok(sim, { type: "place", defId: "rack_air_gpu", floor: 1, x: 20 });
		});
		doStep(sim, "level", () => undefined);
		expect(sim.view().tier).toBe(2);
		expect(stepNow(sim)).toBe("foreman");
		const policy = sim.view().automation.policy;
		ok(sim, { type: "setAutomation", policy: { ...policy, foreman: { ...policy.foreman, enabled: true } } });
		until(sim, "the lesson is won", () => lessonOf(sim).status === "won", 50);
		// Done inside two game days, with the Foreman on and cash above his $1M reserve all along: three stars.
		expect(lessonOf(sim).stars).toBe(3);
	});
});

describe("Lesson 4: the three trees", () => {
	it("is won by retrofitting a rack to Green, opening the Trees panel and placing PV panels", () => {
		const sim = createSim(content, "lesson_trees", 7);
		run(sim, 3);
		expect(sim.view().tier).toBe(2);
		const base = sim.view().facilities.find((f) => f.defId === "rack_air_gpu");
		if (!base) throw new Error("no base rack");
		doStep(sim, "retrofit", () => ok(sim, { type: "retrofit", facilityId: base.id, tree: "greentech" }));
		expect(sim.view().facilities.some((f) => f.defId === "rack_neuromorphic")).toBe(true);
		// Opening the panel is a UI act: the HUD marks the tip for the step while the panel is up.
		doStep(sim, "trees", () => ok(sim, { type: "markTip", tipId: "les:trees" }));
		doStep(sim, "clean", () => ok(sim, { type: "place", defId: "solar_skin", floor: 1, x: 40 }));
		until(sim, "the lesson is won", () => lessonOf(sim).status === "won", 6000);
		expect(sim.view().soul?.trees.greentech.sp).toBeGreaterThan(0);
		expect(lessonOf(sim).stars).toBe(3);
	});
});

describe("Lesson 6: lights out", () => {
	const play = (opts: { genset: boolean }) => {
		const sim = createSim(content, "lesson_lights_out", 7);
		run(sim, 3);
		doStep(sim, "battery", () => ok(sim, { type: "place", defId: "ups_battery", floor: -1, x: 12 }));
		if (opts.genset) doStep(sim, "genset", () => ok(sim, { type: "place", defId: "genset", floor: -1, x: 16 }));
		return sim;
	};
	it("is won by a battery bank and a genset: the grid trips, the racks stay lit, the grid returns", () => {
		const sim = play({ genset: true });
		doStep(sim, "watch", () => undefined);
		expect(lessonOf(sim).beatsFired).toContain("trip");
		until(sim, "the grid is down", () => sim.view().modifiers.some((m) => m.label === "Grid failure"), 50);
		until(sim, "the lesson is won", () => lessonOf(sim).status === "won", 1200);
		const l = lessonOf(sim);
		expect(l.downTicks).toBe(0);
		expect(l.star2).toBe(true);
		expect(l.star3).toBe(true);
		expect(l.stars).toBe(3);
	});
	it("is lost when the genset is switched off: the battery runs dry and the racks go dark", () => {
		const sim = play({ genset: true });
		const gen = sim.view().facilities.find((f) => f.defId === "genset");
		if (!gen) throw new Error("no genset");
		ok(sim, { type: "setEnabled", facilityId: gen.id, enabled: false });
		until(sim, "the grid trips", () => sim.view().modifiers.some((m) => m.label === "Grid failure"), 400);
		until(sim, "the lesson is lost", () => lessonOf(sim).status === "lost", 1200);
		expect(lessonOf(sim).stars).toBe(0);
	});
});

describe("Per-lesson stars", () => {
	it("lessons 1 to 4 and 6 are starred and say in words what each bonus star needs", () => {
		for (const l of content.lessons) {
			expect(l.starred, l.id).toBe(true);
			expect(l.stars2.length, l.id).toBeGreaterThan(0);
			expect(l.stars3.length, l.id).toBeGreaterThan(0);
			expect(l.star2Text.length, l.id).toBeGreaterThan(10);
			expect(l.star3Text.length, l.id).toBeGreaterThan(10);
		}
	});
});
