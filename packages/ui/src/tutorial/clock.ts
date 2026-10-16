import type { GameStore } from "@aitower/shared";
import { type ClockMode, RUN_SPEED } from "./steps";

/**
 * Put the game clock where the current step wants it, but only when the wanted mode CHANGES (or on entry,
 * prev = null). The player's own speed button presses in between are therefore respected.
 * - "pause": speed 0.
 * - "run": at least RUN_SPEED (a faster speed the player already chose is kept).
 * Returns the mode now in force, to pass back as `prev`.
 */
export function applyClock(store: GameStore, mode: ClockMode, prev: ClockMode | null): ClockMode {
	if (mode === prev) return mode;
	const speed = store.get().speed;
	if (mode === "pause") {
		if (speed !== 0) store.setSpeed(0);
	} else if (speed < RUN_SPEED) store.setSpeed(RUN_SPEED);
	return mode;
}

/** Closing the induction must not leave the player staring at a frozen game: a stopped clock restarts at 1×. */
export function releaseClock(store: GameStore): void {
	if (store.get().speed === 0) store.setSpeed(1);
}

/** One line for the memo's clock strip. */
export function clockStatus(mode: ClockMode, speed: number, reason?: string): { running: boolean; text: string } {
	if (speed === 0) return { running: false, text: mode === "run" ? "CLOCK STOPPED · press 3× so time can pass" : "CLOCK STOPPED · nothing moves while you work" };
	if (mode === "run") return { running: true, text: `CLOCK RUNNING AT ${speed}×${reason ? ` · ${reason}` : ""}` };
	return { running: true, text: `CLOCK RUNNING AT ${speed}×` };
}
