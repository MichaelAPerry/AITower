import { loadContent } from "@aitower/content";
import type { SimView } from "@aitower/sim";
import { describe, expect, it } from "vitest";
import { isMasked, leadsTo, stateSignature, treeState } from "./treeState";

const content = loadContent();
const by = (id: string) => content.tech.find((t) => t.id === id) as (typeof content.tech)[number];
const view = (p: Partial<SimView> = {}): SimView => ({ tier: 1, researchPoints: 0, techResearched: [], path: undefined, ...p }) as unknown as SimView;

describe("treeState", () => {
	it("done, available, poor, locked by prerequisite and locked by Level", () => {
		expect(treeState(by("contracts_clerk"), view({ techResearched: ["contracts_clerk"] }), content)).toBe("done");
		expect(treeState(by("contracts_clerk"), view({ researchPoints: 9999 }), content)).toBe("avail");
		expect(treeState(by("contracts_clerk"), view({ researchPoints: 1 }), content)).toBe("poor");
		// reading_room needs the clerk first, but is Level 1: a prerequisite lock.
		expect(treeState(by("reading_room"), view({ researchPoints: 9999 }), content)).toBe("locked");
		// vendor_stamp is Level 2: the Level lock shows even though a prerequisite is also missing.
		expect(treeState(by("vendor_stamp"), view({ researchPoints: 9999 }), content)).toBe("lvl");
		expect(treeState(by("vendor_stamp"), view({ tier: 2, techResearched: ["contracts_clerk"], researchPoints: 9999 }), content)).toBe("locked");
		expect(treeState(by("vendor_stamp"), view({ tier: 2, techResearched: ["contracts_clerk", "reading_room"], researchPoints: 9999 }), content)).toBe("avail");
	});

	it("a path node stays locked until its path is chosen", () => {
		const g = by("canopy_array");
		expect(g.path).toBe("greentech");
		expect(treeState(g, view({ tier: 5, researchPoints: 99999, techResearched: g.requires }), content)).toBe("locked");
		expect(treeState(g, view({ tier: 5, researchPoints: 99999, techResearched: g.requires, path: "greentech" }), content)).toBe("avail");
	});

	it("signature changes with a state change, not with points that change nothing", () => {
		const a = stateSignature(content, view({ researchPoints: 1 }));
		const b = stateSignature(content, view({ researchPoints: 2 }));
		const c = stateSignature(content, view({ researchPoints: 9999 }));
		expect(a.sig).toBe(b.sig);
		expect(a.sig).not.toBe(c.sig);
		expect(a.states.size).toBe(content.tech.length);
	});

	it("leadsTo lists the techs that need a node", () => {
		expect(leadsTo(content, "contracts_clerk").map((t) => t.id)).toContain("reading_room");
	});
});

describe("spoiler masking", () => {
	it("hides wetware and biotech-path details until the node can be started, and only those", () => {
		const wet = by("wetware_annex");
		const bio = by("tissue_scaffolds");
		for (const n of [wet, bio]) {
			expect(isMasked(n, "locked")).toBe(true);
			expect(isMasked(n, "lvl")).toBe(true);
			expect(isMasked(n, "avail")).toBe(false);
			expect(isMasked(n, "poor")).toBe(false);
			expect(isMasked(n, "done")).toBe(false);
		}
		expect(isMasked(by("contracts_clerk"), "locked")).toBe(false);
		expect(isMasked(by("canopy_array"), "locked")).toBe(false);
	});
});
