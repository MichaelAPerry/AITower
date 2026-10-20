export const HEART_PERIOD_S = 1;
/** Gap between the "lub" and the "dub". */
export const HEART_DUB_S = 0.28;
const MIN_CLICK_GAP_S = 0.15;
/** Mean wet clicks per second at layer strength `level`. */
export const clickRate = (level) => 0.3 + 1.7 * level;
/** Heartbeat velocity at layer strength `level` (the "lub"; the "dub" is softer). */
export const heartVel = (level) => 0.35 + 0.5 * level;
export function createOrganic(opts) {
    const { rng, play } = opts;
    let nextBeat = null;
    let nextClick = null;
    return {
        pump(now, horizon, level) {
            if (!(level > 0) || !Number.isFinite(now)) {
                nextBeat = null;
                nextClick = null;
                return;
            }
            const lvl = level > 1 ? 1 : level;
            const end = now + horizon;
            if (nextBeat === null || nextBeat < now - 1)
                nextBeat = now + 0.1;
            while (nextBeat < end) {
                play("heart", 0, nextBeat, 0.25, heartVel(lvl));
                play("heart", 0, nextBeat + HEART_DUB_S, 0.2, heartVel(lvl) * 0.65);
                nextBeat += HEART_PERIOD_S;
            }
            if (nextClick === null || nextClick < now - 1)
                nextClick = now + MIN_CLICK_GAP_S + rng() * 0.5;
            while (nextClick < end) {
                play("wet", 0, nextClick, 0.07, 0.3 + rng() * 0.5);
                const u = Math.min(0.999, rng());
                nextClick += Math.max(MIN_CLICK_GAP_S, -Math.log(1 - u) / clickRate(lvl));
            }
        },
    };
}
/** Cluster chords (corruption > 0.7): a pad/keys note sometimes gains a neighbour a semitone or tone away. */
export function clusterExtra(midi, level, rng) {
    if (!(level > 0) || !(midi > 0))
        return null;
    if (rng() >= Math.min(1, level) * 0.5)
        return null;
    return midi + (rng() < 0.5 ? 1 : 2);
}
