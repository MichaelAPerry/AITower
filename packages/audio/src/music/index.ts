/**
 * Music engine glue: sequencer + instruments + tape chain feeding one output
 * node (the mixer's music bus). `run()` starts the 25 ms scheduling timer;
 * `pump(now)` is the same step for manual clocks (offline rendering).
 */
import type { MusicParams, StingerId } from "./director";
import { createInstruments } from "./instruments";
import { createRng } from "./rng";
import { SCORE, type Score } from "./score";
import { createSequencer, LOOKAHEAD_S, TICK_MS } from "./sequencer";
import { STINGER_NOTES, TAPE_STOP_S } from "./stingers";
import { createTape, TAPE_CORRUPTION } from "./tape";

export interface MusicOptions {
	seed?: number;
	corruption?: number;
	score?: Score;
}

export interface Music {
	/** Apply director output: stems (bar-aligned), level, tape filter, stingers. */
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
	destroy(): void;
}

export function createMusic(ctx: BaseAudioContext, out: AudioNode, opts: MusicOptions = {}): Music {
	const rng = createRng(opts.seed ?? 0xa17);
	const tape = createTape(ctx, rng, opts.corruption ?? TAPE_CORRUPTION);
	const level = ctx.createGain();
	level.gain.value = 1;
	tape.output.connect(level);
	level.connect(out);
	const inst = createInstruments(ctx, tape.input, rng);
	let timer: ReturnType<typeof setInterval> | null = null;
	let halted = false;
	let destroyed = false;

	const seq = createSequencer({
		score: opts.score ?? SCORE,
		play(n, when, durSec) {
			const pitched = n.midi > 0;
			const jitter = pitched ? (rng() - 0.5) * 0.016 : 0;
			const det = pitched ? (rng() * 2 - 1) * tape.detuneCents() : 0;
			inst.play(n.inst, n.midi, when + jitter, durSec, n.vel * (0.94 + rng() * 0.12), { detune: det });
		},
	});

	function pump(now = ctx.currentTime): void {
		if (halted || destroyed) return;
		seq.tick(now);
		tape.pump(now, LOOKAHEAD_S);
	}

	function stop(): void {
		if (timer !== null) clearInterval(timer);
		timer = null;
	}

	function stinger(id: StingerId): void {
		const now = ctx.currentTime;
		if (id === "tapeStop") {
			tape.stop(now, TAPE_STOP_S);
			level.gain.setTargetAtTime(0, now + TAPE_STOP_S * 0.35, TAPE_STOP_S * 0.2);
			return;
		}
		for (const n of STINGER_NOTES[id]) {
			inst.play(n.inst, n.midi, now + 0.02 + n.t, n.dur, n.vel, { force: true, detune: (rng() * 2 - 1) * tape.detuneCents() });
		}
	}

	function halt(): void {
		halted = true;
		seq.halt();
		stop();
	}

	return {
		update(p) {
			if (destroyed) return;
			const now = ctx.currentTime;
			if (!halted) {
				seq.setStems(p.stems);
				tape.setAgeHz(p.filterHz, now);
				level.gain.setTargetAtTime(p.level, now, p.level < 0.5 ? 0.5 : 0.8);
			}
			if (halted) return;
			const stops = p.stingers.includes("tapeStop");
			for (const s of stops ? (["tapeStop"] as const) : p.stingers) stinger(s);
			if (p.silent) {
				if (!stops) level.gain.setTargetAtTime(0, now, 0.3);
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
		voices: () => inst.active(),
		destroy() {
			if (destroyed) return;
			destroyed = true;
			halt();
			inst.dispose();
			tape.destroy();
			level.disconnect();
		},
	};
}

