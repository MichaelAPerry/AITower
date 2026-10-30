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

	it("an edited achievement name, UI label and gallery line (which is also the caption) land in achievements.json", () => {
		const doc = md
			.replace("Name: Clean Hands", "Name: Clean Hands, Edited")
			.replace("Label: has a new portrait", "Label: has a new portrait, framed")
			.replace("luci: Care to join me for a drink Operator?", "luci: Care to join me for a drink, Operator?");
		const r = importDialogue(project, doc, {});
		expect(r.errors).toEqual([]);
		expect(r.edits).toHaveLength(3);
		const out = JSON.parse(applyEdits(project.files, r.edits)[FILES.achievements] as string);
		expect(out.achievements.find((a: { id: string }) => a.id === "clean_hands").name).toBe("Clean Hands, Edited");
		expect(out.ui.stripPortrait).toBe("has a new portrait, framed");
		expect(out.offDuty.luci.caption).toBeUndefined(); // captions are derived from the unlock scene's last spoken line
		expect(out.scenes.find((s: { id: string }) => s.id === "ach_unlock_luci").lines[2].text).toBe("Care to join me for a drink, Operator?");
	});
});

describe("docs/ACHIEVEMENTS_TEXT.md", () => {
	const project = loadProject();
	const md = readFileSync(new URL("../../docs/ACHIEVEMENTS_TEXT.md", import.meta.url), "utf8");

	it("imports with no changes and no errors", () => {
		const r = importDialogue(project, md, {});
		expect(r.errors).toEqual([]);
		expect(r.edits).toEqual([]);
	});

	it("carries every player-facing achievement and gallery string", () => {
		const ach = JSON.parse(project.files[FILES.achievements] as string);
		const need = [
			...ach.achievements.flatMap((a: { name: string; text: string }) => [a.name, a.text]),
			...Object.values<{ name: string; hint: string; rule: string }>(ach.offDuty).flatMap((o) => [o.name, o.hint, o.rule]),
			...Object.values<string>(ach.ui),
			...ach.scenes.flatMap((s: { title: string; location: string; lines: { text: string }[] }) => [s.title, s.location, ...s.lines.map((l) => l.text)]),
		];
		for (const t of need) expect(md, t).toContain(`: ${t}\n`);
	});
});
