import type { Renderer } from "@aitower/shared";
import { describe, expect, it, vi } from "vitest";
import { describeError } from "./crash";
import { MAX_RENDER_FAILURES, startLoop } from "./loop";
import type { GameStoreInternals } from "./store";

function harness(opts: { step?: () => unknown[]; draw?: () => void; speed?: number; clockStep?: number } = {}) {
	let frames: ((t: number) => void) | null = null;
	let clockMs = 0;
	const advance = vi.fn((n: number) => {
		const out: unknown[] = [];
		for (let i = 0; i < n; i++) {
			clockMs += opts.clockStep ?? 0;
			out.push(...(opts.step ? opts.step() : []));
		}
		return out;
	});
	const store = {
		get: () => ({ speed: opts.speed ?? 1 }),
		advance,
		sim: () => ({ view: () => ({ tick: 0 }) }),
		publish: vi.fn(),
		behind: false,
	} as unknown as GameStoreInternals;
	const draw = vi.fn(opts.draw ?? (() => {}));
	const pushEvents = vi.fn();
	const renderer = { draw, pushEvents } as unknown as Renderer;
	const onCrash = vi.fn();
	const stop = startLoop(store, renderer, null, {
		onCrash,
		requestFrame: (cb) => {
			frames = cb;
			return 1;
		},
		cancelFrame: () => {
			frames = null;
		},
		now: () => clockMs,
	});
	const tick = (t: number) => {
		const f = frames;
		f?.(t);
	};
	return { store, advance, draw, pushEvents, onCrash, stop, tick, hasFrame: () => frames !== null };
}

describe("renderer events", () => {
	it("hands the frame's step events to the renderer before drawing, and nothing on an empty frame", () => {
		const ev = { type: "newDay", day: 1 };
		const h = harness({ step: () => [ev] });
		h.tick(0);
		h.tick(200);
		expect(h.pushEvents).toHaveBeenCalled();
		expect(h.pushEvents.mock.calls.at(-1)?.[0]).toContainEqual(ev);
		const quiet = harness({ speed: 0 });
		quiet.tick(0);
		quiet.tick(200);
		expect(quiet.pushEvents).not.toHaveBeenCalled();
	});
});

vi.spyOn(console, "error").mockImplementation(() => {});

describe("loop crash handling", () => {
	it("a throwing sim stops the loop and calls the overlay once", () => {
		const h = harness({
			step: () => {
				throw new Error("boom");
			},
		});
		h.tick(100); // 1 tick due
		expect(h.onCrash).toHaveBeenCalledTimes(1);
		expect(h.onCrash.mock.calls[0]?.[0]).toMatchObject({ source: "sim", message: "boom" });
		expect(h.draw).not.toHaveBeenCalled(); // last good view stays
		expect(h.store.publish).not.toHaveBeenCalled();
		expect(h.hasFrame()).toBe(false);
		h.tick(300);
		expect(h.advance).toHaveBeenCalledTimes(1);
	});

	it("skips a failing render frame and recovers", () => {
		let fail = true;
		const h = harness({ draw: () => { if (fail) throw new Error("gl"); } });
		h.tick(100);
		h.tick(200);
		expect(h.onCrash).not.toHaveBeenCalled();
		fail = false;
		h.tick(300);
		h.tick(400);
		fail = true;
		h.tick(500);
		h.tick(600);
		expect(h.onCrash).not.toHaveBeenCalled(); // counter was reset by the good frames
		expect(h.hasFrame()).toBe(true);
	});

	it("shows the overlay after consecutive render failures", () => {
		const h = harness({ draw: () => { throw new Error("gl lost"); } });
		for (let i = 1; i <= MAX_RENDER_FAILURES; i++) h.tick(i * 100);
		expect(h.onCrash).toHaveBeenCalledTimes(1);
		expect(h.onCrash.mock.calls[0]?.[0]).toMatchObject({ source: "render", message: "gl lost" });
		expect(h.hasFrame()).toBe(false);
	});

	it("stop() halts further frames", () => {
		const h = harness();
		h.tick(100);
		h.stop();
		expect(h.hasFrame()).toBe(false);
	});
});

describe("loop frame budget", () => {
	it("steps normally and clears the behind flag", () => {
		const h = harness();
		h.tick(1000); // dt capped at 250 ms => 2 ticks
		expect(h.advance).toHaveBeenCalledTimes(2);
		expect(h.store.behind).toBe(false);
	});

	it("drops the backlog when stepping exceeds the time budget", () => {
		const h = harness({ speed: 30, clockStep: 5 }); // 250ms*30 = 75 ticks due; each costs 5 ms => budget hit after 3
		h.tick(1000);
		expect(h.advance.mock.calls.length).toBeLessThan(10);
		expect(h.advance.mock.calls.length).toBeGreaterThanOrEqual(1);
		expect(h.store.behind).toBe(true);
		// next frame starts from a clean accumulator instead of spiralling
		h.advance.mockClear();
		h.tick(1016);
		expect(h.advance.mock.calls.length).toBeLessThan(10);
	});

	it("is not behind when it keeps up at high speed", () => {
		const h = harness({ speed: 30, clockStep: 0 });
		h.tick(1000);
		expect(h.advance).toHaveBeenCalledTimes(75);
		expect(h.store.behind).toBe(false);
	});
});

describe("describeError", () => {
	it("handles non-Error throws", () => {
		expect(describeError(new Error("x"))).toBe("x");
		expect(describeError("s")).toBe("s");
		expect(describeError({ a: 1 })).toBe('{"a":1}');
	});
});
