/**
 * When UNIT-7 may speak. Pure, keyed on game ticks. Calm rules:
 *  - one suggestion at a time, and it stays until the problem is gone or the player answers it;
 *  - a dismissed or acted-on suggestion is silent for a cooldown;
 *  - a new suggestion waits a minimum interval after the last one (urgent problems wait less);
 *  - while `quiet` (the tutorial is running), nothing is shown and nothing is spent.
 */
import type { Suggestion } from "./suggest";

export const DISMISS_COOLDOWN = 1440; // one game day
export const ACTED_COOLDOWN = 360; // six game hours after "Show me"
export const MIN_GAP = 180; // three game hours between new suggestions
export const URGENT_GAP = 45;

export interface PaceState {
	/** Id of the suggestion on screen, or null. */
	shown: string | null;
	/** Tick the last new suggestion appeared (or the last one was answered), -Infinity at the start. */
	lastAt: number;
	/** id → tick until which it stays silent. */
	until: Record<string, number>;
}

export const initialPace = (): PaceState => ({ shown: null, lastAt: Number.NEGATIVE_INFINITY, until: {} });

const silent = (s: PaceState, id: string, tick: number): boolean => (s.until[id] ?? Number.NEGATIVE_INFINITY) > tick;

/** Advance the state for this tick and say which candidate (if any) to show. */
export function pace(s: PaceState, candidates: readonly Suggestion[], tick: number, quiet: boolean): { state: PaceState; current: Suggestion | null } {
	if (quiet) return { state: s, current: null };
	if (s.shown) {
		const keep = candidates.find((c) => c.id === s.shown);
		if (keep && !silent(s, keep.id, tick)) {
			// A problem (heat, breakage, the red) may take over from a nice-to-have that is on screen.
			const urgent = keep.urgent ? undefined : candidates.find((c) => c.urgent && !silent(s, c.id, tick));
			if (!urgent) return { state: s, current: keep };
			return { state: { ...s, shown: urgent.id, lastAt: tick }, current: urgent };
		}
		// Solved, or answered: the slot is free; the gap counts from now.
		s = { ...s, shown: null, lastAt: tick };
	}
	const next = candidates.find((c) => !silent(s, c.id, tick));
	if (!next) return { state: s, current: null };
	const gap = next.urgent ? URGENT_GAP : MIN_GAP;
	if (tick - s.lastAt < gap) return { state: s, current: null };
	return { state: { ...s, shown: next.id, lastAt: tick }, current: next };
}

/** "Not now": silent for a day. */
export const dismiss = (s: PaceState, id: string, tick: number): PaceState => ({ ...s, shown: s.shown === id ? null : s.shown, lastAt: tick, until: { ...s.until, [id]: tick + DISMISS_COOLDOWN } });

/** "Show me": the player is acting on it; silent for six hours so it does not nag while they work. */
export const acted = (s: PaceState, id: string, tick: number): PaceState => ({ ...s, shown: s.shown === id ? null : s.shown, lastAt: tick, until: { ...s.until, [id]: tick + ACTED_COOLDOWN } });
