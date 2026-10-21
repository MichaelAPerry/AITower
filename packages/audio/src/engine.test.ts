import type { SimEvent, SimView } from "@aitower/sim";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAudio } from "./engine";
import { createMusic } from "./music";
import { musicParams } from "./music/director";

/** Minimal fake of the WebAudio surface the engine uses; records started sources. */
class FakeParam {
	value = 0;
	targets: number[] = [];
	setValueAtTime(v: number) {
		this.value = v;
	}
	setTargetAtTime(v: number) {
		this.targets.push(v);
		this.value = v;
	}
	linearRampToValueAtTime(v: number) {
		this.value = v;
	}
	cancelScheduledValues() {}
	exponentialRampToValueAtTime(v: number) {
		if (!(v > 0)) throw new RangeError("exponential ramp target must be > 0");
		this.value = v;
	}
}
class FakeNode {
	gain = new FakeParam();
	frequency = new FakeParam();
	Q = new FakeParam();
	detune = new FakeParam();
	delayTime = new FakeParam();
	curve: unknown = null;
	oversample = "";
	threshold = new FakeParam();
	ratio = new FakeParam();
	type = "";
	buffer: unknown = null;
	loop = false;
	onended: (() => void) | null = null;
	constructor(private ctx: FakeContext) {}
	connect<T>(n: T): T {
		return n;
	}
	disconnect() {}
	start() {
		this.ctx.started++;
		this.ctx.sources.add(this);
	}
	stop() {
		this.ctx.sources.delete(this);
	}
}
class FakeContext {
	static last: FakeContext | null = null;
	state: "suspended" | "running" | "closed" = "suspended";
	currentTime = 0;
	sampleRate = 8000;
	destination = {};
	started = 0;
	sources = new Set<FakeNode>();
	constructor() {
		FakeContext.last = this;
	}
	resume() {
		this.state = "running";
		return Promise.resolve();
	}
	close() {
		this.state = "closed";
		return Promise.resolve();
	}
	createGain() {
		return new FakeNode(this);
	}
	createOscillator() {
		return new FakeNode(this);
	}
	createBiquadFilter() {
		return new FakeNode(this);
	}
	createWaveShaper() {
		return new FakeNode(this);
	}
	createDelay() {
		return new FakeNode(this);
	}
	createDynamicsCompressor() {
		return new FakeNode(this);
	}
	createBufferSource() {
		return new FakeNode(this);
	}
	createBuffer(_ch: number, len: number) {
		const data = new Float32Array(len);
		return { getChannelData: () => data };
	}
}

const g = globalThis as { AudioContext?: unknown };
afterEach(() => {
	delete g.AudioContext;
	FakeContext.last = null;
});

const view = (tick: number, extra: Partial<SimView> = {}) =>
	({ tick, itKw: 200, totalKw: 280, facilities: [{ tempC: 70 }], ...extra }) as unknown as SimView;

