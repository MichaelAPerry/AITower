/**
 * Music engine glue: sequencer + instruments + tape chain feeding one output
 * node (the mixer's music bus). `run()` starts the 25 ms scheduling timer;
 * `pump(now)` is the same step for manual clocks (offline rendering).
 * Body-horror layers (director `layers`) add detune/wow (tape), organic
 * textures, cluster chords, chewed tape and an "under" drone; stingers play on
 * their own output so the mixer can duck the music beneath them.
 */
import type { MusicParams, StingerId } from "./director";
import { createInstruments } from "./instruments";
import { clusterExtra, createOrganic } from "./organic";
import { createRng } from "./rng";
import { SCORE, type Score } from "./score";
import { ALL_STEMS_OFF, createSequencer, LOOKAHEAD_S, type Sequencer, TICK_MS, type StemMask } from "./sequencer";
import { HORROR_STINGERS, STINGER_NOTES, stingerDuration, TAPE_STOP_S } from "./stingers";
import { createTape, TAPE_CORRUPTION } from "./tape";
import { TRACKS, type TrackId } from "./tracks";

/** Minimum seconds between two plays of the same (non game-over) stinger. */
const STINGER_MIN_GAP_S = 2;
const NO_GAP: ReadonlySet<StingerId> = new Set<StingerId>(["tapeStop", "absorbed", "victory"]);

export interface MusicOptions {
	seed?: number;
	corruption?: number;
	/** A fixed score (tests, offline render): disables tier-track switching. */
	score?: Score;
	/** Where stingers go (default: `out`). The mixer routes this around the music duck. */
	stingerOut?: AudioNode;
}

export interface Music {
	/** Apply director output: track, stems (bar-aligned), level, tape, horror layers, stingers. */
	update(params: MusicParams): void;
	/** Start the lookahead timer (idempotent; no-op once halted or destroyed). */
	run(): void;
	/** Stop the timer (notes already scheduled still ring out). */
	stop(): void;
	/** One scheduling step at audio time `now`. */
	pump(now?: number): void;
	isRunning(): boolean;
	isHalted(): boolean;
	voices(): number;
	/** Track currently scheduled (or about to be). */
	track(): TrackId | null;
	destroy(): void;
}

interface UnderLayer {
	gain: GainNode;
	nodes: AudioNode[];
	oscs: OscillatorNode[];
}

