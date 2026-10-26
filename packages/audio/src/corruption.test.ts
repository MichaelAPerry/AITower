import type { SimEvent } from "@aitower/sim";
import { describe, expect, it } from "vitest";
import { duckPlan, duckSteps, DUCK } from "./mixer";
import { CORRUPTION_LAYERS, intensityScale, layerLevels, musicParams, tapeCorruption } from "./music/director";
import { clickRate, createOrganic, clusterExtra, HEART_DUB_S } from "./music/organic";
import { createRng } from "./music/rng";
import { STEM_RANGES, STEPS_PER_BAR, type Stem } from "./music/score";
import { ALL_STEMS_OFF, createSequencer } from "./music/sequencer";
import { HORROR_STINGERS, MAX_STINGERS_PER_UPDATE, STINGER_NOTES, stingerDuration, stingerForEvent, stingersForEvents, type StingerId } from "./music/stingers";
import { nextDropout, tapeParams } from "./music/tape";
import { spell, TRACK_2, TRACK_3, TRACKS, TRACK_BARS, trackForTier } from "./music/tracks";

const ev = (e: SimEvent): SimEvent => e;
const view = (corruption: number, tier = 1) => ({ itKw: 100, minuteOfDay: 720, gameOver: null, corruption, tier }) as Parameters<typeof musicParams>[0];

describe("corruption layers", () => {
	it("switches each layer on strictly above its threshold", () => {
		for (const [name, { on }] of Object.entries(CORRUPTION_LAYERS)) {
			const at = layerLevels(on)[name as keyof typeof CORRUPTION_LAYERS];
			const above = layerLevels(on + 0.01)[name as keyof typeof CORRUPTION_LAYERS];
			expect(at, `${name} at threshold`).toBe(0);
			expect(above, `${name} above`).toBeGreaterThan(0);
		}
		expect(layerLevels(0.2).drift).toBe(0);
		expect(layerLevels(0.3)).toMatchObject({ organic: 0, cluster: 0, under: 0 });
		expect(layerLevels(0.3).drift).toBeGreaterThan(0);
		expect(layerLevels(0.5).organic).toBeGreaterThan(0);
		expect(layerLevels(0.5).cluster).toBe(0);
		expect(layerLevels(0.75).cluster).toBeGreaterThan(0);
		expect(layerLevels(0.75).under).toBe(0);
		expect(layerLevels(0.95).under).toBeGreaterThan(0);
		expect(layerLevels(1)).toEqual({ drift: 1, organic: 1, cluster: 1, under: 1 });
		expect(layerLevels(Number.NaN)).toEqual(layerLevels(0));
		expect(layerLevels(7)).toEqual(layerLevels(1));
	});

	it("keeps the tape clean at 0.05 and rises monotonically to 1", () => {
		expect(tapeCorruption(layerLevels(0))).toBeCloseTo(0.05);
		expect(tapeCorruption(layerLevels(0.2))).toBeCloseTo(0.05);
		let prev = 0;
		for (let c = 0; c <= 1.0001; c += 0.05) {
			const t = tapeCorruption(layerLevels(c));
			expect(t).toBeGreaterThanOrEqual(prev);
			prev = t;
		}
		expect(tapeCorruption(layerLevels(1))).toBeCloseTo(1);
	});

	it("scales by the horror setting: off is clean, mild about half", () => {
		expect([intensityScale("full"), intensityScale("mild"), intensityScale("off"), intensityScale(undefined)]).toEqual([1, 0.5, 0, 1]);
		const full = musicParams(view(0.8), [], false, undefined, { intensity: "full" });
		const mild = musicParams(view(0.8), [], false, undefined, { intensity: "mild" });
		const off = musicParams(view(0.8), [], false, undefined, { intensity: "off" });
		expect(full.corruption).toBeCloseTo(0.8);
		expect(mild.corruption).toBeCloseTo(0.4);
		expect(mild.layers.organic).toBe(0);
		expect(mild.layers.drift).toBeGreaterThan(0);
		expect(off.corruption).toBe(0);
		expect(off.tapeCorruption).toBeCloseTo(0.05);
		expect(off.layers).toEqual({ drift: 0, organic: 0, cluster: 0, under: 0 });
		expect(full.layers.cluster).toBeGreaterThan(0);
	});

	it("eases corruption with the frame time, and snaps to clean when turned off", () => {
		const a = musicParams(view(0), [], false);
		const b = musicParams(view(1), [], false, a, { dtS: 0.5 });
		expect(b.corruption).toBeGreaterThan(0);
		expect(b.corruption).toBeLessThan(0.3);
		let p = b;
		for (let i = 0; i < 40; i++) p = musicParams(view(1), [], false, p, { dtS: 0.5 });
		expect(p.corruption).toBeGreaterThan(0.99);
		expect(musicParams(view(1), [], false, p, { dtS: 0.5, intensity: "off" }).corruption).toBe(0);
		expect(musicParams(view(1), [], false, a).corruption).toBe(1); // no dt: jumps
		expect(musicParams(view(Number.NaN), [], false).corruption).toBe(0);
		expect(musicParams({ itKw: 1, minuteOfDay: 0, gameOver: null }, [], false).corruption).toBe(0);
	});

	it("picks the track by tier (4-5 reuse track 3)", () => {
		expect([0, 1, 2, 3, 4, 5, Number.NaN].map(trackForTier)).toEqual([1, 1, 2, 3, 3, 3, 1]);
		expect(musicParams(view(0, 2), [], false).track).toBe(2);
		expect(musicParams(view(0, 5), [], false).track).toBe(3);
		expect(musicParams({ itKw: 1, minuteOfDay: 0, gameOver: null }, [], false).track).toBe(1);
	});

	it("only shifts tape detune/wow/dropouts, never the clean baseline", () => {
		const clean = tapeParams(tapeCorruption(layerLevels(0)));
		const dirty = tapeParams(tapeCorruption(layerLevels(0.3)));
		expect(dirty.detuneCents).toBeGreaterThan(clean.detuneCents);
		expect(dirty.wowDepthS).toBeGreaterThan(clean.wowDepthS);
	});
});

