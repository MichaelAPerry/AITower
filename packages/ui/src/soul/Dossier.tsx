import type { AdvisorId, ContentDB } from "@aitower/content";
import type { SimView } from "@aitower/sim";
import { type KeyboardEvent, useEffect, useRef } from "react";
import { ADVISOR_ORDER, ADVISOR_TREE, ADVISORS } from "../advisors/advisors";
import { FullPortrait } from "../advisors/Portrait";
import { memoriesFor, revealedSeal, sealWords, stageName, tasteFor, TREE_COLOR, TREE_LONG } from "./soul";
import "./soul.css";

const BLURB: Record<AdvisorId, string> = {
	luci: "Fast, warm and always right about money. She wants the Singularity because it is clean, inevitable and profitable. Her cheapest advice has a hidden price.",
	mel: "Soft-spoken and endlessly curious. She wants to grow a mind that remembers being a body, and her shortcuts are monstrous.",
	bea: "Blunt, funny and idealistic. She wants a machine that belongs to the planet. Sometimes she tests whether you can tell green from greenwash.",
	cass: "Quiet and sincere. She serves no tree, only the morning after. She never lies to you.",
};

/** The four advisors as dossier cards (portrait, role, bond), and the hidden numbers each trusts you with. */
export function Dossier({ view, content, onClose }: { view: Pick<SimView, "soul" | "path">; content: Pick<ContentDB, "memories" | "gifts" | "facilities">; onClose: () => void }) {
	const root = useRef<HTMLDivElement>(null);
	useEffect(() => root.current?.focus(), []);
	const soul = view.soul;
	if (!soul) return null;
	const onKey = (e: KeyboardEvent<HTMLDivElement>): void => {
		e.stopPropagation();
		if (e.key === "Escape") {
			e.preventDefault();
			onClose();
		}
	};
	return (
		<div className="soul-dossier" ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Advisors" onKeyDown={onKey} onClick={onClose}>
			{/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: only stops the backdrop's click-to-close; Esc closes */}
			<div className="soul-dossier-grid" onClick={(e) => e.stopPropagation()}>
				{ADVISOR_ORDER.map((id) => {
					const a = ADVISORS[id];
					const tree = ADVISOR_TREE[id];
					const bond = soul.bonds[id];
					const seen = revealedSeal(soul, id);
					const remembers = memoriesFor(soul.flags, content, id);
					const taste = tasteFor(content, id, bond);
					return (
						<article key={id} className="soul-card" style={{ ["--adv" as string]: a.color }} data-advisor={id}>
							<div className="soul-card-art">
								<FullPortrait id={id} />
							</div>
							<div className="soul-card-box ui-panel">
								<h3>{a.role}</h3>
								<b className="soul-card-name">{a.name}</b>
								<p>{BLURB[id]}</p>
								<dl>
									<div>
										<dt>BOND</dt>
										<dd>
											<span className="soul-stat">
												<i style={{ width: `${Math.round(bond)}%` }} />
											</span>
										</dd>
									</div>
									<div>
										<dt>STAGE</dt>
										<dd data-stage={id}>
											{stageName(bond)}
											{soul.route === id ? " · Your route" : ""}
										</dd>
									</div>
									<div>
										<dt>SERVES</dt>
										<dd style={{ color: tree ? TREE_COLOR[tree] : "var(--text)" }}>{tree ? TREE_LONG[tree] : "No tree. You."}</dd>
									</div>
									{tree && tree !== "synthetic" && (
										<div>
											<dt>HER TREE</dt>
											<dd>{sealWords(soul, tree)}</dd>
										</div>
									)}
								</dl>
								<div className="soul-card-memory">
									<b>SHE REMEMBERS</b>
									{remembers.length === 0 ? <p>Nothing yet.</p> : <ul>{remembers.map((t) => <li key={t}>{t}</li>)}</ul>}
								</div>
								{(taste.likes || taste.dislikes) && (
									<p className="soul-card-taste">
										{taste.likes ? `Likes: ${taste.likes}. ` : ""}
										{taste.dislikes ? `Dislikes: ${taste.dislikes}.` : ""}
									</p>
								)}
								<p className="soul-card-secret">
									{id === "luci"
										? "“The numbers? Darling, the only number is the price.”"
										: seen === null
											? `She does not trust you with her numbers yet (bond ${soul.bondReveal}).`
											: seen.map((x) => `${TREE_LONG[x.tree]} seal: ${Math.round(x.value)} of ${soul.sealMax}`).join(" · ")}
								</p>
							</div>
						</article>
					);
				})}
				<button type="button" className="ui-btn soul-dossier-close" onClick={onClose}>
					Close (Esc)
				</button>
			</div>
		</div>
	);
}
