import type { ContentDB } from "@aitower/content";
import type { SimView } from "@aitower/sim";
import { type CSSProperties, type KeyboardEvent, type PointerEvent as RPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PixelIconSvg } from "../icons/PixelIcon";
import { TREE_ICON } from "../icons/pixelIcons";
import { lanesOf } from "./lanes";
import {
	type Cell,
	MAX_LABELS,
	type OrbLayout,
	type OrbNode,
	type StateMap,
	TREES,
	type View,
	cellStats,
	clampView,
	defaultView,
	fitView,
	orbLayoutFor,
	relatives,
	splitZoom,
	toScreen,
	viewForCell,
	viewForNode,
	visibleCells,
	zoomAt,
} from "./orbModel";
import { ART, drawBackdrop, drawFlora } from "./orbArt";
import { type TreeState, stateSignature } from "./treeState";

const NS_RINGS = [1, 2, 3, 4, 5];
const RA = [0, 125, 255, 375, 470, 560];
const RB = [0, 95, 195, 285, 355, 395];
const STATE_WORD: Record<TreeState, string> = { done: "researched", avail: "ready to start", poor: "ready, needs more points", locked: "locked", lvl: "locked by Level" };
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const fmt = (n: number): string => Math.round(n).toLocaleString("en-US");

export interface FocusReq {
	id: string;
	n: number;
}

export interface OrbProps {
	content: ContentDB;
	view: SimView;
	selId: string | null;
	/** A tech the player asked for by name (Hud link): open on it. Null: open toward what can be researched now. */
	initialFocus?: string | null;
	onSelect: (id: string) => void;
	/** Fly to this tech (a link in the side panel). */
	focus: FocusReq | null;
	/** Research points in hand, for the "short" colour of a cost. */
	rp: number;
}

/** First view: the picked tech if there is one, else toward what can be researched now. */
function initialView(layout: OrbLayout, states: StateMap, selId: string | null, w: number, h: number): View {
	if (selId && layout.byId.has(selId)) return viewForNode(layout, selId, w, h, 1.3);
	return defaultView(layout, states, w, h);
}

const reducedMotion = (): boolean => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface DrawArgs {
	layout: OrbLayout;
	v: View;
	states: StateMap;
	selId: string | null;
	rp: number;
	laneColor: Map<string, string>;
	onSelect: (id: string) => void;
	onCluster: (c: Cell) => void;
	moved: { current: boolean };
}

const globeR = (z: number): number => Math.round(14 * clamp(0.8 + 0.35 * z, 1, 1.7));
const clusterR = (n: number): number => Math.round(clamp(24 + 7 * Math.sqrt(n), 30, 60));
const colorOf = (n: OrbNode, laneColor: Map<string, string>): string => (n.tree === "core" ? (laneColor.get(n.lane) ?? TREES.core.color) : TREES[n.tree].color);

