import { loadContent } from "@aitower/content";
import { describe, expect, it } from "vitest";
import { DECISION_ARTICLE } from "../advisors/DecisionCard";
import { buildEntries, searchEntries } from "../encyclopedia/entries";
import { termById, TERMS } from "../glossary/terms";
import { termTarget } from "../glossary/Term";
import { buildChapters, primerTarget, searchChapters } from "./chapters";

const content = loadContent();
const chapters = buildChapters(content);
const entries = buildEntries(content);
const view = { tier: 1, path: null, affinity: { biotech: 0, greentech: 0, synthetic: 0 } } as const;
/** Does the Handbook have a page for this link target ("ch:heat", "fac:genset", "ch:power#kw", "glossary:pue")? */
const opens = (target: string): boolean => {
	const [page, word] = target.split("#");
	const id = primerTarget(page);
	const found = chapters.some((c) => c.id === id) || entries.some((e) => e.id === id);
	return found && (!word || !!termById(word));
};

describe("Handbook search", () => {
	it("finds chapters by keyword, case-insensitively, and needs every word", () => {
		expect(searchChapters(chapters, "headroom", view).map((c) => c.id)).toContain("ch:power");
		expect(searchChapters(chapters, "BROWNOUT", view).map((c) => c.id)).toContain("ch:power");
		expect(searchChapters(chapters, "n+1", view).map((c) => c.id)).toContain("ch:power");
		expect(searchChapters(chapters, "chiller", view).map((c) => c.id)).toContain("ch:heat");
		expect(searchChapters(chapters, "heat zzzz", view)).toEqual([]);
		expect(searchChapters(chapters, "   ", view)).toEqual([]);
	});
	it("a locked path chapter shows up by its title only", () => {
		expect(searchChapters(chapters, "frankenstein", view)).toEqual([]);
		const bio = chapters.find((c) => c.id === "ch:path-biotech");
		expect(bio && searchChapters(chapters, "biotech", view).includes(bio)).toBe(true);
	});
	it("searches the reference lists too (facilities, research, words)", () => {
		expect(searchEntries(entries, "genset").some((e) => e.id === "fac:genset")).toBe(true);
		expect(searchEntries(entries, "kilowatt").length).toBeGreaterThan(0);
	});
});

describe("deep links open the right article", () => {
	it("every glossary term opens its chapter or the Words list", () => {
		for (const t of TERMS) expect(opens(termTarget(t)), t.id).toBe(true);
	});
	it("every build card's ? has an article", () => {
		for (const d of Object.values(content.facilities)) if (!d.growth) expect(opens(`fac:${d.id}`), d.id).toBe(true);
	});
	it("every research node has its own article for the Read: link", () => {
		for (const n of content.tech) expect(opens(`tech:${n.id}`), n.id).toBe(true);
	});
	it("every advisor's decision card links to a chapter", () => {
		for (const [advisor, a] of Object.entries(DECISION_ARTICLE)) expect(opens(a.id), advisor).toBe(true);
	});
});
