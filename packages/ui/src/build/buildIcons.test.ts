import { loadContent } from "@aitower/content";
import { describe, expect, it } from "vitest";
import { ICON_SHEETS, sheetCellStyle } from "../achievements/sheets";
import { BUILD_ICONS, BUILD_SHEETS } from "./buildIcons";

const content = loadContent();

describe("build menu icons", () => {
	it("every facility has a valid cell on a registered sheet", () => {
		for (const id of Object.keys(content.facilities)) {
			const cell = BUILD_ICONS[id];
			expect(cell, `facility ${id} has no build icon`).toBeDefined();
			expect(sheetCellStyle(cell, 64), `facility ${id} cell is outside its sheet`).not.toBeNull();
		}
	});
	it("no cell is used twice and no id is unknown", () => {
		const seen = new Set<string>();
		for (const [id, c] of Object.entries(BUILD_ICONS)) {
			expect(content.facilities[id], `${id} is not a facility`).toBeDefined();
			const key = `${c.sheet}:${c.col},${c.row}`;
			expect(seen.has(key), `${key} used twice`).toBe(false);
			seen.add(key);
		}
	});
	it("the sheets' column counts match the registry, and the lists follow the facility kinds in file order", () => {
		const kinds: Record<string, string[]> = {
			build_racks: ["rack"],
			build_power: ["grid_tie", "genset", "ups", "solar", "wind", "bioreactor"],
			build_cooling: ["crah", "chiller", "cdu"],
			build_support: ["nutrient", "sterilizer", "quarantine", "heat_export", "carbon", "depot", "charger", "transfer"],
		};
		const all = Object.values(content.facilities);
		for (const s of BUILD_SHEETS) {
			expect(ICON_SHEETS[s.sheet]?.cols).toBe(s.cols);
			expect(s.ids).toEqual(all.filter((d) => kinds[s.sheet].includes(d.kind)).map((d) => d.id));
		}
	});
});
