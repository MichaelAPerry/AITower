import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent, validateContent } from "./load";
import type { ContentDB, Flavor } from "./schema";

const docs = readFileSync(new URL("../../../docs/QUOTES.md", import.meta.url), "utf8");
const rows = docs.split("\n").filter((l) => l.startsWith("| `"));

const flavors = (db: ContentDB): { id: string; f: Flavor }[] => [
	...Object.values(db.facilities).flatMap((d) => (d.flavor ? [{ id: d.id, f: d.flavor }] : [])),
	...db.tech.flatMap((n) => (n.flavor ? [{ id: n.id, f: n.flavor }] : [])),
	...Object.values(db.bots).flatMap((b) => (b.flavor ? [{ id: b.id, f: b.flavor }] : [])),
];

describe("flavor validation", () => {
	const withFlavor = (f: unknown): string[] => {
		const db = loadContent();
		const d = db.facilities.rack_air_gpu as { flavor?: unknown };
		const before = d.flavor;
		d.flavor = f;
		try {
			return validateContent(db);
		} finally {
			d.flavor = before;
		}
	};
	it("accepts a good quote, with or without a source", () => {
		expect(withFlavor({ quote: "Simplicity is prerequisite for reliability.", author: "Edsger W. Dijkstra", source: "EWD498" })).toEqual([]);
		expect(withFlavor({ quote: "Simplicity is prerequisite for reliability.", author: "Edsger W. Dijkstra" })).toEqual([]);
	});
	it("rejects empty or over-long quotes, missing authors and bad shapes", () => {
		expect(withFlavor({ quote: "", author: "A" }).join()).toMatch(/flavor\.quote/);
		expect(withFlavor({ quote: "x".repeat(201), author: "A" }).join()).toMatch(/at most 200/);
		expect(withFlavor({ quote: "Fine.", author: " " }).join()).toMatch(/flavor\.author/);
		expect(withFlavor({ quote: "Fine.", author: "A", source: "" }).join()).toMatch(/flavor\.source/);
		expect(withFlavor("just a string").join()).toMatch(/flavor/);
	});
});

describe("flavor quotes", () => {
	const db = loadContent();
	it("covers every buildable facility, tech node and bot, within the word limit", () => {
		const buildable = Object.values(db.facilities).filter((d) => !d.retired && !d.growth);
		for (const d of buildable) expect(d.flavor, d.id).toBeDefined();
		for (const n of db.tech) expect(n.flavor, n.id).toBeDefined();
		for (const b of Object.values(db.bots)) expect(b.flavor, b.id).toBeDefined();
		for (const { id, f } of flavors(db)) expect(f.quote.split(/\s+/).length, id).toBeLessThanOrEqual(25);
	});
	it("lists every quote in docs/QUOTES.md with the item id, author and a verification URL", () => {
		for (const { id, f } of flavors(db)) {
			const row = rows.find((r) => r.startsWith(`| \`${id}\` |`));
			expect(row, `${id} missing from docs/QUOTES.md`).toBeDefined();
			expect(row, id).toContain(f.quote);
			expect(row, id).toContain(f.author);
			expect(row, id).toMatch(/https?:\/\/\S+/);
		}
	});
});
