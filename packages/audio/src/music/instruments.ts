/**
 * Synthesized instruments (oscillators + filters + envelopes, no samples).
 * Every voice self-releases and disconnects on `ended`; the live voice count is
 * bounded, and `dispose()` stops whatever is still sounding.
 */
import type { InstId } from "./score";
import type { Rng } from "./rng";

/** Hard cap on simultaneously live voices (percussion yields earlier). */
export const MAX_VOICES = 56;
const PERC_VOICE_HEADROOM = 10;
const NOISE_SECONDS = 4;
const FLOOR = 0.0001;

const PERC: ReadonlySet<InstId> = new Set(["brush", "rim", "tick"]);
const hz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

export interface PlayOptions {
	/** Per-note detune in cents (tape corruption). */
	detune?: number;
	/** Stingers may exceed the normal cap by a few voices. */
	force?: boolean;
}

export interface Instruments {
	play(inst: InstId, midi: number, when: number, dur: number, vel: number, opts?: PlayOptions): boolean;
	active(): number;
	dispose(): void;
}

/** Attack, exponential-ish decay to a sustain level, release after `dur`. Returns the end time. */
function envelope(p: AudioParam, t0: number, peak: number, attack: number, decayTau: number, sustain: number, dur: number, release: number): number {
	const d = Math.max(dur, attack + 0.02);
	p.setValueAtTime(FLOOR, t0);
	p.linearRampToValueAtTime(Math.max(FLOOR, peak), t0 + attack);
	p.setTargetAtTime(Math.max(FLOOR, peak * sustain), t0 + attack, decayTau);
	p.setTargetAtTime(FLOOR, t0 + d, release / 4);
	return t0 + d + release * 2;
}

