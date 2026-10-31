import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BAR_TABS } from "../build/BuildBar";
import { DRAWER_ICON } from "../calm/Parts";
import { DRAWER_TABS } from "../calm/calm";
import { SPEEDS } from "../calm/TopStrip";
import { MODES } from "../components/OverlaySwitcher";
import { hasIcon, ICON_NAMES, ICON_ROWS, ICON_SIZE, PALETTE, TREE_ICON } from "./pixelIcons";

const SRC = join(__dirname, "..");
const files = (dir: string): string[] =>
	readdirSync(dir).flatMap((f) => {
		const p = join(dir, f);
		return statSync(p).isDirectory() ? files(p) : p.endsWith(".tsx") && !p.endsWith(".test.tsx") ? [p] : [];
	});

describe("pixel icon set", () => {
	it("draws every icon on a 16x16 grid with palette keys only", () => {
		for (const name of ICON_NAMES) {
			const rows = ICON_ROWS[name];
			expect(rows.length, name).toBe(ICON_SIZE);
			for (const row of rows) {
				expect(row.length, name).toBe(ICON_SIZE);
				for (const ch of row) expect(ch === "." || ch in PALETTE, `${name}: ${ch}`).toBe(true);
			}
			expect(rows.join("").replace(/\./g, "").length, `${name} is not empty`).toBeGreaterThan(8);
		}
	});

	it("has every icon key used in the UI source", () => {
		const used = new Set<string>();
		for (const f of files(SRC)) {
			const src = readFileSync(f, "utf8");
			for (const m of src.matchAll(/<PixelIcon(?:Svg)?\s+name="([A-Za-z]+)"/g)) used.add(m[1]);
		}
		expect(used.size).toBeGreaterThan(10);
		for (const k of used) expect(hasIcon(k), `missing icon: ${k}`).toBe(true);
	});

	it("covers every tab, speed, overlay, build category and tree", () => {
		for (const d of DRAWER_TABS) expect(hasIcon(DRAWER_ICON[d.id]), d.id).toBe(true);
		for (const t of BAR_TABS) expect(hasIcon(t === "cooling" ? "coolant" : t), t).toBe(true);
		for (const m of MODES) expect(hasIcon(m.id === "contamination" ? "growth" : m.id), m.id).toBe(true);
		expect(SPEEDS.length).toBe(5);
		for (const v of Object.values(TREE_ICON)) expect(hasIcon(v), v).toBe(true);
		expect(new Set([TREE_ICON.synthetic, TREE_ICON.biotech, TREE_ICON.greentech]).size).toBe(3);
	});
});
