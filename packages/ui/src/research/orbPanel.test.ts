import { loadContent } from "@aitower/content";
import type { SimView } from "@aitower/sim";
import { describe, expect, it } from "vitest";
import { laneName, laneOf } from "./lanes";
import { goalProgress, panelFacts } from "./orbPanel";

const content = loadContent();
const by = (id: string) => content.tech.find((t) => t.id === id) as (typeof content.tech)[number];
const view = (p: Partial<SimView> = {}): SimView => ({ tier: 1, researchPoints: 0, techResearched: [], path: undefined, ...p }) as unknown as SimView;

describe("side panel facts", () => {
	it("ready: cost, have, nothing short, and Start is allowed", () => {
		const f = panelFacts(by("contracts_clerk"), view({ researchPoints: 500 }), content);
		expect(f).toMatchObject({ state: "ready", cost: 180, have: 500, short: 0, why: null });
		expect(f.eta).toBe("You have enough right now.");
	});
	it("short of points: says how many and gives an ETA or the reason there is none", () => {
		const f = panelFacts(by("contracts_clerk"), view({ researchPoints: 100 }), content);
		expect(f).toMatchObject({ state: "short", short: 80, have: 100 });
		expect(f.why).toContain("Need 80 more RP");
		expect(f.eta).toContain("No points are coming in");
	});
	it("locked: names what is needed first, with a tick for what is done, and the reason in words", () => {
		const f = panelFacts(by("vendor_stamp"), view({ researchPoints: 9999, techResearched: ["reading_room"] }), content);
		expect(f.state).toBe("locked");
		expect(f.needs.map((s) => [s.name, s.done])).toContainEqual(["Research Library Access", true]);
		expect(f.needs.some((s) => !s.done)).toBe(true);
		expect(f.why).toMatch(/^First: /);
	});
	it("done: no ETA, no reason", () => {
		const f = panelFacts(by("contracts_clerk"), view({ techResearched: ["contracts_clerk"] }), content);
		expect(f).toMatchObject({ state: "done", eta: "", why: null });
	});
	it("leads to the follow-ups, and keeps Flesh techs sealed", () => {
		const f = panelFacts(by("contracts_clerk"), view(), content);
		expect(f.leads.length).toBeGreaterThan(0);
		expect(f.leads.every((t) => t.requires.includes("contracts_clerk"))).toBe(true);
		const sealed = panelFacts(by("neural_pit_dossier"), view(), content);
		expect(sealed.masked).toBe(true);
	});
});

describe("goal and names", () => {
	it("goal progress is the share of the cost in hand, between 0 and 1", () => {
		expect(goalProgress(1000, 250)).toBe(0.25);
		expect(goalProgress(1000, 5000)).toBe(1);
		expect(goalProgress(0, 0)).toBe(0);
	});
	it("the three trees use their HUD names", () => {
		expect(laneName("syn", content)).toBe("Lattice");
		expect(laneName("wet", content)).toBe("Flesh");
		expect(laneName("green", content)).toBe("Garden");
		expect(laneName(laneOf(by("contracts_clerk")), content)).toBe("Administration");
	});
});
