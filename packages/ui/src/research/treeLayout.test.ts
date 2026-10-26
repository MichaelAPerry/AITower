import { loadContent } from "@aitower/content";
import type { TechNode } from "@aitower/content";
import { describe, expect, it } from "vitest";
import { NODE_H, NODE_W, layoutFor, layoutTree, lanesOf, neighbor, wrapName } from "./treeLayout";

const content = loadContent();

describe("tree layout (real content)", () => {
	const layout = layoutFor(content);

	it("places all 68 techs, in 8 lanes and 5 Level columns, with no two nodes overlapping", () => {
		expect(layout.nodes).toHaveLength(content.tech.length);
		expect(layout.lanes).toHaveLength(8);
		expect(layout.tiers.map((t) => t.tier)).toEqual([1, 2, 3, 4, 5]);
		const ns = layout.nodes;
		for (let i = 0; i < ns.length; i++)
			for (let j = i + 1; j < ns.length; j++) {
				const a = ns[i];
				const b = ns[j];
				const apart = a.x + NODE_W <= b.x || b.x + NODE_W <= a.x || a.y + NODE_H <= b.y || b.y + NODE_H <= a.y;
				expect(apart, `${a.id} overlaps ${b.id}`).toBe(true);
			}
	});

	it("keeps every node inside its Level column and its lane band", () => {
		const tier = new Map(layout.tiers.map((t) => [t.tier, t]));
		const lane = new Map(layout.lanes.map((l) => [l.id, l]));
		for (const n of layout.nodes) {
			const t = tier.get(n.tier);
			const l = lane.get(n.lane);
			expect(t && n.x >= t.x && n.x + NODE_W <= t.x + t.w, `${n.id} column`).toBe(true);
			expect(l && n.y >= l.y && n.y + NODE_H <= l.y + l.h, `${n.id} lane`).toBe(true);
		}
		expect(layout.width).toBeGreaterThan(layout.tiers.at(-1)?.x ?? 0);
		expect(layout.height).toBeGreaterThan(layout.lanes.at(-1)?.y ?? 0);
	});

	it("has one edge per prerequisite, endpoints that exist, and every edge runs left to right", () => {
		const total = content.tech.reduce((n, t) => n + t.requires.length, 0);
		expect(layout.edges).toHaveLength(total);
		for (const e of layout.edges) {
			const a = layout.byId.get(e.from);
			const b = layout.byId.get(e.to);
			expect(a, e.from).toBeDefined();
			expect(b, e.to).toBeDefined();
			expect((a?.x ?? 0) + NODE_W, `${e.from} -> ${e.to}`).toBeLessThanOrEqual(b?.x ?? 0);
			expect(e.cross).toBe(a?.lane !== b?.lane);
			expect(e.d.startsWith("M")).toBe(true);
		}
		expect(layout.edges.some((e) => e.cross)).toBe(true);
	});

	it("stacks Cooling by line: air above liquid above immersion", () => {
		const y = (id: string) => layout.byId.get(id)?.y ?? 0;
		expect(y("desk_fan_standard")).toBeLessThan(y("chilled_loop"));
		expect(y("chilled_loop")).toBeLessThan(y("two_phase_immersion"));
		const cool = layout.lanes.find((l) => l.id === "cool");
		expect(cool?.bands.map((b) => b.line)).toEqual(["air", "liquid", "immersion"]);
	});

	it("is deterministic and cached", () => {
		const again = layoutTree(content.tech, lanesOf(content));
		expect(again.nodes.map((n) => [n.id, n.x, n.y])).toEqual(layout.nodes.map((n) => [n.id, n.x, n.y]));
		expect(again.edges.map((e) => e.d)).toEqual(layout.edges.map((e) => e.d));
		expect(layoutFor(content)).toBe(layout);
	});

	it("leaves a hidden lane out, with the edges that touched it", () => {
		const less = layoutFor(content, ["wet"]);
		expect(less.lanes.some((l) => l.id === "wet")).toBe(false);
		expect(less.nodes.length).toBe(content.tech.filter((t) => t.lane !== "wet").length);
		for (const e of less.edges) expect(less.byId.has(e.from) && less.byId.has(e.to)).toBe(true);
	});

	it("moves keyboard focus to the neighbour in the arrow's direction", () => {
		expect(neighbor(layout, "contracts_clerk", "right")).not.toBeNull();
		expect(neighbor(layout, "contracts_clerk", "left")).toBeNull();
		const down = neighbor(layout, "contracts_clerk", "down");
		expect((layout.byId.get(down ?? "")?.y ?? 0) > (layout.byId.get("contracts_clerk")?.y ?? 0)).toBe(true);
	});
});

describe("tree layout (small cases)", () => {
	const n = (id: string, o: Partial<TechNode> = {}): TechNode => ({ id, name: id, description: "", branch: "compute", lane: "comp", minTier: 1, cost: 1, requires: [], effects: [], ...o });

	it("puts a same-Level child one slot to the right of its parent, and a lone child on its parent's row", () => {
		const l = layoutTree([n("a"), n("b", { requires: ["a"] }), n("c", { requires: ["b"], minTier: 2 })], lanesOf(content));
		const [a, b, c] = ["a", "b", "c"].map((id) => l.byId.get(id) as NonNullable<ReturnType<typeof l.byId.get>>);
		expect(b.x).toBeGreaterThan(a.x + NODE_W - 1);
		expect(b.y).toBe(a.y);
		expect(c.x).toBeGreaterThan(b.x + NODE_W - 1);
	});

	it("gives siblings in the same column their own rows", () => {
		const l = layoutTree([n("a"), n("b", { requires: ["a"], minTier: 2 }), n("c", { requires: ["a"], minTier: 2 })], lanesOf(content));
		expect(l.byId.get("b")?.y).not.toBe(l.byId.get("c")?.y);
	});

	it("ignores prerequisites outside the node set and falls back to the branch when a node has no lane", () => {
		const l = layoutTree([n("a", { lane: undefined, branch: "power", requires: ["ghost"] })], lanesOf(content));
		expect(l.edges).toEqual([]);
		expect(l.byId.get("a")?.lane).toBe("pow");
	});
});

describe("wrapName", () => {
	it("keeps short names whole, wraps at a word, and ends a cut name with an ellipsis", () => {
		expect(wrapName("Surge Protection")).toEqual(["Surge Protection"]);
		expect(wrapName("Authority Framework Agreement")).toEqual(["Authority Framework", "Agreement"]);
		expect(wrapName("A".repeat(40))[0]).toHaveLength(22);
		const long = wrapName("Alpha Beta Gamma Delta Epsilon Zeta Eta Theta Iota Kappa");
		expect(long[1]?.endsWith("…")).toBe(true);
	});
});
