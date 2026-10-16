import type { SimView } from "@aitower/sim";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAudio } from "./engine";

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
		expect(humSources).toBe(4 + 3); // hum + the tape's wow/drift/flutter LFOs

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

			a.update(view(2), [{ type: "memoIssued", memoId: 1, eventId: "x" }, { type: "tierUp", tier: 2, reward: 1 }, { type: "rackTripped", facilityId: 1 }]);
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
