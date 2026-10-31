import type { TechNode } from "@aitower/content";
import { useState } from "react";
import { PATH_COLOR } from "../ascension/ascension";
import { Meter } from "../components/common";
import { FlavorLine } from "../components/FlavorLine";
import { SheetIcon } from "../components/SheetIcon";
import type { PanelProps } from "../components/context";
import { Jargon, TermScope } from "../glossary/Term";
import { pushNotice } from "../notices";
import { PrimaryAction } from "../panel/PanelShell";
import { laneName, laneOf, lanesOf } from "./lanes";
import { TREES, treeOfTech } from "./orbModel";
import { type FocusReq, ResearchOrb } from "./ResearchOrb";
import { goalProgress, panelFacts } from "./orbPanel";
import { PATH_NOTE, getLines, plainName, rpPerHour, whyText } from "./researchText";
import { researchIcon } from "./researchIcons";
import { cheapestAvailable, fmtRp, nodeState, techList } from "./tech";

const rpText = (n: number): string => `${Math.floor(Math.max(0, n) + 1e-9).toLocaleString("en-US")} RP`;

type Ctx = Pick<PanelProps, "content" | "setUi"> & { view: PanelProps["state"]["view"] };

/** Research: one screen. The orb (semantic zoom, see orbModel.ts) on the left, the picked tech on the right, the pinned goal on top. */
export function ResearchPanel({ store, content, state, ui, setUi }: PanelProps) {
	const { view } = state;
	const nodes = techList(content);
	const picked = ui.researchSel ? nodes.find((n) => n.id === ui.researchSel) : undefined;
	// Nothing picked: the cheapest tech you can start, else the first one not done.
	const sel = picked ?? cheapestAvailable(view, content) ?? nodes.find((n) => nodeState(n, view, content).kind !== "researched") ?? nodes[0];
	const goalNode = ui.researchGoal ? nodes.find((n) => n.id === ui.researchGoal && nodeState(n, view, content).kind !== "researched") : undefined;
	const rp = view.researchPoints ?? 0;
	const perHour = rpPerHour(view, content);
	const need = view.tierNeed;
	const [focus, setFocus] = useState<FocusReq | null>(null);
	const go = (id: string): void => {
		setUi({ researchSel: id });
		setFocus((f) => ({ id, n: (f?.n ?? 0) + 1 }));
	};

	const start = (n: TechNode): void => {
		const r = store.dispatch({ type: "research", techId: n.id });
		if (!r.ok) pushNotice({ text: r.reason, severity: "warn", key: `res:${r.reason}` });
	};

	return (
		<div className="orb-wrap" data-research-orb>
			<header className="orb-top">
				<div className="orb-title">
					<h2>Research</h2>
					<span className="res-rp" title="Research points. Racks earn them while they run jobs.">
						{fmtRp(rp)}
					</span>
					<span className="res-rate">{perHour > 0 ? `+${perHour < 10 ? perHour.toFixed(1) : Math.round(perHour)} RP per game hour` : "Not earning yet. Racks earn points while they run jobs."}</span>
				</div>
				<div className="orb-goal" data-goal={goalNode?.id}>
					{goalNode ? (
						<>
							<button type="button" className="orb-goal-name" onClick={() => go(goalNode.id)} title="Show this on the orb">
								Goal: {goalNode.name}
							</button>
							<Meter value={goalProgress(goalNode.cost, rp)} tone={rp >= goalNode.cost ? "good" : "warn"} height={8} />
							<span className="orb-goal-num">
								{rpText(rp)} of {rpText(goalNode.cost)}
							</span>
						</>
					) : (
						<span className="orb-goal-none">No goal pinned. Pick a globe and press Pin as goal.</span>
					)}
				</div>
				{need !== undefined && (
					<p className="res-tier" data-help="res-level">
						{need === null ? "You are at the top Level." : need.techs > 0 ? `Level ${need.tier} needs ${need.techs} technologies researched: ${Math.min(need.techsDone, need.techs)} done.` : `Level ${need.tier} needs no research, only output and uptime.`}
					</p>
				)}
			</header>
			<div className="orb-main">
				<ResearchOrb content={content} view={view} selId={sel?.id ?? null} initialFocus={picked?.id ?? null} onSelect={(id) => setUi({ researchSel: id })} focus={focus} rp={rp} />
				<aside className="orb-side" aria-label="Details">
					<div className="orb-side-body">
					<TermScope key={sel?.id ?? "none"}>{sel ? <ResearchDetails node={sel} view={view} content={content} setUi={setUi} go={go} /> : <p className="bld-blurb">Pick a globe to read what it does.</p>}</TermScope>
					</div>
					{sel && <ResearchFooter node={sel} view={view} content={content} setUi={setUi} goalId={goalNode?.id} start={start} />}
				</aside>
			</div>
		</div>
	);
}

