import type { ContentDB, TechNode } from "@aitower/content";
import type { GameStore } from "@aitower/shared";
import type { SimView } from "@aitower/sim";
import { type KeyboardEvent, useEffect, useRef } from "react";
import { Icon, Pill, Stamp } from "../components/common";
import { focusables, nextFocusIndex } from "../menu/focus";
import { StampBtn } from "../menu/parts";
import { pushNotice } from "../notices";
import { BRANCHES, branchLabel, branchNodes, effectText, fmtRp, nodeState, requirementList, techList, unlocksFor } from "./tech";

export function TechCard({ node, view, content, store }: { node: TechNode; view: SimView; content: ContentDB; store: GameStore }) {
	const st = nodeState(node, view, content);
	const unlocks = unlocksFor(node.id, content);
	const reqs = requirementList(node, view, content);
	const file = (): void => {
		const r = store.dispatch({ type: "research", techId: node.id });
		if (!r.ok) pushNotice({ text: r.reason, severity: "warn", key: `res:${r.reason}` });
	};
	return (
		<li className={`ui-tech is-${st.kind}`} data-tech={node.id}>
			<header className="ui-tech-head">
				<span className="ui-tech-name">{node.name}</span>
				<span className="ui-tech-cost" title={`${node.cost} research points`}>
					{node.cost} RP
				</span>
			</header>
			<div className="ui-tech-meta">
				<Pill tone="dim">{branchLabel(node.branch)}</Pill>
				{node.minTier > 1 && <span className="ui-tech-tier">Clearance {node.minTier}</span>}
			</div>
			{node.effects.length > 0 && (
				<ul className="ui-tech-fx">
					{node.effects.map((e) => (
						<li key={effectText(e, content)}>{effectText(e, content)}</li>
					))}
				</ul>
			)}
			{unlocks.length > 0 && (
				<p className="ui-tech-unlocks">
					<b>Unlocks:</b> {unlocks.join(", ")}
				</p>
			)}
			{reqs.length > 0 && (
				<p className="ui-tech-reqs">
					<b>Needs:</b>{" "}
					{reqs.map((r, i) => (
						<span key={r.id} className={r.done ? "is-done" : "is-missing"}>
							{i > 0 ? ", " : ""}
							{r.done ? "✓ " : ""}
							{r.name}
						</span>
					))}
				</p>
			)}
			{node.description && <p className="ui-tech-desc">{node.description}</p>}
			<footer className="ui-tech-foot">
				{st.kind === "researched" && (
					<Stamp tone="green" className="ui-tech-filed">
						Researched
					</Stamp>
				)}
				{st.kind === "available" && <StampBtn tone="green" rest="Research" hot="Started" onClick={file} title={`Start research: spend ${node.cost} RP on ${node.name}`} />}
				{st.kind === "poor" && (
					<span className="ui-tech-state is-poor" title={`${node.name} costs ${node.cost} RP; you are ${st.short} short`}>
						Need {st.short} more RP
					</span>
				)}
				{st.kind === "locked" && (
					<span className="ui-tech-state is-locked" title={st.reason}>
						<Icon name="lock" size={10} /> 
						{st.reason}
					</span>
				)}
			</footer>
		</li>
	);
}

/**
 * DEPARTMENT OF RESEARCH: a full-screen sheet with one column per branch and an index card per node.
 * The game is paused while it is open (the Hud does that); R or Esc closes it.
 */
export function ResearchSheet({ store, content, view, onClose }: { store: GameStore; content: ContentDB; view: SimView; onClose: () => void }) {
	const root = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const els = root.current ? focusables(root.current) : [];
		(els.find((e) => e.closest(".ui-tech.is-available")) ?? els[0])?.focus();
	}, []);

	const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
		// Nothing typed in the sheet may reach the game hotkeys or the camera.
		e.stopPropagation();
		if (e.key === "Escape" || ((e.key === "r" || e.key === "R") && !e.ctrlKey && !e.metaKey && !e.altKey)) {
			e.preventDefault();
			onClose();
			return;
		}
		if (e.key !== "Tab" || !root.current) return;
		const els = focusables(root.current);
		const i = nextFocusIndex(els.length, els.indexOf(document.activeElement as HTMLElement), e.shiftKey);
		if (i >= 0) {
			e.preventDefault();
			els[i].focus();
		}
	};

	const empty = techList(content).length === 0;
	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: modal sheet; the key handler implements Esc, R and the focus loop
		<div className="ui-research-backdrop" ref={root} onKeyDown={onKeyDown}>
			<section className="ui-research" role="dialog" aria-modal="true" aria-labelledby="research-title">
				<header className="ui-research-head">
					<div className="ui-research-titles">
						<span className="ui-research-form">RESEARCH QUEUE</span>
						<h2 id="research-title">DEPARTMENT OF RESEARCH</h2>
					</div>
					<div className="ui-research-rp ui-crt crt-amber" title="Unspent research points. Delivering compute and finishing jobs earns them.">
						<span className="ui-label">POINTS</span>
						<span className="ui-big">{fmtRp(view.researchPoints ?? 0)}</span>
					</div>
					<span className="ui-research-pause">GAME PAUSED</span>
					<button type="button" className="ui-btn ui-research-close" onClick={onClose} title="Close the Department of Research (R or Esc)">
						Close
					</button>
				</header>
				{empty ? (
					<p className="ui-empty ui-pad">No research started yet.</p>
				) : (
					<div className="ui-research-cols">
						{BRANCHES.map((b) => (
							<div key={b.id} className="ui-research-col">
								<h3 className="ui-research-branch">{b.label}</h3>
								<ul className="ui-research-list">
									{branchNodes(content, b.id).map((n) => (
										<TechCard key={n.id} node={n} view={view} content={content} store={store} />
									))}
								</ul>
							</div>
						))}
					</div>
				)}
			</section>
		</div>
	);
}
