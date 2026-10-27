/** The Trees panel's data (docs/REFRAME.md): three cards, four rungs each, and plain next-step text. */
import { loadContent } from "@aitower/content";
import type { SimView } from "@aitower/sim";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createFakeContent, createFakeStore } from "../dev/fakeStore";
import { TreesPanel } from "./TreesPanel";
import { treeCards } from "./soul";

const content = loadContent();
const view = (): SimView => createFakeStore(createFakeContent()).get().view;

describe("Trees panel", () => {
	it("one card per tree, four rungs each, with a next step that names the research or the retrofit", () => {
		const v = { ...view(), tier: 1, techResearched: [] as string[] };
		const cards = treeCards(v, content);
		expect(cards.map((c) => c.tree)).toEqual(["synthetic", "biotech", "greentech"]);
		for (const c of cards) {
			expect(c.ladder).toHaveLength(4);
			expect(c.next).toMatch(/^Next: /);
		}
		expect(cards[1].next).toMatch(/research/i);
		expect(cards[0].seal).toBeNull();
		expect(cards[2].factor[0]).toMatch(/clean power/);
	});
	it("renders the three columns and a close path", () => {
		const html = renderToString(<TreesPanel view={view()} content={content} onClose={() => {}} />);
		expect((html.match(/trees-col/g) ?? []).length).toBeGreaterThanOrEqual(3);
		expect(html).toContain("The Lattice");
	});
});
