import { loadContent } from "@aitower/content";
import type { LessonView } from "@aitower/sim";
import { describe, expect, it } from "vitest";
import { parseMarkup } from "../advisors/advisors";
import { buildChapters } from "../handbook/chapters";
import { buildEntries } from "../encyclopedia/entries";
import { termById } from "../glossary/terms";
import { allowedIds, articleTitle, baselineAck, goalModel, lessonTabs, pendingMessage, resultModel, slotGhost } from "./lessons";

const content = loadContent();
const def = content.lessons[0];
const lv = (p: Partial<LessonView> = {}): LessonView => ({ id: def.id, status: "active", stepsDone: [], current: 0, beatsFired: [], holdTicks: 0, holdGoal: 1440, minHeadroom: 100, downTicks: 0, stars: 0, allowed: [{ defId: "rack_air_gpu", max: 2 }], loadKw: 53, capacityKw: 120, headroomPct: 55, startTick: 0, endTick: -1, ...p });

describe("teacher lines", () => {
	it("walks the intro, then waits for the player", () => {
		let ack = {};
		const first = pendingMessage(def, lv(), ack);
		expect(first?.kind).toBe("say");
		expect(first?.n).toBe(1);
		ack = { "rack1:say": def.steps[0].say.length };
		expect(pendingMessage(def, lv(), ack)).toBeNull();
	});
	it("explains the trip only after the feeder has tripped", () => {
		const done = { "rack1:say": 9, "rack1:after": 9, "rack2:say": 9 };
		const before = pendingMessage(def, lv({ stepsDone: ["rack1", "rack2"], current: 2, beatsFired: ["job1", "job2"] }), done);
		expect(before).toBeNull();
		const after = pendingMessage(def, lv({ stepsDone: ["rack1", "rack2"], current: 2, beatsFired: ["job1", "job2", "trip"] }), done);
		expect(after?.kind).toBe("after");
		expect(after?.stepId).toBe("rack2");
		expect(after?.pause).toBe(true);
	});
	it("a game loaded mid-lesson does not replay what the player already passed", () => {
		const ack = baselineAck(def, lv({ stepsDone: ["rack1", "rack2"], current: 2 }));
		const m = pendingMessage(def, lv({ stepsDone: ["rack1", "rack2"], current: 2, beatsFired: ["trip"] }), ack);
		expect(m?.stepId).toBe("genset");
	});
});

describe("goal bar and catalog", () => {
	it("reads load against capacity and the success hold", () => {
		expect(goalModel(lv()).tone).toBe("ok");
		expect(goalModel(lv({ loadKw: 133, capacityKw: 120, headroomPct: -10 })).tone).toBe("bad");
		expect(goalModel(lv({ headroomPct: 4 })).tone).toBe("warn");
		expect(goalModel(lv({ holdTicks: 720 })).hold).toBe(0.5);
	});
	it("shows only what the lesson allows", () => {
		const view = { lesson: lv() };
		expect([...(allowedIds(view) ?? [])]).toEqual(["rack_air_gpu"]);
		expect(lessonTabs(content, view)).toEqual(["rack"]);
		expect(allowedIds({ lesson: lv({ status: "won", allowed: [] }) })).toBeNull();
		expect(allowedIds({ lesson: null })).toBeNull();
	});
	it("highlights the current step's slot", () => {
		const g = slotGhost(def, lv(), content);
		expect(g?.cells).toEqual([{ x: 11, floor: 1 }, { x: 12, floor: 1 }]);
		expect(slotGhost(def, lv({ current: 3 }), content)).toBeNull();
	});
});

describe("result", () => {
	it("scores stars and offers the Handbook links", () => {
		const r = resultModel(def, lv({ status: "won", stars: 3, minHeadroom: 89, downTicks: 60, startTick: 0, endTick: 2000 }), true);
		expect(r.won).toBe(true);
		expect(r.rows.every((x) => x.earned)).toBe(true);
		expect(r.bonus).toBe(def.bonus);
		expect(resultModel(def, lv({ status: "won", stars: 1 }), false).bonus).toBe(0);
		expect(r.handbook.map((h) => h.id)).toContain("ch:power");
		expect(articleTitle(content, "ch:power")).toBe("Power");
		expect(articleTitle(content, "ch:power#kw")).toBe("kW");
		expect(r.next).toBe("Where the Heat Goes");
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
