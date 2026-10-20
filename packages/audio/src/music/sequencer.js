export const LOOKAHEAD_S = 0.1;
export const TICK_MS = 25;
/** First step starts this long after the first tick. */
const START_DELAY_S = 0.08;
/** A step this late (timer jitter) is still scheduled rather than dropped. */
const LATE_GRACE_S = 0.05;
export const ALL_STEMS_OFF = { pad: false, keys: false, bass: false, vibes: false, brush: false, rim: false, hat: false };
export function createSequencer(opts) {
    const { score } = opts;
    const loopSteps = score.bars * score.stepsPerBar;
    const stepSec = 60 / score.bpm / 4;
    const buckets = Array.from({ length: loopSteps }, () => []);
    for (const n of score.notes)
        buckets[Math.min(loopSteps - 1, Math.floor(n.step + 1e-9))]?.push(n);
    let requested = { ...ALL_STEMS_OFF };
    let active = { ...ALL_STEMS_OFF };
    let anchor = null;
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
            if (halted || !Number.isFinite(now))
                return 0;
            if (anchor === null) {
                anchor = opts.startAt !== undefined && Number.isFinite(opts.startAt) ? opts.startAt : now + START_DELAY_S;
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
                if (pos % score.stepsPerBar === 0)
                    active = { ...requested };
                const t = anchor + nextAbs * stepSec;
                for (const n of buckets[pos] ?? []) {
                    if (!active[n.stem])
                        continue;
                    opts.play(n, t + (n.step - pos) * stepSec, n.dur * stepSec);
                    count++;
                }
                nextAbs++;
            }
            return count;
        },
    };
}
