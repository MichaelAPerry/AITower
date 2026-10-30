import { describe, expect, it } from "vitest";
import { type AchievementContent, achievementContent, galleryScenes, validateAchievementContent } from "./achievements";

const clone = (): AchievementContent => structuredClone(achievementContent);

describe("achievement content", () => {
	it("has the 18 rows of docs/ACHIEVEMENTS.md and validates clean", () => {
		expect(achievementContent.achievements).toHaveLength(18);
		expect(validateAchievementContent(achievementContent)).toEqual([]);
	});

	it("hides exactly the two failure endings", () => {
		expect(
			achievementContent.achievements
				.filter((a) => a.hidden)
				.map((a) => a.id)
				.sort(),
		).toEqual(["end_absorbed", "end_bankrupt"]);
	});

	it("keeps the owner's wording of the gallery scenes (spot checks)", () => {
		const scene = (id: string) => achievementContent.scenes.find((s) => s.id === id);
		expect(scene("ach_unlock_luci")?.lines.at(-1)).toEqual({ who: "luci", text: "Care to join me for a drink Operator?" });
		expect(scene("ach_bed_intro")?.lines[1]?.text).toBe("You walk down a white hallway for what seems like ages. There are 4 doors ready to open.");
		expect(scene("ach_unlock_cass")?.lines.at(-1)).toEqual({ who: "cass", text: "Come on in, I won't bite.", mood: "pleased" });
		expect(scene(galleryScenes.bed("cass"))?.lines).toHaveLength(1);
		expect(scene(galleryScenes.empty)?.lines[0]?.text).toBe("The frames are dim and nobody has come to hang anything.");
	});

	it("each portrait caption is the last spoken line of her ach_unlock scene (owner wording)", () => {
		const last = (id: string) => [...(achievementContent.scenes.find((s) => s.id === id)?.lines ?? [])].reverse().find((l) => l.who !== "narrator")?.text;
		for (const a of ["luci", "mel", "bea", "cass"] as const) expect(achievementContent.offDuty[a].caption, a).toBe(last(`ach_unlock_${a}`));
		expect(achievementContent.offDuty.luci.caption).toBe("Care to join me for a drink Operator?");
	});

	it("reports every kind of problem", () => {
		const a = clone();
		a.achievements.push({ ...a.achievements[0] });
		a.achievements[1].name = " ";
		delete (a.offDuty as Record<string, unknown>).mel;
		a.offDuty.luci.caption = "";
		a.scenes = a.scenes.filter((s) => s.id !== "ach_bed_intro");
		a.scenes[0].lines[0].who = "bob" as never;
		a.scenes[1].lines = [];
		const p = validateAchievementContent(a).join("\n");
		expect(p).toContain("duplicate id end_lattice");
		expect(p).toContain("achievements.end_flesh: name is empty");
		expect(p).toContain("offDuty.mel: missing");
		expect(p).toContain("offDuty.luci.caption: empty");
		expect(p).toContain("scenes: missing ach_bed_intro");
		expect(p).toContain("unknown speaker bob");
		expect(p).toContain("no lines");
	});
});