describe("createAudio with a (fake) AudioContext", () => {
	it("creates the context lazily on resume and plays rate-limited one-shots", async () => {
		g.AudioContext = FakeContext;
		const a = createAudio();
		a.update(view(1), [{ type: "rackTripped", facilityId: 1 }]);
		expect(FakeContext.last).toBeNull();
		await a.resume();
		const ctx = FakeContext.last!;
		expect(ctx.state).toBe("running");
		const humSources = ctx.started;
		expect(humSources).toBe(5 + 3 + 6); // hum (incl. breath LFO) + the tape LFOs + ambience beds (plant 3, fans 1, wind 2)

		a.update(view(2), [{ type: "jobCompleted", jobId: 1, payout: 1 }]);
		const afterFirst = ctx.started;
		expect(afterFirst).toBeGreaterThan(humSources);
		a.update(view(3), [{ type: "jobCompleted", jobId: 2, payout: 1 }]);
		expect(ctx.started).toBe(afterFirst); // < 300 ms later: suppressed
		ctx.currentTime = 1;
		a.update(view(4), [{ type: "jobCompleted", jobId: 3, payout: 1 }]);
		expect(ctx.started).toBeGreaterThan(afterFirst);

		a.setMuted(true);
		a.setVolume(2);
		a.destroy();
		expect(ctx.state).toBe("closed");
		a.update(view(5), [{ type: "tierUp", tier: 2, reward: 1 }]);
	});

	it("builds the path layers only once a path is chosen, plays toggle/earned sounds, and frees all on destroy", async () => {
		g.AudioContext = FakeContext;
		const a = createAudio();
		await a.resume();
		const ctx = FakeContext.last!;
		const policy = (on: boolean) => ({ research: { enabled: on }, parts: { enabled: false }, bots: { enabled: false }, foreman: { enabled: false } });
		const base = { automation: { policy: policy(false) }, path: null, pathScore: 0 } as unknown as Partial<SimView>;
		a.update(view(1, base), []);
		const idle = ctx.started;
		a.update(view(2, { ...base, path: "greentech", pathScore: 0.8 } as unknown as Partial<SimView>), []);
		expect(ctx.started).toBeGreaterThan(idle + 10); // beds + LFOs built, first notes scheduled or not
		const built = ctx.started;
		ctx.currentTime = 1;
		a.update(view(3, { ...base, automation: { policy: policy(true) } } as unknown as Partial<SimView>), [{ type: "earned", jobId: 1, amount: 5 }]);
		expect(ctx.started).toBeGreaterThan(built); // toggle tick + till chime
		a.destroy();
		expect(ctx.sources.size).toBe(0);
	});

	it("starts the music timer on resume, stops it at music volume 0, and leaves none after destroy", async () => {
		vi.useFakeTimers();
		try {
			g.AudioContext = FakeContext;
			const a = createAudio();
			a.setMusicVolume(0.5);
			expect(vi.getTimerCount()).toBe(0); // nothing before resume
			await a.resume();
			const ctx = FakeContext.last!;
			const base = vi.getTimerCount();
			expect(base).toBeGreaterThanOrEqual(1);
			a.update(view(1), []);
			ctx.currentTime = 0.5;
			const before = ctx.started;
			vi.advanceTimersByTime(100);
			expect(ctx.started).toBeGreaterThan(before); // notes scheduled

			a.setMusicVolume(0);
			const stopped = vi.getTimerCount();
			expect(stopped).toBeLessThan(base);
			ctx.currentTime = 1;
			const n = ctx.started;
			vi.advanceTimersByTime(500);
			expect(ctx.started).toBe(n); // scheduling stopped
			a.setMusicVolume(0.5);
			expect(vi.getTimerCount()).toBe(base);

			a.update(view(2), [{ type: "decisionIssued", decisionId: 1, eventId: "x" }, { type: "tierUp", tier: 2, reward: 1 }, { type: "rackTripped", facilityId: 1 }]);
			a.update(view(3, { gameOver: { kind: "shutdown", tick: 3 } } as Partial<SimView>), [{ type: "gameOver", kind: "shutdown" }]);
			a.destroy();
			vi.advanceTimersByTime(60_000);
			expect(vi.getTimerCount()).toBe(0);
			expect(ctx.sources.size).toBe(0);
			a.setMusicVolume(1);
			expect(vi.getTimerCount()).toBe(0);
		} finally {
			vi.useRealTimers();
		}
	});

	it("is a no-op without an AudioContext", () => {
		vi.useFakeTimers();
		try {
			const a = createAudio();
			a.setMusicVolume(0.5);
			a.update(view(1), [{ type: "rackTripped", facilityId: 1 }]);
			a.destroy();
			expect(vi.getTimerCount()).toBe(0);
		} finally {
			vi.useRealTimers();
		}
	});

	it("plays every sound recipe without throwing", async () => {
		g.AudioContext = FakeContext;
		const a = createAudio();
		await a.resume();
		const ctx = FakeContext.last!;
		ctx.currentTime = 10;
		expect(() =>
			a.update(view(1, { facilities: [{ tempC: 99 }] as SimView["facilities"] }), [
				{ type: "rackTripped", facilityId: 1 },
				{ type: "componentFailed", facilityId: 1 },
				{ type: "repaired", facilityId: 1, botId: 1 },
				{ type: "liftArrived", liftId: 1, floor: 1 },
			]),
		).not.toThrow();
		ctx.currentTime = 20;
		expect(() =>
			a.update(view(2), [
				{ type: "jobCompleted", jobId: 1, payout: 1 },
				{ type: "tierUp", tier: 2, reward: 1 },
				{ type: "powerShortfall", netId: 1, satisfaction: 0.4 },
				{ type: "gensetStarted", facilityId: 2 },
			]),
		).not.toThrow();
		ctx.currentTime = 30;
		expect(() => a.update(view(3), [{ type: "jobFailed", jobId: 1, penalty: 1 }])).not.toThrow();
		a.destroy();
	});
});

