/**
 * Pure mapping: aggregate facility state → ambient hum parameters.
 * No WebAudio here, so it is unit-testable under Node.
 */
import type { SimView } from "@aitower/sim";

export interface HumInput {
	itKw: number;
	totalKw: number;
	/** Hottest rack die temperature, °C. */
	maxRackC: number;
	paused: boolean;
}

export interface HumParams {
	/** Overall hum bus gain 0..1. */
	gain: number;
	/** Fundamental of the electrical drone, Hz. */
	droneHz: number;
	droneGain: number;
	/** Low-pass cutoff on the fan-noise layer, Hz. */
	noiseCutoffHz: number;
	noiseGain: number;
	/** High fan whine that appears when racks run hot. */
	whineHz: number;
	whineGain: number;
}

export const HUM_TUNING = {
	/** kW at which the load curve reaches ~63 % (1 - 1/e). */
	itKwScale: 600,
	overheadKwScale: 250,
	totalKwScale: 900,
	minGain: 0.015,
	gainRange: 0.2,
	pausedFactor: 0.3,
	droneBaseHz: 48,
	droneRangeHz: 14,
	noiseBaseHz: 300,
	noiseRangeHz: 2600,
	whineStartC: 72,
	whineFullC: 95,
	whineBaseHz: 1800,
	whineRangeHz: 1500,
	whineMaxGain: 0.05,
} as const;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const saturate = (kw: number, scale: number): number => (kw > 0 && Number.isFinite(kw) ? 1 - Math.exp(-kw / scale) : 0);

export function humParams(input: HumInput): HumParams {
	const T = HUM_TUNING;
	const it = Math.max(0, input.itKw || 0);
	const total = Math.max(it, input.totalKw || 0);
	const load = saturate(it, T.itKwScale);
	const fans = saturate(total - it, T.overheadKwScale);
	const all = saturate(total, T.totalKwScale);
	const heat = clamp01(((input.maxRackC || 0) - T.whineStartC) / (T.whineFullC - T.whineStartC));
	const activity = input.paused ? T.pausedFactor : 1;
	return {
		gain: (T.minGain + T.gainRange * all) * activity,
		droneHz: T.droneBaseHz + T.droneRangeHz * load,
		droneGain: 0.35 + 0.65 * load,
		noiseCutoffHz: T.noiseBaseHz + T.noiseRangeHz * all,
		noiseGain: 0.15 + 0.6 * fans,
		whineHz: T.whineBaseHz + T.whineRangeHz * heat,
		whineGain: total > 0 ? T.whineMaxGain * heat * activity : 0,
	};
}

/** Hottest facility temperature in the view (racks report die temp; others report air temp, which is lower). */
export function maxRackTemp(view: Pick<SimView, "facilities">): number {
	let max = 0;
	for (const f of view.facilities) if (f.tempC > max) max = f.tempC;
	return max;
}
