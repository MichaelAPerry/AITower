import { loadProgress, shouldNudge, tutorialDone, update as primerUpdate } from "../primer/progress";
import { useCallback, useEffect, useMemo, useState } from "react";
import { findItem } from "../build/catalog";
import type { PanelProps } from "../components/context";
import { pushNotice } from "../notices";
import { cheapestAvailable } from "../research/tech";
import { acted, dismiss, initialPace, type PaceState, pace } from "./pace";
import { type AssistantAction, type Suggestion, tipFor } from "./suggest";
import "./assistant.css";

/** UNIT-7, drawn inline so it follows the theme tokens. The eyes blink and the antenna pulses (CSS; off under reduced motion). */
export function Robot({ mood = "idle" }: { mood?: "idle" | "talk" }) {
	return (
		<svg className={`ast-svg is-${mood}`} viewBox="0 0 64 76" width="56" height="66" role="img" aria-hidden="true" focusable="false">
			<line className="ast-ant" x1="32" y1="11" x2="32" y2="3" />
			<circle className="ast-bulb" cx="32" cy="3.5" r="3" />
			<rect className="ast-head" x="9" y="11" width="46" height="34" rx="11" />
			<rect className="ast-visor" x="14" y="17" width="36" height="21" rx="8" />
			<g className="ast-eyes">
				<rect className="ast-eye" x="21" y="23" width="7" height="9" rx="3" />
				<rect className="ast-eye" x="36" y="23" width="7" height="9" rx="3" />
			</g>
			<path className="ast-smile" d="M27 35.5q5 3 10 0" />
			<rect className="ast-ear" x="4" y="22" width="5" height="12" rx="2.5" />
			<rect className="ast-ear" x="55" y="22" width="5" height="12" rx="2.5" />
			<rect className="ast-body" x="16" y="48" width="32" height="22" rx="8" />
			<rect className="ast-panel" x="25" y="54" width="14" height="6" rx="2" />
			<circle className="ast-led" cx="32" cy="57" r="1.6" />
			<rect className="ast-arm" x="8" y="51" width="7" height="14" rx="3.5" />
			<rect className="ast-arm" x="49" y="51" width="7" height="14" rx="3.5" />
			<rect className="ast-foot" x="20" y="70" width="9" height="4" rx="2" />
			<rect className="ast-foot" x="35" y="70" width="9" height="4" rx="2" />
		</svg>
	);
}

/** Carry out a suggestion's action in the HUD. */
export function runAction(a: AssistantAction, p: Pick<PanelProps, "store" | "content" | "setUi" | "openResearch" | "openAscension">): void {
	const { store, content, setUi } = p;
	if ("focus" in a && a.focus) store.focus(a.focus);
	switch (a.kind) {
		case "build": {
			const item = findItem(a.defId, content);
			if (!item) return;
			setUi({ paletteOpen: true, paletteTab: item.category, drawer: null, buildHover: null });
			store.setTool(item.tool);
			return;
		}
		case "lift":
			setUi({ paletteOpen: true, paletteTab: "structure", drawer: null, buildHover: null });
			store.setTool({ kind: "lift" });
			return;
		case "supplies":
			setUi({ paletteOpen: true, paletteTab: "supplies", drawer: null, buildHover: null });
			return;
		case "drawer":
			setUi({ drawer: a.drawer, paletteOpen: false, buildHover: null });
			return;
		case "inbox":
			setUi({ inboxOpen: true });
			return;
		case "research":
			p.openResearch(cheapestAvailable(store.get().view, content)?.id);
			return;
		case "ascension":
			p.openAscension();
			return;
	}
}

/** True while a coach mark (the first-session tutorial or a just-in-time hint) is on screen. */
const coachShowing = (): boolean => typeof document !== "undefined" && !!document.querySelector(".aitower-hud .ui-coach");

export interface AssistantProps extends PanelProps {
	candidates: readonly Suggestion[];
}

