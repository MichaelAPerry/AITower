import type { SimEvent } from "@aitower/sim";
import { describe, expect, it } from "vitest";
import { DUCK, duckLinear, duckSteps, shouldDuck } from "./mixer";
import { DIRECTOR, isNight, musicParams } from "./music/director";
import { createRng } from "./music/rng";
import { BARS, SCORE, STEM_RANGES, STEPS_PER_BAR, type ScoreNote, type Stem } from "./music/score";
import { ALL_STEMS_OFF, createSequencer, type StemMask } from "./music/sequencer";
import { STINGER_NOTES } from "./music/stingers";
import { nextDropout, saturationCurve, tapeParams } from "./music/tape";

const ev = (e: SimEvent): SimEvent => e;
const v = (itKw: number, minuteOfDay = 720, gameOver: null | { kind: "shutdown"; tick: number } = null) => ({ itKw, minuteOfDay, gameOver }) as Parameters<typeof musicParams>[0];

describe("score", () => {
	it("is a 32-bar 96 BPM loop with notes inside the loop and their instrument's range", () => {
		expect(SCORE.bpm).toBe(96);
		expect(SCORE.bars).toBe(BARS);
		expect(BARS).toBeGreaterThanOrEqual(32);
		const loop = BARS * STEPS_PER_BAR;
		for (const n of SCORE.notes) {
			expect(n.step).toBeGreaterThanOrEqual(0);
			expect(n.step).toBeLessThan(loop);
			expect(n.dur).toBeGreaterThan(0);
			expect(n.vel).toBeGreaterThan(0);
			expect(n.vel).toBeLessThanOrEqual(1);
			const [lo, hi] = STEM_RANGES[n.stem];
			expect(n.midi, `${n.stem}@${n.step}`).toBeGreaterThanOrEqual(lo);
			expect(n.midi, `${n.stem}@${n.step}`).toBeLessThanOrEqual(hi);
		}
		const sorted = [...SCORE.notes].sort((a, b) => a.step - b.step);
		expect(SCORE.notes.map((n) => n.step)).toEqual(sorted.map((n) => n.step));
	});

	it("covers every stem in every bar except the sparse melody, with consistent per-bar counts", () => {
		const perBar = (stem: Stem, bar: number) => SCORE.notes.filter((n) => n.stem === stem && Math.floor(n.step / STEPS_PER_BAR) === bar).length;
		for (let bar = 0; bar < BARS; bar++) {
			for (const stem of ["pad", "keys", "bass", "brush", "rim", "hat"] as const) expect(perBar(stem, bar), `${stem} bar ${bar}`).toBeGreaterThan(0);
			expect(perBar("bass", bar)).toBe(4);
			expect(perBar("keys", bar)).toBe(12);
		}
		expect(SCORE.notes.some((n) => n.stem === "vibes")).toBe(true);
	});

	it("keeps every instrument id mapped to its stem", () => {
		const map: Record<Stem, string> = { pad: "pad", keys: "rhodes", bass: "pluck", vibes: "vibes", brush: "brush", rim: "rim", hat: "tick" };
		for (const n of SCORE.notes) expect(n.inst).toBe(map[n.stem]);
	});

	it("keeps stinger notes in the instrument ranges", () => {
		for (const list of Object.values(STINGER_NOTES)) {
			expect(list.length).toBeGreaterThan(0);
			for (const n of list) {
				expect(n.t).toBeGreaterThanOrEqual(0);
				expect(n.dur).toBeGreaterThan(0);
				expect(n.vel).toBeLessThanOrEqual(1);
			}
		}
	});
});