describe("chewed tape", () => {
	it("adds stutters and shorter gaps only when chewing", () => {
		const r1 = createRng(3);
		const r2 = createRng(3);
		expect(nextDropout(r1, 0.5, 0)).toEqual(nextDropout(r2, 0.5)); // chew 0 = legacy draws
		expect(nextDropout(createRng(3), 0.5, 0).stutters).toBe(0);
		let minGap = Infinity;
		for (let s = 1; s < 200; s++) {
			const d = nextDropout(createRng(s), 1, 1);
			expect(d.stutters).toBeGreaterThanOrEqual(1);
			expect(d.stutters).toBeLessThanOrEqual(3);
			expect(d.gapS).toBeGreaterThanOrEqual(1);
			minGap = Math.min(minGap, d.gapS);
		}
		expect(minGap).toBeLessThan(4);
	});
});

describe("organic scheduler", () => {
	const run = (level: number, secs: number) => {
		const played: { inst: string; when: number; vel: number }[] = [];
		const o = createOrganic({ rng: createRng(5), play: (inst, _m, when, _d, vel) => played.push({ inst, when, vel }) });
		for (let t = 0; t < secs; t += 0.025) o.pump(t, 0.1, level);
		return played;
	};
	it("is silent at level 0", () => {
		expect(run(0, 10)).toEqual([]);
	});
	it("beats at 60 BPM (lub-dub) and clicks at random", () => {
		const p = run(0.6, 20);
		const lubs = p.filter((n) => n.inst === "heart").map((n) => n.when);
		expect(lubs.length).toBeGreaterThanOrEqual(38);
		expect(lubs.length).toBeLessThanOrEqual(42);
		const sorted = [...lubs].sort((a, b) => a - b);
		expect(sorted[1]! - sorted[0]!).toBeCloseTo(HEART_DUB_S, 5);
		expect(sorted[2]! - sorted[0]!).toBeCloseTo(1, 5);
		const clicks = p.filter((n) => n.inst === "wet").length;
		expect(clicks).toBeGreaterThan(20 * 0.3 * 0.5);
		expect(clicks).toBeLessThan(20 * clickRate(0.6) * 2);
	});
	it("schedules each note once and forgets when the level drops to 0", () => {
		const played: number[] = [];
		const o = createOrganic({ rng: createRng(1), play: (_i, _m, when) => played.push(when) });
		o.pump(0, 0.1, 1);
		const n = played.length;
		o.pump(0, 0.1, 1);
		expect(played.length).toBe(n);
		o.pump(1, 0.1, 0);
		const m = played.length;
		o.pump(1.01, 0.1, 0);
		expect(played.length).toBe(m);
		o.pump(5, 0.1, 1); // resumes from now, no replay of the gap
		expect(Math.min(...played.slice(m))).toBeGreaterThanOrEqual(5);
	});
	it("cluster chords add a neighbour a semitone or tone away, never without level", () => {
		const r = createRng(2);
		expect(clusterExtra(60, 0, r)).toBeNull();
		expect(clusterExtra(0, 1, r)).toBeNull();
		const extras = Array.from({ length: 400 }, () => clusterExtra(60, 1, r)).filter((x): x is number => x !== null);
		expect(extras.length).toBeGreaterThan(120);
		expect(extras.length).toBeLessThan(280);
		for (const e of extras) expect([61, 62]).toContain(e);
	});
});

