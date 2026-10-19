/**
 * Pure director: SimView + recent events → music parameters. Hysteresis on the
 * load thresholds and smoothing of the corruption come from feeding the
 * previous result back in.
 *
 * Corruption (view.corruption, scaled by the horror setting: full 1, mild 0.5,
 * off 0) switches body-horror layers on in stages, each strictly above its
 * threshold and ramping to full over the next stretch:
 *   > 0.2  drift    detune drift and extra wow
 *   > 0.45 organic  wet clicks, breathing hum, slow heartbeat sub
 *   > 0.7  cluster  cluster chords and chewed-tape dropouts
 *   > 0.9  under    the muzak plays politely over something that is not music
 */
import type { HorrorIntensity } from "@aitower/shared";
import type { SimEvent, SimView } from "@aitower/sim";
import type { StemMask } from "./sequencer";
import type { Stem } from "./score";
import { type StingerId, stingersForEvents } from "./stingers";
import { type TrackId, trackForTier } from "./tracks";

export type { StingerId };

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
} as const;

/** Corruption thresholds (a layer is active strictly above its `on`; full at `full`). */
export const CORRUPTION_LAYERS = {
	drift: { on: 0.2, full: 0.45 },
	organic: { on: 0.45, full: 0.7 },
	cluster: { on: 0.7, full: 0.9 },
	under: { on: 0.9, full: 1 },
} as const;

/** Strength 0..1 of each body-horror layer. */
export interface CorruptionLayers {
	drift: number;
	organic: number;
	cluster: number;
	under: number;
}

const clamp01 = (v: number): number => (Number.isFinite(v) ? (v < 0 ? 0 : v > 1 ? 1 : v) : 0);
const ramp = (c: number, on: number, full: number): number => (c <= on ? 0 : c >= full ? 1 : (c - on) / (full - on));

export function layerLevels(corruption: number): CorruptionLayers {
	const c = clamp01(corruption);
	const L = CORRUPTION_LAYERS;
	return { drift: ramp(c, L.drift.on, L.drift.full), organic: ramp(c, L.organic.on, L.organic.full), cluster: ramp(c, L.cluster.on, L.cluster.full), under: ramp(c, L.under.on, L.under.full) };
}

/** Depth scale of the horror setting: full 1, mild about half, off none. */
export function intensityScale(i: HorrorIntensity | undefined): number {
	return i === "off" ? 0 : i === "mild" ? 0.5 : 1;
}

/** Clean-tape baseline of the tape chain's `corruption` (see tape.ts). */
export const CLEAN_TAPE = 0.05;

/** The tape chain's single corruption value for a set of layers: clean at 0.05, 1 with every layer full. */
export function tapeCorruption(l: CorruptionLayers): number {
	return Math.min(1, CLEAN_TAPE + 0.3 * l.drift + 0.2 * l.organic + 0.25 * l.cluster + 0.2 * l.under);
}

export interface MusicParams {
	stems: StemMask;
	/** Music level 0..1 (1 playing, ~0.3 paused, 0 after game over). */
	level: number;
	/** Tape low-pass cutoff, Hz. */
	filterHz: number;
	night: boolean;
	/** Game over: stop the sequencer for good. */
	silent: boolean;
	stingers: StingerId[];
	/** Score track for the tier (tiers 4-5 reuse track 3). */
	track: TrackId;
	/** Smoothed corruption after the horror setting, 0..1. */
	corruption: number;
	layers: CorruptionLayers;
	/** Tape-chain corruption for `corruption` (0.05 = clean). */
	tapeCorruption: number;
	/** Horror setting scale: 1 full, 0.5 mild, 0 off. */
	horror: number;
}

export type DirectorView = Pick<SimView, "itKw" | "minuteOfDay" | "gameOver"> & Partial<Pick<SimView, "tier" | "corruption">>;

export interface DirectorOptions {
	intensity?: HorrorIntensity;
	/** Seconds since the previous call; with `prev` the corruption eases toward its target (default: jumps). */
	dtS?: number;
}

export function isNight(minuteOfDay: number): boolean {
	const m = ((minuteOfDay % 1440) + 1440) % 1440;
	return m >= DIRECTOR.nightStartMin || m < DIRECTOR.nightEndMin;
}

const hysteresis = (was: boolean, value: number, on: number, off: number): boolean => (was ? value >= off : value >= on);

export function musicParams(view: DirectorView, events: readonly SimEvent[], paused: boolean, prev?: MusicParams, opts: DirectorOptions = {}): MusicParams {
	const kw = Number.isFinite(view.itKw) ? view.itKw : 0;
	const night = isNight(view.minuteOfDay);
	// Victory is not final (the sim keeps running): the music stays. Every other ending is.
	const finalOver = (k: string | undefined): boolean => k !== undefined && k !== "victory";
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
	const stems: Record<Stem, boolean> = { pad: true, keys: true, vibes: true, bass, brush: perc, rim: perc, hat: perc && !night };

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
