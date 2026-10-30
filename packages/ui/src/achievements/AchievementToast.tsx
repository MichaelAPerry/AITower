import type { GameState } from "@aitower/shared";
import { useEffect, useRef, useState } from "react";
import { ACHIEVEMENTS, type AchievementDef, awardFor } from "./achievements";

/** How long the strip stays (spec: 4 seconds; the game keeps running). */
export const ACHIEVEMENT_TOAST_MS = 4000;

// Dev builds expose `window.__aitower`, which can set anything, so nothing is awarded there (spec, "Cheating by dev tools").
const devBuild = (): boolean => !!(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV;

/**
 * Runs the achievement checks on each `newDay` event and shows a top-centre strip for what unlocked.
 * Events already in the log at mount, and a load (tick going backwards), never award on their own.
 */
export function AchievementToast({ state, defs = ACHIEVEMENTS, enabled = !devBuild() }: { state: GameState; defs?: readonly AchievementDef[]; enabled?: boolean }) {
	const [shown, setShown] = useState<AchievementDef[]>([]);
	const cursor = useRef<number | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the log only, like the toast stack: the view is read at the moment the event is seen
	useEffect(() => {
		const log = state.log;
		const last = log[log.length - 1];
		const c = cursor.current;
		cursor.current = last ? last.tick : -1;
		if (c === null || !last || last.tick < c || !enabled) return;
		if (!log.some((e) => e.tick > c && e.event.type === "newDay")) return;
		const won = awardFor("dayClose", state.view, undefined, defs);
		if (won.length) setShown((s) => [...s, ...won]);
	}, [state.log]);

	useEffect(() => {
		if (!shown.length) return;
		const h = setTimeout(() => setShown((s) => s.slice(1)), ACHIEVEMENT_TOAST_MS);
		return () => clearTimeout(h);
	}, [shown]);

	const now = shown[0];
	if (!now) return null;
	return (
		<div className="ui-ach-toast" role="status" aria-live="polite" data-achievement={now.id}>
			<span className="ui-ach-tag">ACHIEVEMENT</span>
			<span className="ui-ach-name">{now.name}</span>
			<span className="ui-ach-text">{now.text}</span>
		</div>
	);
}
