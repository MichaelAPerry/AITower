import { loadContent } from "@aitower/content";
import type { SimView } from "@aitower/sim";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { BuildPalette } from "../components/BuildPalette";
import { createFakeContent, createFakeStore } from "../dev/fakeStore";
import { panelProps } from "../dev/walk";
import { findItem, itemForTool } from "./catalog";
import { lockedSummary, plainBlurb, plainStats } from "./plain";

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
		expect(s.find((x) => x.label === "Power")).toMatchObject({ sub: "Electricity it uses" });
		expect(s.find((x) => x.label === "Heat")?.sub).toBe("Needs an air handler nearby");
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
