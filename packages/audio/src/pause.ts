/**
 * Pure pause detector: the AudioEngine only sees views, so "paused" means the
 * tick has not advanced for a while (wall-clock, supplied by the caller).
 */
export interface PauseDetector {
	/** Returns true when the sim looks paused. */
	update(tick: number, nowMs: number): boolean;
}

export function createPauseDetector(thresholdMs = 400): PauseDetector {
	let lastTick = Number.NaN;
	let lastChange = 0;
	return {
		update(tick, nowMs) {
			if (tick !== lastTick) {
				lastTick = tick;
				lastChange = nowMs;
				return false;
			}
			return nowMs - lastChange > thresholdMs;
		},
	};
}