/**
 * The helper robot: shows one suggestion at a time in a speech bubble (Show me / Not now), or a short tip when clicked.
 * Quiet while the tutorial coach marks run; pacing and cooldowns are in `pace.ts`.
 */
export function Assistant(props: AssistantProps) {
	const { store, state, candidates } = props;
	const tick = state.view.tick;
	const [ps, setPs] = useState<PaceState>(initialPace);
	const [quiet, setQuiet] = useState(true);
	const [tip, setTip] = useState<{ text: string; n: number } | null>(null);

	// The coach marks live in their own component: poll for them instead of coupling the two.
	useEffect(() => {
		const check = (): void => setQuiet(coachShowing());
		check();
		const iv = setInterval(check, 600);
		return () => clearInterval(iv);
	}, []);

	// One time, after the coach marks: point at the Primer.
	const [nudge, setNudge] = useState(false);
	useEffect(() => {
		if (nudge || quiet || !shouldNudge(tutorialDone(), loadProgress())) return;
		setNudge(true);
		primerUpdate({ nudged: true });
	}, [nudge, quiet]);

	const decided = useMemo(() => pace(ps, candidates, tick, quiet), [ps, candidates, tick, quiet]);
	useEffect(() => {
		if (decided.state !== ps) setPs(decided.state);
	}, [decided.state, ps]);
	const current = decided.current;
	const shown = current && !tip && !nudge ? current : null;

	const answer = useCallback(
		(fn: typeof dismiss, id: string) => {
			setPs((s) => fn(s, id, tick));
			setTip(null);
		},
		[tick],
	);
	const turnOff = (): void => {
		store.setSettings({ assistant: false });
		pushNotice({ text: "UNIT-7 is off. Turn it back on in Settings.", severity: "info", key: "assistant-off" });
	};

	return (
		<aside className="ast" data-help="assistant" aria-label="Assistant UNIT-7">
			{(shown || tip || nudge) && (
				<div className="ast-bubble ui-panel" role="status" aria-live="polite">
					<span className="ast-name">UNIT-7</span>
					<p className="ast-text">{nudge ? "New to datacenters? The Primer explains power, heat and money in plain words, one short page each. Press K any time." : shown ? shown.text : tip?.text}</p>
					<div className="ast-btns">
						{nudge ? (
							<>
								<button
									type="button"
									className="ui-btn is-on ast-go"
									onClick={() => {
										props.setUi({ drawer: "primer", encyId: "ch:what", paletteOpen: false, buildHover: null });
										setNudge(false);
									}}
								>
									Open the Primer
								</button>
								<button type="button" className="ui-btn" onClick={() => setNudge(false)}>
									Later
								</button>
							</>
						) : shown ? (
							<>
								<button
									type="button"
									className="ui-btn is-on ast-go"
									onClick={() => {
										runAction(shown.action, props);
										answer(acted, shown.id);
									}}
								>
									{shown.cta}
								</button>
								<button type="button" className="ui-btn" onClick={() => answer(dismiss, shown.id)}>
									Not now
								</button>
							</>
						) : (
							<>
								<button type="button" className="ui-btn is-on" onClick={() => setTip(null)}>
									Thanks
								</button>
								<button type="button" className="ui-btn" onClick={() => setTip({ text: tipFor(tick, (tip?.n ?? 0) + 1), n: (tip?.n ?? 0) + 1 })}>
									Another tip
								</button>
							</>
						)}
					</div>
				</div>
			)}
			<div className="ast-dock">
				<button
					type="button"
					className={`ast-bot ${shown ? "has-news" : ""}`}
					aria-label={shown ? "UNIT-7 has a suggestion" : "UNIT-7, the assistant. Click for a tip"}
					title="UNIT-7"
					onClick={() => setTip((t) => (t || shown ? null : { text: tipFor(tick), n: 0 }))}
				>
					<Robot mood={shown || tip || nudge ? "talk" : "idle"} />
				</button>
				<button type="button" className="ast-off" aria-label="Turn off assistant" title="Turn off assistant" onClick={turnOff}>
					×
				</button>
			</div>
		</aside>
	);
}
