import type { Speed } from "@aitower/shared";
import { describe, expect, it } from "vitest";
import { createFakeContent, createFakeStore } from "../dev/fakeStore";
import { applyClock, clockStatus, releaseClock } from "./clock";
import { pickCorner, centreBox } from "./placement";

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

	it("tells the player the clock state and why time passes", () => {
		expect(clockStatus("pause", 0)).toMatchObject({ running: false });
		expect(clockStatus("pause", 0).text).toContain("nothing moves");
		expect(clockStatus("run", 3, "so offers arrive")).toEqual({ running: true, text: "CLOCK RUNNING AT 3× · so offers arrive" });
		expect(clockStatus("run", 0).text).toContain("press 3×");
	});
});

describe("memo placement", () => {
	const area = { left: 0, top: 0, right: 900, bottom: 500 };
	const memo = { w: 340, h: 300 };

	it("keeps the preferred corner when nothing is in the way", () => {
		expect(pickCorner("br", area, memo, [])).toBe("br");
		expect(pickCorner("tl", area, memo, [])).toBe("tl");
	});

	it("moves to another corner when the preferred one would cover the target", () => {
		const target = { left: 700, top: 300, right: 880, bottom: 480 };
		expect(pickCorner("br", area, memo, [target])).toBe("bl");
		const left = { left: 10, top: 300, right: 150, bottom: 480 };
		expect(pickCorner("bl", area, memo, [left])).toBe("br");
	});

	it("avoids the middle of the world where the camera puts the focus cell", () => {
		const box = centreBox(area);
		expect(box).toEqual({ left: 360, right: 540, top: 160, bottom: 340 });
		// 900 wide: the 340-wide memo clears the centre box in a corner
		expect(pickCorner("br", area, memo, [box])).toBe("br");
		// 700 wide: both bottom corners would cover it, and so would the top ones (the memo is 300 tall, the area 500)
		const narrow = { left: 0, top: 0, right: 700, bottom: 500 };
		expect(pickCorner("br", narrow, memo, [centreBox(narrow)])).toBe("br");
	});

	it("falls back to the preferred corner when every corner is covered", () => {
		expect(pickCorner("tr", area, memo, [area])).toBe("tr");
	});
});
