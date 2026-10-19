/**
 * WebAudio implementation of AudioEngine. Everything is synthesized; there are
 * no audio files. Every method is a no-op when no AudioContext exists (Node,
 * tests) or before `resume()` has been called from a user gesture.
 */
import type { AudioEngine, HorrorIntensity } from "@aitower/shared";
import type { SimEvent, SimView } from "@aitower/sim";
import { humParams, maxRackTemp } from "./hum";
import { clamp01, createMixer, duckPlan, type Mixer, shouldDuck } from "./mixer";
import { musicParams, type MusicParams } from "./music/director";
import { createMusic, type Music } from "./music";
import { createPauseDetector } from "./pause";
import { createRateLimiter } from "./rateLimit";
import { SOUNDS, type SoundSpec, soundDuration, soundsForEvents, type Voice } from "./sounds";

type AudioContextCtor = new () => AudioContext;

/** Seconds — time constant for hum parameter smoothing. */
const HUM_SMOOTHING = 0.6;
/** Cap on one-shots started per update (a 30× frame can carry many events). */
const MAX_SHOTS_PER_UPDATE = 4;
/** Hz of the corruption "breathing" on the hum (about 13 breaths a minute). */
const BREATH_HZ = 0.22;
/** Peak breathing depth as a fraction of the hum level at full organic layer. */
const BREATH_DEPTH = 0.4;
/** Longest gap fed to the corruption smoothing, seconds (a throttled tab must not snap it). */
const MAX_DT_S = 5;

function findAudioContext(): AudioContextCtor | null {
	const g = globalThis as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
	return g.AudioContext ?? g.webkitAudioContext ?? null;
}

interface HumGraph {
	bus: GainNode;
	drone: OscillatorNode;
	droneOctave: OscillatorNode;
	droneGain: GainNode;
	noise: AudioBufferSourceNode;
	noiseFilter: BiquadFilterNode;
	noiseGain: GainNode;
	whine: OscillatorNode;
	whineGain: GainNode;
	/** Slow LFO on the hum level: the building breathes (corruption > 0.45). */
	breath: OscillatorNode;
	breathDepth: GainNode;
}

