import type { ContentDB } from "@aitower/content";
import type { SimView } from "@aitower/sim";
import { type KeyboardEvent, useEffect, useRef } from "react";
import { ADVISOR_ORDER, ADVISORS } from "../advisors/advisors";
import { Portrait } from "../advisors/Portrait";
import { epilogueAdvisor, type TreeCard, treeCards } from "./soul";
import "./soul.css";

/** One column: a tree's points and pace, its ladder, what comes next, its speed factor and its seal. */
export function TreeColumn({ card }: { card: TreeCard }) {
	const champ = ADVISORS[card.champion];
	return (
		<article className="trees-col" data-tree={card.tree} style={{ ["--tree" as string]: card.color }}>
			<header className="trees-head">
				<Portrait id={card.champion} size={36} />
				<div>
					<h3>{card.name}</h3>
					<small>
						{card.branch} racks · {champ.first} argues for it
					</small>
				</div>
			</header>
			<div className="trees-sp">
				<b>
					{Math.floor(card.sp)} <small>/ {card.target} points</small>
				</b>
				<span className="trees-track">
					<i style={{ width: `${Math.round(card.frac * 100)}%` }} />
				</span>
				<span className="trees-rate">{card.rate}</span>
			</div>
			<ol className="trees-ladder" aria-label={`${card.branch} rungs`}>
				{card.ladder.map((r) => (
					<li key={r.rung} className={`is-${r.status}`}>
						<span className="trees-rung">R{r.rung}</span>
						<span className="trees-rack">{r.name}</span>
						<span className="trees-meta">
							{r.status === "held" ? "built" : `Level ${r.level}`} · {r.pflops} PF
						</span>
					</li>
				))}
			</ol>
			<p className="trees-next">{card.next}</p>
			<div className="trees-factor">
				{card.factor.map((t) => (
					<p key={t}>{t}</p>
				))}
			</div>
			{card.seal ? (
				<div className={`trees-seal ${card.seal.closed ? "is-closed" : ""}`}>
					<div className="trees-seal-row">
						<span>SEAL</span>
						<span className="trees-track is-seal">
							<i style={{ width: `${Math.round((card.seal.value / card.seal.max) * 100)}%` }} />
						</span>
						<b>{card.seal.closed ? "CLOSED" : `${Math.round(card.seal.value)} / ${card.seal.max}`}</b>
					</div>
					{card.seal.hurting.length > 0 ? (
						<p className="trees-hurt">
							<span>Hurting it:</span> {card.seal.hurting.join(", ")}
						</p>
					) : (
						<p className="trees-hurt">Nothing you built is hurting it.</p>
					)}
					<p className="trees-hurt">At {card.seal.max} the branch closes: no new retrofits, and its racks stop scoring.</p>
				</div>
			) : (
				<div className="trees-seal">
					<p className="trees-hurt">No seal. The Lattice never closes, but everything it builds scars the other two.</p>
				</div>
			)}
		</article>
	);
}

/**
 * The Trees panel: three columns, opened by clicking the Singularity bars in the top strip. Esc or a click outside closes it;
 * the game keeps running underneath.
 */
export function TreesPanel({ view, content, onClose }: { view: Pick<SimView, "soul" | "tier" | "techResearched">; content: ContentDB; onClose: () => void }) {
	const root = useRef<HTMLDivElement>(null);
	useEffect(() => root.current?.focus(), []);
	const soul = view.soul;
	if (!soul) return null;
	const cards = treeCards(view, content);
	const speaker = epilogueAdvisor(soul);
	const onKey = (e: KeyboardEvent<HTMLDivElement>): void => {
		e.stopPropagation();
		if (e.key === "Escape") {
			e.preventDefault();
			onClose();
		}
	};
	return (
		<div className="trees-overlay" ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label="The three trees" onKeyDown={onKey} onClick={onClose}>
			{/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: only stops the backdrop's click-to-close; Esc closes */}
			<div className="trees-panel ui-panel" onClick={(e) => e.stopPropagation()}>
				<header className="trees-title">
					<h2>THE THREE TREES</h2>
					<p>The first tree to {soul.spTarget} points ends the world its way. Only racks retrofitted down a tree score for it. Select a rack to retrofit it.</p>
				</header>
				<div className="trees-cols">
					{cards.map((c) => (
						<TreeColumn key={c.tree} card={c} />
					))}
				</div>
				<footer className="trees-bonds">
					<span>Bonds:</span>
					{ADVISOR_ORDER.map((id) => (
						<span key={id} className="trees-bond">
							{ADVISORS[id].first} {Math.round(soul.bonds[id])}
						</span>
					))}
					<span className="trees-bond-note">{speaker ? `${ADVISORS[speaker].first} will speak at the end.` : `The advisor you trust most (${soul.bondEpilogue}+) speaks at the end.`}</span>
				</footer>
				<button type="button" className="ui-btn trees-close" onClick={onClose}>
					Close (Esc)
				</button>
			</div>
		</div>
	);
}
