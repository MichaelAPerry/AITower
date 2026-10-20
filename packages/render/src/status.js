import { CB, HEAT_RAMP, T, dk, lt } from "./palette";
/** Pale frost blue for `tooCold` (the heat ramp's cold stop, lightened): derived, not a new token. */
export const FROST = lt(HEAT_RAMP[0], 0.72);
/** Indicator lamp / phosphor colours (STYLE.md tokens). `starved` (noNutrient) is bile, `cold` (tooCold) frost. */
export const LED = {
    ok: T.green,
    amber: T.amber,
    red: T.red,
    idle: T.greenDim,
    off: dk(T.housing, 0.35),
    starved: T.bile,
    cold: FROST,
};
/** Colour-blind lamp scheme: blue ok, orange warning, vermilion fault. Same roles as `LED`. */
export const LED_CB = {
    ok: CB.blue,
    amber: CB.orange,
    red: lt(CB.vermilion, 0.15),
    idle: dk(CB.blue, 0.5),
    off: LED.off,
    starved: lt(CB.orange, 0.35),
    cold: lt(CB.blue, 0.55),
};
/**
 * Rack status lamps / CRT phosphor: green ok (activity), amber throttled, red tripped/failed, dim-green idle,
 * off unpowered. With `colorBlind` the same roles use blue / orange / vermilion.
 */
export const ledCue = (status, enabled, colorBlind = false) => {
    const L = colorBlind ? LED_CB : LED;
    const accent = L.amber;
    const cue = (color, mode, tone) => ({ color, mode, tone, accent });
    if (!enabled)
        return cue(L.off, "off", "off");
    switch (status) {
        case "ok":
            return cue(L.ok, "activity", "ok");
        case "idle":
            return cue(L.idle, "steady", "idle");
        case "throttled":
        case "brownout":
            return cue(L.amber, "activity", "warn");
        case "noCoolant":
            return cue(L.amber, "blink", "warn");
        case "noNutrient": // organoid tissue without feed: slow bile blink
            return cue(L.starved, "blink", "starved");
        case "tooCold": // below its band: steady pale-blue frost lamp
            return cue(L.cold, "steady", "cold");
        case "tripped":
        case "failed":
            return cue(L.red, "blink", "fault");
        case "disabled":
        case "unpowered":
            return cue(L.off, "off", "off");
    }
};
/** CRT phosphor pair [lit, dim] for a tone. */
export const phosphorFor = (tone, colorBlind = false) => {
    const L = colorBlind ? LED_CB : LED;
    switch (tone) {
        case "ok":
            return [L.ok, dk(L.ok, 0.5)];
        case "warn":
            return [L.amber, dk(L.amber, 0.45)];
        case "fault":
            return [L.red, dk(L.red, 0.6)];
        case "starved":
            return [L.starved, dk(L.starved, 0.5)];
        case "cold":
            return [L.cold, dk(L.cold, 0.6)];
        case "idle":
        case "off":
            return [L.idle, dk(L.idle, 0.5)];
    }
};
export const CRT_GLYPHS = {
    ok: ["..X", ".X.", "X.."],
    throttled: [".X.", "X.X", "XXX"],
    fault: ["X.X", ".X.", "X.X"],
    idle: [".X.", "X.X", ".X."],
    /** noNutrient: an empty feed tube (open top, one drop falling). */
    starved: ["X.X", "X.X", ".X."],
    /** tooCold: a snowflake. */
    frost: [".X.", "XXX", ".X."],
};
/** Glyph shown on a rack CRT, or null for states with no screen (unpowered / disabled). Matches `ledCue` tones. */
export const crtGlyph = (status) => {
    switch (status) {
        case "ok":
            return "ok";
        case "idle":
            return "idle";
        case "throttled":
        case "brownout":
        case "noCoolant":
            return "throttled";
        case "noNutrient":
            return "starved";
        case "tooCold":
            return "frost";
        case "tripped":
        case "failed":
            return "fault";
        case "disabled":
        case "unpowered":
            return null;
    }
};
export const badgeFor = (status) => {
    switch (status) {
        case "failed":
        case "tripped":
            return "wrench";
        case "noCoolant":
            return "noCoolant";
        case "unpowered":
            return "noPower";
        case "noNutrient":
            return "noNutrient";
        case "tooCold":
            return "tooCold";
        default:
            return null;
    }
};
/** Whether a facility's fans / pumps should animate. */
export const isActive = (status, enabled) => enabled && status !== "unpowered" && status !== "disabled" && status !== "failed" && status !== "tripped";
/** Deterministic per-LED activity flicker in [0,1): stable hash of (id, led, timeslot). */
export const flicker = (id, led, slot) => {
    let h = Math.imul(id + 0x9e37, 0x85ebca6b) ^ Math.imul(led + 0x79b9, 0xc2b2ae35) ^ Math.imul(slot, 0x27d4eb2f);
    h ^= h >>> 15;
    h = Math.imul(h, 0x2c1b3c6d);
    h ^= h >>> 12;
    return (h >>> 0) / 4294967296;
};
