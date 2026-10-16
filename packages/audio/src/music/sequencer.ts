/**
 * Lookahead sequencer core. Pure: time comes from the caller (`tick(now)`) and
 * notes leave through `play`, so it is testable with a fake clock. The loop
 * position is a pure function of time since `anchor`, so after a long gap
 * (throttled background tab) it skips the missed steps and stays on the grid.
 */
import type { Score, ScoreNote, Stem } from "./score";

export const LOOKAHEAD_S = 0.1;
export const TICK_MS = 25;
/** First step starts this long after the first tick. */
const START_DELAY_S = 0.08;
/** A step this late (timer jitter) is still scheduled rather than dropped. */
const LATE_GRACE_S = 0.05;

export type StemMask = Record<Stem, boolean>;

export const ALL_STEMS_OFF: StemMask = { pad: false, keys: false, bass: false, vibes: false, brush: false, rim: false, hat: false };

export interface SequencerOptions {
	score: Score;
	/** Called once per scheduled note with its absolute audio time and duration in seconds. */
	play(note: ScoreNote, when: number, durSec: number): void;
}

export interface Sequencer {
	/** Schedule every step starting before `now + LOOKAHEAD_S`; returns notes scheduled. */
	tick(now: number): number;
	/** Request stems; they take effect at the next bar line. */
	setStems(mask: StemMask): void;
	/** Stop scheduling for good. */
	halt(): void;
	/** Seconds per 16th step. */
	readonly stepSec: number;
	/** Audio time of absolute step 0, or null before the first tick. */
	anchor(): number | null;
}

export function createSequencer(opts: SequencerOptions): Sequencer {
	const { score } = opts;
	const loopSteps = score.bars * score.stepsPerBar;
	const stepSec = 60 / score.bpm / 4;
	const buckets: ScoreNote[][] = Array.from({ length: loopSteps }, () => []);
	for (const n of score.notes) buckets[Math.min(loopSteps - 1, Math.floor(n.step + 1e-9))]?.push(n);

	let requested: StemMask = { ...ALL_STEMS_OFF };
	let active: StemMask = { ...ALL_STEMS_OFF };
	let anchor: number | null = null;
	let nextAbs = 0;
	let halted = false;

	return {
		stepSec,
		anchor: () => anchor,
		setStems(mask) {
			requested = { ...mask };
		},
		halt() {
			halted = true;
		},
		tick(now) {
			if (halted || !Number.isFinite(now)) return 0;
			if (anchor === null) {
				anchor = now + START_DELAY_S;
				nextAbs = 0;
				active = { ...requested };
			}
			const firstDue = Math.ceil((now - LATE_GRACE_S - anchor) / stepSec - 1e-9);
			if (nextAbs < firstDue) {
				nextAbs = firstDue;
				active = { ...requested }; // a gap skipped bar lines
			}
			let count = 0;
			while (anchor + nextAbs * stepSec < now + LOOKAHEAD_S) {
				const pos = nextAbs % loopSteps;
				if (pos % score.stepsPerBar === 0) active = { ...requested };
				const t = anchor + nextAbs * stepSec;
				for (const n of buckets[pos] ?? []) {
					if (!active[n.stem]) continue;
					opts.play(n, t + (n.step - pos) * stepSec, n.dur * stepSec);
					count++;
				}
				nextAbs++;
			}
			return count;
		},
	};
}
