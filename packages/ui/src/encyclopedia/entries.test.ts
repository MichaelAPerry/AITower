import { loadContent } from "@aitower/content";
import { describe, expect, it } from "vitest";
import type { SimView } from "@aitower/sim";
import { TERMS } from "../glossary/terms";
import { buildEntries, facilityNeeds, lockFor, searchEntries, sectionOf } from "./entries";

const content = loadContent();
const entries = buildEntries(content);

describe("buildEntries", () => {
	it("is pure and has unique ids", () => {
		expect(buildEntries(content).map((e) => e.id)).toEqual(entries.map((e) => e.id));
		expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
	});
	it("hand-written basics cover the topics, each 5 sentences or fewer lines", () => {
		const ids = entries.filter((e) => e.section === "basics").map((e) => e.id.slice(7));
		for (const t of ["money", "contracts", "power", "cooling", "loops", "lifts", "parts", "research", "level", "reputation", "advisors", "paths", "automation"]) expect(ids).toContain(t);
		for (const e of entries.filter((x) => x.section === "basics")) expect(e.lines.length).toBeLessThanOrEqual(3);
	});
	it("generates one entry per buildable facility, bot and tech node, with numbers from content", () => {
		const buildable = Object.values(content.facilities).filter((d) => !d.growth);
		expect(entries.filter((e) => e.section === "facilities")).toHaveLength(buildable.length);
		expect(entries.filter((e) => e.section === "bots")).toHaveLength(Object.keys(content.bots).length);
		expect(entries.filter((e) => e.section === "research")).toHaveLength(content.tech.length);
		const rack = buildable.find((d) => d.rack);
		const e = entries.find((x) => x.id === `fac:${rack?.id}`);
		expect(e?.stats.some(([k]) => k === "Cost")).toBe(true);
		expect(entries.find((x) => x.id === "basics:level")?.lines[0]).toContain(String(content.balance.tiers.pflops[0]));
	});
	it("states what a facility needs", () => {
		const dlc = Object.values(content.facilities).find((d) => d.rack?.cooling === "dlc");
		if (dlc) expect(facilityNeeds(dlc)).toContain("coolant");
		const rack = Object.values(content.facilities).find((d) => d.rack);
		expect(facilityNeeds(rack as NonNullable<typeof rack>)).toContain("power");
	});
	it("glossary has the jargon", () => {
		const g = entries.filter((e) => e.section === "glossary").map((e) => e.title);
		for (const t of ["PFLOPS (PF)", "kW", "MW", "CDU", "CRAH", "PUE", "Uptime", "SLA", "N+1 (redundancy)"]) expect(g).toContain(t);
		expect(g).toHaveLength(TERMS.length);
	});
	it("horror entries keep their text out of search", () => {
		const spoilers = entries.filter((e) => e.spoiler);
		expect(spoilers.length).toBeGreaterThan(0);
		for (const e of spoilers) expect(e.keywords).toBe(e.title.toLowerCase());
	});
});

describe("searchEntries", () => {
	it("returns everything for an empty query", () => {
		expect(searchEntries(entries, "  ")).toHaveLength(entries.length);
	});
	it("matches every word, title hits first", () => {
		const r = searchEntries(entries, "pue");
		expect(r[0].title).toBe("PUE");
		expect(searchEntries(entries, "zzzz-nothing")).toEqual([]);
		expect(searchEntries(entries, "heat cooling").every((e) => e.keywords.includes("heat") && e.keywords.includes("cooling"))).toBe(true);
	});
	it("finds the jargon in the Words list", () => {
		for (const [q, id] of [["PUE", "glossary:pue"], ["CRAH", "glossary:crah"], ["N+1", "glossary:redundancy"], ["immersion", "glossary:immersion"], ["redundancy", "glossary:redundancy"], ["power usage", "glossary:pue"]]) expect(searchEntries(entries, q).map((e) => e.id), q).toContain(id);
	});
	it("is case-insensitive", () => {
		expect(searchEntries(entries, "CRAH").map((e) => e.id)).toEqual(searchEntries(entries, "crah").map((e) => e.id));
	});
});

describe("sectionOf / lockFor", () => {
	it("maps ids to sections", () => {
		expect(sectionOf("fac:x")).toBe("facilities");
		expect(sectionOf("glossary:pue")).toBe("glossary");
		expect(sectionOf("nope")).toBeNull();
	});
	it("reports the lock of a gated facility and none for basics", () => {
		const view = { tier: 1, techResearched: [] } as unknown as SimView;
		const gated = entries.find((e) => e.ref?.kind === "facility" && (content.facilities[e.ref.id].unlockTier > view.tier || content.facilities[e.ref.id].tech));
		expect(gated && lockFor(gated, view, content)).toMatch(/^Locked/);
		expect(lockFor(entries[0], view, content)).toBeNull();
	});
});
