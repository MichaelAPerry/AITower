import { DEFAULT_SETTINGS } from "@aitower/shared";
/**
 * Colour-blind-safe heat ramp (matplotlib "plasma"), low → high. The renderer uses the same six stops
 * at the same temperatures as the standard ramp (18, 24, 30, 36, 42, 50 °C) when `settings.colorBlind` is on.
 */
export const HEAT_RAMP_COLORBLIND = ["#0d0887", "#6a00a8", "#b12a90", "#e16462", "#fca636", "#f0f921"];
/** Temperatures (°C) of the six heat-ramp stops, shared by both ramps. */
export const HEAT_RAMP_TEMPS = [18, 24, 30, 36, 42, 50];
/** STYLE.md §2 heat ramp as CSS tokens, low → high. */
const HEAT_RAMP_TOKENS = ["var(--heat-18)", "var(--heat-24)", "var(--heat-30)", "var(--heat-36)", "var(--heat-42)", "var(--heat-50)"];
/** The overlay legend's stops: [°C, colour]. */
export function heatRamp(colorBlind) {
    const cols = colorBlind ? HEAT_RAMP_COLORBLIND : HEAT_RAMP_TOKENS;
    return HEAT_RAMP_TEMPS.map((t, i) => [t, cols[i]]);
}
export const TEXT_SCALE_MIN = 0.85;
export const TEXT_SCALE_MAX = 1.5;
/** HUD scale factor from settings, clamped to the supported range (stale or hand-edited values included). */
export function hudScale(s) {
    const v = s.textScale;
    if (typeof v !== "number" || !Number.isFinite(v))
        return DEFAULT_SETTINGS.textScale;
    return Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, v));
}
/** Inline custom properties for the `.aitower-hud` root (consumed by ui.css as `zoom: var(--hud-scale)`). */
export function settingsToCssVars(s) {
    return { "--hud-scale": String(Math.round(hudScale(s) * 100) / 100) };
}
/** Root classes that switch presentation features. Same stylesheet hooks as `prefers-reduced-motion`. */
export function settingsToClasses(s) {
    const c = [];
    if (s.reducedMotion)
        c.push("is-reduced-motion");
    if (s.colorBlind)
        c.push("is-colorblind");
    if (!s.crtEffects)
        c.push("no-crt");
    return c;
}
/** Status glyphs used with `colorBlind` (CSS repeats them as ::before content on pills and lamps). */
export const STATUS_GLYPH = { ok: "✓", throttled: "▲", failed: "✕", idle: "○" };
export function densityFor(width, height, scale) {
    const w = width / scale;
    const h = height / scale;
    if (w < 1000 || h < 540)
        return "cramped";
    if (w < 1380 || h < 660)
        return "tight";
    return "normal";
}
/** "Best on desktop" notice applies below 1024 px wide or 640 px tall (CSS pixels of the real viewport). */
export function isSmallScreen(width, height) {
    return width < 1024 || height < 640;
}
