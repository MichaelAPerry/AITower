/**
 * Pure geometry of the research tree: lanes as rows, Levels as columns, one node per tech, one edge per prerequisite.
 * No React and no view state, so it is deterministic and unit-tested; the SVG is built once per layout and state change.
 *
 * Columns: one per Level (minTier). A node whose prerequisite sits in the same Level moves one slot to the right of it,
 * so every edge runs left to right. Rows: each lane stacks its nodes; Cooling and Compute stack by equipment line first
 * (Air, Liquid, Immersion). A child prefers the row of its in-lane parent, then the next free row below.
 */
import type { ContentDB, LaneDef, TechLane, TechLine, TechNode } from "@aitower/content";

export const NODE_W = 156;
export const NODE_H = 46;
const SLOT_W = 184;
const TIER_PAD = 14;
const ROW_H = 56;
const LANE_PAD = 8;
const LANE_GAP = 12;
/** Space on the left for the lane title and its line labels. */
export const GUTTER_W = 132;
/** Space on top for the Level headings. */
export const HEAD_H = 40;
const LINE_ORDER: (TechLine | "")[] = ["", "air", "liquid", "immersion"];
export const LINE_LABEL: Record<TechLine, string> = { air: "AIR", liquid: "LIQUID", immersion: "IMMERSION" };

/** Lane of a branch, for hand-built content that has no `lane` on its nodes. */
export const BRANCH_LANE: Record<TechNode["branch"], TechLane> = { administration: "adm", logistics: "log", power: "pow", cooling: "cool", compute: "comp", wetware: "wet" };
export const laneOf = (n: TechNode): TechLane => n.lane ?? BRANCH_LANE[n.branch];

const FALLBACK: LaneDef[] = [
	{ id: "adm", name: "Administration", short: "Admin", color: "#c9b98f" },
	{ id: "log", name: "Logistics", short: "Logistics", color: "#e8955a" },
	{ id: "pow", name: "Power", short: "Power", color: "#f0d24a" },
	{ id: "cool", name: "Cooling", short: "Cooling", color: "#5fb6ff" },
	{ id: "comp", name: "Compute", short: "Compute", color: "#8fd1b0" },
	{ id: "wet", name: "Wetware", short: "Wetware", color: "#ff7aa8" },
	{ id: "green", name: "Green", short: "Green", color: "#9be564" },
	{ id: "syn", name: "Synthetic", short: "Synthetic", color: "#a99cff" },
].map((l) => ({ advisor: "", identity: "", signature: "", pitch: "", ...l }) as LaneDef);

/** Lane metadata in display order; falls back to plain names when the content carries none (test fixtures). */
export const lanesOf = (content: ContentDB): LaneDef[] => (content.lanes?.length ? content.lanes : FALLBACK);

export interface LayoutNode {
	id: string;
	lane: TechLane;
	line: TechLine | undefined;
	tier: number;
	/** Slot inside the Level column (0 = no prerequisite in the same Level). */
	slot: number;
	row: number;
	x: number;
	y: number;
	/** Vertical centre, where edges attach. */
	cy: number;
}

export interface LayoutEdge {
	from: string;
	to: string;
	/** Lane of the child; a cross-lane edge is drawn dashed. */
	lane: TechLane;
	fromLane: TechLane;
	cross: boolean;
	d: string;
}

export interface LayoutBand {
	line: TechLine | "";
	y: number;
	rows: number;
}

export interface LayoutLane {
	id: TechLane;
	y: number;
	h: number;
	bands: LayoutBand[];
}

export interface LayoutTier {
	tier: number;
	x: number;
	w: number;
}

export interface TreeLayout {
	width: number;
	height: number;
	tiers: LayoutTier[];
	lanes: LayoutLane[];
	nodes: LayoutNode[];
	byId: Map<string, LayoutNode>;
	edges: LayoutEdge[];
}

const num = (n: number): string => String(Math.round(n * 10) / 10);