describe("director", () => {
	it("maps IT load to bass and percussion stems with hysteresis", () => {
		const lo = musicParams(v(0), [], false);
		expect(lo.stems).toMatchObject({ pad: true, keys: true, vibes: true, bass: false, brush: false, rim: false, hat: false });
		const mid = musicParams(v(60), [], false);
		expect(mid.stems.bass).toBe(true);
		expect(mid.stems.rim).toBe(false);
		const hi = musicParams(v(200), [], false);
		expect(hi.stems).toMatchObject({ bass: true, brush: true, rim: true, hat: true });
		// Hysteresis: between off and on thresholds the previous state holds.
		expect(musicParams(v(100), [], false, hi).stems.rim).toBe(true);
		expect(musicParams(v(100), [], false, mid).stems.rim).toBe(false);
		expect(musicParams(v(30), [], false, hi).stems.bass).toBe(true);
		expect(musicParams(v(10), [], false, hi).stems.bass).toBe(false);
		expect(musicParams(v(Number.NaN), [], false).stems.bass).toBe(false);
	});

	it("goes dark and drops the hats at night", () => {
		expect(isNight(720)).toBe(false);
		expect(isNight(DIRECTOR.nightStartMin)).toBe(true);
		expect(isNight(0)).toBe(true);
		expect(isNight(359)).toBe(true);
		expect(isNight(360)).toBe(false);
		expect(isNight(1440 + 720)).toBe(false);
		const day = musicParams(v(200, 720), [], false);
		const night = musicParams(v(200, 1380), [], false);
		expect(night.night).toBe(true);
		expect(night.filterHz).toBeLessThan(day.filterHz);
		expect(night.stems.hat).toBe(false);
		expect(night.stems.rim).toBe(true);
		expect(day.stems.hat).toBe(true);
	});

	it("fades to ~30% when paused and to 0 after game over", () => {
		expect(musicParams(v(0), [], false).level).toBe(1);
		expect(musicParams(v(0), [], true).level).toBeCloseTo(0.3);
		const over = musicParams(v(0, 720, { kind: "shutdown", tick: 5 }), [], false);
		expect(over.level).toBe(0);
		expect(over.silent).toBe(true);
		expect(over.stingers).toEqual([]); // no event this frame: no stinger on a loaded game-over
	});

	it("turns events into stingers", () => {
		expect(musicParams(v(0), [ev({ type: "memoIssued", memoId: 1, eventId: "x" })], false).stingers).toEqual(["teletype"]);
		expect(musicParams(v(0), [ev({ type: "tierUp", tier: 2, reward: 1 })], false).stingers).toEqual(["fanfare"]);
		const both = musicParams(v(0), [ev({ type: "memoIssued", memoId: 1, eventId: "x" }), ev({ type: "memoIssued", memoId: 2, eventId: "y" }), ev({ type: "tierUp", tier: 2, reward: 1 })], false);
		expect(both.stingers).toEqual(["fanfare", "teletype"]);
		const over = musicParams(v(0, 720, { kind: "shutdown", tick: 5 }), [ev({ type: "gameOver", kind: "shutdown" }), ev({ type: "tierUp", tier: 2, reward: 1 })], false);
		expect(over.stingers).toEqual(["tapeStop"]);
		expect(over.silent).toBe(true);
		expect(musicParams(v(0), [ev({ type: "rackTripped", facilityId: 1 })], false).stingers).toEqual([]);
	});
});

