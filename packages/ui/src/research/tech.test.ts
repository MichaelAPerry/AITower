import type { ContentDB, TechNode } from "@aitower/content";
import type { SimView } from "@aitower/sim";
import { describe, expect, it } from "vitest";
import { branchNodes, cheapestAvailable, clerkNode, effectText, fmtFactor, fmtRp, nodeState, requirementList, techGate, unlocksFor } from "./tech";

const node = (n: Partial<TechNode> & Pick<TechNode, "id">): TechNode => ({ name: n.id, description: "", branch: "compute", minTier: 1, cost: 10, requires: [], effects: [], ...n });
const TECH: TechNode[] = [
	node({ id: "a", name: "Alpha", cost: 10, effects: [{ type: "perk", kind: "failureRate", factor: 0.9 }] }),
	node({ id: "b", name: "Beta", cost: 30, requires: ["a"], minTier: 2 }),
	node({ id: "c", name: "Clerk Forms", cost: 20, branch: "administration", effects: [{ type: "feature", feature: "contractsClerk" }] }),
	node({ id: "d", name: "Delta", cost: 5, branch: "cooling", minTier: 3, requires: ["a", "b"] }),
];
const content = {
	tech: TECH,
	facilities: { cdu: { id: "cdu", name: "CDU", tech: "b" }, crah: { id: "crah", name: "CRAH" } },
	bots: { drone: { id: "drone", name: "Drone", tech: "b" }, techbot: { id: "techbot", name: "TechBot" } },
	balance: { clerk: { feeShare: 0.05 } },
} as unknown as ContentDB;
const view = (p: Partial<SimView> = {}): SimView => ({ tier: 1, researchPoints: 0, techResearched: [], ...p }) as unknown as SimView;

describe("nodeState", () => {
	it("researched wins over everything", () => {
		expect(nodeState(TECH[0], view({ techResearched: ["a"] }), content)).toEqual({ kind: "researched" });
	});
	it("available when points suffice; poor (with the shortfall) when not", () => {
		expect(nodeState(TECH[0], view({ researchPoints: 10 }), content)).toEqual({ kind: "available" });
		expect(nodeState(TECH[0], view({ researchPoints: 4.5 }), content)).toEqual({ kind: "poor", short: 6 });
	});
	it("locked by clearance, naming the level", () => {
		const s = nodeState(TECH[1], view({ tier: 1, techResearched: ["a"], researchPoints: 99 }), content);
		expect(s).toEqual({ kind: "locked", reason: "Requires Clearance 2" });
	});
	it("locked by a missing prerequisite, naming it", () => {
		const s = nodeState(TECH[1], view({ tier: 2, researchPoints: 99 }), content);
		expect(s).toEqual({ kind: "locked", reason: "Requires Alpha" });
	});
	it("lists every missing reason; locked beats poor", () => {
		const s = nodeState(TECH[3], view({ tier: 1, researchPoints: 0 }), content);
		expect(s).toEqual({ kind: "locked", reason: "Requires Clearance 3 and Alpha and Beta" });
	});
	it("treats a missing techResearched as empty", () => {
		expect(nodeState(TECH[0], { tier: 1, researchPoints: 99 } as unknown as SimView, content).kind).toBe("available");
	});
});

describe("effect text", () => {
	it("perks read as plain percentages", () => {
		expect(effectText({ type: "perk", kind: "failureRate", factor: 0.9 })).toBe("−10 % failure rate");
		expect(effectText({ type: "perk", kind: "repairSpeed", factor: 1.25 })).toBe("+25 % repair speed");
		expect(effectText({ type: "perk", kind: "energyPrice", factor: 0.925 })).toBe("−7.5 % energy price");
		expect(effectText({ type: "perk", kind: "researchRate", factor: 1.5 })).toBe("+50 % research points earned");
	});
	it("fmtFactor handles round-off", () => {
		expect(fmtFactor(0.95)).toBe("−5 %");
		expect(fmtFactor(1.1)).toBe("+10 %");
	});
	it("the clerk feature mentions the fee when the balance is known", () => {
		expect(effectText({ type: "feature", feature: "contractsClerk" }, content)).toBe("Contracts Clerk: accepts offers for you (keeps 5 % of each job it books)");
		expect(effectText({ type: "feature", feature: "contractsClerk" })).toBe("Contracts Clerk: accepts offers for you");
	});
});

describe("unlocks, ordering and lookups", () => {
	it("Unlocks scans facilities and bots for their tech", () => {
		expect(unlocksFor("b", content)).toEqual(["CDU", "Drone"]);
		expect(unlocksFor("a", content)).toEqual([]);
	});
	it("branch nodes sort by clearance then cost", () => {
		expect(branchNodes(content, "compute").map((t) => t.id)).toEqual(["a", "b"]);
	});
	it("cheapest available skips locked and unaffordable nodes", () => {
		expect(cheapestAvailable(view({ researchPoints: 100 }), content)?.id).toBe("a");
		expect(cheapestAvailable(view({ researchPoints: 15 }), content)?.id).toBe("a");
		expect(cheapestAvailable(view({ researchPoints: 5 }), content)).toBeUndefined();
		expect(cheapestAvailable(view({ researchPoints: 100, techResearched: ["a"] }), content)?.id).toBe("c");
	});
	it("no tech in content means nothing to research", () => {
		expect(cheapestAvailable(view({ researchPoints: 999 }), { ...content, tech: [] } as unknown as ContentDB)).toBeUndefined();
	});
	it("finds the clerk node and the prerequisite list", () => {
		expect(clerkNode(content)?.id).toBe("c");
		expect(requirementList(TECH[3], view({ techResearched: ["a"] }), content)).toEqual([
			{ id: "a", name: "Alpha", done: true },
			{ id: "b", name: "Beta", done: false },
		]);
	});
	it("RP shows whole points", () => {
		expect(fmtRp(12.9)).toBe("12 RP");
		expect(fmtRp(-1)).toBe("0 RP");
		expect(fmtRp(1500)).toBe("1,500 RP");
	});
});

describe("techGate (build palette)", () => {
	it("blocks items whose tech is not researched, naming it", () => {
		expect(techGate("b", view(), content)).toBe("Requires research: Beta");
		expect(techGate("b", view({ techResearched: ["b"] }), content)).toBeNull();
	});
	it("items without tech are never blocked; an unknown id falls back to the id", () => {
		expect(techGate(undefined, view(), content)).toBeNull();
		expect(techGate("zzz", view(), content)).toBe("Requires research: zzz");
	});
});
