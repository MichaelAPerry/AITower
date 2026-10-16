import { describe, expect, it, vi } from "vitest";
import { createFakeStore } from "./dev/fakeStore";
import { throttledSubscribe } from "./hooks";
import { tooltipTop } from "./components/BuildPalette";

describe("throttledSubscribe", () => {
	it("notifies at once for settings and save-status changes, but throttles view churn", () => {
		vi.useFakeTimers();
		try {
			const store = createFakeStore(undefined, { saveDelayMs: 0 });
			let n = 0;
			const un = throttledSubscribe(store, 100)(() => n++);
			store.setSettings({ textScale: 1.25 });
			expect(n).toBe(1);
			store.setSettings({ colorBlind: true });
			expect(n).toBe(2);
			void store.saveTo("slot1");
			expect(n).toBe(3); // busy flag flips synchronously
			store.advance(1);
			store.advance(1);
			expect(n).toBeLessThanOrEqual(4); // view churn is throttled
			un();
		} finally {
			vi.useRealTimers();
		}
	});
});

describe("tooltipTop", () => {
	it("is a plain clamp at scale 1", () => {
		expect(tooltipTop(300, 900, 1)).toBe(300);
		expect(tooltipTop(10, 900, 1)).toBe(60);
		expect(tooltipTop(800, 900, 1)).toBe(580);
	});
	it("converts viewport pixels to zoomed CSS pixels at other scales", () => {
		expect(tooltipTop(300, 900, 1.5)).toBe(200);
		expect(tooltipTop(10, 720, 1.5)).toBe(40);
		expect(tooltipTop(700, 720, 1.5)).toBeCloseTo((720 - 480) / 1.5);
	});
});
