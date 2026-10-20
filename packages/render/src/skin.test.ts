import { describe, expect, it } from "vitest";
import { BIOTECH_STAGES, GREEN_STAGES, STAGE_AT, SYNTH_STAGES, changesAt, pathSkin, skinEffects, skinTable, stageOf } from "./skin";

describe("stageOf", () => {
	it("steps at 25 / 50 / 75 / 100 % of the score", () => {
		expect([0, 0.24, 0.25, 0.49, 0.5, 0.74, 0.75, 0.97, 0.98, 1].map(stageOf)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
		expect(STAGE_AT).toEqual([0.25, 0.5, 0.75, 0.98]);
	});
	it("treats junk scores as stage 0", () => {
		expect(stageOf(Number.NaN)).toBe(0);
		expect(stageOf(-3)).toBe(0);
	});
});

describe("pathSkin", () => {
	it("no corruption and no path: the plain synthetic look", () => {
		expect(pathSkin({ path: null, corruption: 0 })).toEqual({ path: null, stage: 0, score: 0 });
	});
	it("biotech applies before the path is chosen, from the first corruption on", () => {
		expect(pathSkin({ path: null, corruption: 0.1 })).toMatchObject({ path: "biotech", stage: 0 });
		expect(pathSkin({ path: null, corruption: 0.6 })).toMatchObject({ path: "biotech", stage: 2 });
	});
	it("a chosen biotech path uses corruption as its score", () => {
		expect(pathSkin({ path: "biotech", corruption: 1 })).toEqual({ path: "biotech", stage: 4, score: 1 });
		expect(pathSkin({ path: "biotech", corruption: 0.8 }).stage).toBe(3);
	});
	it("greentech and synthetic mind read view.pathScore, never the corruption or the biotech skin", () => {
		expect(pathSkin({ path: "greentech", corruption: 0.9 })).toEqual({ path: "greentech", stage: 0, score: 0 });
		expect(pathSkin({ path: "synthetic", corruption: 0.9 })).toMatchObject({ path: "synthetic", stage: 0 });
		expect(pathSkin({ path: "greentech", corruption: 0.9, pathScore: 0.5 })).toEqual({ path: "greentech", stage: 2, score: 0.5 });
		expect(pathSkin({ path: "synthetic", corruption: 0, pathScore: 1 })).toEqual({ path: "synthetic", stage: 4, score: 1 });
		expect(pathSkin({ path: "greentech", corruption: 0, pathScore: 9 }).score).toBe(1);
	});
	it("clamps the score", () => {
		expect(pathSkin({ path: "biotech", corruption: 7 }).score).toBe(1);
	});
});

describe("skin table", () => {
	it("biotech stages add: 25 damp + pulse, 50 veins + flesh + bile, 75 breathe + eyes, 100 tissue", () => {
		expect(BIOTECH_STAGES).toEqual([["damp", "pulse"], ["veins", "flesh", "bile"], ["breathe", "eyes"], ["tissue"]]);
	});
	it("effects are cumulative and empty at stage 0", () => {
		expect([...skinEffects({ path: "biotech", stage: 0 }, "rack")]).toEqual([]);
		expect([...skinEffects({ path: null, stage: 4 }, "rack")]).toEqual([]);
		expect([...skinEffects({ path: "biotech", stage: 1 }, "rack")].sort()).toEqual(["damp", "pulse"]);
		expect(skinEffects({ path: "biotech", stage: 4 }, "rack").size).toBe(7);
	});
	it("racks and the bioreactor grow eyes; chillers and the clean devices do not", () => {
		expect(skinEffects({ path: "biotech", stage: 3 }, "rack").has("eyes")).toBe(true);
		expect(skinEffects({ path: "biotech", stage: 3 }, "bioreactor").has("eyes")).toBe(true);
		expect(skinEffects({ path: "biotech", stage: 4 }, "chiller").has("eyes")).toBe(false);
		expect(skinEffects({ path: "biotech", stage: 4 }, "sterilizer").has("eyes")).toBe(false);
	});
	it("a device stays the same at stages that add nothing it responds to", () => {
		// Sterile bays and quarantine locks hold out: damp at 25 %, then nothing until the tissue at 100 %.
		for (const kind of ["sterilizer", "quarantine"] as const) {
			expect([1, 2, 3, 4].map((s) => changesAt("biotech", kind, s as 1 | 2 | 3 | 4))).toEqual([true, false, false, true]);
		}
		// Racks change at every stage.
		expect([1, 2, 3, 4].every((s) => changesAt("biotech", "rack", s as 1 | 2 | 3 | 4))).toBe(true);
	});
	it("growths are already tissue: no damp or tissue overlay", () => {
		const all = skinEffects({ path: "biotech", stage: 4 }, "growth");
		expect(all.has("damp")).toBe(false);
		expect(all.has("tissue")).toBe(false);
		expect(all.has("pulse")).toBe(true);
	});
	it("greentech stages add: 25 moss, 50 fungus + vines, 75 plants + tanks, 100 garden", () => {
		expect(GREEN_STAGES).toEqual([["moss"], ["fungus", "vines"], ["plants", "tank"], ["garden"]]);
		expect([...skinEffects({ path: "greentech", stage: 1 }, "rack")]).toEqual(["moss"]);
		expect([...skinEffects({ path: "greentech", stage: 2 }, "crah")].sort()).toEqual(["fungus", "moss", "vines"]);
		// Racks grow plants but no fish tank; the chiller gets a tank and no fungus.
		expect(skinEffects({ path: "greentech", stage: 3 }, "rack").has("tank")).toBe(false);
		expect(skinEffects({ path: "greentech", stage: 3 }, "chiller").has("tank")).toBe(true);
		expect(skinEffects({ path: "greentech", stage: 4 }, "chiller").has("fungus")).toBe(false);
	});
	it("clean devices hold out of greentech; growths take no green; green kinds change at some stages only", () => {
		for (const kind of ["sterilizer", "quarantine"] as const) expect([1, 2, 3, 4].map((s) => changesAt("greentech", kind, s as 1 | 2 | 3 | 4))).toEqual([true, false, false, false]);
		expect(skinEffects({ path: "greentech", stage: 4 }, "growth").size).toBe(0);
		expect([1, 2, 3, 4].map((s) => changesAt("greentech", "wind", s as 1 | 2 | 3 | 4))).toEqual([true, true, false, false]);
		expect([1, 2, 3, 4].every((s) => changesAt("greentech", "heat_export", s as 1 | 2 | 3 | 4))).toBe(true);
	});
	it("synthetic stages add: 25 lines, 50 glass, 75 panels, 100 light-only", () => {
		expect(SYNTH_STAGES).toEqual([["lines"], ["glass"], ["panels"], ["light"]]);
		expect([...skinEffects({ path: "synthetic", stage: 4 }, "rack")].sort()).toEqual(["glass", "light", "lines", "panels"]);
		expect(skinEffects({ path: "synthetic", stage: 4 }, "wind").has("glass")).toBe(false);
		expect(skinEffects({ path: "synthetic", stage: 4 }, "growth").size).toBe(0);
	});
	it("every path has four stage rows for every kind, and no path leaks another path's effects", () => {
		const bio = new Set(["damp", "pulse", "veins", "flesh", "bile", "breathe", "eyes", "tissue"]);
		for (const path of ["biotech", "greentech", "synthetic"] as const)
			for (const kind of ["rack", "crah", "chiller", "cdu", "grid_tie", "genset", "ups", "depot", "charger", "nutrient", "sterilizer", "quarantine", "bioreactor", "solar", "wind", "heat_export", "carbon", "growth"] as const) {
				const t = skinTable(path, kind);
				expect(t.length).toBe(4);
				if (path !== "biotech") expect(t.flat().some((e) => bio.has(e))).toBe(false);
			}
	});
});
