import { readFileSync } from "node:fs";
import { loadContent } from "@aitower/content";
import type { SimView } from "@aitower/sim";
import { describe, expect, it } from "vitest";
import { LEAF_ZOOM, MAX_LABELS, MAX_ZOOM, type StateMap, TREES, cellStats, clampView, defaultView, fitView, layoutOrb, minZoom, relatives, splitZoom, toScreen, viewForCell, viewForNode, visibleCells, zoomAt } from "./orbModel";
import { stateSignature } from "./treeState";

const content = loadContent();
const L = layoutOrb(content);
const view = (p: Partial<SimView> = {}): SimView => ({ tier: 1, researchPoints: 0, techResearched: [], path: undefined, ...p }) as unknown as SimView;
const SIZES: [number, number][] = [
	[1400, 820],
	[1080, 840],
	[780, 560],
];

describe("orb layout (real content)", () => {
	it("places every tech once, finite, in its tree", () => {
		expect(L.nodes).toHaveLength(content.tech.length);
		for (const n of L.nodes) expect(Number.isFinite(n.x + n.y), n.id).toBe(true);
		const treeOf = (id: string) => L.byId.get(id)?.tree;
		for (const t of content.tech) {
			if (t.lane === "syn") expect(treeOf(t.id)).toBe("lattice");
			else if (t.lane === "wet") expect(treeOf(t.id)).toBe("flesh");
			else if (t.lane === "green") expect(treeOf(t.id)).toBe("garden");
			else expect(treeOf(t.id)).toBe("core");
		}
	});
	it("is deterministic", () => {
		const again = layoutOrb(content);
		expect(again.nodes.map((n) => [n.id, Math.round(n.x), Math.round(n.y)])).toEqual(L.nodes.map((n) => [n.id, Math.round(n.x), Math.round(n.y)]));
	});
	it("puts higher Levels farther from the middle, on average", () => {
		const r = (lv: number) => {
			const ns = L.nodes.filter((n) => n.level === lv);
			return ns.reduce((a, n) => a + Math.hypot(n.x / 560, n.y / 395), 0) / ns.length;
		};
		expect(r(1)).toBeLessThan(r(3));
		expect(r(3)).toBeLessThan(r(5));
	});
	it("groups each tree into a tree of clusters that holds every member once", () => {
		expect(L.roots.map((r) => r.tree)).toEqual(["lattice", "flesh", "garden", "core"]);
		expect(L.roots.reduce((a, r) => a + r.members.length, 0)).toBe(content.tech.length);
		for (const c of L.cells.values()) {
			if (c.kids.length) expect(c.kids.flatMap((k) => k.members).sort()).toEqual([...c.members].sort());
			else expect(c.members).toEqual([c.id]);
		}
	});
	it("names the trees Lattice, Flesh and Garden, never the code names", () => {
		expect(Object.values(TREES).map((t) => t.name)).toEqual(["Core", "Lattice", "Flesh", "Garden"]);
		const names = [...L.cells.values()].filter((c) => !c.node).map((c) => c.name);
		for (const n of names) expect(n).not.toMatch(/Synthetic|Wetware|Green\b/);
	});
});

