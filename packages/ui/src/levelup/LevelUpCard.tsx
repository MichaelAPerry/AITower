import type { ContentDB } from "@aitower/content";
import type { GameState } from "@aitower/shared";
import { useEffect, useRef, useState } from "react";
import { levelUpInfo } from "./levelUp";
import "./levelUp.css";

/** "What changed" after a Level-up: the items this Level opens, grouped by tier. Calm, dismissible, never blocks the game. */
export function LevelUpCard({ content, state }: { content: ContentDB; state: GameState }) {
	const level = state.view.tier;
	const day = state.view.day;
	const prev = useRef({ level, day });
	const [shown, setShown] = useState<number | null>(null);
	useEffect(() => {
		// A real Level-up is one step on the same game; a new game or a load (any other jump) shows nothing.
		const p = prev.current;
		if (level === p.level + 1 && day >= p.day && day - p.day <= 1) setShown(level);
		prev.current = { level, day };
	}, [level, day]);
	if (shown === null) return null;
	const info = levelUpInfo(content, shown);
	return (
		<aside className="lvl-card ui-panel" aria-label={`Level ${shown} reached`} data-levelup>
			<div className="lvl-head">
				<span className="lvl-kicker">Level {shown} reached</span>
				<button type="button" className="ui-btn ui-mini" onClick={() => setShown(null)} aria-label="Dismiss">
					Dismiss
				</button>
			</div>
			<h3 className="lvl-h">What changed</h3>
			{info.items.length > 0 ? (
				<ul className="lvl-list">
					{info.items.map((i) => (
						<li key={i.id} className={i.tier.className}>
							<span className="tier-chip">{i.tier.label}</span> {i.name}
						</li>
					))}
				</ul>
			) : (
				<p className="lvl-p">No new machines at this Level.</p>
			)}
			{info.pathItems > 0 && <p className="lvl-p">{info.pathItems} more {info.pathItems === 1 ? "item" : "items"} for the paths, once you choose one.</p>}
			{info.nodes > 0 && <p className="lvl-p">{info.nodes} research {info.nodes === 1 ? "step opens" : "steps open"} at this Level (R).</p>}
		</aside>
	);
}
