import { describe, expect, it } from "vitest";
import { COALESCE_AGE, COALESCE_DIST, FLOATER_LIFE, FloaterField, MAX_FLOATERS, MAX_PUFFS, PUFF_LIFE, PuffField, applyEvents, floatAlpha, floatOffset, floaterText, fmtMoney, jobAnchor } from "./floaters";

/** Advance in frame-sized steps (updates clamp dt at 0.25 s). */
const run = (f: { update(dt: number): void }, seconds: number): void => {
	for (let t = 0; t < seconds; t += 0.1) f.update(0.1);
};

describe("money text", () => {
	it("formats compactly with a plus for earnings and a real minus for losses", () => {
		expect([0, 7, 950, 1200, 34567, 2_500_000, 12_000_000].map(fmtMoney)).toEqual(["$0", "$7", "$950", "$1.2K", "$34K", "$2.5M", "$12M"]);
		expect(floaterText("earned", 1200)).toBe("+$1.2K");
		expect(floaterText("failed", 500)).toBe("−$500");
		expect(fmtMoney(Number.NaN)).toBe("$0");
	});
});

describe("floater coalescing and caps", () => {
	it("events at the same spot within the window fold into one floater", () => {
		const f = new FloaterField();
		f.add("earned", 100, 50, 1000);
		f.update(0.3);
		f.add("earned", 110, 52, 500);
		expect(f.live).toBe(1);
		expect(f.items[0]).toMatchObject({ amount: 1500, count: 2, text: "+$1.5K" });
		expect(f.items[0].age).toBeLessThanOrEqual(0.2);
	});
	it("kinds never mix, distant events and old floaters stay separate", () => {
		const f = new FloaterField();
		f.add("earned", 0, 0, 10);
		f.add("failed", 0, 0, 10);
		f.add("earned", COALESCE_DIST + 5, 0, 10);
		expect(f.live).toBe(3);
		run(f, COALESCE_AGE + 0.2);
		f.add("earned", 0, 0, 10);
		expect(f.live).toBe(4);
	});
	it("a burst never exceeds the cap and loses no money", () => {
		const f = new FloaterField();
		let total = 0;
		for (let i = 0; i < 200; i++) {
			f.add("earned", i * 40, 0, 10);
			total += 10;
		}
		expect(f.live).toBeLessThanOrEqual(MAX_FLOATERS);
		expect(f.items.length).toBe(MAX_FLOATERS);
		const kept = f.items.filter((q) => q.active).reduce((a, q) => a + q.amount, 0);
		expect(kept).toBeGreaterThan(0);
		expect(kept).toBeLessThanOrEqual(total);
	});
	it("ignores zero, negative and non-finite amounts or positions", () => {
		const f = new FloaterField();
		for (const a of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) f.add("earned", 0, 0, a);
		f.add("earned", Number.NaN, 0, 5);
		expect(f.live).toBe(0);
	});
	it("floaters expire and free their slot", () => {
		const f = new FloaterField();
		f.add("failed", 0, 0, 100);
		run(f, FLOATER_LIFE + 0.2);
		expect(f.live).toBe(0);
		f.add("failed", 0, 0, 100);
		expect(f.live).toBe(1);
	});
	it("rises when moving and only fades under reduced motion", () => {
		expect(floatOffset(0, false)).toBeCloseTo(0, 6);
		expect(floatOffset(FLOATER_LIFE, false)).toBeLessThan(-10);
		expect(floatOffset(FLOATER_LIFE / 2, true)).toBe(0);
		expect(floatAlpha(0)).toBe(0);
		expect(floatAlpha(FLOATER_LIFE * 0.3)).toBe(1);
		expect(floatAlpha(FLOATER_LIFE)).toBe(0);
		expect(floatAlpha(FLOATER_LIFE * 0.8)).toBeGreaterThan(0);
		expect(floatAlpha(FLOATER_LIFE * 0.8)).toBeLessThan(1);
	});
});

describe("puffs", () => {
	it("cap, restart a puff at the same spot, and expire", () => {
		const p = new PuffField();
		for (let i = 0; i < 50; i++) p.add(i * 20, 0);
		expect(p.items.filter((q) => q.active).length).toBe(MAX_PUFFS);
		const q = new PuffField();
		q.add(10, 10);
		q.update(0.1);
		q.add(12, 11);
		expect(q.items.filter((x) => x.active).length).toBe(1);
		expect(q.items[0].age).toBe(0);
		run(q, PUFF_LIFE + 0.2);
		expect(q.items.some((x) => x.active)).toBe(false);
	});
});

describe("job anchor", () => {
	const fac = [
		{ defId: "rack", floor: 2, x: 4, width: 2, jobId: 7 },
		{ defId: "rack", floor: 2, x: 8, width: 2, jobId: 7 },
		{ defId: "rack", floor: 1, x: 20, width: 4, jobId: null },
		{ defId: "chiller", floor: 2, x: 30, width: 4, jobId: 7 },
	];
	const isRack = (d: string): boolean => d === "rack";
	it("is the middle of the job's racks", () => {
		expect(jobAnchor(fac, 7, isRack)).toEqual({ x: 7, floor: 2 });
	});
	it("falls back to the rack area when no rack runs the job, and to null with no racks", () => {
		expect(jobAnchor(fac, 99, isRack)).toEqual({ x: 7, floor: 2 }); // the first rack's floor
		expect(jobAnchor([fac[3]], 7, isRack)).toBeNull();
		expect(jobAnchor([], 1, isRack)).toBeNull();
	});
});

describe("applyEvents", () => {
	const view = {
		floorMax: 3,
		facilities: [
			{ id: 1, defId: "rack", floor: 2, x: 4, width: 2, jobId: 7 },
			{ id: 2, defId: "chiller", floor: 3, x: 10, width: 4, jobId: null },
		],
	};
	const isRack = (d: string): boolean => d === "rack";
	it("earned and failed jobs float over the job's racks in world px; autoBuilt puffs on the device", () => {
		const f = new FloaterField();
		const p = new PuffField();
		applyEvents(
			[
				{ type: "earned", jobId: 7, amount: 2000 },
				{ type: "jobFailed", jobId: 7, penalty: 300 },
				{ type: "autoBuilt", facilityId: 2 },
				{ type: "autoBuilt", facilityId: 99 },
				{ type: "tick" },
			],
			view,
			f,
			p,
			isRack,
		);
		const live = f.items.filter((q) => q.active);
		expect(live.map((q) => q.text).sort()).toEqual(["+$2.0K", "−$300"].sort());
		for (const q of live) expect(q.x).toBe(5 * 16);
		expect(p.items.filter((q) => q.active)).toHaveLength(1);
		expect(p.items[0].x).toBe(12 * 16);
	});
	it("a burst of earnings for one job is one floater", () => {
		const f = new FloaterField();
		applyEvents(Array.from({ length: 30 }, () => ({ type: "earned", jobId: 7, amount: 100 })), view, f, new PuffField(), isRack);
		expect(f.live).toBe(1);
		expect(f.items[0].amount).toBe(3000);
	});
});