function Leaf({ n, x, y, labelled, st, a }: { n: OrbNode; x: number; y: number; labelled: boolean; st: TreeState; a: DrawArgs }) {
	const R = globeR(a.v.z);
	const c = colorOf(n, a.laneColor);
	const rel = relatives(a.layout, a.selId);
	const isSel = a.selId === n.id;
	const related = rel.prereq.has(n.id) || rel.follow.has(n.id);
	const ready = st === "avail" || st === "poor";
	const side = n.side;
	const lx = side * (R + 9);
	const cost = ready ? `${fmt(n.tech.cost)} RP` : null;
	const lines = n.lines;
	const total = lines.length + (cost ? 1 : 0);
	const y0 = -((total - 1) * 22) / 2 + 5;
	return (
		// biome-ignore lint/a11y/useSemanticElements: an SVG group cannot be a <button>
		<g
			className={`orb-g orb-leaf is-${st} ${isSel ? "is-sel" : ""} ${related ? "is-rel" : ""}`}
			transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`}
			role="button"
			tabIndex={0}
			data-tech={n.id}
			data-state={st}
			aria-label={`${n.name}, ${STATE_WORD[st]}${cost ? `, ${cost}` : ""}`}
			aria-pressed={isSel}
			onClick={() => {
				if (!a.moved.current) a.onSelect(n.id);
			}}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					a.onSelect(n.id);
				}
			}}
		>
			<title>{`${n.name} - ${STATE_WORD[st]}`}</title>
			<g className="orb-pop">
				<circle r={R + 10} fill="transparent" />
				{st === "done" && (
					<>
						<circle r={R + 9} fill={c} opacity={0.14} />
						<circle r={R + 5} fill={c} opacity={0.28} />
						<circle r={R} fill={c} stroke="#fff" strokeWidth={2} className="orb-core" />
						<circle r={R - 6} fill="none" stroke="#04041c" strokeWidth={2} opacity={0.45} />
						<path d="M-6,0 L-2,5 L6,-5" fill="none" stroke="#04041c" strokeWidth={3} strokeLinecap="square" />
					</>
				)}
				{ready && (
					<>
						<circle r={R + 9} fill="#fff6a8" opacity={0.12} />
						<circle r={R + 4} fill="none" stroke="#fff6a8" strokeWidth={3} className="orb-ring" />
						<circle r={R} fill="#101248" stroke="#fff6a8" strokeWidth={3} className="orb-core" />
						<circle r={R - 6} fill={c} />
					</>
				)}
				{(st === "locked" || st === "lvl") && (
					<>
						<circle r={R} fill="#080826" stroke={c} strokeOpacity={0.6} strokeWidth={2} className="orb-core" />
						<rect x={-5} y={-1} width={10} height={8} fill={c} opacity={0.7} />
						<path d="M-3.5,-1 v-4 h7 v4" fill="none" stroke={c} strokeOpacity={0.7} strokeWidth={2} />
					</>
				)}
				{isSel && <circle r={R + 10} fill="none" stroke="#ff6ad5" strokeWidth={2} strokeDasharray="4 3" />}
				{related && !isSel && <circle r={R + 8} fill="none" stroke="#ff6ad5" strokeWidth={2} />}
				{labelled && (
					<text x={lx} y={y0} textAnchor={side > 0 ? "start" : "end"}>
						{lines.map((l, i) => (
							<tspan key={l} x={lx} dy={i ? 22 : 0} className={`orb-lab is-${st}`}>
								{l}
							</tspan>
						))}
						{cost && (
							<tspan x={lx} dy={22} className={`orb-cost ${st === "poor" ? "is-short" : ""}`}>
								{cost}
							</tspan>
						)}
					</text>
				)}
			</g>
		</g>
	);
}

function Cluster({ cell, x, y, labelled, a }: { cell: Cell; x: number; y: number; labelled: boolean; a: DrawArgs }) {
	const st = cellStats(cell, a.states);
	const isRoot = cell.depth === 0;
	// A tree's root globe carries its icon above the count: it needs room for both (28 + 4 + 18 px), so it is never smaller than 46.
	const hasIcon = isRoot && cell.tree !== "core";
	const R = hasIcon ? Math.max(46, clusterR(cell.members.length)) : clusterR(cell.members.length);
	const c = TREES[cell.tree].color;
	const rel = relatives(a.layout, a.selId);
	const hot = cell.members.some((m) => m === a.selId || rel.prereq.has(m) || rel.follow.has(m));
	const circ = 2 * Math.PI * (R - 5);
	const doneArc = st.total ? (st.done / st.total) * circ : 0;
	const name = isRoot ? TREES[cell.tree].name : cell.name;
	const sub = `${st.ready > 0 ? `${st.ready} ready · ` : ""}${st.done}/${st.total} done`;
	return (
		// biome-ignore lint/a11y/useSemanticElements: an SVG group cannot be a <button>
		<g
			className={`orb-g orb-cluster ${hot ? "is-rel" : ""} ${st.ready ? "has-ready" : ""}`}
			transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`}
			role="button"
			tabIndex={0}
			data-cluster={cell.id}
			aria-label={`${name}: ${st.total} techs, ${st.ready} ready, ${st.done} done. Press Enter to zoom in.`}
			onClick={() => {
				if (!a.moved.current) a.onCluster(cell);
			}}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					a.onCluster(cell);
				}
			}}
		>
			<title>{`${name} - ${sub}. Click to zoom in.`}</title>
			<g className="orb-pop">
				<circle r={R + 12} fill="transparent" />
				<circle r={R + 10} fill={c} opacity={0.1} />
				<circle r={R + 6} fill={c} opacity={0.18} />
				{st.ready > 0 && <circle r={R + 6} fill="none" stroke="#fff6a8" strokeWidth={3} className="orb-ring" />}
				<circle r={R} fill="#0a0a30" stroke={c} strokeWidth={3} className="orb-core" />
				<circle r={R - 5} fill="none" stroke={c} strokeOpacity={0.25} strokeWidth={5} />
				<circle r={R - 5} fill="none" stroke="#fff" strokeWidth={5} strokeDasharray={`${doneArc} ${circ}`} transform="rotate(-90)" opacity={0.9} />
				<circle r={R - 14} fill={c} opacity={0.2} />
				{hasIcon && cell.tree !== "core" && <PixelIconSvg name={TREE_ICON[cell.tree]} x={-14} y={-26} size={28} />}
				<text className="orb-count" y={hasIcon ? 26 : 7} textAnchor="middle">
					{st.total}
				</text>
				{hot && <circle r={R + 10} fill="none" stroke="#ff6ad5" strokeWidth={2} strokeDasharray="4 3" />}
				{labelled && (
					<text y={R + 26} textAnchor="middle">
						<tspan x={0} className={`orb-lab ${st.ready ? "is-avail" : "is-done"}`}>
							{name}
						</tspan>
						<tspan x={0} dy={22} className="orb-sub">
							{sub}
						</tspan>
					</text>
				)}
			</g>
		</g>
	);
}

