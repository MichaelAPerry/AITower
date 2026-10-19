/**
 * Decaying-tape master chain: saturation → wow/flutter delay → "age" low-pass →
 * dropout gain. One `corruption` value (0..1) scales detune, wow depth and
 * dropouts (the director maps view.corruption onto it; 0.05 is a clean tape),
 * and `chew` (0..1) adds chewed-tape stutters and pitch lurches on top.
 */
import type { Rng } from "./rng";

export const TAPE_CORRUPTION = 0.05;
const BASE_DELAY_S = 0.03;
const MAX_DELAY_S = 1;
const WOW_HZ = 0.55;
const DRIFT_HZ = 0.17;
const FLUTTER_HZ = 6.3;

const clamp01 = (v: number): number => (Number.isFinite(v) ? (v < 0 ? 0 : v > 1 ? 1 : v) : 0);

export interface TapeParams {
	/** Peak delay-time modulation of wow, seconds (pitch deviation ≈ 2π·f·depth). */
	wowDepthS: number;
	flutterDepthS: number;
	/** Max random per-note detune, cents. */
	detuneCents: number;
	/** Mean dropouts per second. */
	dropoutRate: number;
	dropoutDepth: number;
	dropoutDurS: number;
}

export function tapeParams(corruption: number): TapeParams {
	const c = clamp01(corruption);
	return {
		wowDepthS: 0.0003 + c * 0.009,
		flutterDepthS: 0.00004 + c * 0.0004,
		detuneCents: c * 40,
		dropoutRate: 1 / 45 + c * 0.25,
		dropoutDepth: Math.min(0.9, 0.3 + c * 0.6),
		dropoutDurS: 0.08 + c * 0.3,
	};
}

/**
 * Next dropout: exponential gap (min 4 s, down to 1 s when chewing), depth and length, plus
 * 0..3 quick stutter dips after it (only when `chew` > 0.3; no extra rng draws otherwise).
 */
export function nextDropout(rng: Rng, corruption: number, chew = 0): { gapS: number; depth: number; durS: number; stutters: number } {
	const p = tapeParams(corruption);
	const ch = clamp01(chew);
	const u = Math.min(0.999, rng());
	const gapS = Math.max(4 - 3 * ch, -Math.log(1 - u) / (p.dropoutRate * (1 + 4 * ch)));
	const durS = p.dropoutDurS * (0.7 + rng() * 0.6);
	const stutters = ch > 0.3 ? 1 + Math.floor(rng() * 3) : 0;
	return { gapS, depth: p.dropoutDepth, durS, stutters };
}

export function saturationCurve(n = 1024, drive = 1.4): Float32Array<ArrayBuffer> {
	const curve = new Float32Array(new ArrayBuffer(n * 4));
	const norm = Math.tanh(drive);
	for (let i = 0; i < n; i++) curve[i] = Math.tanh(drive * ((i / (n - 1)) * 2 - 1)) / norm;
	return curve;
}

export interface Tape {
	input: AudioNode;
	output: AudioNode;
	setCorruption(c: number): void;
	/** Chewed-tape strength 0..1 (stutter dropouts and pitch lurches). */
	setChew(c: number): void;
	/** Max per-note detune in cents for the current corruption. */
	detuneCents(): number;
	/** Age low-pass cutoff (smoothed). */
	setAgeHz(hz: number, now: number): void;
	/** Schedule the next dropout if it falls inside the lookahead. */
	pump(now: number, horizon: number): void;
	/** Tape-stop slowdown: the pitch glides down and the tape darkens. */
	stop(now: number, secs: number): void;
	destroy(): void;
}

export function createTape(ctx: BaseAudioContext, rng: Rng, corruption: number): Tape {
	let corr = clamp01(corruption);
	const input = ctx.createGain();
	const shaper = ctx.createWaveShaper();
	shaper.curve = saturationCurve();
	shaper.oversample = "2x";
	const delay = ctx.createDelay(MAX_DELAY_S);
	delay.delayTime.value = BASE_DELAY_S;
	const age = ctx.createBiquadFilter();
	age.type = "lowpass";
	age.frequency.value = 5200;
	age.Q.value = 0.5;
	const drop = ctx.createGain();
	input.connect(shaper);
	shaper.connect(delay);
	delay.connect(age);
	age.connect(drop);

	const lfos: { osc: OscillatorNode; gain: GainNode }[] = [];
	const lfo = (hz: number): GainNode => {
		const osc = ctx.createOscillator();
		osc.type = "sine";
		osc.frequency.value = hz;
		const gain = ctx.createGain();
		osc.connect(gain);
		gain.connect(delay.delayTime);
		osc.start();
		lfos.push({ osc, gain });
		return gain;
	};
	const wow = lfo(WOW_HZ);
	const drift = lfo(DRIFT_HZ);
	const flutter = lfo(FLUTTER_HZ);
	const applyDepth = () => {
		const p = tapeParams(corr);
		wow.gain.value = p.wowDepthS;
		drift.gain.value = p.wowDepthS * 0.6;
		flutter.gain.value = p.flutterDepthS;
	};
	applyDepth();

	let nextAt: number | null = null;
	let stopped = false;
	let chew = 0;
	const dip = (t: number, depth: number, durS: number) => {
		drop.gain.setTargetAtTime(1 - depth, t, 0.012);
		drop.gain.setTargetAtTime(1, t + durS, 0.05);
	};

	return {
		input,
		output: drop,
		setCorruption(c) {
			corr = clamp01(c);
			applyDepth();
		},
		setChew(c) {
			chew = clamp01(c);
		},
		detuneCents: () => tapeParams(corr).detuneCents,
		setAgeHz(hz, now) {
			if (!stopped) age.frequency.setTargetAtTime(Math.max(200, hz), now, 2);
		},
		pump(now, horizon) {
			if (stopped) return;
			if (nextAt === null || nextAt < now - 1) nextAt = now + nextDropout(rng, corr, chew).gapS;
			if (nextAt > now + horizon) return;
			const d = nextDropout(rng, corr, chew);
			const t = Math.max(now, nextAt);
			dip(t, d.depth, d.durS);
			let end = t + d.durS;
			for (let k = 0; k < d.stutters; k++) {
				const at = end + 0.08;
				dip(at, Math.min(0.95, d.depth + 0.1), 0.06);
				end = at + 0.06;
			}
			if (chew > 0) {
				// Pitch lurch: the tape stretches for a moment, then snaps back.
				delay.delayTime.setTargetAtTime(BASE_DELAY_S + 0.02 * chew, t, 0.01);
				delay.delayTime.setTargetAtTime(BASE_DELAY_S, t + d.durS, 0.08);
			}
			nextAt = end + d.gapS;
		},
		stop(now, secs) {
			if (stopped) return;
			stopped = true;
			delay.delayTime.cancelScheduledValues(now);
			delay.delayTime.setValueAtTime(BASE_DELAY_S, now);
			delay.delayTime.linearRampToValueAtTime(MAX_DELAY_S * 0.9, now + secs);
			age.frequency.setTargetAtTime(300, now, secs / 3);
		},
		destroy() {
			for (const l of lfos) {
				try {
					l.osc.stop();
				} catch {
					// not started / already stopped
				}
				l.osc.disconnect();
				l.gain.disconnect();
			}
			for (const n of [input, shaper, delay, age, drop]) n.disconnect();
		},
	};
}