export function createMusic(ctx: BaseAudioContext, out: AudioNode, opts: MusicOptions = {}): Music {
	const rng = createRng(opts.seed ?? 0xa17);
	const tape = createTape(ctx, rng, opts.corruption ?? TAPE_CORRUPTION);
	const level = ctx.createGain();
	level.gain.value = 1;
	tape.output.connect(level);
	level.connect(out);
	const inst = createInstruments(ctx, tape.input, rng);
	const stingerInst = createInstruments(ctx, opts.stingerOut ?? out, rng);
	const organic = createOrganic({ rng, play: (id, midi, when, dur, vel) => void inst.play(id, midi, when, dur, vel) });
	const fixedScore = opts.score !== undefined;
	let timer: ReturnType<typeof setInterval> | null = null;
	let halted = false;
	let destroyed = false;

	let stems: StemMask = { ...ALL_STEMS_OFF };
	let trackId: TrackId | null = fixedScore ? null : 1;
	let pending: TrackId | null = null;
	let lastNow: number | null = null;
	let organicLevel = 0;
	let clusterLevel = 0;
	let underLevel = 0;
	let under: UnderLayer | null = null;
	const lastStinger = new Map<StingerId, number>();

	function makeSeq(score: Score, startAt?: number): Sequencer {
		const s = createSequencer({
			score,
			startAt,
			play(n, when, durSec) {
				const pitched = n.midi > 0;
				const jitter = pitched ? (rng() - 0.5) * 0.016 : 0;
				// The melody drifts flat under the "under" layer; everything wobbles with the tape.
				const flat = n.stem === "vibes" ? -underLevel * 30 : 0;
				const det = pitched ? (rng() * 2 - 1) * tape.detuneCents() + flat : 0;
				const vel = n.vel * (0.94 + rng() * 0.12);
				inst.play(n.inst, n.midi, when + jitter, durSec, vel, { detune: det });
				if (clusterLevel > 0 && (n.stem === "pad" || n.stem === "keys")) {
					const extra = clusterExtra(n.midi, clusterLevel, rng);
					if (extra !== null) inst.play(n.inst, extra, when + jitter, durSec, vel * 0.8, { detune: det });
				}
			},
		});
		s.setStems(stems);
		return s;
	}
	let seq = makeSeq(opts.score ?? SCORE);

	/** Swap to the pending track on a bar line: finish the old loop up to the line, start the new one on it. */
	function maybeSwap(now: number): void {
		if (pending === null) return;
		const a = seq.anchor();
		if (a === null || lastNow === null) {
			seq = makeSeq(TRACKS[pending]);
			trackId = pending;
			pending = null;
			return;
		}
		const barSec = seq.stepSec * 16;
		const horizon = lastNow + LOOKAHEAD_S;
		const at = a + Math.ceil((horizon - a) / barSec - 1e-9) * barSec;
		if (now + LOOKAHEAD_S < at) return;
		seq.tick(at - LOOKAHEAD_S - 1e-6);
		seq.halt();
		seq = makeSeq(TRACKS[pending], at);
		trackId = pending;
		pending = null;
	}

	function pump(now = ctx.currentTime): void {
		if (halted || destroyed) return;
		maybeSwap(now);
		seq.tick(now);
		tape.pump(now, LOOKAHEAD_S);
		organic.pump(now, LOOKAHEAD_S, organicLevel);
		lastNow = now;
	}

	function stop(): void {
		if (timer !== null) clearInterval(timer);
		timer = null;
	}

	function stinger(id: StingerId, horror: number): void {
		const now = ctx.currentTime;
		if (id === "tapeStop") {
			tape.stop(now, TAPE_STOP_S);
			level.gain.setTargetAtTime(0, now + TAPE_STOP_S * 0.35, TAPE_STOP_S * 0.2);
			return;
		}
		const last = lastStinger.get(id);
		if (!NO_GAP.has(id) && last !== undefined && now - last < STINGER_MIN_GAP_S) return;
		lastStinger.set(id, now);
		const scale = HORROR_STINGERS.has(id) ? 0.4 + 0.6 * horror : 1;
		for (const n of STINGER_NOTES[id]) stingerInst.play(n.inst, n.midi, now + 0.02 + n.t, n.dur, Math.min(1, n.vel * scale), { force: true });
	}

	/** The "under" layer: a low, beating, not-quite-pitched drone that breathes. Built on first use. */
	function setUnder(lvl: number, now: number): void {
		underLevel = lvl;
		if (!under) {
			if (!(lvl > 0)) return;
			const gain = ctx.createGain();
			gain.gain.value = 0;
			gain.connect(out);
			const lp = ctx.createBiquadFilter();
			lp.type = "lowpass";
			lp.frequency.value = 180;
			lp.connect(gain);
			const oscs: OscillatorNode[] = [];
			const nodes: AudioNode[] = [gain, lp];
			for (const [type, f] of [["sine", 41.2], ["sine", 43.7], ["sawtooth", 58.3]] as const) {
				const o = ctx.createOscillator();
				o.type = type;
				o.frequency.value = f;
				o.connect(lp);
				o.start();
				oscs.push(o);
			}
			// Slow breathing on the drone's level.
			const lfo = ctx.createOscillator();
			lfo.frequency.value = 0.14;
			const depth = ctx.createGain();
			depth.gain.value = 0.04;
			lfo.connect(depth);
			depth.connect(gain.gain);
			lfo.start();
			oscs.push(lfo);
			nodes.push(depth);
			under = { gain, nodes, oscs };
		}
		under.gain.gain.setTargetAtTime(lvl * 0.1, now, 1.5);
	}

	function halt(): void {
		halted = true;
		seq.halt();
		stop();
		organicLevel = 0;
		pending = null;
	}

	return {
		update(p) {
			if (destroyed) return;
			const now = ctx.currentTime;
			if (!halted) {
				stems = p.stems;
				seq.setStems(stems);
				if (!fixedScore && p.track !== trackId) pending = p.track;
				else if (p.track === trackId) pending = null;
				tape.setAgeHz(p.filterHz, now);
				tape.setCorruption(p.tapeCorruption);
				tape.setChew(p.layers.cluster);
				organicLevel = p.layers.organic;
				clusterLevel = p.layers.cluster;
				setUnder(p.layers.under, now);
				level.gain.setTargetAtTime(p.level, now, p.level < 0.5 ? 0.5 : 0.8);
			}
			if (halted) return;
			const stops = p.stingers.includes("tapeStop");
			for (const s of stops ? (["tapeStop"] as const) : p.stingers) stinger(s, p.horror);
			if (p.silent) {
				// A final stinger (absorbed) finishes before the muzak fades out; tapeStop fades itself.
				const wait = stops ? TAPE_STOP_S * 0.35 : Math.max(0, ...p.stingers.map(stingerDuration));
				if (!stops) level.gain.setTargetAtTime(0, now + wait, 0.3);
				if (under) under.gain.gain.setTargetAtTime(0, now + wait, 0.3);
				halt();
			}
		},
		run() {
			if (timer !== null || halted || destroyed) return;
			timer = setInterval(() => {
				if (ctx.state === "running") pump();
			}, TICK_MS);
		},
		stop,
		pump,
		isRunning: () => timer !== null,
		isHalted: () => halted,
		voices: () => inst.active() + stingerInst.active(),
		track: () => trackId,
		destroy() {
			if (destroyed) return;
			destroyed = true;
			halt();
			inst.dispose();
			stingerInst.dispose();
			tape.destroy();
			level.disconnect();
			if (under) {
				for (const o of under.oscs) {
					try {
						o.stop();
					} catch {
						// already stopped
					}
					o.disconnect();
				}
				for (const n of under.nodes) n.disconnect();
				under = null;
			}
		},
	};
}
