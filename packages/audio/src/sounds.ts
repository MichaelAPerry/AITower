/**
 * Pure sound catalogue: SimEvent → SoundId, and each SoundId → a synth recipe
 * (oscillator/noise voices with pitch glides and envelopes). The engine plays
 * recipes; nothing here touches WebAudio.
 */
import type { SimEvent, SimView } from "@aitower/sim";

export type SoundId = "alarm" | "zap" | "blip" | "ding" | "cash" | "fanfare" | "lowWarn" | "rumble" | "fail" | "till" | "clunk" | "droughtOn" | "droughtOff" | "toggleOn" | "toggleOff";

export type Wave = "sine" | "square" | "sawtooth" | "triangle" | "noise";

export interface Voice {
	wave: Wave;
	/** Start frequency, Hz (noise: band-pass centre). */
	freq: number;
	/** Exponential glide target over the voice duration, Hz. */
	freqEnd?: number;
	/** Seconds after trigger. */
	start: number;
	/** Seconds. */
	dur: number;
	/** Peak gain 0..1. */
	gain: number;
	/** Attack seconds (default 5 ms). */
	attack?: number;
	/** Optional low-pass cutoff, Hz. */
	lowpassHz?: number;
}

export interface SoundSpec {
	id: SoundId;
	/** Minimum gap between two plays of this sound, ms (never below 300). */
	minIntervalMs: number;
	/** Overall gain multiplier. */
	gain: number;
	voices: Voice[];
}

const note = (wave: Wave, freq: number, start: number, dur: number, gain: number, extra: Partial<Voice> = {}): Voice => ({
	wave,
	freq,
	start,
	dur,
	gain,
	...extra,
});

export const SOUNDS: Record<SoundId, SoundSpec> = {
	// Rack tripped: urgent two-tone chirp ×3.
	alarm: {
		id: "alarm",
		minIntervalMs: 900,
		gain: 0.35,
		voices: [0, 1, 2].flatMap((i) => [
			note("square", 1320, i * 0.2, 0.08, 0.6, { lowpassHz: 4000 }),
			note("square", 990, i * 0.2 + 0.09, 0.08, 0.6, { lowpassHz: 4000 }),
		]),
	},
	// Component failed: electrical zap + falling clunk.
	zap: {
		id: "zap",
		minIntervalMs: 400,
		gain: 0.4,
		voices: [
			note("noise", 2500, 0, 0.12, 0.7),
			note("sawtooth", 260, 0, 0.28, 0.6, { freqEnd: 45, lowpassHz: 1200 }),
			note("sine", 90, 0.05, 0.2, 0.8, { freqEnd: 50 }),
		],
	},
	// Repaired: rising two-step blip.
	blip: {
		id: "blip",
		minIntervalMs: 300,
		gain: 0.3,
		voices: [note("sine", 440, 0, 0.1, 0.8, { freqEnd: 880 }), note("sine", 660, 0.1, 0.14, 0.8, { freqEnd: 1320 })],
	},
	// Lift arrived: soft bell.
	ding: {
		id: "ding",
		minIntervalMs: 600,
		gain: 0.12,
		voices: [note("sine", 1318.5, 0, 0.7, 0.8, { attack: 0.003 }), note("sine", 3955, 0, 0.25, 0.15, { attack: 0.003 })],
	},
	// Job completed: cash-register arpeggio + drawer tick.
	cash: {
		id: "cash",
		minIntervalMs: 400,
		gain: 0.3,
		voices: [
			note("noise", 6000, 0, 0.04, 0.5),
			...[523.25, 659.25, 783.99, 1046.5].map((f, i) => note("triangle", f, 0.03 + i * 0.07, 0.2, 0.7)),
			note("sine", 2093, 0.33, 0.35, 0.3),
		],
	},
	// Tier up: short brass-ish fanfare.
	fanfare: {
		id: "fanfare",
		minIntervalMs: 2000,
		gain: 0.3,
		voices: [
			note("sawtooth", 392, 0, 0.16, 0.5, { lowpassHz: 2200 }),
			note("sawtooth", 523.25, 0.16, 0.16, 0.5, { lowpassHz: 2200 }),
			note("sawtooth", 659.25, 0.32, 0.16, 0.5, { lowpassHz: 2200 }),
			note("sawtooth", 783.99, 0.48, 0.9, 0.6, { lowpassHz: 2600, attack: 0.02 }),
			note("triangle", 392, 0.48, 0.9, 0.4, { attack: 0.02 }),
			note("triangle", 523.25, 0.48, 0.9, 0.3, { attack: 0.02 }),
		],
	},
	// Power shortfall: low, beating warning tone.
	lowWarn: {
		id: "lowWarn",
		minIntervalMs: 4000,
		gain: 0.35,
		voices: [
			note("sine", 110, 0, 0.6, 0.8, { attack: 0.05 }),
			note("sine", 116, 0, 0.6, 0.6, { attack: 0.05 }),
			note("triangle", 220, 0, 0.45, 0.2, { attack: 0.05 }),
		],
	},
	// Genset started: engine rumble swelling up.
	rumble: {
		id: "rumble",
		minIntervalMs: 1500,
		gain: 0.4,
		voices: [
			note("sawtooth", 28, 0, 1.8, 0.8, { freqEnd: 55, attack: 0.6, lowpassHz: 220 }),
			note("noise", 180, 0, 1.6, 0.5, { attack: 0.5, lowpassHz: 400 }),
		],
	},
	// Job failed (deadline missed): descending minor third.
	fail: {
		id: "fail",
		minIntervalMs: 600,
		gain: 0.3,
		voices: [note("triangle", 392, 0, 0.18, 0.7), note("triangle", 311.13, 0.2, 0.35, 0.7, { freqEnd: 290 })],
	},
	// Money earned: soft till chime (rate-limited hard: inference pays every game-hour).
	till: {
		id: "till",
		minIntervalMs: 2500,
		gain: 0.16,
		voices: [note("sine", 1567.98, 0, 0.35, 0.6, { attack: 0.003 }), note("sine", 2093, 0.07, 0.5, 0.5, { attack: 0.003 }), note("sine", 4186, 0.07, 0.12, 0.08)],
	},
	// Automation built something: pneumatic clunk and a short hiss.
	clunk: {
		id: "clunk",
		minIntervalMs: 700,
		gain: 0.35,
		voices: [
			note("sine", 150, 0, 0.14, 0.9, { freqEnd: 60, attack: 0.002 }),
			note("noise", 2400, 0.02, 0.22, 0.35, { attack: 0.01, lowpassHz: 3000 }),
			note("triangle", 330, 0.01, 0.06, 0.25),
		],
	},
	// Greentech drought begins: a long falling, dry sigh.
	droughtOn: {
		id: "droughtOn",
		minIntervalMs: 4000,
		gain: 0.3,
		voices: [note("sine", 330, 0, 1.4, 0.6, { freqEnd: 165, attack: 0.15 }), note("noise", 700, 0, 1.2, 0.2, { attack: 0.3, lowpassHz: 900 })],
	},
	// Drought over: two rising notes and a bright wash.
	droughtOff: {
		id: "droughtOff",
		minIntervalMs: 4000,
		gain: 0.28,
		voices: [note("sine", 392, 0, 0.5, 0.6, { attack: 0.02 }), note("sine", 587.33, 0.18, 0.8, 0.6, { attack: 0.02 }), note("noise", 5000, 0.18, 0.7, 0.1, { attack: 0.2, lowpassHz: 7000 })],
	},
	// Automation toggles (UI feel): a short tick up / down.
	toggleOn: {
		id: "toggleOn",
		minIntervalMs: 300,
		gain: 0.2,
		voices: [note("triangle", 660, 0, 0.05, 0.6), note("triangle", 990, 0.05, 0.08, 0.6)],
	},
	toggleOff: {
		id: "toggleOff",
		minIntervalMs: 300,
		gain: 0.2,
		voices: [note("triangle", 990, 0, 0.05, 0.6), note("triangle", 660, 0.05, 0.08, 0.6)],
	},
};

