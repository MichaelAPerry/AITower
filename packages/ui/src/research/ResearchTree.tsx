import type { ContentDB, LaneDef, TechLane } from "@aitower/content";
import type { SimView } from "@aitower/sim";
import { type CSSProperties, type KeyboardEvent, type PointerEvent as RPointerEvent, type ReactNode, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { branchView } from "./researchText";
import { fmtRp } from "./tech";
import { HEAD_H, LINE_LABEL, NODE_H, NODE_W, type Dir, type TreeLayout, laneOf, lanesOf, layoutFor, neighbor, wrapName } from "./treeLayout";
import { type TreeState, stateSignature } from "./treeState";

// SVG groups cannot be <button> or <fieldset>, so the roles are spelled out here.
const NODE_ROLE = "button";
const GROUP_ROLE = "group";
const MIN_SCALE = 0.35;
const MAX_SCALE = 1.8;
const STATE_WORD: Record<TreeState, string> = { done: "researched", avail: "ready to start", poor: "needs more research points", locked: "locked, a prerequisite is missing", lvl: "locked by Level" };
const STATE_TAG: Record<TreeState, string> = { done: "✓ DONE", avail: "READY", poor: "NEED RP", locked: "LOCKED", lvl: "" };
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const cssVar = (c: string): CSSProperties => ({ "--lc": c }) as CSSProperties;

export interface TreeProps {
	content: ContentDB;
	view: SimView;
	selId: string | null;
	onSelect: (id: string) => void;
	/** The Inspector for the selected node, shown beside (or below) the tree. */
	inspector: ReactNode;
}

interface BodyArgs {
	layout: TreeLayout;
	lanes: Map<TechLane, LaneDef>;
	content: ContentDB;
	states: Map<string, TreeState>;
	tier: number;
	selId: string | null;
	focusId: string | null;
}

/** The whole SVG. Built once per layout, state signature and selection; hover, zoom, pan and lane isolate never rebuild it. */
function Body({ layout, lanes, content, states, tier, selId, focusId }: BodyArgs) {
	const names = new Map((content.tech ?? []).map((t) => [t.id, t]));
	const hot = new Set<string>();
	if (selId) {
		hot.add(selId);
		for (const e of layout.edges) if (e.from === selId || e.to === selId) hot.add(`${e.from}>${e.to}`);
	}
	return (
		<>
			{layout.tiers.map((t) => (
				<g key={t.tier} className={`rt-col ${t.tier > tier ? "is-future" : ""} ${t.tier === tier ? "is-now" : ""}`}>
					<rect className="rt-colbg" x={t.x} y={HEAD_H - 8} width={t.w} height={layout.height - HEAD_H + 8} />
					<text className="rt-colh" x={t.x + t.w / 2} y={22} textAnchor="middle">
						{`LEVEL ${t.tier}${t.tier === tier ? " · NOW" : ""}`}
					</text>
				</g>
			))}
			{layout.lanes.map((l) => {
				const def = lanes.get(l.id);
				const color = def?.color ?? "#888";
				return (
					<g key={l.id} className="rt-lane" data-lane={l.id} style={cssVar(color)}>
						{def?.pitch ? <title>{`${def.name}: ${def.advisor ? `${def.advisor}. ` : ""}${def.pitch}`}</title> : null}
						<rect className="rt-lb" x={0} y={l.y} width={layout.width} height={l.h} rx={6} />
						<rect className="rt-ls" x={0} y={l.y} width={4} height={l.h} />
						<text className="rt-lt" x={14} y={l.y + 22}>
							{(def?.name ?? l.id).toUpperCase()}
						</text>
						{def?.path && (
							<text className="rt-lsub" x={14} y={l.y + 36}>
								PATH BRANCH
							</text>
						)}
						{l.bands.map((b, i) =>
							b.line ? (
								<g key={b.line}>
									{i > 0 && <line className="rt-bsep" x1={10} x2={layout.width - 6} y1={b.y - 6} y2={b.y - 6} />}
									<text className="rt-lsub rt-line" x={14} y={b.y + (i === 0 ? 38 : 16)}>
										{LINE_LABEL[b.line]}
									</text>
								</g>
							) : null,
						)}
					</g>
				);
			})}
			{layout.edges.map((e) => {
				const live = states.get(e.from) === "done";
				const on = hot.has(`${e.from}>${e.to}`);
				const color = lanes.get(e.lane)?.color ?? "#888";
				return <path key={`${e.from}>${e.to}`} className={`rt-e ${e.cross ? "is-x" : ""} ${live ? "is-live" : ""} ${on ? "is-hot" : ""}`} data-lane={e.lane} data-l2={e.fromLane} d={e.d} style={cssVar(color)} />;
			})}
			{layout.nodes.map((n) => {
				const t = names.get(n.id);
				if (!t) return null;
				const st = states.get(n.id) ?? "locked";
				const [l1, l2] = wrapName(t.name);
				const color = lanes.get(n.lane)?.color ?? "#888";
				const tag = st === "lvl" ? `LEVEL ${t.minTier}` : STATE_TAG[st];
				return (
					// biome-ignore lint/a11y/useAriaPropsSupportedByRole: the SVG group has role=button (see NODE_ROLE)
					<g
						key={n.id}
						className={`rt-n s-${st} ${selId === n.id ? "is-sel" : ""} ${hot.has(n.id) ? "is-hot" : ""}`}
						data-id={n.id}
						data-tech={n.id}
						data-lane={n.lane}
						transform={`translate(${n.x},${n.y})`}
						style={cssVar(color)}
						tabIndex={focusId === n.id ? 0 : -1}
						role={NODE_ROLE}
						aria-pressed={selId === n.id}
						aria-label={`${t.name}, ${lanes.get(n.lane)?.name ?? n.lane}, Level ${t.minTier}, ${STATE_WORD[st]}${st === "done" ? "" : `, ${fmtRp(t.cost)}`}`}
					>
						<title>{t.name}</title>
						<rect className="rt-nb" width={NODE_W} height={NODE_H} rx={5} />
						<rect className="rt-nstripe" width={5} height={NODE_H} rx={2} />
						<text className="rt-nt" x={13} y={l2 ? 16 : 20}>
							{l1}
						</text>
						{l2 && (
							<text className="rt-nt" x={13} y={28}>
								{l2}
							</text>
						)}
						<text className="rt-ns" x={13} y={NODE_H - 5}>
							{tag}
						</text>
						{st !== "done" && (
							<text className="rt-nc" x={NODE_W - 8} y={NODE_H - 5} textAnchor="end">
								{fmtRp(t.cost)}
							</text>
						)}
					</g>
				);
			})}
		</>
	);
}

const MemoBody = memo(Body);

/** Research as a tree: lanes (rows) by Levels (columns), prerequisite lines, zoom, pan, lane isolate and keyboard focus. */
export function ResearchTree({ content, view, selId, onSelect, inspector }: TreeProps) {
	const laneDefs = useMemo(() => lanesOf(content), [content]);
	const laneMap = useMemo(() => new Map(laneDefs.map((l) => [l.id, l])), [laneDefs]);
	const selLane = selId ? (content.tech ?? []).find((t) => t.id === selId) : undefined;
	// Wetware keeps its secrets (same rule as the old tabs): the lane stays out of sight until something in it can be reached.
	const wet = branchView(content, view, "wetware");
	const showWet = wet.ready.length + wet.next.length + wet.done.length > 0 || (selLane !== undefined && laneOf(selLane) === "wet");
	const layout = layoutFor(content, showWet ? [] : ["wet"]);
	const { states, sig } = stateSignature(content, view);
	const focusId = selId && layout.byId.has(selId) ? selId : (layout.nodes[0]?.id ?? null);
	const shownSel = selId && layout.byId.has(selId) ? selId : null;

	const [iso, setIso] = useState<TechLane | null>(null);
	const [hover, setHover] = useState<TechLane | null>(null);
	const vpRef = useRef<HTMLDivElement>(null);
	const svgRef = useRef<SVGSVGElement>(null);
	const pctRef = useRef<HTMLSpanElement>(null);
	const scaleRef = useRef(0.8);
	const layoutRef = useRef(layout);
	layoutRef.current = layout;

	// biome-ignore lint/correctness/useExhaustiveDependencies: sig stands for the states (same signature, same drawing)
	const body = useMemo(() => <MemoBody layout={layout} lanes={laneMap} content={content} states={states} tier={view.tier} selId={shownSel} focusId={focusId} />, [layout, laneMap, content, sig, shownSel, focusId]);

	const setScale = useCallback((next: number, px?: number, py?: number) => {
		const vp = vpRef.current;
		const svg = svgRef.current;
		if (!vp || !svg) return;
		const l = layoutRef.current;
		const old = scaleRef.current;
		const s = clamp(next, MIN_SCALE, MAX_SCALE);
		const ax = px ?? vp.clientWidth / 2;
		const ay = py ?? vp.clientHeight / 2;
		const cx = (vp.scrollLeft + ax) / old;
		const cy = (vp.scrollTop + ay) / old;
		svg.setAttribute("width", String(Math.round(l.width * s)));
		svg.setAttribute("height", String(Math.round(l.height * s)));
		vp.scrollLeft = cx * s - ax;
		vp.scrollTop = cy * s - ay;
		scaleRef.current = s;
		if (pctRef.current) pctRef.current.textContent = `${Math.round(s * 100)}%`;
	}, []);
	const fit = useCallback(() => {
		const vp = vpRef.current;
		if (!vp) return;
		setScale((vp.clientWidth - 6) / layoutRef.current.width);
		vp.scrollLeft = 0;
	}, [setScale]);

	const reveal = useCallback((id: string, center: boolean) => {
		const vp = vpRef.current;
		const n = layoutRef.current.byId.get(id);
		if (!vp || !n) return;
		const s = scaleRef.current;
		const x = n.x * s;
		const y = n.y * s;
		const w = NODE_W * s;
		const h = NODE_H * s;
		const out = x < vp.scrollLeft || x + w > vp.scrollLeft + vp.clientWidth || y < vp.scrollTop || y + h > vp.scrollTop + vp.clientHeight;
		if (center || out) vp.scrollTo({ left: Math.max(0, x - (vp.clientWidth - w) / 2), top: Math.max(0, y - (vp.clientHeight - h) / 2) });
	}, []);

	// On open: fit the width (not smaller than a readable size), then bring the picked node into view.
	// biome-ignore lint/correctness/useExhaustiveDependencies: once on mount
	useEffect(() => {
		const vp = vpRef.current;
		if (!vp) return;
		setScale(Math.max(0.62, Math.min(1, (vp.clientWidth - 6) / layoutRef.current.width)));
		if (shownSel) reveal(shownSel, true);
	}, []);
	useEffect(() => {
		if (shownSel) reveal(shownSel, false);
	}, [shownSel, reveal]);

	// Wheel zoom toward the pointer; it has to be a non-passive listener to stop the page from scrolling.
	useEffect(() => {
		const vp = vpRef.current;
		if (!vp) return;
		const onWheel = (e: WheelEvent): void => {
			e.preventDefault();
			const r = vp.getBoundingClientRect();
			setScale(scaleRef.current * (e.deltaY < 0 ? 1.12 : 1 / 1.12), e.clientX - r.left, e.clientY - r.top);
		};
		vp.addEventListener("wheel", onWheel, { passive: false });
		return () => vp.removeEventListener("wheel", onWheel);
	}, [setScale]);

	const drag = useRef<{ x: number; y: number; l: number; t: number } | null>(null);
	const down = (e: RPointerEvent<HTMLDivElement>): void => {
		const vp = vpRef.current;
		if (!vp || e.button !== 0 || e.pointerType === "touch" || (e.target as Element).closest(".rt-n")) return;
		drag.current = { x: e.clientX, y: e.clientY, l: vp.scrollLeft, t: vp.scrollTop };
		vp.classList.add("is-drag");
		vp.setPointerCapture(e.pointerId);
	};
	const move = (e: RPointerEvent<HTMLDivElement>): void => {
		const d = drag.current;
		const vp = vpRef.current;
		if (!d || !vp) return;
		vp.scrollLeft = d.l - (e.clientX - d.x);
		vp.scrollTop = d.t - (e.clientY - d.y);
	};
	const up = (): void => {
		drag.current = null;
		vpRef.current?.classList.remove("is-drag");
	};

	const nodeOf = (t: EventTarget | null): string | null => (t as Element | null)?.closest?.(".rt-n")?.getAttribute("data-id") ?? null;
	const keys = (e: KeyboardEvent<SVGSVGElement>): void => {
		const id = nodeOf(e.target);
		if (!id) return;
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			onSelect(id);
			return;
		}
		const dir: Dir | null = e.key === "ArrowLeft" ? "left" : e.key === "ArrowRight" ? "right" : e.key === "ArrowUp" ? "up" : e.key === "ArrowDown" ? "down" : null;
		if (!dir) return;
		e.preventDefault();
		const to = neighbor(layoutRef.current, id, dir);
		if (to) svgRef.current?.querySelector<SVGElement>(`.rt-n[data-id="${to}"]`)?.focus();
	};
	const laneOver = (t: EventTarget | null): void => {
		const l = ((t as Element | null)?.closest?.("[data-lane]")?.getAttribute("data-lane") ?? null) as TechLane | null;
		setHover((h) => (h === l ? h : l));
	};

	const pickLane = (id: TechLane): void => {
		const next = iso === id ? null : id;
		setIso(next);
		const vp = vpRef.current;
		const l = layoutRef.current.lanes.find((x) => x.id === next);
		if (vp && l) vp.scrollTo({ top: Math.max(0, l.y * scaleRef.current - 8) });
	};

	const availBy = new Map<TechLane, number>();
	for (const n of layout.nodes) if (states.get(n.id) === "avail") availBy.set(n.lane, (availBy.get(n.lane) ?? 0) + 1);
	const readId = hover ?? (shownSel ? layout.byId.get(shownSel)?.lane : undefined);
	const readLane = readId ? laneMap.get(readId) : undefined;

	return (
		<div className="rt">
			<div className="rt-tools" role="toolbar" aria-label="Research tree view">
				<button type="button" className="rt-btn" aria-label="Zoom out" title="Zoom out (or scroll the wheel down)" onClick={() => setScale(scaleRef.current / 1.2)}>
					−
				</button>
				<span className="rt-pct" ref={pctRef} aria-hidden="true">
					80%
				</span>
				<button type="button" className="rt-btn" aria-label="Zoom in" title="Zoom in (or scroll the wheel up)" onClick={() => setScale(scaleRef.current * 1.2)}>
					+
				</button>
				<button type="button" className="rt-btn" title="Fit the tree to the width of this panel" onClick={fit}>
					Fit
				</button>
				<button type="button" className="rt-btn" title="Actual size" onClick={() => setScale(1)}>
					100%
				</button>
				<span className="rt-sp" />
				{layout.lanes.map((l) => {
					const def = laneMap.get(l.id);
					const n = availBy.get(l.id) ?? 0;
					return (
						<button key={l.id} type="button" className="rt-chip" aria-pressed={iso === l.id} data-lane-chip={l.id} style={cssVar(def?.color ?? "#888")} title={def?.pitch ? `${def.name}: ${def.pitch}` : (def?.name ?? l.id)} onClick={() => pickLane(l.id)}>
							{def?.short ?? l.id}
							{n > 0 && <b>{n}</b>}
						</button>
					);
				})}
			</div>
			<div className="rt-main">
				<div className="rt-vp" ref={vpRef} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
					<svg
						ref={svgRef}
						className="rt-svg"
						data-iso={iso ?? ""}
						viewBox={`0 0 ${layout.width} ${layout.height}`}
						width={Math.round(layout.width * scaleRef.current)}
						height={Math.round(layout.height * scaleRef.current)}
						role={GROUP_ROLE}
						aria-label={`Research tree: ${layout.nodes.length} technologies in ${layout.lanes.length} lanes across ${layout.tiers.length} Levels. Arrow keys move between technologies, Enter selects.`}
						onClick={(e) => {
							const id = nodeOf(e.target);
							if (id) onSelect(id);
						}}
						onKeyDown={keys}
						onPointerOver={(e) => laneOver(e.target)}
						onPointerLeave={() => setHover(null)}
					>
						{body}
					</svg>
				</div>
				<aside className="pnl-insp rt-insp" aria-label="Details">
					{inspector}
				</aside>
			</div>
			<p className="rt-pitch" aria-live="off">
				{readLane ? (
					<>
						<b style={{ color: readLane.color }}>{readLane.name}</b>
						{readLane.pitch ? ` · ${readLane.advisor}: “${readLane.pitch}”` : null}
					</>
				) : (
					"Hover a lane to hear why to go down it. Click a lane name to isolate it. Wheel zooms, drag pans."
				)}
			</p>
			<div className="rt-legend" aria-hidden="true">
				<span><i className="rt-sw s-done" />Done</span>
				<span><i className="rt-sw s-avail" />Ready to start</span>
				<span><i className="rt-sw s-locked" />Locked: needs a prerequisite</span>
				<span><i className="rt-sw s-lvl" />Level too low</span>
				<span><i className="rt-ln" />In-lane prerequisite</span>
				<span><i className="rt-ln is-x" />From another lane</span>
			</div>
		</div>
	);
}
