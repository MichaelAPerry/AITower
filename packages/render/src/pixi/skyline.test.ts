import { describe, expect, it } from "vitest";
import { type SkyStyle, planCity, styleKey } from "./skyline";

const st = (tier: number, path: SkyStyle["path"] = null, stage: SkyStyle["stage"] = 0): SkyStyle => ({ tier, path, stage });
const plan = (s: SkyStyle, far = false) => planCity(1337, 30, 150, !far, s, far);
const avg = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

describe("planCity", () => {
	it("is deterministic", () => {
		expect(plan(st(3, "greentech", 2))).toEqual(plan(st(3, "greentech", 2)));
	});
	it("grows taller and denser with Level, with more lit windows", () => {
		const a = plan(st(1));
		const b = plan(st(5));
		expect(avg(b.map((x) => x.h))).toBeGreaterThan(avg(a.map((x) => x.h)) * 1.5);
		expect(b.length).toBeGreaterThan(a.length);
		expect(b[0].lit).toBeGreaterThan(a[0].lit);
	});
	it("builds cranes only at the upper Levels, never on the far layer", () => {
		expect(plan(st(1)).some((x) => x.crane)).toBe(false);
		expect(plan(st(2)).some((x) => x.crane)).toBe(false);
		expect(plan(st(5)).some((x) => x.crane)).toBe(true);
		expect(plan(st(5), true).some((x) => x.crane)).toBe(false);
	});
	it("decorates more buildings as the path stage rises, and none without a path", () => {
		const n = (s: SkyStyle) => plan(s).filter((x) => x.deco).length;
		expect(n(st(3))).toBe(0);
		expect(n(st(3, "biotech", 0))).toBe(0);
		expect(n(st(3, "biotech", 4))).toBeGreaterThan(n(st(3, "biotech", 1)));
		expect(n(st(3, "biotech", 4))).toBeGreaterThanOrEqual(plan(st(3)).length - 2);
	});
	it("puts turbines on Greentech roofs only", () => {
		expect(plan(st(3, "greentech", 3)).some((x) => x.turbine)).toBe(true);
		expect(plan(st(3, "synthetic", 3)).some((x) => x.turbine)).toBe(false);
		expect(plan(st(3, "greentech", 1)).some((x) => x.turbine)).toBe(false);
	});
	it("always keeps the sign building on the near layer", () => {
		expect(plan(st(1)).filter((x) => x.sign)).toHaveLength(1);
		expect(plan(st(5, "synthetic", 4)).filter((x) => x.sign)).toHaveLength(1);
		expect(plan(st(2), true).some((x) => x.sign)).toBe(false);
	});
	it("keys the style", () => {
		expect(styleKey(st(2, "biotech", 3))).toBe("2b3");
		expect(styleKey(st(9))).toBe("5-0");
	});
});
