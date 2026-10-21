import type { TechBranch, TechNode } from "@aitower/content";
import { Meter } from "../components/common";
import { FlavorLine } from "../components/FlavorLine";
import type { PanelProps } from "../components/context";
import { PATH_COLOR } from "../ascension/ascension";
import { pushNotice } from "../notices";
import { ListHeading, PanelHead, PanelTabs, PrimaryAction, SplitPane } from "../panel/PanelShell";
import { Jargon, TermScope } from "../glossary/Term";
import { branchView, chain, defaultBranch, defaultPick, etaText, getLines, groupOf, isSpoilerTech, PATH_NOTE, plainName, rpPerHour, tabsFor, whyText } from "./researchText";
import { fmtRp, nodeState, techList } from "./tech";

const rpText = (n: number): string => `${Math.floor(Math.max(0, n) + 1e-9).toLocaleString("en-US")} RP`;

/** Research on the shared panel shell: branch tabs, what you can start, what is next, and an Inspector in plain words. */
export function ResearchPanel({ store, content, state, ui, setUi }: PanelProps) {
	const { view } = state;
	const tabs = tabsFor(content, view);
	const nodes = techList(content);
	const picked = ui.researchSel ? nodes.find((n) => n.id === ui.researchSel) : undefined;
	const tab: TechBranch = (ui.researchTab && tabs.some((t) => t.id === ui.researchTab) ? ui.researchTab : null) ?? picked?.branch ?? defaultBranch(content, view);
	const bv = branchView(content, view, tab);
	const sel = picked && picked.branch === tab ? picked : nodes.find((n) => n.id === defaultPick(content, view, tab));
	const rp = view.researchPoints ?? 0;
	const perHour = rpPerHour(view, content);

	const nextId = defaultPick(content, view, tab);
	const nextPick = nextId && nextId !== sel?.id ? nodes.find((n) => n.id === nextId) : undefined;
	const goal = sel && nodeState(sel, view, content).kind !== "researched" ? sel : undefined;

	const start = (n: TechNode): void => {
		const r = store.dispatch({ type: "research", techId: n.id });
		if (!r.ok) pushNotice({ text: r.reason, severity: "warn", key: `res:${r.reason}` });
	};

	const card = (n: TechNode) => {
		const s = nodeState(n, view, content);
		const g = groupOf(n, view, content);
		const on = sel?.id === n.id;
		const masked = isSpoilerTech(n) && s.kind !== "researched" && s.kind !== "available" && s.kind !== "poor";
		const sub = masked ? "Details sealed until you can start it" : plainName(n, content);
		return (
			<button key={n.id} type="button" role="option" aria-selected={on} data-tech={n.id} className={`pnl-card ${on ? "is-sel" : ""} ${g === "next" ? "is-blocked" : ""}`} onClick={() => setUi({ researchSel: n.id, researchTab: n.branch })}>
				<span className="pnl-card-top">
					<span className="pnl-card-name">
						{g === "done" ? "✓ " : ""}
						{n.name}
					</span>
					{g !== "done" && <span className="pnl-card-pay">{rpText(n.cost)}</span>}
				</span>
				<span className="pnl-card-sub">{sub}</span>
				{g === "ready" && s.kind === "available" && <span className="pnl-fit is-ok">Ready to start ✓</span>}
				{g === "ready" && s.kind === "poor" && <span className="pnl-fit is-no">Need {s.short.toLocaleString("en-US")} more RP</span>}
				{g === "next" && s.kind === "locked" && <span className="pnl-card-sub">{s.reason}</span>}
			</button>
		);
	};

	let inspector: React.ReactNode;
	if (sel) {
		const s = nodeState(sel, view, content);
		const masked = isSpoilerTech(sel) && s.kind !== "researched" && s.kind !== "available" && s.kind !== "poor";
		const steps = chain(sel, view, content);
		const kicker = `Research · ${tabs.find((t) => t.id === sel.branch)?.label ?? sel.branch}${sel.minTier > 1 ? ` · Level ${sel.minTier}` : ""}`;
		inspector = (
			<>
				<div className="bld-kicker">{kicker}</div>
				<h3 className="bld-h">{sel.name}</h3>
				{masked ? (
					<p className="bld-blurb">Details stay sealed until you can start this one.</p>
				) : (
					<>
						<p className="bld-blurb">
							<Jargon text={`${plainName(sel, content)}.`} />
						</p>
						{sel.path && (
							<p className="res-path">
								<span className="ui-pathchip" data-path={sel.path} style={{ color: PATH_COLOR[sel.path] }}>
									{sel.path}
								</span>
								<span>{PATH_NOTE(sel.path)}</span>
							</p>
						)}
						<h4 className="res-h">What you get</h4>
						<ul className="res-get">
							{getLines(sel, content).map((l) => (
								<li key={l.title}>
									<b>{l.title}</b>
									<span>
										<Jargon text={l.sub} />
									</span>
								</li>
							))}
							{getLines(sel, content).length === 0 && (
								<li>
									<b>A step forward</b>
									<span>Nothing new by itself. Later research needs it first.</span>
								</li>
							)}
						</ul>
						<h4 className="res-h">Why it helps</h4>
						<p className="bld-blurb">
							<Jargon text={whyText(sel, content)} />
						</p>
					</>
				)}
				{steps.length > 0 && (
					<>
						<h4 className="res-h">You need first</h4>
						<ol className="res-chain">
							{steps.map((p) => (
								<li key={p.id} className={p.done ? "is-done" : "is-missing"}>
									<span aria-hidden="true">{p.done ? "✓" : "○"}</span> {p.name}
								</li>
							))}
							<li className="is-this">
								<span aria-hidden="true">▸</span> {sel.name}
							</li>
						</ol>
					</>
				)}
				{s.kind !== "researched" && <p className="pnl-small">{etaText(sel.cost, view, content)}</p>}
				{s.kind === "researched" ? (
					<>
						<p className="bld-placing">Researched ✓. It is already working for you.</p>
						{nextPick && (
							<button type="button" className="ui-btn pnl-secondary" onClick={() => setUi({ researchSel: nextPick.id, researchTab: nextPick.branch })}>
								Show me what to research next
							</button>
						)}
					</>
				) : (
					<PrimaryAction
						label={`Start research · ${rpText(sel.cost)}`}
						tut="research-go"
						disabled={s.kind !== "available"}
						why={s.kind === "poor" ? `Need ${s.short.toLocaleString("en-US")} more RP (you have ${Math.floor(rp)}). Racks earn points while they run jobs.` : s.kind === "locked" ? s.reason.replace("Requires ", "First: ") : null}
						onClick={() => start(sel)}
					/>
				)}
				{!masked && <FlavorLine flavor={sel.flavor} />}
			</>
		);
	} else {
		inspector = (
			<>
				<div className="bld-kicker">Research</div>
				<h3 className="bld-h">Pick something</h3>
				<p className="bld-blurb">Research unlocks new machines and permanent bonuses. Click an item on the left to read what it does.</p>
			</>
		);
	}

	const list = (
		<>
			{bv.ready.length > 0 && <ListHeading count={bv.ready.length}>Available now</ListHeading>}
			{bv.ready.map(card)}
			{bv.next.length > 0 && <ListHeading count={bv.next.length}>Next up</ListHeading>}
			{bv.next.map(card)}
			{bv.ready.length + bv.next.length === 0 && <p className="pnl-empty">Nothing new here yet. Finish research in the other tabs, or level up.</p>}
			{bv.laterCount > 0 && <p className="pnl-note res-later">{bv.laterCount} more later. They appear when you get closer.</p>}
			{bv.done.length > 0 && <ListHeading count={bv.done.length}>Done</ListHeading>}
			{bv.done.map(card)}
		</>
	);

	return (
		<>
			<PanelHead kicker="Unlock new machines and bonuses" title="Research" aside={<span className="res-rp" title="Research points. Racks earn them while they run jobs.">{fmtRp(rp)}</span>} />
			<p className="pnl-note res-rate">{perHour > 0 ? `Earning about ${perHour < 10 ? perHour.toFixed(1) : Math.round(perHour)} RP per game hour from your racks.` : "Not earning yet. Racks earn research points while they run jobs."}</p>
			{goal && (
				<div className="res-top">
					<Meter value={Math.min(1, rp / Math.max(1, goal.cost))} tone={rp >= goal.cost ? "good" : "warn"} height={5} />
					<span>
						Saving for {goal.name}: {rpText(rp)} of {rpText(goal.cost)}
					</span>
				</div>
			)}
			<PanelTabs label="Research branch" value={tab} onPick={(id) => setUi({ researchTab: id, researchSel: null })} tabs={tabs.map((t) => ({ id: t.id, label: t.ready > 0 ? `${t.label} · ${t.ready}` : t.label, title: t.ready > 0 ? `${t.ready} ready to start` : undefined }))} />
			<SplitPane list={list} inspector={<TermScope key={sel?.id ?? "none"}>{inspector}</TermScope>} />
		</>
	);
}