/** Lay out `nodes` (any subset of the tree; prerequisites outside it are skipped). Deterministic for the same input. */
export function layoutTree(nodes: readonly TechNode[], lanes: readonly LaneDef[]): TreeLayout {
	const ids = new Set(nodes.map((n) => n.id));
	const index = new Map(nodes.map((n, i) => [n.id, i]));
	const byNode = new Map(nodes.map((n) => [n.id, n]));

	// Slot inside the Level: one past the deepest prerequisite of the same Level.
	const slotOf = new Map<string, number>();
	const slot = (n: TechNode): number => {
		const known = slotOf.get(n.id);
		if (known !== undefined) return known;
		slotOf.set(n.id, 0); // guards a cycle; content validation rejects cycles
		let s = 0;
		for (const r of n.requires) {
			const p = byNode.get(r);
			if (p && p.minTier === n.minTier) s = Math.max(s, slot(p) + 1);
		}
		slotOf.set(n.id, s);
		return s;
	};
	for (const n of nodes) slot(n);

	// Columns: width follows the deepest chain in the Level.
	const tierNums = [...new Set(nodes.map((n) => n.minTier))].sort((a, b) => a - b);
	const tiers: LayoutTier[] = [];
	let x = GUTTER_W;
	for (const t of tierNums) {
		let deepest = 0;
		for (const n of nodes) if (n.minTier === t) deepest = Math.max(deepest, slotOf.get(n.id) ?? 0);
		const w = TIER_PAD * 2 + deepest * SLOT_W + NODE_W;
		tiers.push({ tier: t, x, w });
		x += w;
	}
	const width = x + 8;
	const tierX = new Map(tiers.map((t) => [t.tier, t.x]));

	// Rows: lane by lane, band by band.
	const placed = new Map<string, LayoutNode>();
	const outLanes: LayoutLane[] = [];
	let y = HEAD_H;
	for (const lane of lanes) {
		const inLane = nodes.filter((n) => (n.lane ?? BRANCH_LANE[n.branch]) === lane.id);
		if (inLane.length === 0) continue;
		const bands: LayoutBand[] = [];
		let rowsSoFar = 0;
		for (const line of LINE_ORDER) {
			const inBand = inLane.filter((n) => (n.line ?? "") === line).sort((a, b) => a.minTier - b.minTier || (slotOf.get(a.id) ?? 0) - (slotOf.get(b.id) ?? 0) || (index.get(a.id) ?? 0) - (index.get(b.id) ?? 0));
			if (inBand.length === 0) continue;
			const used = new Set<string>();
			const rowOf = new Map<string, number>();
			let maxRow = 0;
			for (const n of inBand) {
				const s = slotOf.get(n.id) ?? 0;
				let row = 0;
				const parents = n.requires.filter((r) => rowOf.has(r)).map((r) => rowOf.get(r) as number);
				if (parents.length) row = Math.min(...parents);
				while (used.has(`${n.minTier}.${s}.${row}`)) row++;
				used.add(`${n.minTier}.${s}.${row}`);
				rowOf.set(n.id, row);
				maxRow = Math.max(maxRow, row);
			}
			const bandY = y + LANE_PAD + rowsSoFar * ROW_H;
			for (const n of inBand) {
				const row = rowOf.get(n.id) as number;
				const s = slotOf.get(n.id) ?? 0;
				const ny = bandY + row * ROW_H;
				placed.set(n.id, { id: n.id, lane: lane.id, line: n.line, tier: n.minTier, slot: s, row: rowsSoFar + row, x: (tierX.get(n.minTier) as number) + TIER_PAD + s * SLOT_W, y: ny, cy: ny + NODE_H / 2 });
			}
			bands.push({ line, y: bandY, rows: maxRow + 1 });
			rowsSoFar += maxRow + 1;
		}
		const h = LANE_PAD * 2 + rowsSoFar * ROW_H - (ROW_H - NODE_H);
		outLanes.push({ id: lane.id, y, h, bands });
		y += h + LANE_GAP;
	}

	const outNodes = nodes.map((n) => placed.get(n.id)).filter((n): n is LayoutNode => n !== undefined);
	const edges: LayoutEdge[] = [];
	for (const n of nodes) {
		const c = placed.get(n.id);
		if (!c) continue;
		for (const r of n.requires) {
			const p = placed.get(r);
			if (!p || !ids.has(r)) continue;
			const x1 = p.x + NODE_W;
			const x2 = c.x;
			const dx = Math.max(12, Math.min(48, (x2 - x1) / 2));
			edges.push({ from: r, to: n.id, lane: c.lane, fromLane: p.lane, cross: p.lane !== c.lane, d: `M${num(x1)},${num(p.cy)} C${num(x1 + dx)},${num(p.cy)} ${num(x2 - dx)},${num(c.cy)} ${num(x2)},${num(c.cy)}` });
		}
	}
	return { width, height: y, tiers, lanes: outLanes, nodes: outNodes, byId: new Map(outNodes.map((n) => [n.id, n])), edges };
}

const cache = new WeakMap<object, Map<string, TreeLayout>>();

/** The layout for the content, minus the `hidden` lanes. Cached per content, so a render only looks it up. */
export function layoutFor(content: ContentDB, hidden: readonly TechLane[] = []): TreeLayout {
	const tech = content.tech ?? [];
	let byKey = cache.get(tech);
	if (!byKey) {
		byKey = new Map();
		cache.set(tech, byKey);
	}
	const key = [...hidden].sort().join(",");
	let l = byKey.get(key);
	if (!l) {
		l = layoutTree(
			tech.filter((n) => !hidden.includes(laneOf(n))),
			lanesOf(content),
		);
		byKey.set(key, l);
	}
	return l;
}

export type Dir = "left" | "right" | "up" | "down";

/** The node to move keyboard focus to: nearest in the arrow's direction, preferring the same row or column. */
export function neighbor(layout: TreeLayout, id: string, dir: Dir): string | null {
	const from = layout.byId.get(id);
	if (!from) return null;
	let best: string | null = null;
	let bestScore = Number.POSITIVE_INFINITY;
	for (const n of layout.nodes) {
		if (n.id === id) continue;
		const dx = n.x - from.x;
		const dy = n.y - from.y;
		const along = dir === "right" ? dx : dir === "left" ? -dx : dir === "down" ? dy : -dy;
		if (along <= 0) continue;
		const across = dir === "left" || dir === "right" ? Math.abs(dy) : Math.abs(dx);
		const score = along + across * 3;
		if (score < bestScore || (score === bestScore && best !== null && n.id < best)) {
			bestScore = score;
			best = n.id;
		}
	}
	return best;
}

/** Name split over at most two lines of about `max` characters; the second line ends with an ellipsis if it is cut. */
export function wrapName(name: string, max = 22): [string, string?] {
	if (name.length <= max) return [name];
	const words = name.split(" ");
	let first = "";
	let i = 0;
	while (i < words.length && (first ? `${first} ${words[i]}` : words[i]).length <= max) first = first ? `${first} ${words[i++]}` : words[i++];
	if (!first) return [`${name.slice(0, max - 1)}…`];
	const rest = words.slice(i).join(" ");
	return [first, rest.length <= max ? rest : `${rest.slice(0, max - 1)}…`];
}
