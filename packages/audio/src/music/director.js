import { stingersForEvents } from "./stingers";
import { trackForTier } from "./tracks";
export const DIRECTOR = {
    bassOnKw: 40,
    bassOffKw: 25,
    percOnKw: 120,
    percOffKw: 80,
    pausedLevel: 0.3,
    /** Tape "age" low-pass, Hz. */
    dayHz: 5200,
    nightHz: 1800,
    /** Night = 20:00 .. 06:00 (sim starts at 06:00). */
    nightStartMin: 20 * 60,
    nightEndMin: 6 * 60,
    /** Time constant of the corruption smoothing, seconds. */
    corruptionTauS: 3,
};
/** Corruption thresholds (a layer is active strictly above its `on`; full at `full`). */
export const CORRUPTION_LAYERS = {
    drift: { on: 0.2, full: 0.45 },
    organic: { on: 0.45, full: 0.7 },
    cluster: { on: 0.7, full: 0.9 },
    under: { on: 0.9, full: 1 },
};
const clamp01 = (v) => (Number.isFinite(v) ? (v < 0 ? 0 : v > 1 ? 1 : v) : 0);
const ramp = (c, on, full) => (c <= on ? 0 : c >= full ? 1 : (c - on) / (full - on));
export function layerLevels(corruption) {
    const c = clamp01(corruption);
    const L = CORRUPTION_LAYERS;
    return { drift: ramp(c, L.drift.on, L.drift.full), organic: ramp(c, L.organic.on, L.organic.full), cluster: ramp(c, L.cluster.on, L.cluster.full), under: ramp(c, L.under.on, L.under.full) };
}
/** Depth scale of the horror setting: full 1, mild about half, off none. */
export function intensityScale(i) {
    return i === "off" ? 0 : i === "mild" ? 0.5 : 1;
}
/** Clean-tape baseline of the tape chain's `corruption` (see tape.ts). */
export const CLEAN_TAPE = 0.05;
/** The tape chain's single corruption value for a set of layers: clean at 0.05, 1 with every layer full. */
export function tapeCorruption(l) {
    return Math.min(1, CLEAN_TAPE + 0.3 * l.drift + 0.2 * l.organic + 0.25 * l.cluster + 0.2 * l.under);
}
export function isNight(minuteOfDay) {
    const m = ((minuteOfDay % 1440) + 1440) % 1440;
    return m >= DIRECTOR.nightStartMin || m < DIRECTOR.nightEndMin;
}
const hysteresis = (was, value, on, off) => (was ? value >= off : value >= on);
export function musicParams(view, events, paused, prev, opts = {}) {
    const kw = Number.isFinite(view.itKw) ? view.itKw : 0;
    const night = isNight(view.minuteOfDay);
    // Victory is not final (the sim keeps running): the music stays. Every other ending is.
    const finalOver = (k) => k !== undefined && k !== "victory";
    const overEvents = events.filter((e) => e.type === "gameOver");
    const silent = finalOver(view.gameOver?.kind) || overEvents.some((e) => e.type === "gameOver" && finalOver(e.kind));
    const scale = intensityScale(opts.intensity);
    const target = clamp01(view.corruption ?? 0) * scale;
    let corruption = target;
    if (prev && scale > 0 && opts.dtS !== undefined && Number.isFinite(opts.dtS) && opts.dtS >= 0) {
        corruption = prev.corruption + (target - prev.corruption) * (1 - Math.exp(-opts.dtS / DIRECTOR.corruptionTauS));
    }
    const layers = layerLevels(corruption);
    const bass = hysteresis(prev?.stems.bass ?? false, kw, DIRECTOR.bassOnKw, DIRECTOR.bassOffKw);
    const perc = hysteresis(prev?.stems.rim ?? false, kw, DIRECTOR.percOnKw, DIRECTOR.percOffKw);
    const stems = { pad: true, keys: true, vibes: true, bass, brush: perc, rim: perc, hat: perc && !night };
    // A final game over plays only its own stinger (and nothing at all on a loaded, already-over game).
    const stingers = stingersForEvents(silent ? overEvents : events, opts.intensity);
    return {
        stems,
        level: silent ? 0 : paused ? DIRECTOR.pausedLevel : 1,
        filterHz: night ? DIRECTOR.nightHz : DIRECTOR.dayHz,
        night,
        silent,
        stingers,
        track: trackForTier(view.tier ?? 1),
        corruption,
        layers,
        tapeCorruption: tapeCorruption(layers),
        horror: scale,
    };
}
