import type { SimEvent, SimView } from "@aitower/sim";
import { describe, expect, it } from "vitest";
import { createAudio } from "./engine";
import { humParams, maxRackTemp } from "./hum";
import { createPauseDetector } from "./pause";
import { createRateLimiter, MIN_REPEAT_MS } from "./rateLimit";
import { eventToSound, SOUNDS, soundDuration, soundsForEvents, type SoundId } from "./sounds";

describe("humParams", () => {
	const base = { itKw: 0, totalKw: 0, maxRackC: 25, paused: false };

	it("is near-silent with no load", () => {
		const p = humParams(base);
		expect(p.gain).toBeLessThan(0.02);
		expect(p.whineGain).toBe(0);
	});

	it("gets louder, higher and brighter with load", () => {
		const lo = humParams({ ...base, itKw: 100, totalKw: 140 });
		const hi = humParams({ ...base, itKw: 1000, totalKw: 1400 });
		expect(hi.gain).toBeGreaterThan(lo.gain);
		expect(hi.droneHz).toBeGreaterThan(lo.droneHz);
		expect(hi.noiseCutoffHz).toBeGreaterThan(lo.noiseCutoffHz);
		expect(hi.noiseGain).toBeGreaterThan(lo.noiseGain);
		expect(hi.gain).toBeLessThanOrEqual(0.25);
	});

	it("adds fan whine only when racks run hot", () => {
		const load = { ...base, itKw: 300, totalKw: 400 };
		expect(humParams({ ...load, maxRackC: 60 }).whineGain).toBe(0);
		const warm = humParams({ ...load, maxRackC: 85 });
		const hot = humParams({ ...load, maxRackC: 100 });
		expect(warm.whineGain).toBeGreaterThan(0);
		expect(hot.whineGain).toBeGreaterThan(warm.whineGain);
		expect(hot.whineHz).toBeGreaterThan(warm.whineHz);
	});

	it("drops when paused", () => {
		const load = { ...base, itKw: 300, totalKw: 400, maxRackC: 90 };
		expect(humParams({ ...load, paused: true }).gain).toBeLessThan(humParams(load).gain * 0.5);
	});

	it("is robust to garbage input", () => {
		const p = humParams({ itKw: Number.NaN, totalKw: -5, maxRackC: Number.NaN, paused: false });
		for (const v of Object.values(p)) expect(Number.isFinite(v)).toBe(true);
	});

	it("maxRackTemp picks the hottest facility", () => {
		const f = (tempC: number) => ({ tempC }) as SimView["facilities"][number];
		expect(maxRackTemp({ facilities: [f(30), f(88), f(41)] })).toBe(88);
		expect(maxRackTemp({ facilities: [] })).toBe(0);
	});
});

describe("sounds", () => {
	it("maps the required events", () => {
		const cases: [SimEvent, SoundId][] = [
			[{ type: "rackTripped", facilityId: 1 }, "alarm"],
			[{ type: "componentFailed", facilityId: 1 }, "zap"],
			[{ type: "repaired", facilityId: 1, botId: 1 }, "blip"],
			[{ type: "liftArrived", liftId: 1, floor: 0 }, "ding"],
			[{ type: "jobCompleted", jobId: 1, payout: 5 }, "cash"],
			[{ type: "tierUp", tier: 2, reward: 1 }, "fanfare"],
			[{ type: "powerShortfall", netId: 1, satisfaction: 0.5 }, "lowWarn"],
			[{ type: "gensetStarted", facilityId: 1 }, "rumble"],
		];
		for (const [e, id] of cases) expect(eventToSound(e)).toBe(id);
		expect(eventToSound({ type: "newDay", day: 2 })).toBeNull();
	});

	it("dedupes a batch of events", () => {
		const evs: SimEvent[] = [
			{ type: "liftArrived", liftId: 1, floor: 0 },
			{ type: "newDay", day: 1 },
			{ type: "liftArrived", liftId: 1, floor: 1 },
			{ type: "rackTripped", facilityId: 3 },
		];
		expect(soundsForEvents(evs)).toEqual(["ding", "alarm"]);
	});

	it("has sane recipes", () => {
		for (const [id, s] of Object.entries(SOUNDS)) {
			expect(s.id).toBe(id);
			expect(s.minIntervalMs).toBeGreaterThanOrEqual(MIN_REPEAT_MS);
			expect(s.voices.length).toBeGreaterThan(0);
			expect(soundDuration(s)).toBeLessThan(3);
			for (const v of s.voices) {
				expect(v.freq).toBeGreaterThan(0);
				expect(v.dur).toBeGreaterThan(0);
				expect(v.gain).toBeGreaterThan(0);
				expect(v.gain).toBeLessThanOrEqual(1);
			}
		}
	});
});

describe("rate limiter", () => {
	it("enforces at least 300 ms per key", () => {
		const r = createRateLimiter();
		expect(r.allow("a", 0)).toBe(true);
		expect(r.allow("a", 299)).toBe(false);
		expect(r.allow("b", 100)).toBe(true);
		expect(r.allow("a", 300)).toBe(true);
		expect(r.allow("a", 400, 50)).toBe(false); // floor of 300 ms
		expect(r.allow("a", 2000, 2000)).toBe(false);
		expect(r.allow("a", 2300, 2000)).toBe(true);
		r.reset();
		expect(r.allow("a", 2301)).toBe(true);
	});
});

describe("pause detector", () => {
	it("reports paused when the tick stalls", () => {
		const p = createPauseDetector(400);
		expect(p.update(1, 0)).toBe(false);
		expect(p.update(1, 300)).toBe(false);
		expect(p.update(1, 500)).toBe(true);
		expect(p.update(2, 600)).toBe(false);
	});
});

describe("createAudio without an AudioContext", () => {
	it("is a silent no-op", async () => {
		const a = createAudio();
		await expect(a.resume()).resolves.toBeUndefined();
		const view = { tick: 1, itKw: 100, totalKw: 150, facilities: [] } as unknown as SimView;
		expect(() => a.update(view, [{ type: "rackTripped", facilityId: 1 }])).not.toThrow();
		a.setMuted(true);
		a.setVolume(0.3);
		a.destroy();
		await expect(a.resume()).resolves.toBeUndefined();
	});
});