describe("sequencer", () => {
	const mask = (on: Stem[]): StemMask => ({ ...ALL_STEMS_OFF, ...Object.fromEntries(on.map((s) => [s, true])) });
	const make = (stems: StemMask) => {
		const played: { n: ScoreNote; when: number; dur: number }[] = [];
		const seq = createSequencer({ score: SCORE, play: (n, when, dur) => played.push({ n, when, dur }) });
		seq.setStems(stems);
		return { seq, played };
	};
	const clock = (seq: ReturnType<typeof make>["seq"], from: number, to: number, dt = 0.025) => {
		for (let t = from; t <= to + 1e-9; t += dt) seq.tick(t);
	};

	it("schedules each note exactly once, on the step grid, in order", () => {
		const { seq, played } = make(mask(["bass", "keys"]));
		clock(seq, 0, 12);
		const anchor = seq.anchor() as number;
		const keys = (s: string) => `${s}`;
		const seen = new Set<string>();
		for (const p of played) {
			const key = keys(`${p.n.stem}:${p.n.step}:${Math.round((p.when - anchor) / seq.stepSec)}`);
			expect(seen.has(key), key).toBe(false);
			seen.add(key);
			// onset = anchor + (loop*steps + n.step) * stepSec
			const steps = (p.when - anchor) / seq.stepSec - p.n.step;
			expect(Math.abs(steps / (BARS * STEPS_PER_BAR) - Math.round(steps / (BARS * STEPS_PER_BAR)))).toBeLessThan(1e-6);
			expect(p.dur).toBeCloseTo(p.n.dur * seq.stepSec);
		}
		const whens = played.map((p) => p.when);
		expect(played.length).toBeGreaterThan(40);
		expect(Math.max(...whens)).toBeLessThanOrEqual(12.1 + 0.2);
		// 12 s at 96 BPM = 4.8 bars: bass has 4 notes/bar and keys 12.
		const bass = played.filter((p) => p.n.stem === "bass").length;
		expect(bass).toBeGreaterThanOrEqual(4 * 4);
		expect(bass).toBeLessThanOrEqual(4 * 6);
	});

	it("only schedules inside the lookahead window", () => {
		const { seq, played } = make(mask(["bass"]));
		seq.tick(0);
		for (const p of played) expect(p.when).toBeLessThanOrEqual(0.1 + 1e-6 + 0.016);
	});

	it("stays aligned to the grid after a long gap and does not replay missed steps", () => {
		const { seq, played } = make(mask(["keys", "bass"]));
		clock(seq, 0, 2);
		const anchor = seq.anchor() as number;
		const before = played.length;
		const lastBefore = Math.max(...played.map((p) => p.when));
		clock(seq, 1000.37, 1003); // tab was throttled for ~16 minutes
		const after = played.slice(before);
		expect(after.length).toBeGreaterThan(0);
		expect(after.length).toBeLessThan(60); // no catch-up burst (~3 s of music)
		for (const p of after) {
			expect(p.when).toBeGreaterThanOrEqual(1000.37 - 0.05 - 0.1);
			const steps = (p.when - anchor) / seq.stepSec - p.n.step;
			const loops = steps / (BARS * STEPS_PER_BAR);
			expect(Math.abs(loops - Math.round(loops))).toBeLessThan(1e-6);
		}
		expect(Math.min(...after.map((p) => p.when))).toBeGreaterThan(lastBefore);
		// continues without duplicates
		const n = played.length;
		seq.tick(1003);
		expect(played.length).toBe(n);
	});

	it("latches stem changes at the next bar line", () => {
		const { seq, played } = make(mask(["keys"]));
		const barSec = seq.stepSec * STEPS_PER_BAR;
		seq.tick(0);
		const anchor = seq.anchor() as number;
		// switch the bass on mid-bar 0
		clock(seq, 0.025, anchor + barSec * 0.5);
		seq.setStems(mask(["keys", "bass"]));
		clock(seq, anchor + barSec * 0.5, anchor + barSec * 2.5);
		const bassTimes = played.filter((p) => p.n.stem === "bass").map((p) => p.when);
		expect(bassTimes.length).toBeGreaterThan(0);
		expect(Math.min(...bassTimes)).toBeGreaterThanOrEqual(anchor + barSec - 1e-6);
		// ...and off again at a bar line
		seq.setStems(mask(["keys"]));
		const mark = anchor + barSec * 2.5;
		clock(seq, mark, anchor + barSec * 5.5);
		const late = played.filter((p) => p.n.stem === "bass" && p.when > anchor + barSec * 3.2);
		expect(late.length).toBe(0);
	});

	it("wraps the loop and halts for good", () => {
		const { seq, played } = make(mask(["rim"]));
		const loopSec = BARS * STEPS_PER_BAR * seq.stepSec;
		clock(seq, 0, loopSec + 1, 0.05);
		const firstLoop = played.filter((p) => p.when < (seq.anchor() as number) + loopSec - 1e-6).length;
		expect(played.length).toBeGreaterThan(firstLoop);
		seq.halt();
		const n = played.length;
		seq.tick(loopSec * 3);
		expect(played.length).toBe(n);
		expect(seq.tick(Number.NaN)).toBe(0);
	});
});

