import { loadContent } from "@aitower/content";
import type { LessonView } from "@aitower/sim";
import { describe, expect, it } from "vitest";
import { parseMarkup } from "../advisors/advisors";
import { buildChapters } from "../handbook/chapters";
import { buildEntries } from "../encyclopedia/entries";
import { termById } from "../glossary/terms";
import { articleTitle, baselineAck, goalModel, lessonTotal, lessonsInOrder, nextLessonOf, pendingMessage, resultModel, slotGhost, stepPulse, waitMet } from "./lessons";

const content = loadContent();
const def = content.lessons[0];
const lv = (p: Partial<LessonView> = {}): LessonView => ({ id: def.id, status: "active", stepsDone: [], current: 0, beatsFired: [], holdTicks: 0, holdGoal: 1440, minHeadroom: 100, downTicks: 0, pue: 1.2, loadKw: 53, capacityKw: 120, headroomPct: 55, startTick: 0, endTick: -1, ...p });

describe("teacher lines", () => {
	it("walks the intro, then waits for the player", () => {
		let ack = {};
		const first = pendingMessage(def, lv(), ack);
		expect(first?.kind).toBe("say");
		expect(first?.n).toBe(1);
		expect(first?.advisor).toBe("bea");
		ack = { "clock:say": def.steps[0].say.length };
		expect(pendingMessage(def, lv(), ack)).toBeNull();
	});
	it("speaks the after-lines of a finished step before the next step", () => {
		const done = { "clock:say": 9, "rack:say": 9, "power:say": 9 };
		const m = pendingMessage(def, lv({ stepsDone: ["clock", "rack", "power"], current: 3 }), done);
		expect(m?.kind).toBe("after");
		expect(m?.stepId).toBe("power");
	});
	it("a step can hand the talking to another advisor", () => {
		const done = { "clock:say": 9, "rack:say": 9, "rack:after": 9, "power:say": 9, "power:after": 9 };
		const m = pendingMessage(def, lv({ stepsDone: ["clock", "rack", "power"], current: 3 }), done);
		expect(m?.stepId).toBe("cool");
		expect(m?.advisor).toBe("cass");
	});
	it("holds the next step back until its scripted moment has landed", () => {
		const earn = content.lessons[1];
		const done = { "accept:say": 9, "accept:after": 9 };
		expect(pendingMessage(earn, lv({ id: earn.id, stepsDone: ["accept"], current: 1 }), done)?.stepId).toBe("paid");
	});
	it("a game loaded mid-lesson does not replay what the player already passed", () => {
		const ack = baselineAck(def, lv({ stepsDone: ["clock", "rack", "power"], current: 3 }));
		const m = pendingMessage(def, lv({ stepsDone: ["clock", "rack", "power"], current: 3, beatsFired: [] }), ack);
		expect(m?.stepId).toBe("cool");
	});
});

describe("goal bar and catalog", () => {
	it("reads load against capacity and the success hold", () => {
		expect(goalModel(lv()).tone).toBe("ok");
		expect(goalModel(lv({ loadKw: 133, capacityKw: 120, headroomPct: -10 })).tone).toBe("bad");
		expect(goalModel(lv({ headroomPct: 4 })).tone).toBe("warn");
		expect(goalModel(lv({ holdTicks: 90, holdGoal: 180 })).hold).toBe(0.5);
	});
	it("highlights the current step's slot", () => {
		const g = slotGhost(def, lv(), content);
		expect(slotGhost(def, lv({ current: 0 }), content)).toBeNull();
		expect(slotGhost(def, lv({ current: 1 }), content)?.cells).toEqual([{ x: 11, floor: 1 }, { x: 12, floor: 1 }]);
		expect(g).toBeNull();
	});
});

describe("the lesson list", () => {
	it("lists exactly the lessons that exist, in order, with a next lesson for all but the last", () => {
		const list = lessonsInOrder(content);
		expect(list.map((l) => l.number)).toEqual([1, 2, 3, 4, 5, 6]);
		expect(nextLessonOf(content, list[0])?.id).toBe(list[1].id);
		// Numbered 1 to 6 with no gap: 4 leads to 5, 5 leads to 6.
		expect(nextLessonOf(content, list[3])?.number).toBe(5);
		expect(nextLessonOf(content, list[4])?.number).toBe(6);
		expect(nextLessonOf(content, list[5])).toBeUndefined();
	});
});

describe("lesson 5 pipe step", () => {
	const liquid = content.lessons.find((l) => l.id === "liquid");
	it("marks the pipe run on the floor and shows the Structure tab with the coolant pipe", () => {
		if (!liquid) throw new Error("no liquid lesson");
		const g = slotGhost(liquid, lv({ id: "liquid", current: 0 }), content);
		expect(g?.cells.length).toBe(liquid.steps[0].slot?.width);
	});
});

describe("lesson count", () => {
	it("totals by the highest lesson number, so a gap does not read LESSON 6 OF 5", () => {
		expect(lessonTotal(content)).toBe(6);
	});
});

describe("result", () => {
	it("passes the lesson with the Handbook links ", () => {
		const r = resultModel(def, lv({ status: "won", startTick: 0, endTick: 2000 }), true);
		expect(r.won).toBe(true);
		expect(r.rows).toEqual([
			{ label: "Passed", value: def.passed ?? def.goal, earned: true },
		]);
		expect(r.bonus).toBe(def.bonus);
		expect(resultModel(def, lv({ status: "won" }), false).bonus).toBe(0);
		expect(r.handbook.map((h) => h.id)).toContain("ch:power");
		expect(articleTitle(content, "ch:power")).toBe("Power");
		expect(articleTitle(content, "ch:power#kw")).toBe("kW");
	});
});