describe("tier tracks", () => {
	const stems: Stem[] = ["pad", "keys", "bass", "vibes", "brush", "rim", "hat"];
	for (const [name, track, bpm] of [["tier 2", TRACK_2, 104], ["tier 3", TRACK_3, 88]] as const) {
		it(`${name} is a valid 64-bar loop with every stem`, () => {
			expect(track.bars).toBe(TRACK_BARS);
			expect(track.bars).toBe(64);
			expect(track.bpm).toBe(bpm);
			expect(track.stepsPerBar).toBe(STEPS_PER_BAR);
			const loop = track.bars * STEPS_PER_BAR;
			const map: Record<Stem, string> = { pad: "pad", keys: "rhodes", bass: "pluck", vibes: "vibes", brush: "brush", rim: "rim", hat: "tick" };
			for (const n of track.notes) {
				expect(n.step).toBeGreaterThanOrEqual(0);
				expect(n.step).toBeLessThan(loop);
				expect(n.dur).toBeGreaterThan(0);
				expect(n.vel).toBeGreaterThan(0);
				expect(n.vel).toBeLessThanOrEqual(1);
				expect(n.inst).toBe(map[n.stem]);
				const [lo, hi] = STEM_RANGES[n.stem];
				expect(n.midi, `${n.stem}@${n.step}`).toBeGreaterThanOrEqual(lo);
				expect(n.midi, `${n.stem}@${n.step}`).toBeLessThanOrEqual(hi);
			}
			expect(track.notes.map((n) => n.step)).toEqual([...track.notes].map((n) => n.step).sort((a, b) => a - b));
			for (let bar = 0; bar < 64; bar++) {
				for (const stem of stems.filter((s) => s !== "vibes")) {
					expect(track.notes.some((n) => n.stem === stem && Math.floor(n.step / STEPS_PER_BAR) === bar), `${stem} bar ${bar}`).toBe(true);
				}
			}
			// Melody in at least half the bars; every chord change pads in four voices.
			const melBars = new Set(track.notes.filter((n) => n.stem === "vibes").map((n) => Math.floor(n.step / STEPS_PER_BAR)));
			expect(melBars.size).toBeGreaterThanOrEqual(32);
		});
	}
	it("differs from track 1 and from each other, and the sequencer plays them", () => {
		expect(TRACKS[1].bars).toBe(32);
		expect(TRACKS[2]).toBe(TRACK_2);
		expect(TRACKS[3]).toBe(TRACK_3);
		const sig = (t: typeof TRACK_2) => t.notes.filter((n) => n.stem === "keys").slice(0, 12).map((n) => n.midi).join(",");
		expect(sig(TRACK_2)).not.toBe(sig(TRACK_3));
		expect(sig(TRACK_2)).not.toBe(sig(TRACKS[1]));
		for (const t of [TRACK_2, TRACK_3]) {
			let count = 0;
			const seq = createSequencer({ score: t, play: () => count++ });
			seq.setStems({ ...ALL_STEMS_OFF, pad: true, keys: true, bass: true, vibes: true, brush: true, rim: true, hat: true });
			for (let now = 0; now < 30; now += 0.025) seq.tick(now);
			expect(count).toBeGreaterThan(100);
		}
	});
	it("spells chords inside every stem range", () => {
		for (const name of ["Dm9", "Bbmaj7#11", "Gm11", "A7b9", "Em7b5", "DmMaj7", "Bdim7", "Eb13", "Db13", "Cmaj7", "F13", "Bbm7", "Gmaj9"]) {
			const sp = spell(name);
			for (const m of sp.v) {
				expect(m).toBeGreaterThanOrEqual(STEM_RANGES.keys[0]);
				expect(m).toBeLessThanOrEqual(STEM_RANGES.keys[1]);
			}
			expect(sp.root).toBeGreaterThanOrEqual(STEM_RANGES.bass[0]);
			expect(sp.fifth).toBeLessThanOrEqual(STEM_RANGES.bass[1]);
		}
		expect(() => spell("Hm9")).toThrow();
		expect(() => spell("Dxyz")).toThrow();
		expect(spell("Dm9").root % 12).toBe(2);
	});
	it("starts a new sequencer on a given bar line", () => {
		const times: number[] = [];
		const seq = createSequencer({ score: TRACK_2, startAt: 10, play: (_n, when) => times.push(when) });
		seq.setStems({ ...ALL_STEMS_OFF, pad: true });
		seq.tick(9.95);
		expect(seq.anchor()).toBe(10);
		expect(times.length).toBeGreaterThan(0);
		expect(Math.min(...times)).toBeGreaterThanOrEqual(10 - 1e-9);
	});
});

