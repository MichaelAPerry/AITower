/**
 * The research orb, as pure geometry and rules: where every tech sits and which globes carry a label at a zoom level.
 * Every globe and every link is always drawn; zooming out only shrinks them (labels hide when they would be too small).
 * No React, so it is deterministic and unit-tested.
 */
import type { ContentDB, TechLane, TechNode } from "@aitower/content";
import { laneOf } from "./lanes";
import type { TreeState } from "./treeState";

export type TreeId = "core" | "lattice" | "flesh" | "garden";
export const TREE_ORDER: TreeId[] = ["lattice", "flesh", "garden", "core"];
export const TREES: Record<TreeId, { name: string; sub: string; color: string; deg: number; w: number }> = {
	core: { name: "Core", sub: "shared research", color: "#c9e6ff", deg: 0, w: 0 },
	lattice: { name: "Lattice", sub: "circuits and crystal", color: "#6fd3ff", deg: 270, w: 76 },
	flesh: { name: "Flesh", sub: "veins and cells", color: "#ff6a84", deg: 140, w: 84 },
	garden: { name: "Garden", sub: "vines and flowers", color: "#b0f070", deg: 40, w: 96 },
};
const LANE_TREE: Partial<Record<TechLane, TreeId>> = { syn: "lattice", wet: "flesh", green: "garden" };

export const MAX_ZOOM = 3.6;
/** Below this zoom (px per world unit) labels are hidden: they would touch. Globes and links stay. */
export const LABEL_ZOOM = 1;

const RA = [0, 125, 255, 375, 470, 560];
const RB = [0, 95, 195, 285, 355, 395];
const LANEDEG: Record<string, number> = { adm: 205, log: 340, pow: 0, cool: 92, comp: 255 };
const SEAMS = [330, 93, 207];
const CH = 8.4;
const LINE_H = 19;

