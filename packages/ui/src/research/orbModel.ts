/**
 * The research orb, as pure geometry and rules: where every tech sits, how the globes group into clusters (a binary
 * dendrogram per tree), and which globes are visible at a zoom level. No React, so it is deterministic and unit-tested.
 *
 * Semantic zoom: zoomed out you see one cluster globe per tree. Zooming in splits a cluster into its two halves once its
 * on-screen size is big enough, down to single techs. At most MAX_LABELS labelled globes are ever in view: if a view would
 * hold more, the clusters farthest from the middle of the view are folded back.
 */
import type { ContentDB, TechLane, TechNode } from "@aitower/content";
import { laneName, laneOf } from "./lanes";
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

export const MAX_LABELS = 15;
export const MAX_ZOOM = 3.6;
/** Below this zoom (px per world unit) single globes do not split out: their labels would touch. */
export const LEAF_ZOOM = 1.15;
/** A cluster splits once its on-screen radius reaches this (plus a little for big children). */
const SPLIT_PX = 120;
/** Per depth: the lowest zoom at which that depth may split (the trees stay whole when zoomed out). */
const DEPTH_FLOOR = [1.0, 1.1, 1.2];

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

/** A node of the grouping tree: a single tech (leaf) or a cluster of two halves. */
export interface Cell {
	id: string;
	tree: TreeId;
	depth: number;
	x: number;
	y: number;
	/** World radius that holds every member. */
	r: number;
	members: string[];
	kids: Cell[];
	parent: Cell | null;
	/** Cluster title, e.g. "Power · LV1-3". Leaves use the tech name. */
	name: string;
	/** Set when the cell is a single tech. */
	node?: OrbNode;
}

export interface OrbLayout {
	nodes: OrbNode[];
	byId: Map<string, OrbNode>;
	roots: Cell[];
	cells: Map<string, Cell>;
	bounds: { x0: number; y0: number; x1: number; y1: number };
	/** Where the "LV n" tags go. */
	levelTags: { level: number; x: number; y: number }[];
	prereqs: Map<string, string[]>;
	follows: Map<string, string[]>;
}

export const isLeaf = (c: Cell): boolean => c.kids.length === 0;

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

	const cells = new Map<string, Cell>();
	const roots: Cell[] = [];
	for (const tree of TREE_ORDER) {
		const ns = nodes.filter((n) => n.tree === tree);
		if (!ns.length) continue;
		const root = buildTree(ns, tree, content, cells);
		assignDepth(root, 0, null);
		roots.push(root);
	}
	const levelTags = [1, 2, 3, 4, 5].map((lv) => {
		const [x, y] = pol(lv, 312);
		return { level: lv, x: x + 6, y: y + 4 };
	});
	return { nodes, byId, roots, cells, bounds: { x0, y0, x1, y1 }, levelTags, prereqs, follows };
}

function assignDepth(c: Cell, depth: number, parent: Cell | null): void {
	c.depth = depth;
	c.parent = parent;
	for (const k of c.kids) assignDepth(k, depth + 1, c);
}

/** Group a tree's techs: repeatedly join the two closest groups (Ward's rule), so every cluster is a compact patch of the orb. */
function buildTree(ns: OrbNode[], tree: TreeId, content: ContentDB, cells: Map<string, Cell>): Cell {
	const byId = new Map(ns.map((n) => [n.id, n]));
	let live: Cell[] = ns.map((n) => {
		const c: Cell = { id: n.id, tree, depth: 0, x: n.x, y: n.y, r: n.R + 6, members: [n.id], kids: [], parent: null, name: n.name, node: n };
		cells.set(c.id, c);
		return c;
	});
	let seq = 0;
	const nameOf = (members: string[]): string => {
		const counts = new Map<string, number>();
		let lo = 9;
		let hi = 0;
		for (const id of members) {
			const n = byId.get(id);
			if (!n) continue;
			counts.set(n.lane, (counts.get(n.lane) ?? 0) + 1);
			lo = Math.min(lo, n.level);
			hi = Math.max(hi, n.level);
		}
		const [lane, share] = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] ?? ["", 0];
		const base = tree === "core" && share >= members.length * 0.6 ? laneName(lane as TechLane, content) : TREES[tree].name;
		return `${base} · LV${lo}${hi > lo ? `-${hi}` : ""}`;
	};
	while (live.length > 1) {
		let best = Number.POSITIVE_INFINITY;
		let bi = 0;
		let bj = 1;
		for (let i = 0; i < live.length; i++)
			for (let j = i + 1; j < live.length; j++) {
				const a = live[i];
				const b = live[j];
				const na = a.members.length;
				const nb = b.members.length;
				const d = ((a.x - b.x) ** 2 + (a.y - b.y) ** 2) * ((na * nb) / (na + nb));
				if (d < best - 1e-9) {
					best = d;
					bi = i;
					bj = j;
				}
			}
		const a = live[bi];
		const b = live[bj];
		const members = [...a.members, ...b.members];
		const x = (a.x * a.members.length + b.x * b.members.length) / members.length;
		const y = (a.y * a.members.length + b.y * b.members.length) / members.length;
		let r = 0;
		for (const id of members) {
			const n = byId.get(id);
			if (n) r = Math.max(r, Math.hypot(n.x - x, n.y - y) + n.R + 6);
		}
		const cell: Cell = { id: `c:${tree}:${seq++}`, tree, depth: 0, x, y, r, members, kids: [a, b], parent: null, name: nameOf(members) };
		cells.set(cell.id, cell);
		live = live.filter((_, k) => k !== bi && k !== bj);
		live.push(cell);
	}
	const root = live[0];
	if (!root.node) root.name = TREES[tree].name;
	return root;
}

