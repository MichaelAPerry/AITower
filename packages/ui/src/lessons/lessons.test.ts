import { loadContent } from "@aitower/content";
import type { LessonView } from "@aitower/sim";
import { describe, expect, it } from "vitest";
import { parseMarkup } from "../advisors/advisors";
import { buildChapters } from "../handbook/chapters";
import { buildEntries } from "../encyclopedia/entries";
import { termById } from "../glossary/terms";
import { allowedIds, articleTitle, baselineAck, goalModel, lessonTabs, lessonsInOrder, nextLessonOf, pendingMessage, resultModel, slotGhost } from "./lessons";

const content = loadContent();
const def = content.lessons[0];
const lv = (p: Partial<LessonView> = {}): LessonView => ({ id: def.id, status: "active", stepsDone: [], current: 0, beatsFired: [], holdTicks: 0, holdGoal: 1440, minHeadroom: 100, downTicks: 0, stars: 0, star2: false, star3: false, allowed: [{ defId: "rack_air_gpu", max: 2 }], pue: 1.2, drawers: [], supplies: false, loadKw: 53, capacityKw: 120, headroomPct: 55, startTick: 0, endTick: -1, ...p });

describe("teacher lines", () => {
	it("walks the intro, then waits for the player", () => {
		let ack = {};
		const first = pendingMessage(def, lv(), ack);
		expect(first?.kind).toBe("say");
		expect(first?.n).toBe(1);
		expect(first?.advisor).toBe("bea");
		ack = { "rack:say": def.steps[0].say.length };
		expect(pendingMessage(def, lv(), ack)).toBeNull();
	});
	it("speaks the after-lines of a finished step before the next step", () => {
		const done = { "rack:say": 9 };
		const m = pendingMessage(def, lv({ stepsDone: ["rack"], current: 1 }), done);
		expect(m?.kind).toBe("after");
		expect(m?.stepId).toBe("rack");
		expect(m?.pause).toBe(true);
	});
	it("a step can hand the talking to another advisor", () => {
		const done = { "rack:say": 9, "rack:after": 9, "power:say": 9, "power:after": 9 };
		const m = pendingMessage(def, lv({ stepsDone: ["rack", "power"], current: 2 }), done);
		expect(m?.stepId).toBe("cool");
		expect(m?.advisor).toBe("cass");
	});
	it("holds the next step back until its scripted moment has landed", () => {
		const earn = content.lessons[1];
		const done = { "accept:say": 9, "accept:after": 9 };
		expect(pendingMessage(earn, lv({ id: earn.id, stepsDone: ["accept"], current: 1 }), done)?.stepId).toBe("paid");
	});
	it("a game loaded mid-lesson does not replay what the player already passed", () => {
		const ack = baselineAck(def, lv({ stepsDone: ["rack", "power"], current: 2 }));
		const m = pendingMessage(def, lv({ stepsDone: ["rack", "power"], current: 2, beatsFired: [] }), ack);
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
	it("shows only what the lesson allows", () => {
		const view = { lesson: lv() };
		expect([...(allowedIds(view) ?? [])]).toEqual(["rack_air_gpu"]);
		expect(lessonTabs(content, view)).toEqual(["rack"]);
		expect(lessonTabs(content, { lesson: lv({ supplies: true }) })).toContain("supplies");
		expect(allowedIds({ lesson: lv({ status: "won", allowed: [] }) })).toBeNull();
		expect(allowedIds({ lesson: null })).toBeNull();
	});
	it("highlights the current step's slot", () => {
		const g = slotGhost(def, lv(), content);
		expect(g?.cells).toEqual([{ x: 11, floor: 1 }, { x: 12, floor: 1 }]);
		expect(slotGhost(def, lv({ current: 3 }), content)).toBeNull();
	});
});

describe("the lesson list", () => {
	it("lists exactly the lessons that exist, in order, with a next lesson for all but the last", () => {
		const list = lessonsInOrder(content);
		expect(list.map((l) => l.number)).toEqual([1, 2, 3, 4, 6]);
		expect(nextLessonOf(content, list[0])?.id).toBe(list[1].id);
		// Lesson 5 is not built yet: the next one after 4 is 6.
		expect(nextLessonOf(content, list[3])?.number).toBe(6);
		expect(nextLessonOf(content, list[4])).toBeUndefined();
	});
});

describe("result", () => {
	it("passes the lesson with the Handbook links and says in words what earned each star", () => {
		const r = resultModel(def, lv({ status: "won", stars: 2, star2: true, startTick: 0, endTick: 2000 }), true);
		expect(r.won).toBe(true);
		expect(r.starred).toBe(true);
		expect(r.rows).toEqual([
			{ label: "Passed", value: def.passed ?? def.goal, earned: true },
			{ label: "Star 2", value: def.star2Text, earned: true },
			{ label: "Star 3", value: def.star3Text, earned: false },
		]);
		expect(def.star2Text.length).toBeGreaterThan(10);
		expect(r.bonus).toBe(def.bonus);
		expect(resultModel(def, lv({ status: "won", stars: 1 }), false).bonus).toBe(0);
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
