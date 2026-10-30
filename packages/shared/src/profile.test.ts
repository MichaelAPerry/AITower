import { describe, expect, it } from "vitest";
import { PROFILE_KEY, loadProfile, recordAchievement } from "./index";

const memory = () => {
	const m = new Map<string, string>();
	return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};

describe("profile", () => {
	it("starts empty, and an unreadable store gives the empty profile", () => {
		expect(loadProfile(memory())).toEqual({ v: 1, earned: {}, epilogues: { luci: false, mel: false, bea: false, cass: false } });
		const bad = memory();
		bad.m.set(PROFILE_KEY, "{not json");
		expect(loadProfile(bad).earned).toEqual({});
		bad.m.set(PROFILE_KEY, JSON.stringify({ v: 2, earned: { x: { day: 1, ending: null } } }));
		expect(loadProfile(bad).earned).toEqual({});
	});

	it("latches: the first record wins and a repeat never overwrites", () => {
		const s = memory();
		expect(recordAchievement("cash_deep", 12, null, s).first).toBe(true);
		expect(recordAchievement("cash_deep", 30, "flesh", s).first).toBe(false);
		expect(loadProfile(s).earned.cash_deep).toEqual({ day: 12, ending: null });
		expect(JSON.parse(s.m.get(PROFILE_KEY) as string).v).toBe(1);
	});

	it("keeps only well-formed rows", () => {
		const s = memory();
		s.m.set(PROFILE_KEY, JSON.stringify({ v: 1, earned: { ok: { day: 3, ending: "garden" }, junk: 5, nan: { day: "x" } }, epilogues: { luci: true, mel: "yes" } }));
		const p = loadProfile(s);
		expect(Object.keys(p.earned)).toEqual(["ok"]);
		expect(p.epilogues).toEqual({ luci: true, mel: false, bea: false, cass: false });
	});

	it("works with no storage, and with storage that throws", () => {
		expect(loadProfile(null).earned).toEqual({});
		expect(recordAchievement("cash_deep", 1, null, null).first).toBe(true);
		const throwing = {
			getItem: () => {
				throw new Error("denied");
			},
			setItem: () => {
				throw new Error("quota");
			},
		};
		expect(loadProfile(throwing).earned).toEqual({});
		expect(() => recordAchievement("cash_deep", 1, null, throwing)).not.toThrow();
	});
});
