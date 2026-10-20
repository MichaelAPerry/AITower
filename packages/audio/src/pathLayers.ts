/**
 * Pure ascension-path audio layers. Greentech: a bright quasi-modal music layer
 * (marimba + flute-ish synth), a rustle and water bed, a spore "breath" at high
 * score. Synthetic: glassy, quantised notes and a hollow doubled tone. Levels
 * follow `view.path` / `view.pathScore`, smoothed, and the unsettling parts
 * (spores, the hollow double) respect the horror setting. Biotech has its own
 * corruption layers in the music director, so it adds nothing here.
 */
import type { SimView } from "@aitower/sim";
import type { HorrorIntensity } from "@aitower/shared";
import { intensityScale } from "./music/director";
import { createRng, type Rng } from "./music/rng";
import type { Voice } from "./sounds";
type AscensionPath = NonNullable<SimView["path"]>;

export interface PathLevels {
	/** Greentech: marimba/flute notes. */
	gMusic: number;
	/** Greentech: leaf rustle bed. */
	rustle: number;
	/** Greentech: water bed. */
	water: number;
	/** Greentech: slow spore breath (horror-scaled). */
	spore: number;
	/** Synthetic: glass notes. */
	sMusic: number;
	/** Synthetic: bright quantised shimmer bed. */
	shimmer: number;
	/** Synthetic: hollow doubled tone (horror-scaled). */
	hollow: number;
}

export const ZERO_LEVELS: PathLevels = { gMusic: 0, rustle: 0, water: 0, spore: 0, sMusic: 0, shimmer: 0, hollow: 0 };

export const PATH_TUNING = {
	/** Seconds: time constant of level smoothing. */
	tauS: 6,
	sporeOn: 0.6,
	hollowOn: 0.7,
} as const;

const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
const ramp = (v: number, on: number): number => (v <= on ? 0 : v >= 1 ? 1 : (v - on) / (1 - on));

/** Where the levels want to be (unsmoothed). */
export function pathTargets(path: AscensionPath | null | undefined, score: number, intensity?: HorrorIntensity): PathLevels {
	const s = clamp01(score);
	const h = intensityScale(intensity);
	if (path === "greentech") {
		return { ...ZERO_LEVELS, gMusic: 0.35 + 0.65 * s, rustle: 0.3 + 0.5 * s, water: 0.2 + 0.6 * s, spore: ramp(s, PATH_TUNING.sporeOn) * h };
	}
	if (path === "synthetic") {
		return { ...ZERO_LEVELS, sMusic: 0.35 + 0.65 * s, shimmer: 0.2 + 0.7 * ramp(s, 0.2), hollow: ramp(s, PATH_TUNING.hollowOn) * h };
	}
	return ZERO_LEVELS;
}

/**
 * Ease `prev` toward the targets over `dtS` seconds (no `dtS` or no `prev`: it does not move, so a loaded game
 * fades its path in instead of starting at full level).
 */
export function pathLevels(path: AscensionPath | null | undefined, score: number, prev: PathLevels | undefined, dtS: number | undefined, intensity?: HorrorIntensity): PathLevels {
	const target = pathTargets(path, score, intensity);
	const from = prev ?? ZERO_LEVELS;
	const a = dtS !== undefined && Number.isFinite(dtS) && dtS > 0 ? 1 - Math.exp(-dtS / PATH_TUNING.tauS) : 0;
	const out = { ...ZERO_LEVELS };
	for (const k of Object.keys(out) as (keyof PathLevels)[]) out[k] = from[k] + (target[k] - from[k]) * a;
	return out;
}

// ── Notes ──────────────────────────────────────────────────────────────

export type PathNoteKind = "marimba" | "flute" | "glass";

export interface PathNote {
	kind: PathNoteKind;
	freq: number;
	/** Seconds until the next note. */
	gapS: number;
	/** 0..1 */
	vel: number;
}

