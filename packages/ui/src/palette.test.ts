import type { BuildCategory, ContentDB, FacilityDef } from "@aitower/content";
import type { SimView } from "@aitower/sim";
import { describe, expect, it } from "vitest";
import { leadingPath, preselectedPath } from "./ascension/ascension";
import { chipParts, effectChip } from "./calm/calm";
import { lockText, paletteDefs } from "./components/BuildPalette";

const def = (id: string, category: BuildCategory, unlockTier: number, cost: number, tech?: string): FacilityDef => ({ id, name: id, category, unlockTier, cost, tech }) as unknown as FacilityDef;
const content = {
	facilities: Object.fromEntries(
		[def("depot_big", "logistics", 2, 190_000, "central_stores"), def("depot", "logistics", 1, 60_000), def("charger", "logistics", 1, 40_000), def("fast", "logistics", 3, 160_000), def("chiller", "cooling", 1, 1), def("plant", "bio", 3, 9)].map((d) => [d.id, d]),
	),
	tech: [{ id: "central_stores", name: "Central Stores" }],
	paths: [
		{ id: "biotech", name: "Biotech", available: true },
		{ id: "greentech", name: "Greentech", available: false },
	],
} as unknown as ContentDB;
const view = { tier: 2, researched: [] } as unknown as SimView;

describe("palette lists", () => {
	it("each tab holds only its own category (logistics lists its facilities)", () => {
		expect(paletteDefs(content, view, "logistics").map((d) => d.id)).toContain("charger");
		expect(paletteDefs(content, view, "bio").map((d) => d.id)).toEqual(["plant"]);
		expect(paletteDefs(content, view, "cooling").map((d) => d.id)).toEqual(["chiller"]);
	});
	it("sorts by tier then cost, with locked rows after unlocked ones", () => {
		const ids = paletteDefs(content, view, "logistics").map((d) => d.id);
		expect(ids.slice(0, 2)).toEqual(["charger", "depot"]);
		expect(ids.slice(2)).toEqual(expect.arrayContaining(["depot_big", "fast"]));
	});
	it("words a lock as one line", () => {
		expect(lockText(def("fast", "logistics", 3, 1), view, content)).toBe("Locked: Clearance 3");
		expect(lockText(def("charger", "logistics", 1, 1), view, content)).toBeNull();
		expect(lockText(content.facilities.depot_big, view, content)).toBe("Locked: Central Stores");
	});
});

describe("path affinity", () => {
	it("finds the leading path, none when flat or tied", () => {
		expect(leadingPath({ biotech: 0.2, greentech: 0.5, synthetic: 0.3 })).toBe("greentech");
		expect(leadingPath({ biotech: 0, greentech: 0, synthetic: 0 })).toBeNull();
		expect(leadingPath({ biotech: 0.5, greentech: 0.5, synthetic: 0 })).toBeNull();
	});
	it("pre-selects the leader only when it can be chosen", () => {
		expect(preselectedPath(content, { biotech: 0.6, greentech: 0.2, synthetic: 0.2 })).toBe("biotech");
		expect(preselectedPath(content, { biotech: 0.1, greentech: 0.8, synthetic: 0.1 })).toBeNull();
	});
	it("renders affinity effects as path chips", () => {
		expect(effectChip({ type: "affinity", path: "biotech", amount: 5 })).toBe("Biotech +5");
		expect(effectChip({ type: "affinity", path: "synthetic", amount: -3 })).toBe("Synthetic −3");
		expect(chipParts([{ type: "cash", amount: 5000 }, { type: "affinity", path: "greentech", amount: 4 }])).toEqual([{ text: "+$5k" }, { text: "Greentech +4", path: "greentech" }]);
	});
});
