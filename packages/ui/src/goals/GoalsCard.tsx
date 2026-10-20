import { useEffect, useRef, useState } from "react";
import type { PanelProps } from "../components/context";
import { pushNotice } from "../notices";
import { type Goal, goalLadder, newlyDone, visibleGoals } from "./goals";
import "./goals.css";

const KEY = "aitower.goals.collapsed";
const FLASH_MS = 3500;

const readCollapsed = (): boolean => {
	try {
		return localStorage.getItem(KEY) === "1";
	} catch {
		return false;
	}
};

/** The always-visible "what now" card: the next 1 to 3 goals with progress. Replaces NEXT as the main guide. */
export function GoalsCard({ state, content }: Pick<PanelProps, "state" | "content">) {
	const ladder = goalLadder(state.view, content);
	// Goals already done when the card first appears (a loaded game) are latched silently: no toast, no tick.
	const latched = useRef<Set<string> | null>(null);
	if (latched.current === null) latched.current = new Set(ladder.filter((g) => g.done).map((g) => g.id));
	const [flash, setFlash] = useState<Goal[]>([]);
	const [collapsed, setCollapsed] = useState(readCollapsed);

	useEffect(() => {
		const fresh = newlyDone(ladder, latched.current as Set<string>);
		if (fresh.length === 0) return;
		for (const g of fresh) {
			(latched.current as Set<string>).add(g.id);
			pushNotice({ text: `Goal done: ${g.title}`, severity: "good", key: `goal:${g.id}` });
		}
		setFlash((f) => [...f, ...fresh]);
		const t = setTimeout(() => setFlash((f) => f.filter((g) => !fresh.includes(g))), FLASH_MS);
		return () => clearTimeout(t);
	});

	const goals = visibleGoals(ladder, latched.current);
	if (goals.length === 0 && flash.length === 0) return null;
	const toggle = (): void => {
		const v = !collapsed;
		setCollapsed(v);
		try {
			localStorage.setItem(KEY, v ? "1" : "0");
		} catch {
			/* best effort */
		}
	};
	const main = goals[0];
	return (
		<section className={`ui-goals ${collapsed ? "is-collapsed" : ""}`} data-tut="goals" aria-label="Goals">
			<button type="button" className="ui-goals-head" onClick={toggle} aria-expanded={!collapsed} title={collapsed ? "Show goals" : "Hide goals"}>
				<span className="ui-label">GOALS</span>
				{collapsed && main && <span className="ui-goals-peek">{main.title}</span>}
				<span className="ui-goals-chev" aria-hidden="true">
					{collapsed ? "▸" : "▾"}
				</span>
			</button>
			{!collapsed && (
				<ul className="ui-goals-list">
					{flash.map((g) => (
						<li key={g.id} className="ui-goal is-done">
							<span className="ui-goal-title">
								<span className="ui-goal-tick" aria-hidden="true">
									✓
								</span>
								{g.title}
							</span>
						</li>
					))}
					{goals.map((g, i) => (
						<li key={g.id} className={`ui-goal ${i === 0 ? "is-main" : ""}`} data-goal={g.id}>
							<span className="ui-goal-title">{g.title}</span>
							<span className="ui-goal-num">{g.progress}</span>
							<span className="ui-goal-bar" role="progressbar" tabIndex={-1} aria-valuemin={0} aria-valuemax={g.need} aria-valuenow={Math.round(g.have)} aria-label={g.title}>
								<i style={{ width: `${Math.round((g.have / g.need) * 100)}%` }} />
							</span>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