describe("stingers", () => {
	const E: Record<string, SimEvent> = {
		tierUp: { type: "tierUp", tier: 2, reward: 1 },
		researched: { type: "researched", techId: "x" },
		auditA: { type: "quarterReport", quarter: 1, grade: "A" },
		auditB: { type: "quarterReport", quarter: 1, grade: "B" },
		auditC: { type: "quarterReport", quarter: 1, grade: "C" },
		auditE: { type: "quarterReport", quarter: 1, grade: "E" },
		path: { type: "pathChosen", path: "biotech" },
		sprout: { type: "growthSprouted", facilityId: 1 },
		mutated: { type: "botMutated", botId: 1, trait: "fleshed" },
		irreversible: { type: "contaminationIrreversible" },
		victory: { type: "gameOver", kind: "victory" },
		absorbed: { type: "gameOver", kind: "absorbed" },
		bankrupt: { type: "gameOver", kind: "bankrupt" },
	};
	it("maps each trigger to its stinger", () => {
		const m = (e: SimEvent) => stingerForEvent(e);
		expect(m(E.tierUp!)).toBe("fanfare");
		expect(m(E.researched!)).toBe("researched");
		expect([m(E.auditA!), m(E.auditB!)]).toEqual(["auditGood", "auditGood"]);
		expect([m(E.auditC!), m(E.auditE!)]).toEqual(["auditBad", "auditBad"]);
		expect(m(E.path!)).toBe("pathChosen");
		expect(m(E.sprout!)).toBe("sprout");
		expect(m(E.mutated!)).toBe("mutation");
		expect(m(E.irreversible!)).toBe("irreversible");
		expect(m(E.victory!)).toBe("victory");
		expect(m(E.absorbed!)).toBe("absorbed");
		expect(m(E.bankrupt!)).toBe("tapeStop");
		expect(m(ev({ type: "newDay", day: 1 }))).toBeNull();
		expect(m(ev({ type: "rackTripped", facilityId: 1 }))).toBeNull();
	});
	it("drops horror stingers at off (absorbed degrades to a plain tape stop), keeps them at mild", () => {
		for (const id of HORROR_STINGERS) expect(["sprout", "mutation", "irreversible", "absorbed"]).toContain(id);
		expect(stingerForEvent(E.sprout!, "off")).toBeNull();
		expect(stingerForEvent(E.mutated!, "off")).toBeNull();
		expect(stingerForEvent(E.irreversible!, "off")).toBeNull();
		expect(stingerForEvent(E.absorbed!, "off")).toBe("tapeStop");
		expect(stingerForEvent(E.sprout!, "mild")).toBe("sprout");
		expect(stingerForEvent(E.tierUp!, "off")).toBe("fanfare");
		expect(stingerForEvent(E.path!, "off")).toBe("pathChosen");
	});
	it("dedupes, orders by priority and caps a frame; game over replaces the rest", () => {
		expect(stingersForEvents([E.sprout!, E.sprout!, E.sprout!])).toEqual(["sprout"]);
		const many = stingersForEvents([E.sprout!, E.researched!, E.irreversible!, E.tierUp!, E.mutated!]);
		expect(many.length).toBe(MAX_STINGERS_PER_UPDATE);
		expect(many).toEqual(["irreversible", "fanfare"]);
		expect(stingersForEvents([E.tierUp!, E.absorbed!, E.sprout!])).toEqual(["absorbed"]);
		expect(stingersForEvents([E.tierUp!, E.bankrupt!])).toEqual(["tapeStop"]);
		expect(stingersForEvents([E.victory!, E.tierUp!])).toEqual(["victory", "fanfare"]);
		expect(stingersForEvents([])).toEqual([]);
	});
	it("has note data of 1-4 s with sane notes for every stinger", () => {
		const ids = Object.keys(STINGER_NOTES) as Exclude<StingerId, "tapeStop">[];
		expect(ids.length).toBeGreaterThanOrEqual(8);
		const range = (inst: string): readonly [number, number] | null => (inst === "pad" ? STEM_RANGES.pad : inst === "rhodes" ? STEM_RANGES.keys : inst === "vibes" ? STEM_RANGES.vibes : inst === "pluck" ? STEM_RANGES.bass : null);
		for (const id of ids) {
			const d = stingerDuration(id);
			if (id !== "teletype") expect(d, id).toBeGreaterThanOrEqual(1);
			expect(d, id).toBeLessThanOrEqual(4);
			for (const n of STINGER_NOTES[id]) {
				expect(n.t).toBeGreaterThanOrEqual(0);
				expect(n.dur).toBeGreaterThan(0);
				expect(n.vel).toBeGreaterThan(0);
				expect(n.vel).toBeLessThanOrEqual(1);
				const r = range(n.inst);
				if (r && n.inst !== "rhodes") {
					expect(n.midi, `${id} ${n.inst}`).toBeGreaterThanOrEqual(r[0]);
					expect(n.midi, `${id} ${n.inst}`).toBeLessThanOrEqual(r[1]);
				}
			}
		}
		expect(stingerDuration("tapeStop")).toBeCloseTo(1.8);
	});
	it("flows through the director, silent only for final endings", () => {
		const frame = (gameOver: { kind: "victory" | "absorbed" | "bankrupt"; tick: number } | null, events: SimEvent[]) => musicParams({ itKw: 0, minuteOfDay: 720, gameOver, corruption: 0 }, events, false);
		const vic = frame({ kind: "victory", tick: 1 }, [E.victory!]);
		expect(vic.silent).toBe(false);
		expect(vic.level).toBe(1);
		expect(vic.stingers).toEqual(["victory"]);
		const abs = frame({ kind: "absorbed", tick: 1 }, [E.absorbed!, E.tierUp!]);
		expect(abs.silent).toBe(true);
		expect(abs.stingers).toEqual(["absorbed"]);
		expect(frame({ kind: "absorbed", tick: 1 }, [E.tierUp!]).stingers).toEqual([]);
		expect(frame({ kind: "victory", tick: 1 }, [E.tierUp!]).stingers).toEqual(["fanfare"]);
		const off = musicParams({ itKw: 0, minuteOfDay: 720, gameOver: { kind: "absorbed", tick: 1 } }, [E.absorbed!], false, undefined, { intensity: "off" });
		expect(off.stingers).toEqual(["tapeStop"]);
		expect(musicParams(view(0), [E.sprout!], false, undefined, { intensity: "off" }).stingers).toEqual([]);
	});
});

describe("stinger ducking", () => {
	it("plans nothing, an alarm dip, a stinger dip, or the deeper/longer of both", () => {
		expect(duckPlan(false, 0)).toBeNull();
		expect(duckPlan(true, 0)).toEqual({ db: DUCK.db, holdS: DUCK.holdS });
		const s = duckPlan(false, 2);
		expect(s?.db).toBeLessThan(0);
		expect(s?.db).toBeGreaterThan(DUCK.db);
		expect(s?.holdS).toBeCloseTo(1.5);
		const both = duckPlan(true, 4);
		expect(both?.db).toBe(DUCK.db);
		expect(both?.holdS).toBeCloseTo(3);
	});
	it("turns a plan into dip and release steps", () => {
		const [dip, rel] = duckSteps(5, { db: -6, holdS: 2 });
		expect(dip?.target).toBeCloseTo(10 ** (-6 / 20));
		expect(rel?.time).toBeCloseTo(7);
		expect(rel?.target).toBe(1);
	});
});