export function createAudio(): AudioEngine {
	let ctx: AudioContext | null = null;
	let mixer: Mixer | null = null;
	let music: Music | null = null;
	let lastMusic: MusicParams | undefined;
	let fx: GainNode | null = null;
	let hum: HumGraph | null = null;
	let noiseBuffer: AudioBuffer | null = null;
	let muted = false;
	let volume = 0.7;
	let musicVolume = 0.6;
	let destroyed = false;
	let horror: HorrorIntensity = "full";
	let lastUpdateS: number | null = null;
	const limiter = createRateLimiter();
	const pause = createPauseDetector();

	const masterLevel = () => (muted ? 0 : volume);

	function makeNoiseBuffer(c: AudioContext): AudioBuffer {
		const len = Math.floor(c.sampleRate * 2);
		const buf = c.createBuffer(1, len, c.sampleRate);
		const data = buf.getChannelData(0);
		// Cheap LCG — audio noise needs no determinism, but keeps us off Math.random for consistency.
		let s = 0x12345678;
		for (let i = 0; i < len; i++) {
			s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
			data[i] = (s / 0x80000000 - 1) * 0.9;
		}
		return buf;
	}

	function buildGraph(c: AudioContext): void {
		mixer = createMixer(c, masterLevel(), musicVolume);
		fx = c.createGain();
		fx.gain.value = 1;
		fx.connect(mixer.buses.sfx);
		noiseBuffer = makeNoiseBuffer(c);

		const bus = c.createGain();
		bus.gain.value = 0;
		bus.connect(mixer.buses.ambience);

		const droneFilter = c.createBiquadFilter();
		droneFilter.type = "lowpass";
		droneFilter.frequency.value = 220;
		const droneGain = c.createGain();
		droneGain.gain.value = 0.4;
		droneFilter.connect(droneGain).connect(bus);
		const drone = c.createOscillator();
		drone.type = "sawtooth";
		drone.frequency.value = 50;
		drone.connect(droneFilter);
		const droneOctave = c.createOscillator();
		droneOctave.type = "sine";
		droneOctave.frequency.value = 100;
		const octGain = c.createGain();
		octGain.gain.value = 0.5;
		droneOctave.connect(octGain).connect(droneFilter);

		const noise = c.createBufferSource();
		noise.buffer = noiseBuffer;
		noise.loop = true;
		const noiseFilter = c.createBiquadFilter();
		noiseFilter.type = "lowpass";
		noiseFilter.frequency.value = 400;
		noiseFilter.Q.value = 0.7;
		const noiseGain = c.createGain();
		noiseGain.gain.value = 0.2;
		noise.connect(noiseFilter).connect(noiseGain).connect(bus);

		const whine = c.createOscillator();
		whine.type = "sine";
		whine.frequency.value = 1800;
		const whineGain = c.createGain();
		whineGain.gain.value = 0;
		whine.connect(whineGain).connect(mixer.buses.ambience);

		const breath = c.createOscillator();
		breath.type = "sine";
		breath.frequency.value = BREATH_HZ;
		const breathDepth = c.createGain();
		breathDepth.gain.value = 0;
		breath.connect(breathDepth).connect(bus.gain);

		drone.start();
		droneOctave.start();
		noise.start();
		whine.start();
		breath.start();
		hum = { bus, drone, droneOctave, droneGain, noise, noiseFilter, noiseGain, whine, whineGain, breath, breathDepth };
		music = createMusic(c, mixer.buses.music, { stingerOut: mixer.buses.stinger });
		syncMusic();
	}

	/** The music timer runs only while the music volume is above zero. */
	function syncMusic(): void {
		if (!music) return;
		if (musicVolume > 0) music.run();
		else music.stop();
	}

	function setSmooth(param: AudioParam, value: number, now: number): void {
		param.setTargetAtTime(value, now, HUM_SMOOTHING);
	}

	function playVoice(c: AudioContext, out: AudioNode, v: Voice, t0: number): void {
		const start = t0 + v.start;
		const end = start + v.dur;
		const attack = Math.min(v.attack ?? 0.005, v.dur * 0.5);
		const env = c.createGain();
		env.gain.setValueAtTime(0.0001, start);
		env.gain.exponentialRampToValueAtTime(Math.max(0.0002, v.gain), start + attack);
		env.gain.exponentialRampToValueAtTime(0.0001, end);
		let tail: AudioNode = env;
		if (v.lowpassHz) {
			const lp = c.createBiquadFilter();
			lp.type = "lowpass";
			lp.frequency.value = v.lowpassHz;
			env.connect(lp);
			tail = lp;
		}
		tail.connect(out);

		let src: AudioScheduledSourceNode;
		if (v.wave === "noise") {
			const n = c.createBufferSource();
			n.buffer = noiseBuffer;
			n.loop = true;
			const bp = c.createBiquadFilter();
			bp.type = "bandpass";
			bp.frequency.value = v.freq;
			bp.Q.value = 0.8;
			n.connect(bp).connect(env);
			src = n;
		} else {
			const o = c.createOscillator();
			o.type = v.wave;
			o.frequency.setValueAtTime(v.freq, start);
			if (v.freqEnd) o.frequency.exponentialRampToValueAtTime(v.freqEnd, end);
			o.connect(env);
			src = o;
		}
		src.start(start);
		src.stop(end + 0.05);
		src.onended = () => {
			src.disconnect();
			tail.disconnect();
			if (tail !== env) env.disconnect();
		};
	}

	function play(spec: SoundSpec): void {
		if (!ctx || !fx) return;
		const bus = ctx.createGain();
		bus.gain.value = spec.gain;
		bus.connect(fx);
		const t0 = ctx.currentTime + 0.01;
		for (const v of spec.voices) playVoice(ctx, bus, v, t0);
		const c = ctx;
		globalThis.setTimeout(() => {
			if (c.state !== "closed") bus.disconnect();
		}, (soundDuration(spec) + 0.3) * 1000);
	}

	return {
		async resume() {
			if (destroyed) return;
			const Ctor = findAudioContext();
			if (!Ctor) return;
			try {
				if (!ctx) {
					ctx = new Ctor();
					buildGraph(ctx);
				}
				if (ctx.state === "suspended") await ctx.resume();
			} catch {
				// Autoplay refusal or unsupported environment: stay silent.
			}
		},

		update(view: SimView, events: SimEvent[]) {
			if (!ctx || !hum || ctx.state !== "running") return;
			const now = ctx.currentTime;
			const nowMs = now * 1000;
			const paused = pause.update(view.tick, nowMs);
			const p = humParams({ itKw: view.itKw, totalKw: view.totalKw, maxRackC: maxRackTemp(view), paused });
			setSmooth(hum.bus.gain, p.gain, now);
			setSmooth(hum.drone.frequency, p.droneHz, now);
			setSmooth(hum.droneOctave.frequency, p.droneHz * 2, now);
			setSmooth(hum.droneGain.gain, p.droneGain, now);
			setSmooth(hum.noiseFilter.frequency, p.noiseCutoffHz, now);
			setSmooth(hum.noiseGain.gain, p.noiseGain, now);
			setSmooth(hum.whine.frequency, p.whineHz, now);
			setSmooth(hum.whineGain.gain, p.whineGain, now);

			const dtS = lastUpdateS === null ? undefined : Math.min(MAX_DT_S, Math.max(0, now - lastUpdateS));
			lastUpdateS = now;
			// Pure and cheap, so it also runs with the music off: the corruption smoothing stays continuous.
			lastMusic = musicParams(view, events, paused, lastMusic, { intensity: horror, dtS });
			setSmooth(hum.breathDepth.gain, lastMusic.layers.organic * BREATH_DEPTH * p.gain, now);
			const musicOn = musicVolume > 0 && music !== null;
			let stingerS = 0;
			if (music && musicOn) stingerS = music.update(lastMusic);
			const plan = duckPlan(shouldDuck(events), stingerS);
			if (plan) mixer?.duck(plan);

			let shots = 0;
			for (const id of soundsForEvents(events)) {
				if (shots >= MAX_SHOTS_PER_UPDATE) break;
				if (id === "fanfare" && musicOn) continue; // the music stinger replaces the one-shot
				const spec = SOUNDS[id];
				if (!limiter.allow(id, nowMs, spec.minIntervalMs)) continue;
				play(spec);
				shots++;
			}
		},

		setMuted(m: boolean) {
			muted = m;
			mixer?.setMaster(masterLevel());
		},

		setHorrorIntensity(i: HorrorIntensity) {
			// "off" = clean tape, no organic sounds or horror stingers; "mild" = about half the depth.
			horror = i === "off" || i === "mild" ? i : "full";
		},
		setMusicVolume(v: number) {
			musicVolume = clamp01(v, musicVolume);
			mixer?.setMusic(musicVolume);
			syncMusic();
		},
		setVolume(v: number) {
			volume = clamp01(v, volume);
			mixer?.setMaster(masterLevel());
		},

		destroy() {
			destroyed = true;
			music?.destroy();
			music = null;
			lastMusic = undefined;
			lastUpdateS = null;
			if (hum) {
				for (const n of [hum.drone, hum.droneOctave, hum.noise, hum.whine, hum.breath]) {
					try {
						n.stop();
					} catch {
						// already stopped
					}
				}
			}
			const c = ctx;
			ctx = null;
			hum = null;
			mixer?.dispose();
			mixer = null;
			fx = null;
			limiter.reset();
			if (c && c.state !== "closed") void c.close().catch(() => undefined);
		},
	};
}
