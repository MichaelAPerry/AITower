export const DUCK = {
    /** Music dip on alarms, dB. */
    db: -8,
    /** Seconds the dip is held before release starts. */
    holdS: 1.5,
    attackTau: 0.03,
    releaseTau: 0.4,
};
/** Fixed trim so music sits under the sfx at equal slider positions. */
export const MUSIC_TRIM = 0.8;
export const DUCK_EVENT_TYPES = new Set(["rackTripped", "powerShortfall", "gameOver"]);
export const shouldDuck = (events) => events.some((e) => DUCK_EVENT_TYPES.has(e.type));
export const duckLinear = () => 10 ** (DUCK.db / 20);
/** setTargetAtTime steps for a duck triggered at `now`: dip, then release after the hold. */
export function duckSteps(now, plan = { db: DUCK.db, holdS: DUCK.holdS }) {
    return [
        { time: now, target: 10 ** (plan.db / 20), tau: DUCK.attackTau },
        { time: now + plan.holdS, target: 1, tau: DUCK.releaseTau },
    ];
}
/** Music dip under a stinger, dB (stingers play on their own, un-ducked bus). */
export const STINGER_DUCK_DB = -6;
/**
 * What to do to the music bus this frame: an alarm dips it (-8 dB, 1.5 s); stingers
 * dip it (-6 dB) for most of their length. Both at once: the deeper dip, the longer hold.
 */
export function duckPlan(alarm, stingerS) {
    const plans = [];
    if (alarm)
        plans.push({ db: DUCK.db, holdS: DUCK.holdS });
    if (stingerS > 0)
        plans.push({ db: STINGER_DUCK_DB, holdS: stingerS * 0.75 });
    if (plans.length === 0)
        return null;
    return { db: Math.min(...plans.map((p) => p.db)), holdS: Math.max(...plans.map((p) => p.holdS)) };
}
export const clamp01 = (v, fallback = 0) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback);
export function createMixer(ctx, master, music) {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.connect(ctx.destination);
    const masterGain = ctx.createGain();
    masterGain.gain.value = master;
    masterGain.connect(comp);
    const bus = (v) => {
        const g = ctx.createGain();
        g.gain.value = v;
        return g;
    };
    const buses = { music: bus(music * MUSIC_TRIM), sfx: bus(1), ambience: bus(1), ui: bus(1), stinger: bus(music * MUSIC_TRIM) };
    const duckGain = bus(1);
    buses.music.connect(duckGain);
    duckGain.connect(masterGain);
    buses.sfx.connect(masterGain);
    buses.ambience.connect(masterGain);
    buses.ui.connect(masterGain);
    buses.stinger.connect(masterGain);
    return {
        buses,
        setMaster: (v) => masterGain.gain.setTargetAtTime(v, ctx.currentTime, 0.05),
        setMusic(v) {
            buses.music.gain.setTargetAtTime(v * MUSIC_TRIM, ctx.currentTime, 0.05);
            buses.stinger.gain.setTargetAtTime(v * MUSIC_TRIM, ctx.currentTime, 0.05);
        },
        duck(plan) {
            const now = ctx.currentTime;
            duckGain.gain.cancelScheduledValues(now);
            for (const s of duckSteps(now, plan))
                duckGain.gain.setTargetAtTime(s.target, s.time, s.tau);
        },
        dispose() {
            for (const n of [buses.music, duckGain, buses.sfx, buses.ambience, buses.ui, buses.stinger, masterGain, comp])
                n.disconnect();
        },
    };
}
