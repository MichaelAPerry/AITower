import { loadContent } from "@aitower/content";
import { describe, expect, it } from "vitest";
import { levelUpInfo } from "./levelUp";

const content = loadContent();

describe("level-up card content", () => {
	it("lists what each Level opens, with tiers, from content", () => {
		const l3 = levelUpInfo(content, 3);
		expect(l3.items.map((i) => i.id)).toContain("rack_dlc_gpu2");
		expect(l3.items.map((i) => i.id)).not.toContain("rack_air_gpu3"); // retired
		expect(l3.items.find((i) => i.id === "rack_dlc_gpu2")?.tier.label).toBe("Advanced");
		expect(levelUpInfo(content, 4).items.find((i) => i.id === "rack_dlc_gpu3")?.tier.label).toBe("Frontier");
		expect(levelUpInfo(content, 5).items.every((i) => !i.tier.isPath)).toBe(true);
		expect(levelUpInfo(content, 5).pathItems).toBeGreaterThan(0);
		expect(levelUpInfo(content, 2).items.length).toBeGreaterThan(0);
	});
});