describe("tape", () => {
	it("scales detune, wow depth and dropouts with corruption", () => {
		const a = tapeParams(0.05);
		const b = tapeParams(1);
		expect(a.detuneCents).toBeLessThan(5);
		expect(b.detuneCents).toBeGreaterThan(a.detuneCents);
		expect(b.wowDepthS).toBeGreaterThan(a.wowDepthS);
		expect(b.dropoutRate).toBeGreaterThan(a.dropoutRate);
		expect(b.dropoutDepth).toBeLessThanOrEqual(0.9);
		expect(tapeParams(-3)).toEqual(tapeParams(0));
		expect(tapeParams(Number.NaN)).toEqual(tapeParams(0));
		expect(tapeParams(9)).toEqual(tapeParams(1));
	});

	it("keeps wow below ~5 cents at the fixed 0.05 corruption", () => {
		const cents = 1200 * Math.log2(1 + 2 * Math.PI * 0.55 * tapeParams(0.05).wowDepthS);
		expect(cents).toBeLessThan(5);
	});

	it("draws deterministic, bounded dropouts", () => {
		const r1 = createRng(1);
		const r2 = createRng(1);
		for (let i = 0; i < 50; i++) {
			const d = nextDropout(r1, 0.05);
			expect(d).toEqual(nextDropout(r2, 0.05));
			expect(d.gapS).toBeGreaterThanOrEqual(4);
			expect(Number.isFinite(d.gapS)).toBe(true);
			expect(d.depth).toBeLessThan(0.6);
			expect(d.durS).toBeLessThan(0.5);
		}
	});

	it("has a bounded, odd-symmetric saturation curve", () => {
		const c = saturationCurve(257);
		expect(Math.max(...c)).toBeCloseTo(1);
		expect(c[0]).toBeCloseTo(-1);
		expect(c[128]).toBeCloseTo(0);
		for (let i = 0; i < c.length; i++) expect(c[i] as number).toBeCloseTo(-(c[c.length - 1 - i] as number), 5);
	});
});

describe("mixer ducking", () => {
	it("dips ~8 dB for ~1.5 s then releases", () => {
		expect(DUCK.db).toBe(-8);
		expect(DUCK.holdS).toBe(1.5);
		expect(duckLinear()).toBeCloseTo(0.398, 2);
		const [dip, release] = duckSteps(10);
		expect(dip).toEqual({ time: 10, target: duckLinear(), tau: DUCK.attackTau });
		expect(release?.time).toBeCloseTo(11.5);
		expect(release?.target).toBe(1);
		expect(release?.tau).toBeGreaterThan(dip?.tau ?? 0);
	});

	it("ducks on rackTripped, powerShortfall and gameOver only", () => {
		expect(shouldDuck([ev({ type: "rackTripped", facilityId: 1 })])).toBe(true);
		expect(shouldDuck([ev({ type: "powerShortfall", netId: 1, satisfaction: 0.5 })])).toBe(true);
		expect(shouldDuck([ev({ type: "gameOver", kind: "shutdown" })])).toBe(true);
		expect(shouldDuck([ev({ type: "tierUp", tier: 2, reward: 1 }), ev({ type: "memoIssued", memoId: 1, eventId: "x" })])).toBe(false);
		expect(shouldDuck([])).toBe(false);
	});
});
