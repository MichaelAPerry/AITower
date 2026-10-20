/**
 * WebAudio implementation of AudioEngine. Everything is synthesized; there are
 * no audio files. Every method is a no-op when no AudioContext exists (Node,
 * tests) or before `resume()` has been called from a user gesture.
 */
import type { AudioEngine, HorrorIntensity } from "@aitower/shared";
import type { SimEvent, SimView } from "@aitower/sim";
import { ambienceMix } from "./ambience";
import { humParams, maxRackTemp } from "./hum";
import { clamp01, createMixer, duckPlan, type Mixer, shouldDuck } from "./mixer";
import { musicParams, type MusicParams } from "./music/director";
import { createMusic, type Music } from "./music";
import { createPauseDetector } from "./pause";
import { createPathNotes, dueNotes, noteVoices, type PathLevels, pathLevels, type PathNotes } from "./pathLayers";
import { createRateLimiter } from "./rateLimit";
import { SOUNDS, type SoundSpec, automationToggles, soundDuration, soundPlays, type Voice } from "./sounds";
import { CENTRE, listenerFromView, spatialForEvent, type Spatial } from "./spatial";

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

/** Ambience bed gain at full mix (the hum stays the main floor tone). */
const AMBIENCE_GAIN = { plant: 0.1, fans: 0.05, wind: 0.07 } as const;
/** Path bed / note-bus gain at full level. */
const PATH_GAIN = { rustle: 0.05, water: 0.05, spore: 0.07, shimmer: 0.018, hollow: 0.03, notes: 0.5 } as const;
/** Seconds of path notes scheduled ahead. */
const NOTE_HORIZON_S = 0.4;

