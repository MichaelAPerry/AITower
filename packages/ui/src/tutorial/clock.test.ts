import type { Speed } from "@aitower/shared";
import { describe, expect, it } from "vitest";
import { createFakeContent, createFakeStore } from "../dev/fakeStore";
import { applyClock, releaseClock } from "./clock";
import { intersects, placeBubble } from "./placement";

const mk = (speed: Speed) => {
	const store = createFakeStore(createFakeContent());
	store.setSpeed(speed);
	return store;
};

describe("induction clock control", () => {
	it("pauses on entry to a reading step", () => {
		const store = mk(3);
		expect(applyClock(store, "pause", null)).toBe("pause");
		expect(store.get().speed).toBe(0);
	});

	it("keeps the clock paused for a hands-on task: nothing re-enforces it, and the player's own speed press is respected", () => {
		const store = mk(1);
		let mode = applyClock(store, "pause", null);
		expect(store.get().speed).toBe(0);
		store.setSpeed(3); // the "set speed to 3x" task
		mode = applyClock(store, "pause", mode);
		expect(store.get().speed).toBe(3);
		expect(mode).toBe("pause");
	});

	it("runs the clock at 3x when a step needs time, but keeps a faster speed the player chose", () => {
		const slow = mk(0);
		expect(applyClock(slow, "run", null)).toBe("run");
		expect(slow.get().speed).toBe(3);
		const fast = mk(30);
		applyClock(fast, "run", null);
		expect(fast.get().speed).toBe(30);
	});

	it("stops the clock again the moment the wanted mode flips back to pause (an offer arrived)", () => {
		const store = mk(0);
		let mode = applyClock(store, "run", null);
		expect(store.get().speed).toBe(3);
		mode = applyClock(store, "pause", mode);
		expect(store.get().speed).toBe(0);
		expect(mode).toBe("pause");
	});

	it("does not touch the clock when the mode is unchanged", () => {
		const store = mk(0);
		const mode = applyClock(store, "run", null);
		store.setSpeed(0); // the player stops it on purpose
		applyClock(store, "run", mode);
		expect(store.get().speed).toBe(0);
	});

	it("closing the induction restarts a stopped clock at 1x and leaves a running clock alone", () => {
		const stopped = mk(0);
		releaseClock(stopped);
		expect(stopped.get().speed).toBe(1);
		const running = mk(10);
		releaseClock(running);
		expect(running.get().speed).toBe(10);
	});

	it("leaves the clock to the player in free mode", () => {
		const store = mk(3);
		expect(applyClock(store, "free", null)).toBe("free");
		expect(store.get().speed).toBe(3);
	});
});

describe("bubble placement", () => {
	const bounds = { left: 0, top: 0, right: 900, bottom: 500 };
	const size = { w: 240, h: 80 };

	it("sits on the preferred side with the arrow on the target's centre", () => {
		const target = { left: 400, top: 100, right: 460, bottom: 130 };
		const p = placeBubble(target, size, bounds, ["below"]);
		expect(p.side).toBe("below");
		expect(p.top).toBeGreaterThanOrEqual(target.bottom);
		expect(p.left + p.arrow).toBeCloseTo(430);
	});

	it("moves to another side when the preferred one does not fit, and never covers the target", () => {
		const target = { left: 700, top: 440, right: 880, bottom: 490 };
		const p = placeBubble(target, size, bounds, ["below", "right"]);
		expect(p.side).not.toBe("below");
		expect(intersects({ left: p.left, top: p.top, right: p.left + size.w, bottom: p.top + size.h }, target)).toBe(false);
	});

	it("keeps the bubble inside the bounds and the arrow inside the bubble", () => {
		const target = { left: 880, top: 10, right: 899, bottom: 30 };
		const p = placeBubble(target, size, bounds, ["right", "below"]);
		expect(p.left + size.w).toBeLessThanOrEqual(bounds.right);
		expect(p.arrow).toBeLessThanOrEqual(size.w - 16);
		expect(p.arrow).toBeGreaterThanOrEqual(16);
	});
});