const rad = (d: number): number => (d * Math.PI) / 180;
const angDiff = (a: number, b: number): number => Math.abs((((((a - b + 540) % 360) + 360) % 360) - 180));
const meanDeg = (a: number[]): number => {
	let x = 0;
	let y = 0;
	for (const d of a) {
		x += Math.cos(rad(d));
		y += Math.sin(rad(d));
	}
	return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const pol = (t: number, deg: number, k = 0): [number, number] => {
	const a = rad(deg);
	return [Math.cos(a) * RA[t] * (1 + k), Math.sin(a) * RB[t] * (1 + k)];
};

export function wrapLabel(s: string, max = 13): string[] {
	const out: string[] = [];
	let c = "";
	for (const w of s.split(" ")) {
		if (`${c} ${w}`.trim().length > max && c) {
			out.push(c);
			c = w;
		} else c = `${c} ${w}`.trim();
	}
	out.push(c);
	return out;
}

export interface OrbNode {
	id: string;
	name: string;
	tree: TreeId;
	level: number;
	lane: string;
	x: number;
	y: number;
	/** Globe radius at zoom 1. */
	R: number;
	/** Name lines at 16 px (the cost line is added when ready). */
	lines: string[];
	/** 1: label to the right of the globe, -1: to the left. */
	side: 1 | -1;
	tech: TechNode;
}

export interface OrbLayout {
	nodes: OrbNode[];
	byId: Map<string, OrbNode>;
	bounds: { x0: number; y0: number; x1: number; y1: number };
	/** Where the "LV n" tags go. */
	levelTags: { level: number; x: number; y: number }[];
	prereqs: Map<string, string[]>;
	follows: Map<string, string[]>;
}

/** Tree a tech belongs to: its own lane if it is one of the three trees, else core. */
export const treeOfTech = (n: TechNode): TreeId => LANE_TREE[laneOf(n)] ?? "core";

const layoutCache = new WeakMap<object, OrbLayout>();
/** The layout is deterministic per content; build it once. */
export function orbLayoutFor(content: ContentDB): OrbLayout {
	const key = (content.tech ?? content) as object;
	let l = layoutCache.get(key);
	if (!l) {
		l = layoutOrb(content);
		layoutCache.set(key, l);
	}
	return l;
}

export function layoutOrb(content: ContentDB): OrbLayout {
	const techs = content.tech ?? [];
	const byTech = new Map(techs.map((t) => [t.id, t]));
	const level = (t: TechNode): number => clamp(t.minTier || 1, 1, 5);
	const follows = new Map<string, string[]>();
	const prereqs = new Map<string, string[]>();
	for (const t of techs) {
		prereqs.set(
			t.id,
			t.requires.filter((r) => byTech.has(r)),
		);
		for (const r of t.requires) follows.set(r, [...(follows.get(r) ?? []), t.id]);
	}
	const memo = new Map<string, Set<TreeId>>();
	const treesFed = (id: string): Set<TreeId> => {
		const hit = memo.get(id);
		if (hit) return hit;
		const t = byTech.get(id);
		const s = new Set<TreeId>();
		memo.set(id, s);
		if (!t) return s;
		const own = treeOfTech(t);
		if (own !== "core") s.add(own);
		else for (const d of follows.get(id) ?? []) for (const x of treesFed(d)) s.add(x);
		return s;
	};

	const pos = new Map<string, { x: number; y: number }>();
	const angle = new Map<string, number>();
	for (const tree of ["lattice", "flesh", "garden"] as const) {
		const T = TREES[tree];
		for (let lv = 1; lv <= 5; lv++) {
			const ns = techs.filter((n) => treeOfTech(n) === tree && level(n) === lv);
			const par = (n: TechNode): number => angle.get(n.requires[0] ?? "") ?? 0;
			ns.sort((a, b) => par(a) - par(b) || a.id.localeCompare(b.id));
			ns.forEach((n, i) => {
				const f = ns.length === 1 ? 0 : i / (ns.length - 1) - 0.5;
				const d = T.deg + f * (T.w - 14);
				angle.set(n.id, d);
				const [x, y] = pol(lv, d, i % 2 ? 0.045 : -0.03);
				pos.set(n.id, { x, y });
			});
		}
	}
	const shared = techs.filter((n) => treeOfTech(n) === "core");
	for (const n of shared) {
		const fed = [...treesFed(n.id)];
		const lane = laneOf(n);
		let d: number;
		if (level(n) >= 4) {
			const want = fed.length ? meanDeg(fed.map((x) => TREES[x].deg)) : (LANEDEG[lane] ?? 0);
			d = SEAMS.reduce((b, s) => (angDiff(s, want) < angDiff(b, want) ? s : b));
		} else d = fed.length ? meanDeg(fed.map((x) => TREES[x].deg).concat([LANEDEG[lane] ?? 0])) : (LANEDEG[lane] ?? 0);
		angle.set(n.id, d);
	}
	for (let lv = 1; lv <= 5; lv++) {
		const ns = shared.filter((n) => level(n) === lv).sort((a, b) => (angle.get(a.id) ?? 0) - (angle.get(b.id) ?? 0) || a.id.localeCompare(b.id));
		const gap = lv === 1 ? 34 : lv === 2 ? 24 : lv === 3 ? 20 : 16;
		const a = ns.map((n) => angle.get(n.id) ?? 0);
		for (let it = 0; it < 60; it++)
			for (let i = 0; i < ns.length; i++) {
				const j = (i + 1) % ns.length;
				const d = (((a[j] - a[i]) % 360) + 360) % 360;
				if (ns.length > 1 && d < gap) {
					const m = (gap - d) / 2;
					a[i] -= m;
					a[j] += m;
				}
			}
		ns.forEach((n, i) => {
			const [x, y] = pol(lv, a[i], i % 2 ? 0.07 : -0.06);
			pos.set(n.id, { x, y });
		});
	}

	const nodes: OrbNode[] = techs.map((t) => {
		const p = pos.get(t.id) ?? { x: 0, y: 0 };
		return { id: t.id, name: t.name, tree: treeOfTech(t), level: level(t), lane: laneOf(t), x: p.x, y: p.y, R: 14, lines: wrapLabel(t.name), side: p.x >= -6 ? 1 : -1, tech: t };
	});
	const box = (o: OrbNode): { x0: number; x1: number; y0: number; y1: number } => {
		const lw = Math.max(...o.lines.map((l) => l.length)) * CH + 4;
		const lh = (o.lines.length + 1) * LINE_H;
		const hh = Math.max(o.R, lh / 2) + 1;
		return o.side > 0 ? { x0: o.x - o.R - 3, x1: o.x + o.R + 8 + lw, y0: o.y - hh, y1: o.y + hh } : { x0: o.x - o.R - 8 - lw, x1: o.x + o.R + 3, y0: o.y - hh, y1: o.y + hh };
	};
	const home = nodes.map((o) => ({ x: o.x, y: o.y }));
	for (let it = 0; it < 900; it++) {
		const sp = it < 300 ? 0.01 : it < 600 ? 0.002 : 0;
		for (let i = 0; i < nodes.length; i++)
			for (let j = i + 1; j < nodes.length; j++) {
				const A = nodes[i];
				const B = nodes[j];
				const a = box(A);
				const b = box(B);
				const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) + 5;
				const oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) + 5;
				if (ox > 0 && oy > 0) {
					if (oy < ox) {
						const s = ((A.y < B.y ? -1 : 1) * oy) / 2;
						A.y += s;
						B.y -= s;
					} else {
						const s = ((A.x < B.x ? -1 : 1) * ox) / 2;
						A.x += s;
						B.x -= s;
					}
				}
			}
		nodes.forEach((o, i) => {
			o.x += (home[i].x - o.x) * sp;
			o.y += (home[i].y - o.y) * sp;
			o.side = o.x >= -6 ? 1 : -1;
		});
	}

	const byId = new Map(nodes.map((n) => [n.id, n]));
	let x0 = -RA[5];
	let x1 = RA[5];
	let y0 = -RB[5];
	let y1 = RB[5];
	for (const o of nodes) {
		const b = box(o);
		x0 = Math.min(x0, b.x0);
		x1 = Math.max(x1, b.x1);
		y0 = Math.min(y0, b.y0);
		y1 = Math.max(y1, b.y1);
	}

	const levelTags = [1, 2, 3, 4, 5].map((lv) => {
		const [x, y] = pol(lv, 312);
		return { level: lv, x: x + 6, y: y + 4 };
	});
	return { nodes, byId, bounds: { x0, y0, x1, y1 }, levelTags, prereqs, follows };
}

