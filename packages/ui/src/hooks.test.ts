import { describe, expect, it, vi } from "vitest";
import { createFakeStore } from "./dev/fakeStore";
import { throttledSubscribe } from "./hooks";
import { specCardPos } from "./components/SpecCard";

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

describe("specCardPos", () => {
	const anchor = { right: 260, rowTop: 300, rowBottom: 340 };
	it("sits right of the anchor, level with the row", () => {
		expect(specCardPos(anchor, { w: 300, h: 200 }, 1280, 800, 1)).toEqual({ left: 268, top: 300 });
	});
	it("is clamped to the viewport and never moves left of the anchor unless the screen is too narrow", () => {
		expect(specCardPos(anchor, { w: 300, h: 200 }, 1280, 800, 1).left).toBeGreaterThanOrEqual(anchor.right);
		expect(specCardPos({ ...anchor, rowTop: 700 }, { w: 300, h: 200 }, 1280, 800, 1).top).toBe(592);
		expect(specCardPos({ ...anchor, rowTop: -20 }, { w: 300, h: 200 }, 1280, 800, 1).top).toBe(8);
		expect(specCardPos({ ...anchor, right: 1200 }, { w: 300, h: 200 }, 1280, 800, 1).left).toBe(972);
	});
	it("converts viewport pixels to zoomed CSS pixels", () => {
		const p = specCardPos(anchor, { w: 300, h: 200 }, 1500, 900, 1.5);
		expect(p.left).toBeCloseTo(268 / 1.5);
		expect(p.top).toBeCloseTo(200);
		expect(specCardPos({ ...anchor, rowTop: 880 }, { w: 300, h: 200 }, 1500, 900, 1.5).top).toBeCloseTo((900 - 300 - 8) / 1.5);
	});
});