/** Edge between two single globes, as a gentle arc bent toward the middle of the orb. */
function edgePath(a: [number, number], b: [number, number], mid: [number, number], ra: number, rb: number): string {
	const dx = b[0] - a[0];
	const dy = b[1] - a[1];
	const L = Math.hypot(dx, dy) || 1;
	const sx = a[0] + (dx / L) * ra;
	const sy = a[1] + (dy / L) * ra;
	const ex = b[0] - (dx / L) * (rb + 2);
	const ey = b[1] - (dy / L) * (rb + 2);
	const mx = (sx + ex) / 2;
	const my = (sy + ey) / 2;
	return `M${sx.toFixed(1)},${sy.toFixed(1)}Q${(mx + (mid[0] - mx) * 0.22).toFixed(1)},${(my + (mid[1] - my) * 0.22).toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}`;
}

/** Everything drawn on top of the pixel art, in screen space so text stays 16 px at every zoom. */
function Scene({ a }: { a: DrawArgs }) {
	const { layout, v } = a;
	const shown = visibleCells(layout, v);
	const leaves = new Map<string, [number, number, number]>();
	for (const s of shown) if (s.cell.node) leaves.set(s.cell.id, [...toScreen(v, s.cell.x, s.cell.y), globeR(v.z)] as [number, number, number]);
	const mid = toScreen(v, 0, 0);
	const edges: React.ReactNode[] = [];
	for (const [to, froms] of layout.prereqs) {
		const tp = leaves.get(to);
		if (!tp) continue;
		for (const from of froms) {
			const fp = leaves.get(from);
			if (!fp) continue;
			const hot = a.selId === to || a.selId === from;
			const lit = a.states.get(from) === "done";
			const n = layout.byId.get(to);
			const col = hot ? "#ff6ad5" : n ? colorOf(n, a.laneColor) : "#6fd3ff";
			const d = edgePath([fp[0], fp[1]], [tp[0], tp[1]], mid, fp[2], tp[2]);
			edges.push(
				<g key={`${from}>${to}`} className={`orb-edge ${hot ? "is-hot" : ""}`}>
					{(hot || (lit && a.states.get(to) === "done")) && <path d={d} stroke={col} strokeWidth={6} strokeOpacity={0.25} fill="none" />}
					<path d={d} fill="none" stroke={col} strokeWidth={hot ? 3.4 : lit ? 2.2 : 1.4} strokeOpacity={hot ? 1 : lit ? 0.9 : 0.35} strokeDasharray={hot || lit ? undefined : "2 5"} strokeLinecap="round" />
				</g>,
			);
		}
	}
	const rootsOpen = new Map(layout.roots.map((r) => [r.tree, v.z >= splitZoom(r)] as const));
	const world = `translate(${v.w / 2 - v.cx * v.z} ${v.h / 2 - v.cy * v.z}) scale(${v.z})`;
	return (
		<svg className="orb-svg" width={v.w} height={v.h} viewBox={`0 0 ${v.w} ${v.h}`} role="presentation">
			<g transform={world} className="orb-grid">
				{NS_RINGS.map((t) => (
					<ellipse key={t} cx={0} cy={0} rx={RA[t]} ry={RB[t]} className="orb-rg" vectorEffect="non-scaling-stroke" />
				))}
				{[330, 93, 207].map((d) => (
					<line key={d} x1={0} y1={0} x2={Math.cos((d * Math.PI) / 180) * (RA[5] + 30)} y2={Math.sin((d * Math.PI) / 180) * (RB[5] + 30)} className="orb-sp" vectorEffect="non-scaling-stroke" strokeDasharray="3 5" />
				))}
				{rootsOpen.get("core") && (
					<>
						<circle r={16} fill="#0a1a4a" stroke="#7fe6ff" strokeWidth={2} vectorEffect="non-scaling-stroke" opacity={0.7} />
						<circle r={8} fill="#bff3ff" opacity={0.6} />
					</>
				)}
			</g>
			{layout.levelTags.map((t) => {
				const [x, y] = toScreen(v, t.x, t.y);
				return (
					<text key={t.level} x={x} y={y} className="orb-lv">
						{`LV${t.level}`}
					</text>
				);
			})}
			{layout.roots.map((r) => {
				if (r.tree === "core" || !rootsOpen.get(r.tree)) return null;
				const T = TREES[r.tree];
				const ang = (T.deg * Math.PI) / 180;
				const [x, y] = toScreen(v, Math.cos(ang) * RA[5] * 1.06, Math.sin(ang) * RB[5] * 1.06);
				return (
					<g key={r.tree}>
						<PixelIconSvg name={TREE_ICON[r.tree]} x={x - 14} y={y - 46} size={28} />
						<text x={x} y={y} textAnchor="middle" className="orb-rim" fill={T.color}>
							{T.name.toUpperCase()}
						</text>
					</g>
				);
			})}
			<g>{edges}</g>
			<g>
				{shown.map((s) => {
					const [x, y] = toScreen(v, s.cell.x, s.cell.y);
					const n = s.cell.node;
					if (n) return <Leaf key={s.cell.id} n={n} x={x} y={y} labelled={s.labelled} st={a.states.get(n.id) ?? "locked"} a={a} />;
					return <Cluster key={s.cell.id} cell={s.cell} x={x} y={y} labelled={s.labelled} a={a} />;
				})}
			</g>
		</svg>
	);
}

