import { achievementContent, loadContent } from "@aitower/content";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CHAPTER_FLAVOR } from "../handbook/chapters";
import { CreditsPane } from "./CreditsPane";
import { citation, creditQuotes } from "./credits";

const esc = (t: string): string => renderToStaticMarkup(<span>{t}</span>).replace(/^<span>|<\/span>$/g, "");

describe("the credits screen", () => {
	const content = loadContent();
	const quotes = creditQuotes(content);

	it("collects every quote in the content data and the Handbook, with an author", () => {
		const fromData = [...Object.values(content.facilities), ...content.tech, ...Object.values(content.bots)].filter((d) => d.flavor);
		expect(quotes.length).toBe(fromData.length + Object.keys(CHAPTER_FLAVOR).length);
		expect(quotes.length).toBeGreaterThan(100);
		for (const q of quotes) expect(q.flavor.author.trim(), q.item).not.toBe("");
	});

	it("renders the credit lines and every quote with its author and source", () => {
		const html = renderToStaticMarkup(<CreditsPane content={content} />);
		for (const l of [achievementContent.ui.creditsCode, achievementContent.ui.creditsArt, achievementContent.ui.creditsInspired]) expect(html).toContain(esc(l));
		expect((html.match(/class="cr-quote"/g) ?? []).length).toBe(quotes.length);
		for (const q of quotes) {
			expect(html, q.item).toContain(esc(`“${q.flavor.quote}”`));
			expect(html, q.item).toContain(esc(`— ${citation(q.flavor)}`));
		}
	});

	it("does not spoil the plot", () => {
		const u = achievementContent.ui;
		const text = [u.creditsCode, u.creditsArt, u.creditsInspired, u.creditsQuotes].join(" ").toLowerCase();
		for (const w of ["seal", "bond", "bankrupt", "absorbed"]) expect(text).not.toContain(w);
	});
});