interface Layered {
	level: GainNode;
}
interface AmbienceGraph {
	plant: Layered;
	fans: Layered;
	wind: Layered;
}
interface PathGraph {
	rustle: Layered;
	water: Layered;
	spore: Layered;
	shimmer: Layered;
	hollow: Layered;
	gNotes: GainNode;
	sNotes: GainNode;
	nodes: AudioScheduledSourceNode[];
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
	let ambience: AmbienceGraph | null = null;
	let pathGraph: PathGraph | null = null;
	let ambienceSources: AudioScheduledSourceNode[] = [];
	let levels: PathLevels | undefined;
	let notes: PathNotes | null = null;
	let notesPath: string | null = null;
	let nextNoteS: number | null = null;
	let prevPolicy: SimView["automation"]["policy"] | undefined;
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
		buildAmbience(c, mixer.buses.ambience);
		syncMusic();
	}

	/** noise → (filters) → mod gain → level gain → out. Returns the level gain and pushes started sources to `list`. */
	function bed(c: AudioContext, out: AudioNode, list: AudioScheduledSourceNode[], filters: [BiquadFilterType, number, number][], lfo?: { type: OscillatorType; hz: number; depth: number; freqDepth?: number }): Layered {
		const src = c.createBufferSource();
		src.buffer = noiseBuffer;
		src.loop = true;
		let tail: AudioNode = src;
		const biq: BiquadFilterNode[] = [];
		for (const [type, hz, q] of filters) {
			const f = c.createBiquadFilter();
			f.type = type;
			f.frequency.value = hz;
			f.Q.value = q;
			tail.connect(f);
			tail = f;
			biq.push(f);
		}
		const mod = c.createGain();
		mod.gain.value = lfo ? 1 - lfo.depth : 1;
		const level = c.createGain();
		level.gain.value = 0;
		tail.connect(mod).connect(level).connect(out);
		list.push(src);
		if (lfo) {
			const o = c.createOscillator();
			o.type = lfo.type;
			o.frequency.value = lfo.hz;
			const d = c.createGain();
			d.gain.value = lfo.depth;
			o.connect(d).connect(mod.gain);
			if (lfo.freqDepth && biq[0]) {
				const fd = c.createGain();
				fd.gain.value = lfo.freqDepth;
				o.connect(fd).connect(biq[0].frequency);
			}
			o.start();
			list.push(o);
		}
		src.start();
		return { level };
	}

	/** Oscillator tones → level gain → out. */
	function tones(c: AudioContext, out: AudioNode, list: AudioScheduledSourceNode[], parts: [OscillatorType, number, number][], lfo?: { type: OscillatorType; hz: number; depth: number }): Layered {
		const mod = c.createGain();
		mod.gain.value = lfo ? 1 - lfo.depth : 1;
		const level = c.createGain();
		level.gain.value = 0;
		mod.connect(level).connect(out);
		for (const [type, hz, g] of parts) {
			const o = c.createOscillator();
			o.type = type;
			o.frequency.value = hz;
			const pg = c.createGain();
			pg.gain.value = g;
			o.connect(pg).connect(mod);
			o.start();
			list.push(o);
		}
		if (lfo) {
			const o = c.createOscillator();
			o.type = lfo.type;
			o.frequency.value = lfo.hz;
			const d = c.createGain();
			d.gain.value = lfo.depth;
			o.connect(d).connect(mod.gain);
			o.start();
			list.push(o);
		}
		return { level };
	}

	function buildAmbience(c: AudioContext, out: AudioNode): void {
		const list: AudioScheduledSourceNode[] = [];
		const plant = tones(c, out, list, [["sine", 55, 0.6], ["sine", 110, 0.3], ["sawtooth", 27.5, 0.1]]);
		const fans = bed(c, out, list, [["bandpass", 1100, 0.6]]);
		const wind = bed(c, out, list, [["bandpass", 520, 1.2]], { type: "sine", hz: 0.13, depth: 0.5, freqDepth: 260 });
		ambience = { plant, fans, wind };
		ambienceSources = list;
	}

	function buildPath(c: AudioContext): void {
		if (!mixer) return;
		const out = mixer.buses.ambience;
		const nodes: AudioScheduledSourceNode[] = [];
		const rustle = bed(c, out, nodes, [["bandpass", 5500, 0.5]], { type: "sine", hz: 0.7, depth: 0.5 });
		const water = bed(c, out, nodes, [["bandpass", 900, 3]], { type: "sine", hz: 4.5, depth: 0.35, freqDepth: 350 });
		const spore = bed(c, out, nodes, [["lowpass", 250, 0.7]], { type: "sine", hz: 0.15, depth: 0.9 });
		const shimmer = tones(c, out, nodes, [["sine", 2637, 0.5], ["sine", 3951, 0.3]], { type: "square", hz: 4, depth: 0.5 });
		const hollow = tones(c, out, nodes, [["sine", 220, 0.5], ["sine", 220.9, 0.5]]);
		const gNotes = c.createGain();
		gNotes.gain.value = 0;
		gNotes.connect(mixer.buses.music);
		const sNotes = c.createGain();
		sNotes.gain.value = 0;
		sNotes.connect(mixer.buses.music);
		pathGraph = { rustle, water, spore, shimmer, hollow, gNotes, sNotes, nodes };
	}

	function updatePath(c: AudioContext, view: SimView, now: number, dtS: number | undefined, paused: boolean): void {
		levels = pathLevels(view.path, view.pathScore, levels, dtS, horror);
		const L = levels;
		if (!pathGraph && view.path !== "greentech" && view.path !== "synthetic") return;
		if (!pathGraph) buildPath(c);
		const g = pathGraph;
		if (!g) return;
		// Paused: beds drop to 30 %, notes stop. A final game over (music level 0) silences the lot.
		const k = lastMusic ? lastMusic.level : 1;
		setSmooth(g.rustle.level.gain, L.rustle * PATH_GAIN.rustle * k, now);
		setSmooth(g.water.level.gain, L.water * PATH_GAIN.water * k, now);
		setSmooth(g.spore.level.gain, L.spore * PATH_GAIN.spore * k, now);
		setSmooth(g.shimmer.level.gain, L.shimmer * PATH_GAIN.shimmer * k, now);
		setSmooth(g.hollow.level.gain, L.hollow * PATH_GAIN.hollow * k, now);
		setSmooth(g.gNotes.gain, L.gMusic * PATH_GAIN.notes, now);
		setSmooth(g.sNotes.gain, L.sMusic * PATH_GAIN.notes, now);

		const path = view.path === "greentech" || view.path === "synthetic" ? view.path : null;
		if (path !== notesPath) {
			notesPath = path;
			notes = path ? createPathNotes(path, path === "greentech" ? 11 : 23) : null;
			nextNoteS = null;
		}
		const layer = path === "greentech" ? L.gMusic : L.sMusic;
		if (!notes || !path || paused || musicVolume <= 0 || k <= 0 || layer < 0.02) {
			nextNoteS = null;
			return;
		}
		const r = dueNotes(notes, nextNoteS, now + 0.02, NOTE_HORIZON_S);
		nextNoteS = r.nextS;
		const out = path === "greentech" ? g.gNotes : g.sNotes;
		for (const { note, at } of r.due) for (const v of noteVoices(note)) playVoice(c, out, v, at);
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

	function play(spec: SoundSpec, spat: Spatial = CENTRE, out: AudioNode | null = fx): void {
		if (!ctx || !out) return;
		const bus = ctx.createGain();
		bus.gain.value = spec.gain * spat.gain;
		let panner: StereoPannerNode | null = null;
		if (spat.pan !== 0 && typeof ctx.createStereoPanner === "function") {
			panner = ctx.createStereoPanner();
			panner.pan.value = spat.pan;
			bus.connect(panner).connect(out);
		} else bus.connect(out);
		const t0 = ctx.currentTime + 0.01;
		for (const v of spec.voices) playVoice(ctx, bus, v, t0);
		const c = ctx;
		globalThis.setTimeout(() => {
			if (c.state !== "closed") {
				bus.disconnect();
				panner?.disconnect();
			}
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

			if (ambience) {
				const a = ambienceMix(view, paused);
				const k = lastMusic && lastMusic.level === 0 ? 0 : 1; // final game over: the building goes quiet too
				setSmooth(ambience.plant.level.gain, a.plant * AMBIENCE_GAIN.plant * k, now);
				setSmooth(ambience.fans.level.gain, a.fans * AMBIENCE_GAIN.fans * k, now);
				setSmooth(ambience.wind.level.gain, a.wind * AMBIENCE_GAIN.wind * k, now);
			}
			updatePath(ctx, view, now, dtS, paused);

			let shots = 0;
			let listener: ReturnType<typeof listenerFromView> | null = null;
			for (const { id, event } of soundPlays(events)) {
				if (shots >= MAX_SHOTS_PER_UPDATE) break;
				if (id === "fanfare" && musicOn) continue; // the music stinger replaces the one-shot
				const spec = SOUNDS[id];
				if (!limiter.allow(id, nowMs, spec.minIntervalMs)) continue;
				listener ??= listenerFromView(view);
				play(spec, spatialForEvent(event, view, listener));
				shots++;
			}
			for (const id of automationToggles(prevPolicy, view.automation?.policy)) {
				if (limiter.allow(id, nowMs, SOUNDS[id].minIntervalMs)) play(SOUNDS[id], CENTRE, mixer?.buses.ui ?? null);
			}
			prevPolicy = view.automation?.policy;
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
			levels = undefined;
			notes = null;
			notesPath = null;
			nextNoteS = null;
			prevPolicy = undefined;
			for (const n of [...ambienceSources, ...(pathGraph?.nodes ?? [])]) {
				try {
					n.stop();
				} catch {
					// already stopped
				}
			}
			ambience = null;
			pathGraph = null;
			ambienceSources = [];
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