describe("semantic zoom", () => {
	it("zoomed out you see exactly one cluster globe per tree", () => {
		for (const [w, h] of SIZES) {
			const v = fitView(L, w, h);
			const shown = visibleCells(L, v);
			expect(shown.map((s) => s.cell.id)).toEqual(L.roots.map((r) => r.id));
			expect(shown.every((s) => !s.cell.node)).toBe(true);
		}
	});
	it("fit is the lowest zoom allowed, and the highest splits down to single techs", () => {
		const v = fitView(L, 1400, 820);
		expect(clampView(L, { ...v, z: 0.01 }).z).toBe(minZoom(L, 1400, 820));
		expect(clampView(L, { ...v, z: 99 }).z).toBe(MAX_ZOOM);
		const hi = visibleCells(L, { ...v, z: MAX_ZOOM });
		expect(hi.some((s) => s.cell.node)).toBe(true);
	});
	it("zooming in splits clusters: more, smaller globes appear around the view centre", () => {
		const f = fitView(L, 1400, 820);
		const counts = [f.z, 1.1, 1.4, 1.8].map((z) => visibleCells(L, { ...f, z, cx: 0, cy: 0 }).length);
		expect(counts[0]).toBe(4);
		expect(counts[1]).toBeGreaterThan(counts[0]);
		expect(counts[2]).toBeGreaterThan(counts[1]);
	});
	it("single techs only show at or above the leaf zoom", () => {
		const f = fitView(L, 1400, 820);
		for (const z of [0.7, 0.9, 1.0, LEAF_ZOOM - 0.01]) {
			for (const [cx, cy] of [
				[0, 0],
				[200, 150],
				[-300, -200],
			])
				expect(
					visibleCells(L, { ...f, z, cx, cy }).filter((s) => s.cell.node),
					`z=${z}`,
				).toHaveLength(0);
		}
	});
	it(`never labels more than ${MAX_LABELS} globes, at any zoom, centre or window size`, () => {
		let worst = 0;
		for (const [w, h] of SIZES) {
			const f = fitView(L, w, h);
			for (let z = f.z; z <= MAX_ZOOM; z *= 1.08)
				for (let cx = -600; cx <= 600; cx += 150)
					for (let cy = -400; cy <= 400; cy += 100) {
						const v = { cx, cy, z, w, h };
						const n = visibleCells(L, v).filter((s) => s.labelled).length;
						worst = Math.max(worst, n);
						expect(n, `z=${z.toFixed(2)} at ${cx},${cy} in ${w}x${h}`).toBeLessThanOrEqual(MAX_LABELS);
					}
		}
		expect(worst).toBeGreaterThan(8); // the cap is reached, not just trivially met
	});
	it("a view that would hold too many globes folds the far ones back into clusters, nearest stay split", () => {
		const f = fitView(L, 1400, 820);
		const v = { ...f, z: 1.6, cx: 0, cy: 0 };
		const all = [...L.cells.values()].filter((c) => !c.kids.length && Math.abs(toScreen(v, c.x, c.y)[0] - v.w / 2) < v.w / 2).length;
		expect(all).toBeGreaterThan(MAX_LABELS);
		const shown = visibleCells(L, v).filter((s) => s.labelled);
		expect(shown.length).toBeLessThanOrEqual(MAX_LABELS);
		expect(shown.some((s) => !s.cell.node)).toBe(true);
		expect(shown.some((s) => s.cell.node)).toBe(true);
	});
	it("clicking a cluster zooms into it so that it splits", () => {
		for (const r of L.roots) {
			const v = viewForCell(L, r, 1400, 820);
			expect(v.z).toBeGreaterThanOrEqual(Math.min(splitZoom(r), MAX_ZOOM));
			const ids = visibleCells(L, v).map((s) => s.cell.id);
			expect(ids).not.toContain(r.id);
			expect(ids.some((id) => r.members.includes(id) || L.cells.get(id)?.members.every((m) => r.members.includes(m)))).toBe(true);
		}
	});
	it("any tech can be flown to and shows as its own globe", () => {
		for (const id of ["contracts_clerk", "mind_lattice_dossier", "organoid_vats", "canopy_array", "transfer_protocol"]) {
			if (!L.byId.has(id)) continue;
			for (const [w, h] of SIZES) {
				const v = viewForNode(L, id, w, h);
				expect(visibleCells(L, v).some((s) => s.cell.id === id && s.labelled), id).toBe(true);
			}
		}
	});
	it("zoom around the pointer keeps the world point under it", () => {
		const v = fitView(L, 1400, 820);
		const z = zoomAt(L, { ...v, z: 1.2, cx: 50, cy: 30 }, 1.5, 300, 200);
		const before = { x: (300 - 700) / 1.2 + 50, y: (200 - 410) / 1.2 + 30 };
		const after = { x: (300 - 700) / z.z + z.cx, y: (200 - 410) / z.z + z.cy };
		expect(after.x).toBeCloseTo(before.x, 4);
		expect(after.y).toBeCloseTo(before.y, 4);
	});
});

describe("opening view and states", () => {
	const statesFor = (p: Partial<SimView>): StateMap => stateSignature(content, view(p)).states;
	it("opens zoomed toward what can be researched now, with those techs as single globes", () => {
		const states = statesFor({ researchPoints: 5000 });
		const v = defaultView(L, states, 1400, 820);
		expect(v.z).toBeGreaterThan(fitView(L, 1400, 820).z);
		const shown = visibleCells(L, v);
		const ready = shown.filter((s) => s.cell.node && states.get(s.cell.id) === "avail" && s.labelled);
		expect(ready.length).toBeGreaterThan(0);
		expect(shown.filter((s) => s.labelled).length).toBeLessThanOrEqual(MAX_LABELS);
	});
	it("falls back to the whole orb when everything is done", () => {
		const states: StateMap = new Map(content.tech.map((t) => [t.id, "done" as const]));
		expect(defaultView(L, states, 1400, 820)).toEqual(fitView(L, 1400, 820));
	});
	it("cluster stats count ready and done", () => {
		const states = statesFor({ researchPoints: 5000, techResearched: ["contracts_clerk"] });
		const core = L.roots.find((r) => r.tree === "core") as (typeof L.roots)[number];
		const s = cellStats(core, states);
		expect(s.total).toBe(core.members.length);
		expect(s.done).toBe(1);
		expect(s.ready).toBeGreaterThan(0);
		expect(s.startable).toBe(s.ready);
	});
	it("selecting a tech finds its prerequisites and follow-ups", () => {
		const t = content.tech.find((x) => x.requires.length > 0) as (typeof content.tech)[number];
		expect([...relatives(L, t.id).prereq]).toEqual(t.requires);
		expect(relatives(L, t.requires[0]).follow.has(t.id)).toBe(true);
		expect(relatives(L, null).prereq.size).toBe(0);
	});
});

describe("text size", () => {
	it("research CSS has no hard-coded font size under 16 px; sizes come from the --fs scale", () => {
		const css = readFileSync(new URL("./research.css", import.meta.url), "utf8");
		const px: number[] = [];
		for (const m of css.matchAll(/font:\s*(?:\d+\s+)?(\d+)px/g)) px.push(Number(m[1]));
		for (const m of css.matchAll(/font-size:\s*(?:max\()?(\d+)px/g)) px.push(Number(m[1]));
		for (const m of px) expect(m).toBeGreaterThanOrEqual(16);
		expect(css.match(/font(?:-size)?:[^;]*var\(--fs-/g)?.length).toBeGreaterThan(10);
	});
	it("globe labels are drawn from the small step of the scale (17 px)", () => {
		const css = readFileSync(new URL("./research.css", import.meta.url), "utf8");
		expect(css).toMatch(/\.orb-lab \{[^}]*font: 400 var\(--fs-small\)/);
	});
});