export function eventToSound(e: SimEvent): SoundId | null {
	switch (e.type) {
		case "rackTripped":
			return "alarm";
		case "componentFailed":
			return "zap";
		case "repaired":
			return "blip";
		case "liftArrived":
			return "ding";
		case "jobCompleted":
			return "cash";
		case "tierUp":
			return "fanfare";
		case "powerShortfall":
			return "lowWarn";
		case "gensetStarted":
			return "rumble";
		case "jobFailed":
			return "fail";
		case "earned":
			return "till";
		case "autoBuilt":
			return "clunk";
		case "droughtStarted":
			return "droughtOn";
		case "droughtEnded":
			return "droughtOff";
		default:
			return null;
	}
}

/** Distinct sounds to trigger for a batch of events, in first-seen order (deduplicated). */
export function soundsForEvents(events: readonly SimEvent[]): SoundId[] {
	const out: SoundId[] = [];
	for (const e of events) {
		const id = eventToSound(e);
		if (id && !out.includes(id)) out.push(id);
	}
	return out;
}

/** Total length of a sound in seconds. */
export const soundDuration = (spec: SoundSpec): number => Math.max(...spec.voices.map((v) => v.start + v.dur));

/** Like `soundsForEvents`, but keeps the first event that triggered each sound (for its position). */
export function soundPlays(events: readonly SimEvent[]): { id: SoundId; event: SimEvent }[] {
	const out: { id: SoundId; event: SimEvent }[] = [];
	for (const event of events) {
		const id = eventToSound(event);
		if (id && !out.some((p) => p.id === id)) out.push({ id, event });
	}
	return out;
}

type Policy = SimView["automation"]["policy"];
const POLICY_KEYS = ["research", "parts", "bots", "foreman"] as const;

/** Toggle sounds for the automation switches that flipped between two policies (fixed key order). */
export function automationToggles(prev: Policy | undefined, next: Policy | undefined): ("toggleOn" | "toggleOff")[] {
	if (!prev || !next) return [];
	const out: ("toggleOn" | "toggleOff")[] = [];
	for (const k of POLICY_KEYS) {
		const a = !!prev[k]?.enabled;
		const b = !!next[k]?.enabled;
		if (a !== b) out.push(b ? "toggleOn" : "toggleOff");
	}
	return out;
}
