import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Jargon, Term, TermScope } from "./Term";
import { TERMS } from "./terms";

describe("Term", () => {
	it("renders a known id with an underline hook, and an unknown id as plain text", () => {
		expect(renderToStaticMarkup(<Term id="pue">PUE</Term>)).toContain('data-term="pue"');
		expect(renderToStaticMarkup(<Term id="no-such-term">x</Term>)).toBe("x");
	});
	it("underlines only the first occurrence per scope", () => {
		const html = renderToStaticMarkup(
			<TermScope>
				<Term id="pue">PUE</Term> and <Term id="pue">PUE</Term>
			</TermScope>,
		);
		expect(html.match(/data-term="pue"/g)).toHaveLength(1);
	});
	it("Jargon links known words in copy and every id it can emit exists", () => {
		const html = renderToStaticMarkup(<Jargon text="A CDU and a CRAH feed 40 kW, under an SLA. N+1 inference at 12 PF" />);
		for (const id of ["cdu", "crah", "kw", "sla", "redundancy", "inference", "pflops"]) expect(html, id).toContain(`data-term="${id}"`);
		expect(TERMS.some((t) => t.id === "redundancy")).toBe(true);
	});
});
