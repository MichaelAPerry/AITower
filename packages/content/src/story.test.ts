/** The twelve rung-up scenes (docs/REFRAME.md): narrator first, short, one choice, spoken by the tree's champion. */
import { describe, expect, it } from "vitest";
import { loadContent } from "./load";

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
	it("the story file holds the intro, both objections and the twelve rung scenes", () => {
		const ids = content.events.filter((x) => x.category === "story").map((x) => x.id);
		expect(ids).toHaveLength(15);
		expect(ids).toContain("st_intro");
	});
});
