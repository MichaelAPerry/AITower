import { loadContent } from "@aitower/content";
import type { GameState, GameStore } from "@aitower/shared";
import type { DecisionView } from "@aitower/sim";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DecisionCard } from "./DecisionCard";

const content = loadContent();

function render(eventId: string): string {
	const ev = content.events.find((e) => e.id === eventId);
	if (!ev) throw new Error(`no event ${eventId}`);
	const decision: DecisionView = { id: 1, eventId, advisor: ev.advisor, category: ev.category, title: ev.title, body: ev.body, choices: ev.choices.map((c) => ({ id: c.id, label: c.label, hint: c.hint })), recommended: ev.recommended, votes: ev.votes, issuedAt: 0, canDefer: true };
	const state = { view: { decision, corruption: 0 }, settings: { horrorIntensity: "full" } } as unknown as GameState;
	return renderToString(<DecisionCard store={{ dispatch: () => ({ ok: true }) } as unknown as GameStore} content={content} state={state} />);
}

describe("decision card", () => {
	it("a multi-area decision shows Cass, Bea and Mel voting with a reason each, then Luci naming the price", () => {
		const html = render("heatwave");
		expect(html).toContain("MAGI vote");
		const at = (s: string) => html.indexOf(s);
		expect(at("Cass")).toBeGreaterThan(-1);
		expect(at("Bea")).toBeGreaterThan(at("Cass"));
		expect(at("Mel")).toBeGreaterThan(at("Bea"));
		expect(at("Luci")).toBeGreaterThan(at("Mel"));
		expect(html).toMatch(/Approve|Reject/);
		expect(html).toContain("costs $90k");
		expect(html).toContain("2 to 1 for");
	});
	it("a single-area decision has no vote, one recommended option, the effect chips and a defer button", () => {
		const html = render("surprise_audit");
		expect(html).not.toContain("MAGI vote");
		expect(html.match(/adv-opt is-rec/g)?.length).toBe(1);
		expect(html.match(/Recommended by Luci/g)?.length).toBe(1);
		expect(html).toContain("−$120k");
		expect(html).not.toContain("★");
		expect(html).toContain("Defer one day");
		expect(html).toContain("Luci Ferro");
	});
	it("affinity effects are path-coloured pills", () => {
		const html = render("brownout");
		expect(html).toContain("ui-pathchip");
		expect(html).toContain("Garden +3");
	});
});