export interface View {
	/** World point at the middle of the stage. */
	cx: number;
	cy: number;
	/** Pixels per world unit. */
	z: number;
	/** Stage size in pixels. */
	w: number;
	h: number;
}

export const toScreen = (v: View, x: number, y: number): [number, number] => [(x - v.cx) * v.z + v.w / 2, (y - v.cy) * v.z + v.h / 2];
const inView = (v: View, x: number, y: number, pad: number): boolean => {
	const [sx, sy] = toScreen(v, x, y);
	return sx >= pad && sx <= v.w - pad && sy >= pad && sy <= v.h - pad;
};

/** Every globe is drawn at every zoom; only its label depends on the view (big enough zoom, and the globe is on screen). */
export function visibleNodes(layout: OrbLayout, v: View): Shown[] {
	return layout.nodes.map((node) => ({ node, labelled: v.z >= LABEL_ZOOM && inView(v, node.x, node.y, 0) }));
}

export interface Shown {
	node: OrbNode;
	labelled: boolean;
}

/** On-screen globe radius in px: it shrinks with the zoom (never to nothing), and grows a little when zoomed in. */
export const globeRadius = (z: number): number => (z >= 1 ? Math.round(14 * clamp(0.8 + 0.35 * z, 1, 1.7)) : Math.max(4, 16 * z));

