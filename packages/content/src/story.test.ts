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
			it(`${id} opens on the narrator, is 4-8 lines, has one choice of 2-3 and a champion voice`, () => {
				const e = content.events.find((x) => x.id === id);
				expect(e, id).toBeDefined();
				expect(e?.trigger).toEqual({ kind: "rung", tree, rung });
				const lines = e?.lines ?? [];
				expect(lines[0]?.who).toBe("narrator");
				expect(lines.length).toBeGreaterThanOrEqual(4);
				expect(lines.length).toBeLessThanOrEqual(8);
				expect(lines.some((l) => l.who === CHAMPION[tree])).toBe(true);
				expect(e?.choices.length).toBeGreaterThanOrEqual(2);
				expect(e?.choices.length).toBeLessThanOrEqual(3);
			});
		}
	}
	it("the story file holds the intro, both objections, the twelve rung scenes, Cass's night shift, two seal scenes, the seal tip, the bond tip and four bond beats", () => {
		const ids = content.events.filter((x) => x.category === "story").map((x) => x.id);
		expect(ids).toHaveLength(24);
		expect(ids).toContain("st_intro");
	});

	it("the new scenes carry their triggers, one location painting each and only the existing effect kinds", () => {
		const get = (id: string) => content.events.find((x) => x.id === id);
		expect(get("cass_night_shift")).toMatchObject({ trigger: { kind: "tick", atLeast: 14400 }, minDay: 10, minTier: 1, advisor: "cass" });
		expect(get("seal_biotech")?.trigger).toEqual({ kind: "seal", tree: "biotech" });
		expect(get("seal_greentech")?.trigger).toEqual({ kind: "seal", tree: "greentech" });
		for (const a of ["luci", "mel", "bea", "cass"]) expect(get(`bond50_${a}`)?.trigger).toEqual({ kind: "bond", advisor: a, atLeast: 50 });
		expect(get("cass_night_shift")?.choices.find((c) => c.id === "order")?.effects).toEqual([
			{ type: "cash", amount: -12000 },
			{ type: "bond", advisor: "cass", amount: 2 },
			{ type: "bond", advisor: "luci", amount: -1 },
		]);
		for (const a of ["luci", "mel", "bea", "cass"]) expect(get(`bond50_${a}`)?.choices.map((c) => c.id)).toEqual(["ok"]);
	});

	it("every ending has a fallback epilogue, and the epilogue bar is 50", () => {
		for (const e of content.endings) expect(e.epilogue?.fallback, e.id).toBeTruthy();
		expect(content.balance.soul.bondEpilogue).toBe(50);
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
	it("accepts the seal and bond triggers and rejects bad ones", () => {
		expect(broken("seal_biotech", { kind: "seal", tree: "greentech" })).toBe("");
		expect(broken("seal_biotech", { kind: "seal", tree: "synthetic" })).toMatch(/only biotech or greentech/);
		expect(broken("bond50_mel", { kind: "bond", advisor: "cass", atLeast: 40 })).toBe("");
		expect(broken("bond50_mel", { kind: "bond", advisor: "ned", atLeast: 40 })).toMatch(/unknown advisor/);
		expect(broken("bond50_mel", { kind: "bond", advisor: "mel", atLeast: 0 })).toMatch(/atLeast/);
		expect(broken("bond50_mel", { kind: "bond", advisor: "mel", atLeast: 101 })).toMatch(/atLeast/);
		expect(broken("bond50_mel", { kind: "weather" })).toMatch(/unknown trigger/);
	});
	it("accepts a fallback epilogue and rejects an empty one", () => {
		const db = loadContent();
		expect(validateContent(db)).toEqual([]);
		(db.endings[0].epilogue as { fallback: string }).fallback = " ";
		expect(validateContent(db).join("\n")).toMatch(/epilogue\.fallback/);
	});
});
