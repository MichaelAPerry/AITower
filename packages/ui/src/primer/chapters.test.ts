import { loadContent } from "@aitower/content";
import type { SimView } from "@aitower/sim";
import { describe, expect, it } from "vitest";
import { buildEntries, searchEntries } from "../encyclopedia/entries";
import { HELP, HELP_KEYS } from "../help/helpText";
import { buildChapters, isUnlocked, lockText, newlyOpen, primerTarget, unlockedIds, wordCount } from "./chapters";
import { TERMS, termById } from "../glossary/terms";
import { shouldNudge } from "./progress";

const content = loadContent();
const chapters = buildChapters(content);
const entries = buildEntries(content);
const view = (tier: number, path: SimView["path"] = null, a: Partial<SimView["affinity"]> = {}): SimView => ({ tier, path, affinity: { biotech: 0, greentech: 0, synthetic: 0, ...a } }) as unknown as SimView;
const core = chapters.filter((c) => c.group === "core");

describe("chapters", () => {
	it("has six core chapters, five Level chapters and three path chapters with unique ids", () => {
		expect(core.map((c) => c.title)).toEqual(["What is a datacenter?", "Power", "Heat & cooling", "Why racks break", "Uptime & reputation", "Money"]);
		expect(chapters.filter((c) => c.group === "level")).toHaveLength(5);
		expect(chapters.filter((c) => c.group === "path").map((c) => c.id)).toEqual(["ch:path-biotech", "ch:path-greentech", "ch:path-synthetic"]);
		expect(new Set(chapters.map((c) => c.id)).size).toBe(chapters.length);
		for (const c of core) expect(c.diagram, c.id).toBeTruthy();
	});
	it("keeps every core chapter at 170 words or fewer, and the others short", () => {
		for (const c of core) expect(wordCount(c), c.id).toBeLessThanOrEqual(170);
		for (const c of chapters) expect(wordCount(c), c.id).toBeLessThanOrEqual(190);
	});
	it("uses real numbers from content", () => {
		const text = (id: string) => chapters.find((c) => c.id === id)?.blocks.map((b) => b.p).join(" ") ?? "";
		expect(text("ch:heat")).toContain(String(content.balance.thermal.okC));
		expect(text("ch:uptime")).toContain(`${Math.round(content.balance.tiers.uptime[1] * 100)}%`);
		expect(text("ch:level1")).toContain(`${content.balance.tiers.pflops[1]} PF`);
		expect(text("ch:level2")).toContain(`${content.balance.tiers.pflops[2]} PF`);
	});
	it("is pure", () => {
		expect(buildChapters(content)).toEqual(chapters);
	});
});

describe("unlock rules", () => {
	it("core chapters are always open; Level chapters open at their Level", () => {
		expect(unlockedIds(chapters, view(1)).filter((id) => id.startsWith("ch:level"))).toEqual(["ch:level1"]);
		expect(unlockedIds(chapters, view(3)).filter((id) => id.startsWith("ch:level"))).toEqual(["ch:level1", "ch:level2", "ch:level3"]);
		for (const c of core) expect(isUnlocked(c.unlock, view(1))).toBe(true);
	});
	it("path chapters open when chosen, at Level 5, or when the path leads from Level 3", () => {
		const bio = chapters.find((c) => c.id === "ch:path-biotech")?.unlock;
		if (!bio) throw new Error("no biotech chapter");
		expect(isUnlocked(bio, view(2, null, { biotech: 1 }))).toBe(false);
		expect(isUnlocked(bio, view(3, null, { biotech: 0.4 }))).toBe(false);
		expect(isUnlocked(bio, view(3, null, { biotech: 0.6 }))).toBe(true);
		expect(isUnlocked(bio, view(5))).toBe(true);
		expect(isUnlocked(bio, view(2, "biotech"))).toBe(true);
		expect(lockText(bio, view(2))).toMatch(/^Unlocks at Level 5/);
		expect(lockText(bio, view(5))).toBeNull();
	});
	it("newlyOpen reports only what was not announced", () => {
		expect(newlyOpen(["a", "b", "c"], ["a", "c"])).toEqual(["b"]);
	});
	it("the Primer is offered once, after the tutorial, and never if it was opened", () => {
		expect(shouldNudge(false, { opened: false, nudged: false })).toBe(false);
		expect(shouldNudge(true, { opened: false, nudged: false })).toBe(true);
		expect(shouldNudge(true, { opened: true, nudged: false })).toBe(false);
		expect(shouldNudge(true, { opened: false, nudged: true })).toBe(false);
	});
});

