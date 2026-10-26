import { loadContent } from "@aitower/content";
import type { SimView } from "@aitower/sim";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { BuildInspector } from "./BuildInspector";
import { BuildPalette } from "../components/BuildPalette";
import { CURSOR_HINT_PLACEMENTS, cursorHintVisible } from "../components/CursorHint";
import { createFakeContent, createFakeStore } from "../dev/fakeStore";
import { panelProps } from "../dev/walk";
import { findItem, itemForTool } from "./catalog";
import { lockedSummary, plainBlurb, plainStats, structureGate } from "./plain";

const content = loadContent();
const view = { tier: 1, techResearched: [] } as unknown as SimView;

describe("plain build copy", () => {
	it("every buildable facility has a plain blurb and a cost row with the real price", () => {
		for (const d of Object.values(content.facilities)) {
			expect(plainBlurb(d).length, d.id).toBeGreaterThan(20);
			const cost = plainStats(d).find((s) => s.label === "Costs");
			expect(cost?.value, d.id).toMatch(/^\$/);
		}
	});
	it("the air rack says what power, heat and earnings mean, with numbers from content", () => {
		const d = content.facilities.rack_air_gpu;
		const s = plainStats(d);
		expect(s.find((x) => x.label === "Power")).toMatchObject({ sub: "Electricity it uses (rack density)" });
		expect(s.find((x) => x.label === "Heat")?.sub).toBe("Needs an air handler (CRAH) nearby");
		expect(s.find((x) => x.label === "Earns")?.value).toMatch(/PF/);
	});
	it("folds locked items into level and research lines", () => {
		const locked = Object.values(content.facilities).filter((d) => d.category === "rack" && (d.unlockTier > 1 || d.tech));
		const lines = lockedSummary(locked, view, content);
		expect(lines[0]).toMatch(/^Coming at Level 2: /);
		expect(lines.length).toBeLessThanOrEqual(3);
		expect(lockedSummary([], view, content)).toEqual([]);
	});
	it("finds items by key and by armed tool", () => {
		expect(findItem("rack_air_gpu", content)?.name).toBe("AC-1 Air-Cooled Rack");
		expect(findItem("slab", content)?.tool).toEqual({ kind: "slab" });
		expect(itemForTool({ kind: "place", defId: "rack_air_gpu" }, content)?.key).toBe("rack_air_gpu");
		expect(itemForTool({ kind: "select" }, content)).toBeNull();
		expect(findItem("growth_mass", content)).toBeNull();
	});
});

describe("structure tools behind research", () => {
	it("coolant and nutrient pipes wait for their research, power pipe and lifts never do", () => {
		const coolant = findItem("conduit-coolant", content);
		const nutrient = findItem("conduit-nutrient", content);
		expect(coolant && structureGate(coolant, view, content)).toBe("chilled_loop");
		expect(nutrient && structureGate(nutrient, view, content)).toBeTruthy();
		const done = { tier: 3, techResearched: ["chilled_loop", nutrient ? structureGate(nutrient, view, content) : ""] } as unknown as SimView;
		expect(coolant && structureGate(coolant, done, content)).toBeUndefined();
		expect(nutrient && structureGate(nutrient, done, content)).toBeUndefined();
		for (const k of ["conduit-power", "lift", "slab", "demolish"]) {
			const it = findItem(k, content);
			expect(it && structureGate(it, view, content), k).toBeUndefined();
		}
	});
	it("the Structure catalog shows a Research row instead of the coolant card", () => {
		const fc = createFakeContent();
		for (const d of Object.values(fc.facilities)) if (d.kind === "chiller" || d.kind === "cdu") d.tech = fc.tech[0].id;
		const store = createFakeStore(fc);
		const html = renderToString(createElement(BuildPalette, panelProps(store, fc, { ui: { paletteTab: "structure", paletteOpen: true } })));
		expect(html).toContain("Power pipe");
		expect(html.split("Coolant pipe").length - 1).toBe(1); // only in the Research row, no card
		expect(html).toMatch(/Research &quot;[^&]+&quot; to unlock Coolant pipe/);
	});
});

describe("Recommended row hook", () => {
	const fc = createFakeContent();
	const store = createFakeStore(fc);
	const props = panelProps(store, fc, { ui: { paletteTab: "rack", paletteOpen: true } });
	it("renders nothing when empty and a row when given buildable def ids", () => {
		expect(renderToString(createElement(BuildPalette, props))).not.toContain("Recommended");
		const id = Object.values(fc.facilities).find((d) => d.category === "cooling" && d.unlockTier <= store.get().view.tier && !d.tech)?.id;
		if (id) expect(renderToString(createElement(BuildPalette, { ...props, recommended: [id, "nope"] }))).toContain("Recommended");
	});
});

describe("putting the tool down", () => {
	it("has no Put-tool-down button, and the picked card stays highlighted", () => {
		const fc = createFakeContent();
		const store = createFakeStore(fc);
		store.setTool({ kind: "slab" });
		const html = renderToString(createElement(BuildPalette, panelProps(store, fc, { ui: { paletteTab: "structure", paletteOpen: true } })));
		expect(html).not.toMatch(/Put tool down/i);
		expect(html).toMatch(/class="bld-card is-on[^"]*"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*class="bld-card is-on/);
	});
	it("the cursor tip shows for the first few placements only", () => {
		expect(cursorHintVisible(0)).toBe(true);
		expect(cursorHintVisible(CURSOR_HINT_PLACEMENTS - 1)).toBe(true);
		expect(cursorHintVisible(CURSOR_HINT_PLACEMENTS)).toBe(false);
	});
});

describe("tier on the cards", () => {
	it("every card carries exactly one tier class and a badge; path items add the diamond", () => {
		const fc = createFakeContent();
		const props = panelProps(createFakeStore(fc), fc, { ui: { paletteTab: "rack", paletteOpen: true } });
		const html = renderToString(createElement(BuildPalette, props));
		const cards = html.match(/<button[^>]*class="bld-card[^"]*"/g) ?? [];
		expect(cards.length).toBeGreaterThan(0);
		for (const c of cards) expect(c.match(/\bt-(std|adv|fro|bio|green|syn)\b/g)).toHaveLength(1);
		expect(html).toContain("tier-badge");
	});
	it("catalogue items map to the right class, label and bar", () => {
		const t = (id: string) => findItem(id, content)?.tier;
		expect(t("rack_air_gpu")?.className).toBe("t-std");
		expect(t("rack_dlc_gpu2")?.className).toBe("t-adv");
		expect(t("rack_imm_gpu2")?.className).toBe("t-fro");
		expect(t("organoid_incubator")).toMatchObject({ className: "t-bio", label: "Path: Wetware", isPath: true });
		expect(t("rack_mind_lattice")?.className).toBe("t-syn");
		expect(t("rack_mind_lattice")?.output?.share).toBe(1);
		expect(t("rack_imm_gpu3")?.output?.share).toBeCloseTo(800 / 1400, 5);
		expect(t("rack_infer")?.note).toBe("Air tops out here");
	});
	it("renders the Inspector with the badge, bar and note", () => {
		const fc = createFakeContent();
		const props = panelProps(createFakeStore(fc), fc, { ui: { paletteTab: "rack", paletteOpen: true, buildHover: "rack_air_gpu" } });
		const html = renderToString(createElement(BuildInspector, props));
		expect(html).toContain("t-std");
		expect(html).toContain("Standard");
		expect(html).toContain("tier-bar");
	});
});