/** Zoom (px per world unit) at which a cluster stops being one globe and shows its halves. */
export function splitZoom(c: Cell): number {
	if (isLeaf(c)) return Number.POSITIVE_INFINITY;
	const bigKid = Math.max(...c.kids.map((k) => k.members.length));
	const need = (SPLIT_PX + 14 * Math.sqrt(bigKid)) / Math.max(30, c.r);
	const floor = DEPTH_FLOOR[Math.min(c.depth, DEPTH_FLOOR.length - 1)];
	// Two single techs: the layout keeps their labels apart at 1:1, so they split as soon as labels are legible.
	if (c.kids.every(isLeaf)) return Math.max(floor, LEAF_ZOOM);
	return Math.min(Math.max(floor, need, c.kids.some(isLeaf) ? LEAF_ZOOM : 0), MAX_ZOOM * 0.92);
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

export interface Shown {
	cell: Cell;
	/** Counts toward the label cap: its centre is in view. */
	labelled: boolean;
}

/** The cells to draw at this view: the split rule, then the label cap. Cells far outside the view are left out. */
export function visibleCells(layout: OrbLayout, v: View): Shown[] {
	const out: Cell[] = [];
	const walk = (c: Cell): void => {
		if (!isLeaf(c) && v.z >= splitZoom(c)) for (const k of c.kids) walk(k);
		else out.push(c);
	};
	for (const r of layout.roots) walk(r);
	let list = out;
	const lab = (c: Cell): boolean => inView(v, c.x, c.y, 0);
	for (let guard = 0; guard < 400; guard++) {
		if (list.filter(lab).length <= MAX_LABELS) break;
		const inList = new Set(list);
		let pick: Cell | null = null;
		let far = -1;
		for (const c of list) {
			const p = c.parent;
			if (!p?.kids.every((k) => inList.has(k)) || !p.kids.some(lab)) continue;
			const d = Math.hypot((p.x - v.cx) * v.z, (p.y - v.cy) * v.z);
			if (d > far) {
				far = d;
				pick = p;
			}
		}
		if (!pick) break;
		const gone = new Set(pick.kids);
		const at = list.findIndex((c) => gone.has(c));
		list = list.filter((c) => !gone.has(c));
		list.splice(at, 0, pick);
	}
	return list.filter((c) => inView(v, c.x, c.y, -140)).map((c) => ({ cell: c, labelled: lab(c) }));
}

export type StateMap = Map<string, TreeState>;
export interface CellStats {
	total: number;
	done: number;
	ready: number;
	startable: number;
}
/** n ready / n done for a cell. Ready = every prerequisite met (it may still need points); startable = and affordable. */
export function cellStats(c: Cell, states: StateMap): CellStats {
	const s: CellStats = { total: c.members.length, done: 0, ready: 0, startable: 0 };
	for (const id of c.members) {
		const st = states.get(id);
		if (st === "done") s.done++;
		else if (st === "avail") {
			s.ready++;
			s.startable++;
		} else if (st === "poor") s.ready++;
	}
	return s;
}

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

/** The view that shows a cluster split into its halves, centred on it. */
export function viewForCell(layout: OrbLayout, c: Cell, w: number, h: number): View {
	const fit = fitBox({ x0: c.x - c.r, x1: c.x + c.r, y0: c.y - c.r, y1: c.y + c.r }, w, h);
	const z = Math.min(MAX_ZOOM, Math.max(fit.z, isLeaf(c) ? 1.5 : splitZoom(c) * 1.04));
	return clampView(layout, { cx: c.x, cy: c.y, z, w, h });
}

/** The view that shows one tech as its own globe: the lowest zoom (from `minZ`) at which it is not folded into a cluster. */
export function viewForNode(layout: OrbLayout, id: string, w: number, h: number, minZ = 0): View {
	const n = layout.byId.get(id);
	if (!n) return fitView(layout, w, h);
	for (let z = Math.max(minZ, minZoom(layout, w, h)); z < MAX_ZOOM; z *= 1.06) {
		const v = clampView(layout, { cx: n.x, cy: n.y, z, w, h });
		if (visibleCells(layout, v).some((s) => s.cell.id === id)) return v;
	}
	return clampView(layout, { cx: n.x, cy: n.y, z: MAX_ZOOM, w, h });
}

/**
 * The opening view: zoomed toward what can be researched now (else what is nearly ready), centred on it and close
 * enough for those techs to show as single globes.
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
	return clampView(layout, { ...f, z: clamp(f.z, LEAF_ZOOM + 0.1, 2.2) });
}