describe("corruption in the engine", () => {
	const corrupt = (c: number) => view(1, { corruption: c, tier: 1, minuteOfDay: 720, gameOver: null } as Partial<SimView>);
	const started = async (intensity: "full" | "mild" | "off", c: number): Promise<number> => {
		g.AudioContext = FakeContext;
		const a = createAudio();
		a.setHorrorIntensity(intensity);
		await a.resume();
		const ctx = FakeContext.last!;
		ctx.currentTime = 1;
		const before = ctx.started;
		a.update(corrupt(c), []);
		const n = ctx.started - before;
		a.destroy();
		delete g.AudioContext;
		return n;
	};

	it("builds the under drone only at full intensity and very high corruption", async () => {
		expect(await started("full", 0.5)).toBe(0);
		expect(await started("full", 0.95)).toBe(4); // three drone oscillators + the breathing LFO
		expect(await started("mild", 1)).toBe(0); // 1.0 * 0.5 stays below 0.9
		expect(await started("off", 1)).toBe(0);
	});

	it("accepts every intensity and an unknown one without throwing", async () => {
		g.AudioContext = FakeContext;
		const a = createAudio();
		await a.resume();
		FakeContext.last!.currentTime = 1;
		for (const i of ["mild", "off", "full", "bogus" as unknown as "full"] as const) {
			a.setHorrorIntensity(i);
			expect(() => a.update(corrupt(0.8), [{ type: "growthSprouted", facilityId: 1 }])).not.toThrow();
		}
		a.destroy();
	});
});

describe("music integration with a fake context", () => {
	const mk = () => {
		const ctx = new FakeContext();
		ctx.state = "running";
		const node = new FakeNode(ctx);
		const music = createMusic(ctx as unknown as BaseAudioContext, node as unknown as AudioNode, { seed: 1 });
		return { ctx, music };
	};
	const v = (tier: number, corruption = 0) => ({ itKw: 200, minuteOfDay: 720, gameOver: null, tier, corruption }) as Parameters<typeof musicParams>[0];

	it("switches to the tier track on the next bar line", () => {
		const { ctx, music } = mk();
		expect(music.track()).toBe(1);
		let prev = musicParams(v(1), [], false);
		music.update(prev);
		for (let t = 0; t <= 1; t += 0.025) {
			ctx.currentTime = t;
			music.pump(t);
		}
		ctx.currentTime = 1;
		prev = musicParams(v(3), [], false, prev);
		music.update(prev);
		for (let t = 1; t <= 2.2; t += 0.025) music.pump(t);
		expect(music.track()).toBe(1); // bar line (anchor 0.08 + 2.5 s) not reached
		for (let t = 2.2; t <= 4; t += 0.025) music.pump(t);
		expect(music.track()).toBe(3);
		music.destroy();
	});

	it("plays stingers, rate-limits repeats and reports the duck length", () => {
		const { ctx, music } = mk();
		ctx.currentTime = 1;
		const sting = (e: SimEvent) => music.update(musicParams(v(1), [e], false));
		expect(sting({ type: "researched", techId: "x" })).toBeGreaterThan(1);
		ctx.currentTime = 1.5;
		expect(sting({ type: "researched", techId: "x" })).toBe(0);
		ctx.currentTime = 4;
		expect(sting({ type: "researched", techId: "x" })).toBeGreaterThan(1);
		expect(music.update(musicParams(v(1), [], false))).toBe(0);
		music.destroy();
	});

	it("halts after an absorbed ending and survives corruption layers while pumping", () => {
		const { ctx, music } = mk();
		let prev = musicParams(v(2, 1), [], false);
		music.update(prev);
		for (let t = 0; t < 6; t += 0.025) {
			ctx.currentTime = t;
			prev = musicParams(v(2, 1), [], false, prev, { dtS: 0.025 });
			music.update(prev);
			music.pump(t);
			expect(music.voices()).toBeLessThanOrEqual(130);
		}
		const over = musicParams({ ...v(2, 1), gameOver: { kind: "absorbed", tick: 9 } }, [{ type: "gameOver", kind: "absorbed" }], false, prev);
		expect(music.update(over)).toBeGreaterThan(1);
		expect(music.isHalted()).toBe(true);
		music.destroy();
		expect(ctx.sources.size).toBe(0);
	});
});