export function createInstruments(ctx: BaseAudioContext, out: AudioNode, rng: Rng): Instruments {
	let live = 0;
	const stoppers = new Set<() => void>();
	let noise: AudioBuffer | null = null;

	function noiseBuf(): AudioBuffer {
		if (noise) return noise;
		const len = Math.floor(ctx.sampleRate * NOISE_SECONDS);
		noise = ctx.createBuffer(1, len, ctx.sampleRate);
		const data = noise.getChannelData(0);
		for (let i = 0; i < len; i++) data[i] = rng() * 2 - 1;
		return noise;
	}

	function noiseSrc(t0: number): AudioBufferSourceNode {
		const n = ctx.createBufferSource();
		n.buffer = noiseBuf();
		n.loop = true;
		n.start(t0, rng() * (NOISE_SECONDS - 1));
		return n;
	}

	/** Register a voice: start oscillators, stop them at `end`, free everything on ended. */
	function voice(srcs: AudioScheduledSourceNode[], nodes: AudioNode[], end: number): void {
		live++;
		let done = false;
		const stop = () => {
			if (done) return;
			done = true;
			live--;
			stoppers.delete(stop);
			for (const s of srcs) {
				try {
					s.stop();
				} catch {
					// never started or already stopped
				}
				s.disconnect();
			}
			for (const n of nodes) n.disconnect();
		};
		stoppers.add(stop);
		for (const s of srcs) {
			s.onended = stop;
			s.stop(end);
		}
	}

	function osc(type: OscillatorType, freq: number, t0: number, detune = 0): OscillatorNode {
		const o = ctx.createOscillator();
		o.type = type;
		o.frequency.value = freq;
		if (detune) o.detune.value = detune;
		o.start(t0);
		return o;
	}

	function filter(type: BiquadFilterType, f: number, q: number): BiquadFilterNode {
		const b = ctx.createBiquadFilter();
		b.type = type;
		b.frequency.value = f;
		b.Q.value = q;
		return b;
	}

	function play(inst: InstId, midi: number, when: number, dur: number, vel: number, opts: PlayOptions = {}): boolean {
		const limit = opts.force ? MAX_VOICES + 8 : PERC.has(inst) ? MAX_VOICES - PERC_VOICE_HEADROOM : MAX_VOICES;
		if (live >= limit || !Number.isFinite(when) || !(dur > 0)) return false;
		const t0 = Math.max(when, ctx.currentTime);
		const v = Math.min(1, Math.max(0, vel));
		const det = opts.detune ?? 0;
		const f = hz(midi);
		const env = ctx.createGain();
		env.connect(out);

		switch (inst) {
			case "rhodes": {
				// Tine-ish FM: a 1:1 modulator whose index decays fast, soft low-pass on top.
				const car = osc("sine", f, t0, det);
				const mod = osc("sine", f, t0);
				const idx = ctx.createGain();
				idx.gain.setValueAtTime(f * 1.4, t0);
				idx.gain.setTargetAtTime(f * 0.12, t0, 0.22);
				mod.connect(idx);
				idx.connect(car.frequency);
				const lp = filter("lowpass", 3200, 0.5);
				car.connect(lp);
				lp.connect(env);
				voice([car, mod], [idx, lp, env], envelope(env.gain, t0, v * 0.17, 0.004, 0.45, 0.22, dur, 0.28));
				break;
			}
			case "pluck": {
				const o = osc("triangle", f, t0, det);
				const lp = filter("lowpass", 1100, 0.7);
				lp.frequency.setValueAtTime(1100, t0);
				lp.frequency.setTargetAtTime(280, t0, 0.1);
				o.connect(lp);
				lp.connect(env);
				voice([o], [lp, env], envelope(env.gain, t0, v * 0.38, 0.006, 0.28, 0.25, dur, 0.14));
				break;
			}
			case "pad": {
				// String machine: two detuned saws through a warm low-pass, slow swell.
				const a = osc("sawtooth", f, t0, 6 + det);
				const b = osc("sawtooth", f, t0, -6 - det);
				const lp = filter("lowpass", 1100, 0.3);
				a.connect(lp);
				b.connect(lp);
				lp.connect(env);
				voice([a, b], [lp, env], envelope(env.gain, t0, v * 0.045, 0.35, 0.8, 0.85, dur, 0.55));
				break;
			}
			case "vibes": {
				const a = osc("sine", f, t0, det);
				const p4 = osc("sine", f * 4, t0);
				const g4 = ctx.createGain();
				p4.connect(g4);
				g4.connect(env);
				a.connect(env);
				const end4 = envelope(g4.gain, t0, 0.22, 0.002, 0.08, 0.02, dur, 0.1);
				voice([a, p4], [g4, env], Math.max(end4, envelope(env.gain, t0, v * 0.2, 0.002, 0.7, 0.12, dur, 0.5)));
				break;
			}
			case "brush": {
				const n = noiseSrc(t0);
				const bp = filter("bandpass", 5500, 0.6);
				n.connect(bp);
				bp.connect(env);
				voice([n], [bp, env], envelope(env.gain, t0, v * 0.075, 0.018, 0.06, 0.2, Math.min(dur, 0.25), 0.08));
				break;
			}
			case "rim": {
				const o = osc("triangle", 1500, t0);
				o.frequency.setValueAtTime(1500, t0);
				o.frequency.exponentialRampToValueAtTime(1000, t0 + 0.03);
				const n = noiseSrc(t0);
				const bp = filter("bandpass", 2800, 1);
				n.connect(bp);
				bp.connect(env);
				o.connect(env);
				voice([o, n], [bp, env], envelope(env.gain, t0, v * 0.1, 0.001, 0.01, 0.1, 0.03, 0.05));
				break;
			}
			case "tick": {
				// Teletype: a tiny noise burst plus a dull clack.
				const n = noiseSrc(t0);
				const bp = filter("bandpass", 3800, 1.5);
				const clack = osc("sine", 900, t0);
				n.connect(bp);
				bp.connect(env);
				clack.connect(env);
				voice([n, clack], [bp, env], envelope(env.gain, t0, v * 0.06, 0.001, 0.008, 0.1, 0.012, 0.03));
				break;
			}
		}
		return true;
	}

	return {
		play,
		active: () => live,
		dispose() {
			for (const stop of [...stoppers]) stop();
			stoppers.clear();
			live = 0;
			noise = null;
		},
	};
}
