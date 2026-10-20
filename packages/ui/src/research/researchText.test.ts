import { describe, expect, it } from "vitest";
import { createFakeContent, createFakeStore } from "../dev/fakeStore";
import { branchView, chain, defaultBranch, defaultPick, etaText, getLines, groupOf, rpPerHour, tabsFor, whyText } from "./researchText";

const content = createFakeContent();
const view = () => ({ ...createFakeStore(content).get().view, tier: 1 });
const node = (id: string) => content.tech.find((t) => t.id === id) as (typeof content.tech)[number];

describe("research grouping", () => {
	it("groups done, ready, next-up and later; far nodes are only counted", () => {
		const v = { ...view(), techResearched: ["cmp_burnin"] };
		expect(groupOf(node("cmp_burnin"), v, content)).toBe("done");
		expect(groupOf(node("cmp_binning"), v, content)).toBe("next"); // level 2 needed, tier 1 now
		expect(groupOf(node("cmp_cluster"), v, content)).toBe("later"); // two steps away
		const b = branchView(content, v, "compute");
		expect(b.done.map((n) => n.id)).toEqual(["cmp_burnin"]);
		expect(b.laterCount).toBe(1);
	});
	it("a prerequisite that is ready makes its follower 'next'", () => {
		expect(groupOf(node("cmp_binning"), view(), content)).toBe("next");
	});
	it("picks something startable by default", () => {
		const v = view();
		expect(defaultPick(content, v, "compute")).toBe("cmp_burnin");
		expect(["compute", "cooling", "power", "logistics", "administration"]).toContain(defaultBranch(content, v));
		expect(tabsFor(content, v).map((t) => t.id)).not.toContain("wetware");
	});
});

describe("research copy", () => {
	it("every node has a what-you-get and a why", () => {
		for (const n of content.tech) {
			expect(whyText(n, content).length).toBeGreaterThan(10);
			expect(getLines(n, content).length + n.effects.length).toBeGreaterThanOrEqual(0);
		}
		expect(getLines(node("cool_exchange"), content).some((l) => l.title.startsWith("Build: Chiller"))).toBe(true);
	});
	it("chain lists prerequisites and clearance with ticks", () => {
		const c = chain(node("cmp_binning"), { ...view(), techResearched: ["cmp_burnin"] }, content);
		expect(c).toEqual([
			{ id: "cmp_burnin", name: "Burn-in Protocol", done: true },
			{ id: "_tier", name: "Level 2", done: false },
		]);
	});
	it("estimates time from the current rate", () => {
		const v = view();
		expect(rpPerHour(v, content)).toBeCloseTo(v.pflops * 0.01);
		expect(etaText(10, v, content)).toMatch(/enough/);
		expect(etaText(1e6, v, content)).toMatch(/about .* of game time/);
		expect(etaText(1e6, { ...v, pflops: 0 }, content)).toMatch(/No points/);
	});
});
