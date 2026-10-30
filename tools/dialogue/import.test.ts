import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FILES, applyEdits, importDialogue, indexJsonStrings, loadProject, markers, resolveContainer } from "./import.ts";

const REAL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const CRAWL = `export const CRAWL_LINES: readonly string[] = [\n\t"First card.",\n\t"Second card.",\n];\n`;
const ADVISORS = `export const ADVISORS = {\n\tcass: { id: "cass", name: "Cass Parr", first: "Cass", role: "Cooling", areas: "Air", color: "#7fdcff", motto: "Keep it cold." },\n};\n`;
const story = [
	{
		id: "rung_a",
		title: "Scene A",
		body: "Caption.",
		location: "The lot",
		recommended: "go",
		lines: [{ who: "luci", mood: "pleased", text: "Hello {item}." }],
		choices: [{ id: "go", label: "Go", hint: "Fast", outcome: "Done.\n\nReally done.", effects: [{ type: "cash", amount: 5 }], reply: [{ who: "mel", text: "See {{kw|kW}}." }] }],
	},
	{ id: "rung_a.b", title: "Scene AB", body: "Other.", recommended: "x", choices: [{ id: "x", label: "X" }] },
];
const events = [{ id: "ev_one", advisor: "bea", title: "Ev", body: "Body.", recommended: "a", votes: [{ advisor: "cass", approve: true, line: "Aye." }], choices: [{ id: "a", label: "A", effects: [] }] }];
const endings = [{ id: "e1", title: "End", body: "It ends.", epilogue: { cass: "Cass ends." } }];
const lessons = {
	lessons: [
		{ id: "les1", number: 1, advisor: "cass", title: "L", concept: "C", goal: "G", scenario: "s", learned: "Lr", outro: "Out", next: "Nx", steps: [{ id: "s1", text: "Do it", when: [], say: ["Say one"], after: ["After one"] }] },
	],
};

/** Mixed formatting on purpose: story is 2-space with no trailing newline, lessons is 1-space with one. */
function fixture(): string {
	const root = mkdtempSync(resolve(tmpdir(), "dlg-"));
	const put = (rel: string, text: string): void => {
		mkdirSync(dirname(resolve(root, rel)), { recursive: true });
		writeFileSync(resolve(root, rel), text);
	};
	put(FILES.crawl, CRAWL);
	put(FILES.advisors, ADVISORS);
	put(FILES.story, JSON.stringify(story, null, 2));
	put(FILES.events, `${JSON.stringify(events, null, 2)}\n`);
	put(FILES.endings, JSON.stringify(endings));
	put(FILES.lessons, `${JSON.stringify(lessons, null, 1)}\n`);
	return root;
}

const DOC = `# Doc

> metadata line

## 1. Crawl

- [crawl.1] narrator: First card.
- [crawl.2] narrator: Second card.

Choice \`go\`:

- [adv.cass.name] Name: Cass Parr
- [adv.cass.first] First name: Cass
- [adv.cass.role] Role: Cooling
- [adv.cass.areas] Areas: Air
- [adv.cass.motto] Motto: Keep it cold.
- [rung_a.title] Title: Scene A
- [rung_a.location] Location: The lot
- [rung_a.caption] Caption: Caption.
- [rung_a.l1 mood=pleased] luci: Hello {item}.
- [rung_a.go.label] Label: Go
- [rung_a.go.hint] Hint: Fast
- [rung_a.go.outcome.p1] Outcome: Done.
- [rung_a.go.outcome.p2] Outcome: Really done.
- [rung_a.go.r1] mel: See {{kw|kW}}.
- [rung_a.b.title] Title: Scene AB
- [rung_a.b.caption] Caption: Other.
- [rung_a.b.x.label] Label: X
- [ev_one.title] Title: Ev
- [ev_one.body] bea: Body.
- [ev_one.vote.cass] cass: Aye.
- [ev_one.a.label] Label: A
- [end.e1.title] Title: End
- [end.e1.body] narrator: It ends.
- [end.e1.epilogue.cass] narrator: Cass ends.
- [les1.title] Title: L
- [les1.concept] Concept: C
- [les1.goal] Goal: G
- [les1.learned] Learned: Lr
- [les1.outro] cass: Out
- [les1.next] Next lesson: Nx
- [les1.s1.objective] Objective: Do it
- [les1.s1.say1] cass: Say one
- [les1.s1.after1] cass: After one
`;