export interface Link {
	/** The prerequisite, or null for a branch from the centre of the orb. */
	from: string | null;
	to: string;
}
/** Every line, at every zoom: each prerequisite link, plus a branch from the centre to every globe that has no prerequisite. */
export function orbLinks(layout: OrbLayout): Link[] {
	const out: Link[] = [];
	for (const n of layout.nodes) {
		const ps = layout.prereqs.get(n.id) ?? [];
		if (!ps.length) out.push({ from: null, to: n.id });
		for (const p of ps) out.push({ from: p, to: n.id });
	}
	return out;
}

export type StateMap = Map<string, TreeState>;

/** The selected tech's direct prerequisites and direct follow-ups. */
export function relatives(layout: OrbLayout, id: string | null): { prereq: Set<string>; follow: Set<string> } {
	return { prereq: new Set(id ? (layout.prereqs.get(id) ?? []) : []), follow: new Set(id ? (layout.follows.get(id) ?? []) : []) };
}

/** Zoom that fits the box into the stage. */
export function fitBox(b: { x0: number; y0: number; x1: number; y1: number }, w: number, h: number, pad = 36): View {
	const z = Math.min((w - pad * 2) / Math.max(1, b.x1 - b.x0), (h - pad * 2) / Math.max(1, b.y1 - b.y0));
	return { cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2, z: clamp(z, 0.05, MAX_ZOOM), w, h };
}
export const fitView = (layout: OrbLayout, w: number, h: number): View => fitBox(layout.bounds, w, h);
/** The lowest zoom allowed: the whole orb in the stage. */
export const minZoom = (layout: OrbLayout, w: number, h: number): number => fitView(layout, w, h).z;

/** Keep the view's middle inside the orb and its zoom inside the limits. */
export function clampView(layout: OrbLayout, v: View): View {
	const z = clamp(v.z, minZoom(layout, v.w, v.h), MAX_ZOOM);
	const b = layout.bounds;
	return { ...v, z, cx: clamp(v.cx, b.x0, b.x1), cy: clamp(v.cy, b.y0, b.y1) };
}

/** Zoom the view by a factor around a screen point, keeping the world point under it fixed. */
export function zoomAt(layout: OrbLayout, v: View, factor: number, sx: number, sy: number): View {
	const z = clamp(v.z * factor, minZoom(layout, v.w, v.h), MAX_ZOOM);
	const wx = (sx - v.w / 2) / v.z + v.cx;
	const wy = (sy - v.h / 2) / v.z + v.cy;
	return clampView(layout, { ...v, z, cx: wx - (sx - v.w / 2) / z, cy: wy - (sy - v.h / 2) / z });
}

/** The view centred on one tech, at least at zoom `minZ`, with its label showing. */
export function viewForNode(layout: OrbLayout, id: string, w: number, h: number, minZ = 0): View {
	const n = layout.byId.get(id);
	if (!n) return fitView(layout, w, h);
	return clampView(layout, { cx: n.x, cy: n.y, z: Math.max(minZ, LABEL_ZOOM * 1.1, minZoom(layout, w, h)), w, h });
}

/**
 * The opening view: zoomed toward what can be researched now (else what is nearly ready), centred on it and close
 * enough for their labels to show.
 */
export function defaultView(layout: OrbLayout, states: StateMap, w: number, h: number): View {
	let pick = layout.nodes.filter((n) => states.get(n.id) === "avail");
	if (!pick.length) pick = layout.nodes.filter((n) => states.get(n.id) === "poor");
	if (!pick.length) pick = layout.nodes.filter((n) => states.get(n.id) === "locked");
	if (!pick.length) return fitView(layout, w, h);
	const b = { x0: Number.POSITIVE_INFINITY, y0: Number.POSITIVE_INFINITY, x1: Number.NEGATIVE_INFINITY, y1: Number.NEGATIVE_INFINITY };
	for (const n of pick.slice(0, 40)) {
		b.x0 = Math.min(b.x0, n.x - 70);
		b.x1 = Math.max(b.x1, n.x + 140);
		b.y0 = Math.min(b.y0, n.y - 50);
		b.y1 = Math.max(b.y1, n.y + 50);
	}
	const f = fitBox(b, w, h, 60);
	return clampView(layout, { ...f, z: clamp(f.z, LABEL_ZOOM + 0.1, 2.2) });
}
