/** The twelve rung-up scenes (docs/REFRAME.md): narrator first, short, one choice, spoken by the tree's champion. */
import { describe, expect, it } from "vitest";
import { loadContent, validateContent } from "./load";

const content = loadContent();
const CHAMPION = { synthetic: "luci", biotech: "mel", greentech: "bea" } as const;
const SHORT = { synthetic: "syn", biotech: "bio", greentech: "green" } as const;

describe("rung-up scenes", () => {
	for (const tree of ["synthetic", "biotech", "greentech"] as const) {
		for (const rung of [1, 2, 3, 4]) {
			const id = `rung_${SHORT[tree]}_${rung}`;
			it(`${id} opens on the narrator, is 4-8 lines, has one acknowledgement choice and a champion voice`, () => {
				const e = content.events.find((x) => x.id === id);
				expect(e, id).toBeDefined();
				expect(e?.trigger).toEqual({ kind: "rung", tree, rung });
				const lines = e?.lines ?? [];
				expect(lines[0]?.who).toBe("narrator");
				expect(lines.length).toBeGreaterThanOrEqual(4);
				expect(lines.length).toBeLessThanOrEqual(8);
				expect(lines.some((l) => l.who === CHAMPION[tree])).toBe(true);
				expect(e?.choices.length).toBe(1);
			});
		}
	}
	it("the story file holds the intro, both objections, the twelve rung scenes, Cass's night shift, two seal scenes, and the seal tip", () => {
		const ids = content.events.filter((x) => x.category === "story").map((x) => x.id);
		expect(ids).toHaveLength(39); // 19 + the 20 after-hours scenes
		expect(ids).toContain("st_intro");
	});

	it("the new scenes carry their triggers, one location painting each and only the existing effect kinds", () => {
		const get = (id: string) => content.events.find((x) => x.id === id);
		expect(get("cass_night_shift")).toMatchObject({ trigger: { kind: "tick", atLeast: 14400 }, minDay: 10, minTier: 1, advisor: "cass" });
		expect(get("seal_biotech")?.trigger).toEqual({ kind: "seal", tree: "biotech" });
		expect(get("seal_greentech")?.trigger).toEqual({ kind: "seal", tree: "greentech" });
		expect(get("cass_night_shift")?.choices.find((c) => c.id === "order")?.effects).toEqual([
			{ type: "cash", amount: -12000 },
		]);
		expect(get("st_intro")?.choices.map((c) => c.id)).toEqual(["ok"]);
		expect(get("tip_bond")).toBeUndefined();
	});

	it("every ending has a fallback epilogue", () => {
		for (const e of content.endings) expect(e.epilogue?.fallback, e.id).toBeTruthy();
	});
});

