import { loadContent } from "@aitower/content";
import { describe, expect, it } from "vitest";
import { ICON_SHEETS, sheetCellStyle } from "../achievements/sheets";
import { RESEARCH_ICONS, RESEARCH_SHEETS } from "./researchIcons";

const content = loadContent();
const techs = content.tech ?? [];
const ids = new Set(techs.map((t) => t.id));

describe("research icons", () => {
	it("every technology has a valid cell on a registered sheet", () => {
		expect(techs.length).toBeGreaterThan(0);
		for (const t of techs) {
			const cell = RESEARCH_ICONS[t.id];
			expect(cell, `tech ${t.id} has no research icon`).toBeDefined();
			expect(sheetCellStyle(cell, 64), `tech ${t.id} cell is outside its sheet`).not.toBeNull();
		}
	});
	it("no cell is used twice and no id is unknown", () => {
		const seen = new Set<string>();
		for (const [id, c] of Object.entries(RESEARCH_ICONS)) {
			expect(ids.has(id), `${id} is not a tech`).toBe(true);
			const key = `${c.sheet}:${c.col},${c.row}`;
			expect(seen.has(key), `${key} used twice`).toBe(false);
			seen.add(key);
		}
	});
	it("the sheets' column counts match the registry, and the lists follow the tech branches in file order", () => {
		for (const s of RESEARCH_SHEETS) {
			expect(ICON_SHEETS[s.sheet]?.cols).toBe(s.cols);
			expect(s.ids).toEqual(techs.filter((t) => s.branches.includes(t.branch)).map((t) => t.id));
		}
	});
});