describe("lesson text links into the Handbook", () => {
	const lines = (): string[] => content.lessons.flatMap((l) => [l.goal, l.learned, l.outro, ...l.steps.flatMap((s) => [s.text, ...s.say, ...(s.after ?? [])])]);
	it("every {{term}} in a lesson is a glossary word", () => {
		for (const line of lines()) for (const g of parseMarkup(line)) if ("term" in g) expect(termById(g.term), g.term).toBeDefined();
	});
	it("every Handbook link on a lesson opens an article that exists", () => {
		const chapters = new Set(buildChapters(content).map((c) => c.id));
		const entries = new Set(buildEntries(content).map((e) => e.id));
		for (const l of content.lessons) {
			const ids = [...l.handbook, ...l.steps.flatMap((s) => (s.handbook ? [s.handbook] : []))];
			for (const id of ids) {
				const [page, word] = id.split("#");
				expect(chapters.has(page) || entries.has(page), id).toBe(true);
				if (word) expect(termById(word), id).toBeDefined();
			}
		}
	});
});

describe("the full game UI in lessons", () => {
	it("a lesson no longer carries a restricted catalog, drawer list or command list", () => {
		for (const l of content.lessons) {
			const raw = l as unknown as Record<string, unknown>;
			expect(raw.commands, l.id).toBeUndefined();
			expect(raw.research, l.id).toBeUndefined();
			expect(raw.speed, l.id).toBeUndefined();
			for (const st of l.steps) for (const k of ["allow", "drawers", "supplies", "pause", "focus"]) expect((st as unknown as Record<string, unknown>)[k], `${l.id}.${st.id}.${k}`).toBeUndefined();
		}
	});
	it("only Lesson 1 starts with the clock stopped", () => {
		expect(content.lessons.filter((l) => !l.startRunning).map((l) => l.id)).toEqual(["first_watt"]);
	});
});

describe("speed steps wait for the player", () => {
	it("each wait is met only by the matching speed or overlay", () => {
		const idle = { trees: false, speed: 0, overlay: "normal" };
		expect(waitMet({ wait: "play" }, idle)).toBe(false);
		expect(waitMet({ wait: "play" }, { ...idle, speed: 1 })).toBe(true);
		expect(waitMet({ wait: "pause" }, idle)).toBe(true);
		expect(waitMet({ wait: "pause" }, { ...idle, speed: 3 })).toBe(false);
		expect(waitMet({ wait: "fast" }, { ...idle, speed: 1 })).toBe(false);
		expect(waitMet({ wait: "fast" }, { ...idle, speed: 3 })).toBe(true);
		expect(waitMet({ wait: "heat" }, { ...idle, overlay: "heat" })).toBe(true);
		expect(waitMet({ wait: "power" }, { ...idle, overlay: "heat" })).toBe(false);
		expect(waitMet({ panel: "trees" }, { ...idle, trees: true })).toBe(true);
		expect(waitMet(undefined, idle)).toBe(false);
	});
	it("Lesson 1 asks for Play, Pause and a faster speed, each with its real speed button pulsed", () => {
		const waits = def.steps.filter((s) => s.wait).map((s) => [s.id, s.wait, s.pulse]);
		expect(waits).toEqual([
			["clock", "play", ['[data-tut="speed-1"]']],
			["pause", "pause", ['[data-tut="speed-0"]']],
			["fast", "fast", ['[data-tut="speed-3"]']],
		]);
	});
	it("a step that waits has a matching tip condition, and the wait never changes the speed itself", () => {
		for (const l of content.lessons)
			for (const st of l.steps) if (st.wait || st.panel) expect(st.when.some((c) => c.metric === "tips"), `${l.id}.${st.id}`).toBe(true);
	});
});

describe("highlight targets", () => {
	it("every step pulses something real: a stable data-tut, a build category or a card", () => {
		const known = new Set(["speed-0", "speed-1", "speed-3", "speed-10", "dtab-contracts", "dtab-research", "dtab-automation", "dtab-insights", "take", "perhour", "clearance", "retrofit", "trees", "cat-supplies", "overlay-heat", "overlay-power"]);
		for (const l of content.lessons)
			for (const st of l.steps)
				for (const sel of st.pulse ?? []) {
					const m = /^\[data-tut="([^"]+)"\]$/.exec(sel);
					expect(m, `${l.id}.${st.id}: ${sel}`).not.toBeNull();
					expect(known.has((m as RegExpExecArray)[1]), `${l.id}.${st.id}: ${sel}`).toBe(true);
				}
	});
	it("a placement step pulses its build category, then its card", () => {
		const sl = def.steps[1];
		const none = { paletteOpen: false, paletteTab: "rack" };
		expect(stepPulse(def, lv({ current: 1 }), content, none)).toEqual(['[data-tut="cat-rack"]']);
		expect(stepPulse(def, lv({ current: 1 }), content, { paletteOpen: true, paletteTab: "rack" })).toEqual([`[data-tut="card-${sl.slot?.defId}"]`]);
	});
	it("the rack to click is marked in the world", () => {
		const trees = content.lessons.find((l) => l.id === "the_three_trees");
		if (!trees) throw new Error("no trees lesson");
		expect(slotGhost(trees, lv({ id: trees.id, current: 0 }), content)?.label).toBe("CLICK THIS RACK");
	});
});

describe("lessons keep the plot out", () => {
	it("no lesson line names the seal, closed trees, bonds, epilogues or endings", () => {
		const lines = content.lessons.flatMap((l) => [l.title, l.concept, l.goal, l.learned, l.outro, ...l.steps.flatMap((s) => [s.text, ...s.say, ...(s.after ?? [])])]);
		for (const line of lines) expect(line, line).not.toMatch(/\bseal|closed|\bbond|epilogue|ending|ends the game|1,000 points/i);
	});
});
