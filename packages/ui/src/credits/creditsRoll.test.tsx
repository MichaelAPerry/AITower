import { loadContent } from "@aitower/content";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SONGS } from "../title/titleMusic";
import { CreditsRoll, canSkip, ROLL_SECONDS } from "./CreditsRoll";
import { citation, creditLines, creditQuotes, musicCreditLines, rollFor } from "./credits";
import { CreditsPane } from "./CreditsPane";

const esc = (t: string): string => renderToStaticMarkup(<span>{t}</span>).replace(/^<span>|<\/span>$/g, "");

describe("the ending credits roll", () => {
	const content = loadContent();

	it("rolls after the three success endings only, set to that tree's song", () => {
		expect(rollFor("singularity")).toEqual({ tree: "lattice", song: "lattice" });
		expect(rollFor("flesh")).toEqual({ tree: "flesh", song: "flesh" });
		expect(rollFor("garden")).toEqual({ tree: "garden", song: "garden" });
		expect(rollFor("absorbed")).toBeNull();
		expect(rollFor("bankrupt" as never)).toBeNull();
	});

	it("shows the ending theme first, as tagged, and highlights it in the music list", () => {
		for (const tree of ["lattice", "flesh", "garden"] as const) {
			const html = renderToStaticMarkup(<CreditsRoll tree={tree} song={tree} content={content} onDone={() => {}} />);
			expect(html).toContain(esc(`Ending theme: ${SONGS[tree].title}`));
			expect(html.indexOf("data-credit-theme")).toBeLessThan(html.indexOf("data-credit-music"));
			expect(html).toContain(`class="is-playing">${esc(`${SONGS[tree].label}: ${SONGS[tree].title}`)}`);
			expect(html).toContain("data-credits-skip");
			expect(html).toContain(`data-credits-roll="${tree}"`);
		}
	});

	it("takes its content from the shared credits data (same lines and quotes as the menu section)", () => {
		const roll = renderToStaticMarkup(<CreditsRoll tree="flesh" song="flesh" content={content} onDone={() => {}} />);
		const pane = renderToStaticMarkup(<CreditsPane content={content} />);
		for (const l of [...creditLines(), ...musicCreditLines().map((m) => m.text)]) {
			expect(roll).toContain(esc(l));
			expect(pane).toContain(esc(l));
		}
		const quotes = creditQuotes(content);
		for (const q of quotes) expect(roll, q.item).toContain(esc(`— ${citation(q.flavor)}`));
		expect((roll.match(/<blockquote>/g) ?? []).length).toBe(quotes.length);
	});

	it("lasts about three minutes and can be skipped after the first second", () => {
		expect(ROLL_SECONDS).toBeGreaterThanOrEqual(150);
		expect(ROLL_SECONDS).toBeLessThanOrEqual(210);
		expect(canSkip(200)).toBe(false);
		expect(canSkip(1000)).toBe(true);
	});
});
