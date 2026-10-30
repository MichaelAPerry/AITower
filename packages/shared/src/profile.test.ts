import { describe, expect, it } from "vitest";
import {
	PROFILE_KEY,
	attachProfile,
	extractProfile,
	loadProfile,
	markProfileFlag,
	mergeProfiles,
	mergeStoredProfile,
	parseProfile,
	recordAchievement,
	recordBonds,
	recordEpilogue,
	recordOffDuty,
} from "./index";

const memory = () => {
	const m = new Map<string, string>();
	return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};

const empty = () => loadProfile(memory());

describe("profile", () => {
	it("starts empty, and an unreadable store gives the empty profile", () => {
		expect(loadProfile(memory())).toEqual({
			v: 1,
			earned: {},
			epilogues: { luci: false, mel: false, bea: false, cass: false },
			offDuty: { luci: { casual: false }, mel: { casual: false }, bea: { casual: false }, cass: { casual: false } },
			bondMax: { luci: 0, mel: 0, bea: 0, cass: 0 },
			told: {},
			scenesSeen: {},
		});
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
		s.m.set(PROFILE_KEY, JSON.stringify({ v: 1, earned: { ok: { day: 3, ending: "garden" }, junk: 5, nan: { day: "x" } }, epilogues: { luci: true, mel: "yes" }, offDuty: { cass: { casual: true }, mel: { casual: 1 } }, bondMax: { luci: 61, mel: "x", bea: 900 } }));
		const p = loadProfile(s);
		expect(Object.keys(p.earned)).toEqual(["ok"]);
		expect(p.epilogues).toEqual({ luci: true, mel: false, bea: false, cass: false });
		expect(p.offDuty.cass.casual).toBe(true);
		expect(p.offDuty.mel.casual).toBe(false);
		expect(p.bondMax).toEqual({ luci: 61, mel: 0, bea: 100, cass: 0 });
	});

	it("an older v1 profile (no gallery fields) still loads", () => {
		const s = memory();
		s.m.set(PROFILE_KEY, JSON.stringify({ v: 1, earned: { cash_deep: { day: 9, ending: null } }, epilogues: { luci: false, mel: false, bea: false, cass: false } }));
		const p = loadProfile(s);
		expect(p.earned.cash_deep.day).toBe(9);
		expect(p.offDuty.luci.casual).toBe(false);
		expect(p.told).toEqual({});
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
		expect(() => recordEpilogue("mel", throwing)).not.toThrow();
		expect(() => mergeStoredProfile(empty(), throwing)).not.toThrow();
	});

	it("latches epilogues, off-duty portraits and the highest bonds; flags are set once", () => {
		const s = memory();
		expect(recordEpilogue("bea", s)).toBe(true);
		expect(recordEpilogue("bea", s)).toBe(false);
		expect(recordOffDuty("cass", s)).toBe(true);
		expect(recordOffDuty("cass", s)).toBe(false);
		recordBonds({ luci: 40, mel: 10 }, s);
		recordBonds({ luci: 30, mel: 12 }, s);
		markProfileFlag("told", "cass", s);
		markProfileFlag("scenesSeen", "ach_bed_intro", s);
		const p = loadProfile(s);
		expect(p.epilogues.bea).toBe(true);
		expect(p.offDuty.cass.casual).toBe(true);
		expect(p.bondMax).toMatchObject({ luci: 40, mel: 12 });
		expect(p.told).toEqual({ cass: true });
		expect(p.scenesSeen).toEqual({ ach_bed_intro: true });
	});
});

describe("profile merge and the save file", () => {
	const a = () => {
		const s = memory();
		recordAchievement("end_lattice", 25, "singularity", s);
		recordAchievement("cash_deep", 10, null, s);
		recordEpilogue("luci", s);
		recordOffDuty("luci", s);
		recordBonds({ luci: 61 }, s);
		markProfileFlag("told", "luci", s);
		return loadProfile(s);
	};
	const b = () => {
		const s = memory();
		recordAchievement("end_flesh", 40, "flesh", s);
		recordAchievement("cash_deep", 5, null, s);
		recordEpilogue("mel", s);
		recordOffDuty("cass", s);
		recordBonds({ luci: 20, mel: 44 }, s);
		markProfileFlag("scenesSeen", "ach_gallery_empty", s);
		return loadProfile(s);
	};

	it("is a union: nothing is removed from either side, the earlier day wins", () => {
		const m = mergeProfiles(a(), b());
		expect(Object.keys(m.earned).sort()).toEqual(["cash_deep", "end_flesh", "end_lattice"]);
		expect(m.earned.cash_deep.day).toBe(5);
		expect(m.epilogues).toEqual({ luci: true, mel: true, bea: false, cass: false });
		expect(m.offDuty.luci.casual && m.offDuty.cass.casual).toBe(true);
		expect(m.bondMax).toMatchObject({ luci: 61, mel: 44 });
		expect(m.scenesSeen.ach_gallery_empty).toBe(true);
		// Merging an empty profile changes nothing; merging twice is stable.
		expect(mergeProfiles(a(), empty())).toEqual({ ...a(), told: {} });
		expect(mergeProfiles(m, m)).toEqual(m);
	});

	it("a merge never hides an unshown strip", () => {
		expect(mergeProfiles(a(), b()).told.luci).toBeUndefined();
	});

	it("an import merges into the stored profile and removes nothing", () => {
		const s = memory();
		recordAchievement("books_clean", 30, "singularity", s);
		const merged = mergeStoredProfile(b(), s);
		expect(Object.keys(merged.earned).sort()).toEqual(["books_clean", "cash_deep", "end_flesh"]);
		expect(Object.keys(loadProfile(s).earned).sort()).toEqual(["books_clean", "cash_deep", "end_flesh"]);
		mergeStoredProfile(empty(), s);
		expect(Object.keys(loadProfile(s).earned)).toHaveLength(3);
	});

	it("travels in the exported file and comes out again", () => {
		const s = memory();
		recordAchievement("cash_deep", 9, null, s);
		const text = attachProfile(JSON.stringify({ snapshot: { version: 16 }, meta: { day: 3 } }), s);
		expect(JSON.parse(text).profile.earned.cash_deep.day).toBe(9);
		const out = extractProfile(text);
		expect(out.profile?.earned.cash_deep.day).toBe(9);
		expect(JSON.parse(out.text)).toEqual({ snapshot: { version: 16 }, meta: { day: 3 } });
	});

	it("a file with no profile, a bad profile, or bad JSON hands the original text on", () => {
		const plain = JSON.stringify({ snapshot: 1 });
		expect(extractProfile(plain)).toEqual({ text: plain, profile: null });
		const bad = extractProfile(JSON.stringify({ snapshot: 1, profile: { v: 7 } }));
		expect(bad.profile).toBeNull();
		expect(JSON.parse(bad.text)).toEqual({ snapshot: 1 });
		expect(extractProfile("not json")).toEqual({ text: "not json", profile: null });
		expect(attachProfile("not json", memory())).toBe("not json");
		expect(attachProfile("[1]", memory())).toBe("[1]");
	});

	it("parseProfile survives junk", () => {
		for (const junk of [null, 3, "x", [], { v: 1, earned: 4 }]) expect(() => parseProfile(junk)).not.toThrow();
	});
});
