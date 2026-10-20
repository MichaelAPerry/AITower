export const DEFAULT_SETTINGS = {
    masterVolume: 0.8,
    muted: false,
    reducedMotion: false,
    crtEffects: true,
    textScale: 1,
    colorBlind: false,
    horrorIntensity: "full",
    autosave: true,
    showDesktopNotice: true,
    musicVolume: 0.6,
};
/** Clamp/repair a possibly partial or stale settings object (e.g. from storage). */
export function normalizeSettings(raw) {
    const r = (raw && typeof raw === "object" ? raw : {});
    const num = (v, d, lo, hi) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
    const bool = (v, d) => (typeof v === "boolean" ? v : d);
    const d = DEFAULT_SETTINGS;
    return {
        masterVolume: num(r.masterVolume, d.masterVolume, 0, 1),
        muted: bool(r.muted, d.muted),
        reducedMotion: bool(r.reducedMotion, d.reducedMotion),
        crtEffects: bool(r.crtEffects, d.crtEffects),
        textScale: num(r.textScale, d.textScale, 0.85, 1.5),
        colorBlind: bool(r.colorBlind, d.colorBlind),
        horrorIntensity: r.horrorIntensity === "mild" || r.horrorIntensity === "off" ? r.horrorIntensity : "full",
        autosave: bool(r.autosave, d.autosave),
        showDesktopNotice: bool(r.showDesktopNotice, d.showDesktopNotice),
        musicVolume: num(r.musicVolume, d.musicVolume, 0, 1),
    };
}
export const SAVE_SLOTS = ["auto", "slot1", "slot2", "slot3"];
// ─── Helpers ───────────────────────────────────────────────────────────
export const cellIndex = (view, x, floor) => (floor - view.floorMin) * view.width + x;
export const inBounds = (view, x, floor) => x >= 0 && x < view.width && floor >= view.floorMin && floor <= view.floorMax;
/** Format minuteOfDay as HH:MM. */
export const clock = (minuteOfDay) => `${String(Math.floor(minuteOfDay / 60)).padStart(2, "0")}:${String(minuteOfDay % 60).padStart(2, "0")}`;