const run = (doc: string, root = fixture()) => {
	const project = loadProject(root);
	return { project, report: importDialogue(project, doc) };
};

describe("dialogue import", () => {
	it("an unchanged document changes nothing and finds every id", () => {
		const { report, project } = run(DOC);
		expect(report.errors).toEqual([]);
		expect(report.warnings).toEqual([]);
		expect(report.changed).toEqual([]);
		expect(report.missing).toEqual([]);
		expect(report.extra).toEqual([]);
		expect(applyEdits(project.files, report.edits)).toEqual(project.files);
	});

	it("joins .pN parts with a blank line and splices only that value", () => {
		const doc = DOC.replace("Really done.", "Really, truly done.");
		const { report, project } = run(doc);
		expect(report.errors).toEqual([]);
		expect(report.changed).toEqual(["rung_a.go.outcome"]);
		const out = applyEdits(project.files, report.edits);
		const next = JSON.parse(out[FILES.story] as string);
		expect(next[0].choices[0].outcome).toBe("Done.\n\nReally, truly done.");
		expect(next[0].choices[0].effects).toEqual([{ type: "cash", amount: 5 }]);
		// formatting kept: only the one literal differs, no trailing newline added
		expect(out[FILES.story]).toBe((project.files[FILES.story] as string).replace('"Done.\\n\\nReally done."', '"Done.\\n\\nReally, truly done."'));
		expect(out[FILES.story]?.endsWith("\n")).toBe(false);
		expect(out[FILES.lessons]).toBe(project.files[FILES.lessons]);
	});

	it("rewrites crawl and advisor strings in place", () => {
		const doc = DOC.replace("Second card.", 'Second "card".').replace("Keep it cold.", "Stay cold.");
		const { report, project } = run(doc);
		expect(report.changed.sort()).toEqual(["adv.cass.motto", "crawl.2"]);
		const out = applyEdits(project.files, report.edits);
		expect(out[FILES.crawl]).toBe(CRAWL.replace('"Second card."', '"Second \\"card\\"."'));
		expect(out[FILES.advisors]).toBe(ADVISORS.replace("Keep it cold.", "Stay cold."));
	});

	it("fails a line whose {item} or term id changed, and keeps going", () => {
		const doc = DOC.replace("Hello {item}.", "Hello there.").replace("See {{kw|kW}}.", "See {{mw|MW}}.").replace("Aye.", "Yes.");
		const { report } = run(doc);
		expect(report.errors).toHaveLength(2);
		expect(report.errors.join("\n")).toContain("rung_a.l1: markers differ");
		expect(report.errors.join("\n")).toContain("rung_a.go.r1: markers differ");
		expect(report.changed).toEqual(["ev_one.vote.cass"]);
	});

	it("allows a reworded term label but warns", () => {
		const { report } = run(DOC.replace("{{kw|kW}}", "{{kw|kilowatts}}"));
		expect(report.errors).toEqual([]);
		expect(report.changed).toEqual(["rung_a.go.r1"]);
		expect(report.warnings.join("\n")).toContain("marker labels");
	});

	it("warns when a TAG or mood differs and still imports the text", () => {
		const doc = DOC.replace("[rung_a.l1 mood=pleased] luci: Hello", "[rung_a.l1 mood=sly] mel: Howdy");
		const { report } = run(doc);
		expect(report.errors).toEqual([]);
		expect(report.changed).toEqual(["rung_a.l1"]);
		const w = report.warnings.join("\n");
		expect(w).toContain('TAG changed from "luci" to "mel"');
		expect(w).toContain('mood changed from "pleased" to "sly"');
	});

	it("reports a malformed line with its line number", () => {
		const lines = DOC.split("\n");
		const at = lines.findIndex((l) => l.startsWith("- [crawl.2]"));
		lines[at] = "- [crawl.2] narrator:Second card";
		lines.push("- [Bad Id] x: y");
		const { report } = run(lines.join("\n"));
		expect(report.errors).toHaveLength(2);
		expect(report.errors[0]).toContain(`line ${at + 1}:`);
	});

	it("reports duplicate, extra, missing and empty ids; missing keeps current text", () => {
		const doc = `${DOC.replace("- [crawl.1] narrator: First card.\n", "").replace("- [ev_one.a.label] Label: A", "- [ev_one.a.label] Label:")}- [crawl.9] narrator: Nine\n- [rung_a.nope] Title: x\n- [ghost.title] Title: y\n- [crawl.2] narrator: dup\n`;
		const { report } = run(doc);
		expect(report.missing).toEqual(["crawl.1"]);
		expect(report.empty).toEqual(["ev_one.a.label"]);
		expect(report.extra.map((e) => e.split(" ")[0])).toEqual(["crawl.9", "rung_a.nope", "ghost.title"]);
		expect(report.errors.join("\n")).toContain("duplicate id crawl.2");
	});

	it("a body with fewer paragraph lines keeps its text by default and is cut with truncateParagraphs", () => {
		const doc = DOC.replace("- [rung_a.go.outcome.p2] Outcome: Really done.\n", "");
		const project = loadProject(fixture());
		const kept = importDialogue(project, doc);
		expect(kept.changed).toEqual([]);
		expect(kept.missing).toEqual(["rung_a.go.outcome.p2"]);
		const cut = importDialogue(project, doc, { truncateParagraphs: true });
		expect(cut.errors).toEqual([]);
		expect(cut.missing).toEqual([]);
		expect(cut.changed).toEqual(["rung_a.go.outcome"]);
		const out = JSON.parse(applyEdits(project.files, cut.edits)[FILES.story] as string);
		expect(out[0].choices[0].outcome).toBe("Done.");
		// a gap (p2 present, p1 missing) is never treated as a cut
		const gap = importDialogue(project, DOC.replace("- [rung_a.go.outcome.p1] Outcome: Done.\n", ""), { truncateParagraphs: true });
		expect(gap.changed).toEqual([]);
		expect(gap.missing).toEqual(["rung_a.go.outcome.p1"]);
	});

	it("resolves ids by longest known prefix, not by splitting on dots", () => {
		const known = ["rung_a", "rung_a.b", "end.e1"];
		expect(resolveContainer("rung_a.b.x.label", known)).toEqual({ container: "rung_a.b", rest: "x.label" });
		expect(resolveContainer("rung_a.go.label", known)).toEqual({ container: "rung_a", rest: "go.label" });
		expect(resolveContainer("rung_ab.title", known)).toBeUndefined();
		// through the importer: scene "rung_a.b" is not mistaken for scene "rung_a" choice "b"
		const { report } = run(DOC.replace("Scene AB", "Scene AB, renamed"));
		expect(report.changed).toEqual(["rung_a.b.title"]);
	});

	it("indexes JSON string spans", () => {
		const raw = '{ "a": ["x", {"b": "y\\"z"}], "n": 1 }';
		const spans = indexJsonStrings(raw);
		const at = spans.get(JSON.stringify(["a", 1, "b"])) as [number, number];
		expect(JSON.parse(raw.slice(at[0], at[1]))).toBe('y"z');
		expect(spans.has(JSON.stringify(["n"]))).toBe(false);
	});

	it("extracts markers", () => {
		expect(markers("a {item} b {{kw|kW}} {{ups}}")).toEqual(["{item}", "{{kw|kW}}", "{{ups}}"]);
	});
});

describe("dialogue round trip on the real data", () => {
	it("export then import changes nothing", () => {
		const docPath = resolve(REAL_ROOT, "docs/DIALOGUE.md");
		const original = readFileSync(docPath, "utf8");
		try {
			execFileSync("npx", ["tsx", "tools/dialogue/export.ts"], { cwd: REAL_ROOT, stdio: "pipe" });
			const project = loadProject(REAL_ROOT);
			const report = importDialogue(project, readFileSync(docPath, "utf8"));
			expect(report.errors).toEqual([]);
			expect(report.warnings).toEqual([]);
			expect(report.changed).toEqual([]);
			expect(report.missing).toEqual([]);
			expect(report.extra).toEqual([]);
			expect(report.empty).toEqual([]);
			expect(report.unchanged).toBe(project.slots.length);
			expect(applyEdits(project.files, report.edits)).toEqual(project.files);
		} finally {
			writeFileSync(docPath, original);
		}
	}, 60_000);
});
