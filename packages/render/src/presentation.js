export const DEFAULT_RENDER_OPTIONS = {
    reducedMotion: false,
    crtEffects: true,
    colorBlind: false,
    horrorIntensity: "full",
};
const KEYS = ["reducedMotion", "crtEffects", "colorBlind", "horrorIntensity"];
/** Keys whose value differs between `a` and `b` (empty when they are equal). */
export const changedOptions = (a, b) => KEYS.filter((k) => a[k] !== b[k]);
export class Presentation {
    o = { ...DEFAULT_RENDER_OPTIONS };
    /** Current options (read-only view; never mutate). */
    get options() {
        return this.o;
    }
    /**
     * Adopts `next`. Returns the changed keys; an empty array means nothing changed and nothing needs rebuilding.
     */
    set(next) {
        const changed = changedOptions(this.o, next);
        if (changed.length > 0) {
            this.o = {
                reducedMotion: next.reducedMotion,
                crtEffects: next.crtEffects,
                colorBlind: next.colorBlind,
                horrorIntensity: next.horrorIntensity,
            };
        }
        return changed;
    }
    /** Body-horror intensity: `full`, `mild` (half alpha, no eyes or faces) or `off` (plain synthetic look). */
    get horrorIntensity() {
        return this.o.horrorIntensity;
    }
}