const midiHz = (m: number): number => 440 * 2 ** ((m - 69) / 12);
/** D major pentatonic over two octaves (bright, never dissonant). */
const GREEN_SCALE = [62, 64, 66, 69, 71, 74, 76, 78, 81, 83];
/** C lydian-ish, stepped (glassy and exact). */
const SYNTH_SCALE = [72, 74, 76, 78, 79, 81, 83, 84, 86, 88];
/** Synthetic notes sit on a 0.25 s grid. */
export const SYNTH_GRID_S = 0.25;

export interface PathNotes {
	next(): PathNote;
}

/** Deterministic note stream for a path (random walk on the scale). */
export function createPathNotes(path: "greentech" | "synthetic", seed = 1): PathNotes {
	const rng: Rng = createRng(seed);
	const scale = path === "greentech" ? GREEN_SCALE : SYNTH_SCALE;
	let i = Math.floor(scale.length / 2);
	return {
		next() {
			const step = Math.floor(rng() * 5) - 2; // -2..2
			i = Math.min(scale.length - 1, Math.max(0, i + step));
			const freq = midiHz(scale[i] ?? 69);
			const vel = 0.5 + 0.5 * rng();
			if (path === "greentech") {
				const flute = rng() < 0.25;
				const gaps = [0.5, 0.75, 1, 1.5];
				return { kind: flute ? "flute" : "marimba", freq: flute ? freq * 2 : freq, gapS: gaps[Math.floor(rng() * gaps.length)] ?? 1, vel };
			}
			return { kind: "glass", freq, gapS: SYNTH_GRID_S * (1 + Math.floor(rng() * 4)), vel };
		},
	};
}

/** Synth recipe of a note (relative gain 0..1; the engine scales it by the layer level). */
export function noteVoices(n: PathNote): Voice[] {
	const g = 0.5 * n.vel;
	switch (n.kind) {
		case "marimba":
			// Quasi-modal bar: fundamental plus the inharmonic ~4x and ~10x partials, the upper ones dying fast.
			return [
				{ wave: "sine", freq: n.freq, start: 0, dur: 0.9, gain: g, attack: 0.004 },
				{ wave: "sine", freq: n.freq * 3.99, start: 0, dur: 0.18, gain: g * 0.35, attack: 0.002 },
				{ wave: "sine", freq: n.freq * 9.9, start: 0, dur: 0.07, gain: g * 0.12, attack: 0.002 },
			];
		case "flute":
			return [
				{ wave: "sine", freq: n.freq, start: 0, dur: 1.4, gain: g * 0.7, attack: 0.12, freqEnd: n.freq * 1.004 },
				{ wave: "triangle", freq: n.freq * 2, start: 0, dur: 1.2, gain: g * 0.12, attack: 0.15 },
				{ wave: "noise", freq: n.freq * 2, start: 0, dur: 1.0, gain: g * 0.1, attack: 0.1, lowpassHz: 5000 },
			];
		case "glass":
			return [
				{ wave: "sine", freq: n.freq, start: 0, dur: 0.7, gain: g * 0.8, attack: 0.002 },
				{ wave: "sine", freq: n.freq * 2.76, start: 0, dur: 0.35, gain: g * 0.3, attack: 0.002 },
				{ wave: "sine", freq: n.freq * 5.4, start: 0, dur: 0.15, gain: g * 0.12, attack: 0.002 },
			];
	}
}

/**
 * Notes due within the lookahead window: returns the (note, offset from `nowS`) pairs and the new `nextS`.
 * A gap longer than `maxCatchUpS` (a throttled tab) restarts at `nowS` instead of bursting.
 */
export function dueNotes(notes: PathNotes, nextS: number | null, nowS: number, horizonS: number, maxCatchUpS = 1): { due: { note: PathNote; at: number }[]; nextS: number } {
	let t = nextS === null || nowS - nextS > maxCatchUpS ? nowS : Math.max(nextS, nowS);
	const due: { note: PathNote; at: number }[] = [];
	while (t < nowS + horizonS && due.length < 8) {
		const note = notes.next();
		due.push({ note, at: t });
		t += note.gapS;
	}
	return { due, nextS: t };
}