describe("links and search", () => {
	it("old Encyclopedia ids that have a chapter now open it", () => {
		expect(primerTarget("basics:cooling")).toBe("ch:heat");
		expect(primerTarget("fac:chiller")).toBe("fac:chiller");
		for (const k of HELP_KEYS) expect(chapters.some((c) => c.id === primerTarget(HELP[k].entry)) || entries.some((e) => e.id === primerTarget(HELP[k].entry)), k).toBe(true);
	});
	it("search finds chiller and uptime in chapters and reference", () => {
		for (const word of ["chiller", "uptime"]) {
			expect(chapters.some((c) => c.keywords.includes(word)), word).toBe(true);
			expect(searchEntries(entries, word).length, word).toBeGreaterThan(0);
		}
		expect(entries.some((e) => e.section === "facilities" && e.title.toLowerCase().includes("chiller"))).toBe(true);
	});
});

describe("jargon", () => {
	const gloss = new Set(TERMS.flatMap((t) => [t.id, t.name.toLowerCase(), ...(t.aka ?? "").split(/\s+/)]));
	const copy = [...chapters.flatMap((c) => c.blocks.map((b) => b.p)), ...HELP_KEYS.map((k) => HELP[k].text)].join(" ");
	it("every technical term used in Primer and help copy has a glossary entry", () => {
		const terms = ["PUE", "CDU", "CRAH", "UPS", "COP", "DLC", "RP", "PF", "PFLOPS", "kW", "MW", "kWh", "Chiller", "Genset", "Throttle", "Brownout", "Uptime", "Rack", "Reputation", "Overlay", "PDU", "SLA", "SLO", "MTBF", "TDP", "PPA", "WUE"];
		for (const t of terms) if (new RegExp(`\\b${t}\\b`, "i").test(copy)) expect(gloss.has(t.toLowerCase()), t).toBe(true);
	});
	it("any other ALL-CAPS word in chapter copy is a known label", () => {
		const ok = new Set(["NO", "POWER", "BROKEN", "HOT", "COOLANT", "PER", "HOUR", "PF", "MW", "FORM", "A", "RP", "AI", "UNIT", "DLC", "CDU", "NEXT", "PV"]);
		const caps = chapters.flatMap((c) => c.blocks.flatMap((b) => b.p.match(/\b[A-Z]{2,}\b(?!-)/g) ?? []));
		for (const w of caps) expect(ok.has(w) || gloss.has(w.toLowerCase()), w).toBe(true);
	});
});

describe("Speak the language", () => {
	it("every core chapter has a block of at least three terms, and every term id resolves", () => {
		for (const c of core) expect(c.terms?.length ?? 0, c.id).toBeGreaterThanOrEqual(3);
		for (const c of chapters) for (const id of c.terms ?? []) expect(termById(id), `${c.id}:${id}`).toBeDefined();
	});
	it("covers the required vocabulary, each term taught in a chapter", () => {
		const taught = new Set(core.flatMap((c) => c.terms ?? []));
		for (const id of ["it-load", "rack-density", "pdu", "ups", "redundancy", "crah", "crac", "aisle", "chiller", "cdu", "dlc", "immersion", "pue", "wue", "tdp", "throttle", "mtbf", "uptime", "nines", "sla", "slo", "inference", "training", "checkpointing", "pflops", "utilisation", "capex", "ppa", "heat-reuse"]) expect(taught.has(id), id).toBe(true);
	});
	it("terms have unique ids, a definition and an AItower line, and point at a real chapter", () => {
		expect(new Set(TERMS.map((t) => t.id)).size).toBe(TERMS.length);
		for (const t of TERMS) {
			expect(t.def.length, t.id).toBeGreaterThan(20);
			expect(t.game.length, t.id).toBeGreaterThan(5);
			expect(t.at === "words" || chapters.some((c) => c.id === t.at), t.id).toBe(true);
		}
	});
	it("chapter search finds the jargon", () => {
		for (const w of ["pue", "crah", "n+1", "immersion"]) expect(chapters.some((c) => c.keywords.includes(w)), w).toBe(true);
	});
});

describe("chapter epigraphs", () => {
	it("every chapter has a real quote that is recorded in docs/QUOTES.md with a URL", async () => {
		const { readFileSync } = await import("node:fs");
		const docs = readFileSync(new URL("../../../../docs/QUOTES.md", import.meta.url), "utf8");
		for (const c of chapters) {
			expect(c.flavor, c.id).toBeDefined();
			const row = docs.split("\n").find((l) => l.startsWith(`| \`${c.id}\` |`));
			expect(row, c.id).toContain(c.flavor?.quote);
			expect(row, c.id).toMatch(/https?:\/\/\S+/);
		}
	});
});
