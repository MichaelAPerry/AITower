/**
 * Pure director: SimView + recent events → music parameters. Hysteresis on the
 * load thresholds comes from feeding the previous result back in.
 */
import type { SimEvent, SimView } from "@aitower/sim";
import type { StemMask } from "./sequencer";
import type { Stem } from "./score";

export type StingerId = "teletype" | "fanfare" | "tapeStop";

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
} as const;

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
}

export type DirectorView = Pick<SimView, "itKw" | "minuteOfDay" | "gameOver">;

export function isNight(minuteOfDay: number): boolean {
	const m = ((minuteOfDay % 1440) + 1440) % 1440;
	return m >= DIRECTOR.nightStartMin || m < DIRECTOR.nightEndMin;
}

const hysteresis = (was: boolean, value: number, on: number, off: number): boolean => (was ? value >= off : value >= on);

export function musicParams(view: DirectorView, events: readonly SimEvent[], paused: boolean, prev?: MusicParams): MusicParams {
	const kw = Number.isFinite(view.itKw) ? view.itKw : 0;
	const night = isNight(view.minuteOfDay);
	const silent = view.gameOver != null || events.some((e) => e.type === "gameOver");
	const bass = hysteresis(prev?.stems.bass ?? false, kw, DIRECTOR.bassOnKw, DIRECTOR.bassOffKw);
	const perc = hysteresis(prev?.stems.rim ?? false, kw, DIRECTOR.percOnKw, DIRECTOR.percOffKw);
	const stems: Record<Stem, boolean> = { pad: true, keys: true, vibes: true, bass, brush: perc, rim: perc, hat: perc && !night };

	const stingers: StingerId[] = [];
	if (silent) {
		if (events.some((e) => e.type === "gameOver")) stingers.push("tapeStop");
	} else {
		if (events.some((e) => e.type === "tierUp")) stingers.push("fanfare");
		if (events.some((e) => e.type === "memoIssued")) stingers.push("teletype");
	}
	return {
		stems,
		level: silent ? 0 : paused ? DIRECTOR.pausedLevel : 1,
		filterHz: night ? DIRECTOR.nightHz : DIRECTOR.dayHz,
		night,
		silent,
		stingers,
	};
}
