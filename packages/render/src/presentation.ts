/**
 * Presentation options (`Renderer.setOptions`) as a pure store. `set` reports which keys actually changed,
 * so callers invalidate cached layers only on a real change and repeat calls cost a four-field compare.
 */
import type { HorrorIntensity, RenderOptions } from "@aitower/shared";

export type OptionKey = keyof RenderOptions;

export const DEFAULT_RENDER_OPTIONS: Readonly<RenderOptions> = {
	reducedMotion: false,
	crtEffects: true,
	colorBlind: false,
	horrorIntensity: "full",
};

const KEYS: readonly OptionKey[] = ["reducedMotion", "crtEffects", "colorBlind", "horrorIntensity"];

/** Keys whose value differs between `a` and `b` (empty when they are equal). */
export const changedOptions = (a: Readonly<RenderOptions>, b: Readonly<RenderOptions>): OptionKey[] => KEYS.filter((k) => a[k] !== b[k]);

export class Presentation {
	private o: RenderOptions = { ...DEFAULT_RENDER_OPTIONS };

	/** Current options (read-only view; never mutate). */
	get options(): Readonly<RenderOptions> {
		return this.o;
	}

	/**
	 * Adopts `next`. Returns the changed keys; an empty array means nothing changed and nothing needs rebuilding.
	 */
	set(next: Readonly<RenderOptions>): OptionKey[] {
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

	/**
	 * Horror intensity is stored for M3 and has no visual effect yet.
	 */
	get horrorIntensity(): HorrorIntensity {
		return this.o.horrorIntensity;
	}
}
