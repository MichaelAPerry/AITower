import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FILES, applyEdits, importDialogue, loadProject } from "./import.ts";

// The achievements and gallery text round-trips through DIALOGUE.md like every other file (docs/ACHIEVEMENTS.md).
describe("dialogue import: achievements.json", () => {
	const project = loadProject();
	const md = readFileSync(new URL("../../docs/DIALOGUE.md", import.meta.url), "utf8");

	it("the exported file matches the data: nothing changes, no errors", () => {
		const r = importDialogue(project, md, {});
		expect(r.errors).toEqual([]);
		expect(r.edits).toEqual([]);
	});

	it("an edited achievement name, caption and gallery line land in achievements.json", () => {
		const doc = md
			.replace("Name: Clean Hands", "Name: Clean Hands, Edited")
			.replace("Caption: Off the clock. Don't enter the whisky, Operator.", "Caption: Off the clock. Mind the whisky, Operator.")
			.replace("luci: Care to join me for a drink Operator?", "luci: Care to join me for a drink, Operator?");
		const r = importDialogue(project, doc, {});
		expect(r.errors).toEqual([]);
		expect(r.edits).toHaveLength(3);
		const out = JSON.parse(applyEdits(project.files, r.edits)[FILES.achievements] as string);
		expect(out.achievements.find((a: { id: string }) => a.id === "clean_hands").name).toBe("Clean Hands, Edited");
		expect(out.offDuty.luci.caption).toBe("Off the clock. Mind the whisky, Operator.");
		expect(out.scenes.find((s: { id: string }) => s.id === "ach_unlock_luci").lines[2].text).toBe("Care to join me for a drink, Operator?");
	});
});