/** The research orb: a pan-and-zoom stage with semantic zoom (see orbModel.ts). */
export function ResearchOrb({ content, view, selId, initialFocus = null, onSelect, focus, rp }: OrbProps) {
	const layout = useMemo(() => orbLayoutFor(content), [content]);
	const { states, sig } = useMemo(() => stateSignature(content, view), [content, view]);
	// biome-ignore lint/correctness/useExhaustiveDependencies: the signature is the cheap stand-in for the state map
	const stable = useMemo(() => states, [sig]);
	const laneColor = useMemo(() => new Map(lanesOf(content).map((l) => [l.id as string, l.color])), [content]);
	const stage = useRef<HTMLDivElement>(null);
	const bg = useRef<HTMLCanvasElement>(null);
	const flora = useRef<HTMLCanvasElement>(null);
	const [size, setSize] = useState({ w: 960, h: 620 });
	const [cur, setCur] = useState<View>(() => initialView(layout, stable, initialFocus, 960, 620));
	const tgt = useRef<View>(cur);
	const curRef = useRef<View>(cur);
	const raf = useRef(0);
	const last = useRef(0);
	const moved = useRef(false);
	const inited = useRef(false);
	const sizeRef = useRef(size);
	const layoutRef = useRef(layout);
	layoutRef.current = layout;
	const statesRef = useRef(stable);
	statesRef.current = stable;

	const step = useCallback((t: number) => {
		const dt = Math.min(0.12, Math.max(0.001, (t - last.current) / 1000));
		last.current = t;
		const c = curRef.current;
		const g = tgt.current;
		const k = 1 - Math.exp(-dt * 9);
		const z = Math.exp(Math.log(c.z) + (Math.log(g.z) - Math.log(c.z)) * k);
		const next: View = { ...g, z, cx: c.cx + (g.cx - c.cx) * k, cy: c.cy + (g.cy - c.cy) * k };
		const done = Math.abs(Math.log(g.z / z)) < 0.002 && Math.hypot(g.cx - next.cx, g.cy - next.cy) * z < 0.4;
		curRef.current = done ? g : next;
		setCur(curRef.current);
		raf.current = done ? 0 : requestAnimationFrame(step);
	}, []);
	const flyTo = useCallback(
		(v: View, snap = false) => {
			tgt.current = v;
			if (snap || reducedMotion()) {
				cancelAnimationFrame(raf.current);
				raf.current = 0;
				curRef.current = v;
				setCur(v);
			} else if (!raf.current) {
				last.current = performance.now();
				raf.current = requestAnimationFrame(step);
			}
		},
		[step],
	);
	useEffect(() => () => cancelAnimationFrame(raf.current), []);

	// Measure the stage. The first real size picks the opening view; later resizes keep the zoom.
	useEffect(() => {
		const el = stage.current;
		if (!el) return;
		const apply = (): void => {
			const w = Math.max(320, Math.round(el.clientWidth));
			const h = Math.max(240, Math.round(el.clientHeight));
			if (w === sizeRef.current.w && h === sizeRef.current.h && inited.current) return;
			sizeRef.current = { w, h };
			setSize({ w, h });
			if (!inited.current) {
				inited.current = true;
				flyTo(initialView(layoutRef.current, statesRef.current, initialFocus, w, h), true);
			} else flyTo(clampView(layoutRef.current, { ...tgt.current, w, h }), true);
		};
		apply();
		if (typeof ResizeObserver === "undefined") return;
		const ro = new ResizeObserver(apply);
		ro.observe(el);
		return () => ro.disconnect();
	}, [flyTo, initialFocus]);

	useEffect(() => {
		if (bg.current) drawBackdrop(bg.current);
		if (flora.current) drawFlora(flora.current);
	}, []);

	// A link in the side panel: fly to that tech and show it as its own globe.
	const focusN = focus?.n ?? 0;
	// biome-ignore lint/correctness/useExhaustiveDependencies: fires once per request
	useEffect(() => {
		if (!focus || !inited.current) return;
		flyTo(viewForNode(layoutRef.current, focus.id, sizeRef.current.w, sizeRef.current.h, Math.max(tgt.current.z, 1.3)));
	}, [focusN]);

	// Wheel zoom around the pointer.
	useEffect(() => {
		const el = stage.current;
		if (!el) return;
		const onWheel = (e: WheelEvent): void => {
			e.preventDefault();
			const r = el.getBoundingClientRect();
			const factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0016));
			flyTo(zoomAt(layoutRef.current, tgt.current, factor, e.clientX - r.left, e.clientY - r.top));
		};
		el.addEventListener("wheel", onWheel, { passive: false });
		return () => el.removeEventListener("wheel", onWheel);
	}, [flyTo]);

	// Drag to pan.
	const drag = useRef<{ x: number; y: number; cx: number; cy: number; on: boolean } | null>(null);
	const onDown = (e: RPointerEvent<HTMLDivElement>): void => {
		if (e.button !== 0 || (e.target as Element).closest("button")) return;
		moved.current = false;
		drag.current = { x: e.clientX, y: e.clientY, cx: tgt.current.cx, cy: tgt.current.cy, on: false };
		const move = (m: PointerEvent): void => {
			const d = drag.current;
			if (!d) return;
			if (!d.on && Math.hypot(m.clientX - d.x, m.clientY - d.y) < 5) return;
			d.on = true;
			moved.current = true;
			stage.current?.classList.add("is-drag");
			const z = tgt.current.z;
			flyTo(clampView(layoutRef.current, { ...tgt.current, cx: d.cx - (m.clientX - d.x) / z, cy: d.cy - (m.clientY - d.y) / z }), true);
		};
		const up = (): void => {
			drag.current = null;
			stage.current?.classList.remove("is-drag");
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", up);
			setTimeout(() => {
				moved.current = false;
			}, 0);
		};
		window.addEventListener("pointermove", move);
		window.addEventListener("pointerup", up);
	};

	const zoomBy = (f: number): void => flyTo(zoomAt(layoutRef.current, tgt.current, f, sizeRef.current.w / 2, sizeRef.current.h / 2));
	const fit = (): void => flyTo(fitView(layoutRef.current, sizeRef.current.w, sizeRef.current.h));
	const home = (): void => flyTo(defaultView(layoutRef.current, statesRef.current, sizeRef.current.w, sizeRef.current.h));
	const onKey = (e: KeyboardEvent<HTMLDivElement>): void => {
		if ((e.target as Element).closest("[data-tech],[data-cluster]") && (e.key === "Enter" || e.key === " ")) return;
		const pan = (dx: number, dy: number): void => flyTo(clampView(layoutRef.current, { ...tgt.current, cx: tgt.current.cx + dx / tgt.current.z, cy: tgt.current.cy + dy / tgt.current.z }));
		const map: Record<string, () => void> = { "0": fit, Home: fit, "+": () => zoomBy(1.4), "=": () => zoomBy(1.4), "-": () => zoomBy(1 / 1.4), _: () => zoomBy(1 / 1.4), h: home, ArrowLeft: () => pan(-120, 0), ArrowRight: () => pan(120, 0), ArrowUp: () => pan(0, -120), ArrowDown: () => pan(0, 120) };
		const f = map[e.key];
		if (!f) return;
		e.preventDefault();
		e.stopPropagation();
		f();
	};

	const args: DrawArgs = { layout, v: cur, states: stable, selId, rp, laneColor, onSelect, onCluster: (c) => flyTo(viewForCell(layoutRef.current, c, sizeRef.current.w, sizeRef.current.h)), moved };
	const worldStyle: CSSProperties = { transform: `translate(${cur.w / 2 - cur.cx * cur.z}px, ${cur.h / 2 - cur.cy * cur.z}px) scale(${cur.z})` };
	const artStyle: CSSProperties = { left: ART.x0, top: ART.y0, width: ART.w, height: ART.h };
	return (
		<div className="orb">
			{/* biome-ignore lint/a11y/noNoninteractiveTabindex lint/a11y/useSemanticElements: the stage takes arrow and zoom keys */}
			<div ref={stage} className="orb-stage" tabIndex={0} role="group" aria-label={`Research orb. ${MAX_LABELS} globes at most are labelled. Scroll to zoom, drag to pan, 0 to fit, arrow keys to move.`} onPointerDown={onDown} onKeyDown={onKey} data-zoom={cur.z.toFixed(2)}>
				<div className="orb-world" style={worldStyle} aria-hidden="true">
					<canvas ref={bg} className="orb-art" style={artStyle} />
					<canvas ref={flora} className="orb-art" style={artStyle} />
				</div>
				<Scene a={args} />
				<div className="orb-scan" />
				<div className="orb-vig" />
				<div className="orb-tools" role="toolbar" aria-label="Zoom">
					<button type="button" className="orb-btn" aria-label="Zoom in" title="Zoom in (+)" onClick={() => zoomBy(1.5)}>
						+
					</button>
					<button type="button" className="orb-btn" aria-label="Zoom out" title="Zoom out (-)" onClick={() => zoomBy(1 / 1.5)}>
						−
					</button>
					<button type="button" className="orb-btn orb-wide" title="Show the whole orb (0)" onClick={fit}>
						Fit <kbd>0</kbd>
					</button>
					<button type="button" className="orb-btn orb-wide" title="Back to what you can research now (H)" onClick={home}>
						Ready now <kbd>H</kbd>
					</button>
				</div>
				<div className="orb-legend" aria-hidden="true">
					<span>
						<i className="lg-done" />
						Done
					</span>
					<span>
						<i className="lg-ready" />
						Ready
					</span>
					<span>
						<i className="lg-locked" />
						Locked
					</span>
					<span className="orb-hint">Wheel: zoom. Drag: move.</span>
				</div>
			</div>
		</div>
	);
}
