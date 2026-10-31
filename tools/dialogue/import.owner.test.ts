import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FILES, applyEdits, importDialogue, loadProject } from "./import.ts";

// docs/OWNER_TEXT.md uses its own short ids; the importer maps them onto the slots, so the owner renames nothing.
describe("docs/OWNER_TEXT.md ids", () => {
	const project = loadProject();
	const dry = (lines: string[]) => importDialogue(project, `${lines.join("\n")}\n`, {});

	it("end_bankrupt_note lands on ach.ui.end_bankrupt_note", () => {
		const r = dry(["- [end_bankrupt_note] narrator: test"]);
		expect(r.errors).toEqual([]);
		expect(r.changed).toEqual(["ach.ui.end_bankrupt_note"]);
		const out = JSON.parse(applyEdits(project.files, r.edits)[FILES.achievements] as string);
		expect(out.ui.endBankruptNote).toBe("test");
	});

	it("the credits lines land on their ach.ui slots", () => {
		const keys = { title: "creditsTitle", code: "creditsCode", art: "creditsArt", inspired: "creditsInspired", fonts: "creditsFonts", quotes: "creditsQuotes" } as const;
		const r = dry(Object.keys(keys).map((k) => `- [credits.${k}] Line: test ${k}`));
		expect(r.errors).toEqual([]);
		expect(r.changed).toHaveLength(6);
		const out = JSON.parse(applyEdits(project.files, r.edits)[FILES.achievements] as string);
		for (const [k, ui] of Object.entries(keys)) expect(out.ui[ui]).toBe(`test ${k}`);
	});

	it("the starter description lands in scenarios.json", () => {
		const r = dry(["- [scenario.starter.description] Description: test"]);
		expect(r.errors).toEqual([]);
		expect(r.changed).toEqual(["scenario.starter.description"]);
		const out = JSON.parse(applyEdits(project.files, r.edits)[FILES.scenarios] as string);
		expect(out.starter.description).toBe("test");
	});

	it("the owner's current file matches the data: no changes, only the empty note", () => {
		const md = readFileSync(new URL("../../docs/OWNER_TEXT.md", import.meta.url), "utf8");
		const r = importDialogue(project, md, {});
		expect(r.errors).toEqual([]);
		expect(r.edits).toEqual([]);
		expect(r.empty).toContain("end_bankrupt_note");
	});
});