export function ResearchFooter({ node, view, content, goalId, setUi, start }: Ctx & { node: TechNode; goalId?: string; start: (n: TechNode) => void }) {
	const f = panelFacts(node, view, content);
	const pinned = goalId === node.id;
	return (
		<footer className="orb-foot">
			{f.state !== "done" && (
				<dl className="orb-cost">
					<div>
						<dt>Cost</dt>
						<dd>{rpText(f.cost)}</dd>
					</div>
					<div>
						<dt>You have</dt>
						<dd>{rpText(f.have)}</dd>
					</div>
					<div>
						<dt>Short</dt>
						<dd className={f.short ? "is-no" : "is-ok"}>{f.short ? rpText(f.short) : "none"}</dd>
					</div>
				</dl>
			)}
			{f.state !== "done" && <p className="orb-eta">{f.eta}</p>}
			{f.state === "done" ? (
				<p className="bld-placing">Researched ✓. It is already working for you.</p>
			) : (
				<PrimaryAction label={`Start research · ${rpText(node.cost)}`} tut="research-go" disabled={f.state !== "ready"} why={f.why} onClick={() => start(node)} />
			)}
			{f.state !== "done" && (
				<button type="button" className="ui-btn pnl-secondary orb-pin" aria-pressed={pinned} data-pin={node.id} onClick={() => setUi({ researchGoal: pinned ? null : node.id })}>
					{pinned ? "Unpin goal" : "Pin as goal"}
				</button>
			)}
		</footer>
	);
}


export function ResearchDetails({ node, view, content, setUi, go: goTo }: Ctx & { node: TechNode; go: (id: string) => void }) {
	const f = panelFacts(node, view, content);
	const lane = lanesOf(content).find((l) => l.id === laneOf(node));
	const tree = treeOfTech(node);
	const cell = researchIcon(node.id);
	const locked = f.state === "locked" || f.masked;
	const kicker = `${tree === "core" ? `Core · ${laneName(laneOf(node), content)}` : TREES[tree].name}${node.minTier > 1 ? ` · Level ${node.minTier}` : ""}`;
	const color = tree === "core" ? (lane?.color ?? TREES.core.color) : TREES[tree].color;
	return (
		<>
			<div className="res-head">
				{cell && <SheetIcon cell={cell} size={64} locked={locked} hidden={f.masked} className="res-icon" />}
				<div className="res-head-text">
					<div className="orb-kicker" style={{ color }}>
						{kicker}
					</div>
					<h3 className="orb-name">{node.name}</h3>
					<span className={`orb-badge is-${f.state}`}>{f.state === "done" ? "✓ Researched" : f.state === "ready" ? "Ready" : f.state === "short" ? "Ready, needs points" : "Locked"}</span>
				</div>
			</div>
			{f.masked ? (
				<p className="bld-blurb">Details stay sealed until you can start this one.</p>
			) : (
				<>
					<p className="bld-blurb">
						<Jargon text={`${plainName(node, content)}.`} />
					</p>
					{node.path && (
						<p className="res-path">
							<span className="ui-pathchip" data-path={node.path} style={{ color: PATH_COLOR[node.path] }}>
								{node.path}
							</span>
							<span>{PATH_NOTE(node.path)}</span>
						</p>
					)}
					<h4 className="res-h">What you get</h4>
					<ul className="res-get">
						{getLines(node, content).map((l) => (
							<li key={l.title}>
								<b>
									{l.title}
									{l.tier && <span className={`tier-chip ${l.tier.className}`}>{l.tier.label}</span>}
								</b>
								<span>
									<Jargon text={l.sub} />
								</span>
							</li>
						))}
						{getLines(node, content).length === 0 && (
							<li>
								<b>A step forward</b>
								<span>Nothing new by itself. Later research needs it first.</span>
							</li>
						)}
					</ul>
					<h4 className="res-h">Why it helps</h4>
					<p className="bld-blurb">
						<Jargon text={whyText(node, content)} />
					</p>
				</>
			)}
			{f.needs.length > 0 && (
				<>
					<h4 className="res-h">Needs first</h4>
					<ul className="res-chain">
						{f.needs.map((p) => (
							<li key={p.id} className={p.done ? "is-done" : "is-missing"}>
								<span aria-hidden="true">{p.done ? "✓" : "○"}</span>
								{p.id === "_tier" ? (
									<span>{p.name}</span>
								) : (
									<button type="button" className="res-link" onClick={() => goTo(p.id)}>
										{p.name}
									</button>
								)}
							</li>
						))}
					</ul>
				</>
			)}
			{f.leads.length > 0 && (
				<>
					<h4 className="res-h">Leads to</h4>
					<ul className="res-chain">
						{f.leads.map((c) => (
							<li key={c.id}>
								<span aria-hidden="true">▸</span>
								<button type="button" className="res-link" onClick={() => goTo(c.id)}>
									{c.name}
								</button>
							</li>
						))}
					</ul>
				</>
			)}
				{!f.masked && lane?.pitch && (
				<p className="bld-blurb res-pitch" style={{ borderLeftColor: lane.color }}>
					<b>{lane.advisor}:</b> “{lane.pitch}”
				</p>
			)}
			{!f.masked && (
				<button type="button" className="ui-btn pnl-secondary res-read" data-read={node.id} onClick={() => setUi({ drawer: "handbook", encyId: `tech:${node.id}`, paletteOpen: false, buildHover: null })}>
					Read: {node.name}
				</button>
			)}
			{!f.masked && <FlavorLine flavor={node.flavor} />}
		</>
	);
}
