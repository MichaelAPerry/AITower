/**
 * Pure per-floor ambience: how loud the basement plant hum, the rack-floor fans
 * and the roof wind should be, from what is built and running.
 */
import type { SimView } from "@aitower/sim";

export interface AmbienceMix {
	/** Basement plant hum (grid, gensets, chillers, UPS...). */
	plant: number;
	/** Rack-floor fans. */
	fans: number;
	/** Roof wind (grows with height; masts whistle). */
	wind: number;
}

export const AMBIENCE = {
	plantKwScale: 250,
	fansKwScale: 400,
	/** Floors above ground at which the wind bed reaches its height maximum. */
	windFullFloors: 8,
	windHeightMax: 0.6,
	windPerMast: 0.2,
	pausedFactor: 0.3,
} as const;

type Fac = Pick<SimView["facilities"][number], "defId" | "floor" | "enabled" | "status" | "powerKw">;

const RUNNING: ReadonlySet<string> = new Set(["ok", "idle", "throttled", "brownout"]);
const PLANT = /^(grid_tie|genset|ups|chiller|cdu|cryo|continuity|nutrient|bioreactor)/;
const FANS = /^(rack|crah|organoid|dna_vault|neural|growth|backup_vault)/;

const saturate = (kw: number, scale: number): number => (kw > 0 && Number.isFinite(kw) ? 1 - Math.exp(-kw / scale) : 0);
const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

export const isRunning = (f: Pick<Fac, "enabled" | "status">): boolean => f.enabled !== false && RUNNING.has(f.status);

export function ambienceMix(view: Pick<SimView, "facilities" | "floorMax">, paused = false): AmbienceMix {
	const A = AMBIENCE;
	let plantKw = 0;
	let fansKw = 0;
	let masts = 0;
	for (const f of (view.facilities ?? []) as Fac[]) {
		if (!isRunning(f)) continue;
		const kw = Math.max(0, f.powerKw || 0);
		if (PLANT.test(f.defId)) plantKw += kw + 20; // a running plant item hums even at idle draw
		else if (FANS.test(f.defId)) fansKw += kw;
		else if (f.defId.startsWith("wind")) masts++;
	}
	const k = paused ? A.pausedFactor : 1;
	const height = clamp01((view.floorMax || 0) / A.windFullFloors) * A.windHeightMax;
	return {
		plant: saturate(plantKw, A.plantKwScale) * k,
		fans: saturate(fansKw, A.fansKwScale) * k,
		wind: clamp01(height + masts * A.windPerMast) * (paused ? 0.6 : 1),
	};
}
