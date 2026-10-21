/**
 * One definition of "too hot" for every warning the player sees (advisor tips, the tutorial hint, the build dock, the
 * dossier text), matching the sim: a rack throttles when its die is above `thermal.okC` and trips at `tripC` (a trip stays
 * latched until it has cooled and sat out its cooldown, so a tripped rack can already be cool). Organoid racks throttle
 * when the tissue leaves its temperature band, which the sim reports as the same `throttled` status.
 *
 * A reading a hair above `okC` slows a rack by a fraction of a percent, so it is not "hot" yet: HOT_MARGIN_C of headroom.
 * Tips additionally wait for the heat to last (`watchHeat`), and let go only after it has stayed gone, so a blip does
 * not make an advisor cry wolf.
 */
import type { ContentDB } from "@aitower/content";
import type { FacilityView, SimView } from "@aitower/sim";

/** Degrees above the "ok" line before a throttled rack counts as running hot. */
export const HOT_MARGIN_C = 2;
/** Game ticks (minutes) the heat must last before a tip may mention it. */
export const HOT_SUSTAIN_TICKS = 20;
/** Game ticks it must stay gone before the tip is withdrawn (and a new run starts from zero). */
export const HOT_CLEAR_TICKS = 10;

/** Is this compute rack too hot right now, by the sim's own definition? */
export function rackIsHot(f: FacilityView, content: ContentDB): boolean {
	const rack = content.facilities[f.defId]?.rack;
	if (!rack || rack.pflops <= 0 || !f.enabled) return false;
	if (rack.cooling === "bio") return f.status === "throttled"; // tissue above its band
	const okC = content.balance.thermal.okC;
	if (f.status === "throttled") return f.tempC >= okC + HOT_MARGIN_C;
	return f.status === "tripped" && f.tempC > okC; // a latched trip that has cooled off is recovering, not hot
}

export interface HeatWatch {
	/** Rack id → tick its current run of heat began. */
	since: Record<number, number>;
	/** Rack id → tick it stopped being hot (only for racks already confirmed). */
	clearSince: Record<number, number>;
	/** Racks whose heat has lasted: the only ones a tip may talk about. */
	confirmed: ReadonlySet<number>;
}

export const initialHeatWatch = (): HeatWatch => ({ since: {}, clearSince: {}, confirmed: new Set() });

/** Advance the watch to this view (call once per view; it only reads `view.tick` and rack readings). */
export function watchHeat(prev: HeatWatch, view: SimView, content: ContentDB): HeatWatch {
	const tick = view.tick;
	const since: Record<number, number> = {};
	const clearSince: Record<number, number> = {};
	const confirmed = new Set<number>();
	for (const f of view.facilities) {
		const was = prev.since[f.id];
		if (rackIsHot(f, content)) {
			const start = was ?? tick;
			since[f.id] = start;
			if (tick - start >= HOT_SUSTAIN_TICKS || prev.confirmed.has(f.id)) confirmed.add(f.id);
		} else if (prev.confirmed.has(f.id)) {
			const gone = prev.clearSince[f.id] ?? tick;
			if (tick - gone < HOT_CLEAR_TICKS) {
				since[f.id] = was ?? tick;
				clearSince[f.id] = gone;
				confirmed.add(f.id);
			}
		}
	}
	return { since, clearSince, confirmed };
}
