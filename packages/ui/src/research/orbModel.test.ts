import { readFileSync } from "node:fs";
import { loadContent } from "@aitower/content";
import type { SimView } from "@aitower/sim";
import { describe, expect, it } from "vitest";
import { LABEL_ZOOM, MAX_ZOOM, type StateMap, TREES, clampView, defaultView, fitView, globeRadius, layoutOrb, minZoom, orbLinks, relatives, viewForNode, visibleNodes, zoomAt } from "./orbModel";
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
	it("names the trees Lattice, Flesh and Garden, never the code names", () => {
		expect(Object.values(TREES).map((t) => t.name)).toEqual(["Core", "Lattice", "Flesh", "Garden"]);
	});
});

describe("zoom: nothing appears, disappears or merges", () => {
	const zooms = (f: { z: number }): number[] => [f.z, (f.z + MAX_ZOOM) / 2, MAX_ZOOM];
	it("every globe is shown at min, mid and max zoom, in every window size and wherever the view is centred", () => {
		for (const [w, h] of SIZES) {
			const f = fitView(L, w, h);
			for (const z of zooms(f))
				for (const [cx, cy] of [
					[0, 0],
					[300, 200],
					[-400, -250],
				]) {
					const shown = visibleNodes(L, { cx, cy, z, w, h });
					expect(shown.map((s) => s.node.id).sort(), `z=${z.toFixed(2)}`).toEqual(content.tech.map((t) => t.id).sort());
				}
		}
	});
	it("every prerequisite link is drawn at every zoom, and every prerequisite-free globe has a branch from the centre", () => {
		const links = orbLinks(L);
		const want = content.tech.reduce((a, t) => a + Math.max(1, t.requires.filter((r) => L.byId.has(r)).length), 0);
		expect(links).toHaveLength(want);
		for (const t of content.tech) for (const r of t.requires) if (L.byId.has(r)) expect(links.some((l) => l.from === r && l.to === t.id), `${r}>${t.id}`).toBe(true);
		for (const n of L.nodes) expect(links.some((l) => l.to === n.id), n.id).toBe(true);
		expect(links.some((l) => l.from === null)).toBe(true);
	});
	it("fit is the lowest zoom allowed and MAX_ZOOM the highest", () => {
		const v = fitView(L, 1400, 820);
		expect(clampView(L, { ...v, z: 0.01 }).z).toBe(minZoom(L, 1400, 820));
		expect(clampView(L, { ...v, z: 99 }).z).toBe(MAX_ZOOM);
	});
	it("zooming out only shrinks globes, and never to nothing", () => {
		const f = fitView(L, 1400, 820);
		expect(globeRadius(f.z)).toBeGreaterThanOrEqual(4);
		expect(globeRadius(f.z)).toBeLessThan(globeRadius(1));
		let prev = 0;
		for (let z = f.z; z <= MAX_ZOOM; z *= 1.05) {
			expect(globeRadius(z)).toBeGreaterThanOrEqual(prev);
			prev = globeRadius(z);
		}
	});
	it("labels hide only when zoomed out too far or off screen; globes stay", () => {
		const f = fitView(L, 1400, 820);
		expect(visibleNodes(L, f).every((s) => !s.labelled)).toBe(true);
		const hi = visibleNodes(L, { ...f, z: MAX_ZOOM, cx: 0, cy: 0 });
		expect(hi.some((s) => s.labelled)).toBe(true);
		expect(hi).toHaveLength(content.tech.length);
		expect(visibleNodes(L, { ...f, z: LABEL_ZOOM, cx: 0, cy: 0 }).some((s) => s.labelled)).toBe(true);
	});
	it("any tech can be flown to and its label shows", () => {
		for (const id of ["contracts_clerk", "mind_lattice_dossier", "organoid_vats", "canopy_array", "transfer_protocol"]) {
			if (!L.byId.has(id)) continue;
			for (const [w, h] of SIZES) {
				const v = viewForNode(L, id, w, h);
				expect(visibleNodes(L, v).some((s) => s.node.id === id && s.labelled), id).toBe(true);
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
	it("opens zoomed toward what can be researched now, with those labels showing", () => {
		const states = statesFor({ researchPoints: 5000 });
		const v = defaultView(L, states, 1400, 820);
		expect(v.z).toBeGreaterThan(fitView(L, 1400, 820).z);
		const ready = visibleNodes(L, v).filter((s) => states.get(s.node.id) === "avail" && s.labelled);
		expect(ready.length).toBeGreaterThan(0);
	});
	it("falls back to the whole orb when everything is done", () => {
		const states: StateMap = new Map(content.tech.map((t) => [t.id, "done" as const]));
		expect(defaultView(L, states, 1400, 820)).toEqual(fitView(L, 1400, 820));
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