describe("after-hours scenes", () => {
	const get = (id: string) => content.events.find((x) => x.id === id);
	const say = (id: string) => (get(id)?.lines ?? []).map((l) => `${l.who}: ${l.text}`);
	const reply = (id: string, choice: string) => (get(id)?.choices.find((c) => c.id === choice)?.reply ?? []).map((l) => l.text);

	it("every item has a third-day scene, a tenth-day scene and three lead-in lines, all with the afterHours trigger", () => {
		for (const item of ["fern", "tank", "coffee", "book"]) {
			for (const s of ["third", "tenth", "again1", "again2", "again3"]) expect(get(`ah_${item}_${s}`)?.trigger, `${item} ${s}`).toEqual({ kind: "afterHours" });
			for (const s of ["third", "tenth"]) expect(get(`ah_${item}_${s}`)?.choices.map((c) => c.id), `${item} ${s}`).toEqual(["yes", "no"]);
		}
		expect(get("ah_fern_third")?.advisor).toBe("bea");
		expect(get("ah_tank_third")?.advisor).toBe("mel");
		expect(get("ah_coffee_third")?.advisor).toBe("cass");
		expect(get("ah_book_third")?.advisor).toBe("luci");
	});

	it("only the Yes of a tenth-day scene buys", () => {
		for (const item of ["fern", "tank", "coffee", "book"]) {
			expect(get(`ah_${item}_tenth`)?.choices.find((c) => c.id === "yes")?.effects).toEqual([{ type: "buyUpgrade", item }]);
			expect(get(`ah_${item}_tenth`)?.choices.find((c) => c.id === "no")?.effects).toEqual([]);
			for (const c of get(`ah_${item}_third`)?.choices ?? []) expect(c.effects, `${item} third ${c.id}`).toEqual([]);
		}
	});

	it("carries the owner's words (spelling fixed on request), line for line", () => {
		expect(say("ah_fern_third")).toEqual(["bea: Oh you noticed nigel my fern Isn't he great!", "bea: I'm glad you're watering him are you going to keep it up?"]);
		expect(reply("ah_fern_third", "yes")).toEqual(["Oh thanks! You're the best"]);
		expect(reply("ah_fern_third", "no")).toEqual(["Oh come on, just cause I asked?"]);
		expect(say("ah_fern_tenth")[1]).toBe("bea: Isn't he worth it!");
		expect(reply("ah_fern_tenth", "no")).toEqual(["Well, I left the catalogue on your desk."]);
		expect(say("ah_tank_tenth")[0]).toContain("Mr. Fido is doing good, but look at these new bio-enhancements we can add.");
		expect(reply("ah_tank_tenth", "yes")).toEqual(["Yay! It will be awesome!"]);
		expect(reply("ah_coffee_tenth", "no")).toEqual(["Ugh, cheapskate."]);
		expect(say("ah_book_third")[0]).toBe("luci: You're the one who's been coming in and checking the ledger.");
		expect(say("ah_book_third")[1]).toBe("luci: Unusual, but I appreciate an operator who does the numbers");
		expect(say("ah_book_tenth")[0]).toContain("Well, you obviously care about our financial future.");
		expect(reply("ah_book_tenth", "yes")).toEqual(["Excellent, class starts tonight.  Don't be late."]);
	});

	it("the lead-in lines are the placeholders, and say nothing about bonds or after hours", () => {
		expect(say("ah_coffee_again1")).toEqual(["narrator: [ buy the coffee machine ]"]);
		for (const e of content.events.filter((x) => x.id.startsWith("ah_"))) expect(JSON.stringify(e.lines)).not.toMatch(/bond|after.?hours/i);
	});

	it("the price and the day counts are in the balance and validated", () => {
		expect(content.balance.afterHours).toEqual({ price: 1_000_000, thirdDay: 3, tenthDay: 10 });
		const db = loadContent();
		db.balance.afterHours.tenthDay = 2;
		expect(validateContent(db).join("\n")).toMatch(/tenthDay/);
	});
});

describe("story trigger validation", () => {
	const broken = (id: string, trigger: unknown): string => {
		const db = loadContent();
		const e = db.events.find((x) => x.id === id);
		if (!e) throw new Error(id);
		(e as { trigger: unknown }).trigger = trigger;
		return validateContent(db).join("\n");
	};
	it("accepts the seal triggers and rejects bad ones", () => {
		expect(broken("seal_biotech", { kind: "seal", tree: "greentech" })).toBe("");
		expect(broken("seal_biotech", { kind: "seal", tree: "synthetic" })).toMatch(/only biotech or greentech/);
		expect(broken("seal_biotech", { kind: "bond", advisor: "mel", atLeast: 40 })).toMatch(/unknown trigger/);
		expect(broken("seal_biotech", { kind: "weather" })).toMatch(/unknown trigger/);
	});
	it("accepts a fallback epilogue and rejects an empty one", () => {
		const db = loadContent();
		expect(validateContent(db)).toEqual([]);
		(db.endings[0].epilogue as { fallback: string }).fallback = " ";
		expect(validateContent(db).join("\n")).toMatch(/epilogue\.fallback/);
	});
});
