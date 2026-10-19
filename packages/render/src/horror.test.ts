import { describe, expect, it } from "vitest";
import {
	BAYER4,
	NO_FX,
	SIGN_ALT,
	SIGN_WORD,
	TEXELS_X,
	TEXELS_Y,
	breathFrame,
	contaminationColor,
	contaminationDensity,
	contaminationTexels,
	creepBlock,
	crtMotif,
	ditherOn,
	easeToward,
	eyeClosed,
	horrorActive,
	horrorKey,
	horrorStages,
	lampFactor,
	nutrientNetColor,
	nutrientSatisfaction,
	pupilOffset,
	signWord,
} from "./horror";
import { CB } from "./palette";

describe("horrorStages", () => {
	it("full intensity switches layers on by skin stage", () => {
		const on = (stage: 0 | 1 | 2 | 3 | 4) => horrorStages(stage, [0, 0.25, 0.5, 0.75, 1][stage], "full");
		expect(horrorActive(on(0))).toBe(false);
		expect(on(1)).toMatchObject({ lamps: true, damp: true, veined: false, breathing: false, eyes: false, tissue: false, sign: false, alpha: 1 });
		expect(on(2)).toMatchObject({ veined: true, breathing: false, eyes: false });
		expect(on(3)).toMatchObject({ veined: true, breathing: true, eyes: true, tissue: false });
		expect(on(4)).toMatchObject({ tissue: true, sign: true, eyes: true });
		expect(on(4).creep).toBeGreaterThanOrEqual(0.5);
		expect(on(3).creep).toBe(0);
	});
	it("mild halves the alpha and drops eyes and faces, keeping everything else", () => {
		const m = horrorStages(4, 1, "mild");
		expect(m.alpha).toBe(0.5);
		expect(m.eyes).toBe(false);
		expect(m).toMatchObject({ lamps: true, damp: true, veined: true, breathing: true, tissue: true, sign: true });
	});
	it("off disables every layer", () => {
		const o = horrorStages(4, 1, "off");
		expect(o.alpha).toBe(0);
		expect(horrorActive(o)).toBe(false);
		expect([o.lamps, o.damp, o.veined, o.breathing, o.eyes, o.tissue, o.sign]).toEqual(Array(7).fill(false));
		expect(o.stage).toBe(0);
	});
	it("ignores a non-finite score", () => {
		expect(horrorStages(2, Number.NaN, "full").amount).toBe(0);
	});
	it("the cache key changes with stage, alpha and quantised growth, not with tiny score changes", () => {
		const k = (s: number, i: "full" | "mild" = "full") => horrorKey(horrorStages(2, s, i));
		expect(k(0.5)).not.toBe(horrorKey(horrorStages(3, 0.75, "full")));
		expect(k(0.5)).not.toBe(k(0.5, "mild"));
		expect(k(0.5)).toBe(k(0.5001));
	});
});

describe("dither masks", () => {
	it("Bayer is a permutation of 0..15", () => {
		expect([...BAYER4].sort((a, b) => a - b)).toEqual(Array.from({ length: 16 }, (_, i) => i));
	});
	it("density 0 and 1 are empty and full; in between fills the matching share of a 4x4 block", () => {
		let n0 = 0;
		let n1 = 0;
		let nh = 0;
		for (let y = 0; y < 4; y++)
			for (let x = 0; x < 4; x++) {
				n0 += +ditherOn(x, y, 0);
				n1 += +ditherOn(x, y, 1);
				nh += +ditherOn(x, y, 0.5);
			}
		expect([n0, n1, nh]).toEqual([0, 16, 8]);
	});
	it("is a pattern, never a smooth fill: a half-density row alternates", () => {
		const row = [0, 1, 2, 3, 4, 5, 6, 7].map((x) => ditherOn(x, 0, 0.5));
		expect(row.some((v) => v)).toBe(true);
		expect(row.some((v) => !v)).toBe(true);
	});
	it("tissue creep grows monotonically with the creep amount", () => {
		const count = (c: number) => {
			let n = 0;
			for (let cx = 0; cx < 6; cx++) for (let by = 0; by < 2; by++) for (let bx = 0; bx < 8; bx++) n += +creepBlock(cx, 0, bx, by, c);
			return n;
		};
		expect(count(0)).toBe(0);
		expect(count(0.5)).toBeGreaterThan(0);
		expect(count(1)).toBeGreaterThan(count(0.5));
		expect(count(0.25)).toBeLessThanOrEqual(count(0.5));
	});
});

describe("lamps, breathing, sign", () => {
	it("lamps pulse slightly (never below 55 %) and out of sync; steady when off, not yet at stage 0, or calm", () => {
		const full = horrorStages(1, 0.3, "full");
		const vals = Array.from({ length: 40 }, (_, i) => lampFactor(full, 3, 0, i * 0.17, false));
		expect(Math.min(...vals)).toBeGreaterThanOrEqual(0.55);
		expect(Math.max(...vals)).toBeLessThanOrEqual(1);
		expect(Math.min(...vals)).toBeLessThan(0.9);
		const other = Array.from({ length: 40 }, (_, i) => lampFactor(full, 3, 1, i * 0.17, false));
		expect(other).not.toEqual(vals);
		expect(lampFactor(full, 3, 0, 1, true)).toBe(1);
		expect(lampFactor(horrorStages(1, 0.3, "off"), 3, 0, 1, false)).toBe(1);
		expect(lampFactor(horrorStages(0, 0, "full"), 3, 0, 1, false)).toBe(1);
		const mild = Array.from({ length: 40 }, (_, i) => lampFactor(horrorStages(1, 0.3, "mild"), 3, 0, i * 0.17, false));
		expect(Math.min(...mild)).toBeGreaterThan(Math.min(...vals));
	});
	it("walls breathe in two frames at 0.2 Hz and hold still under reduced motion", () => {
		expect([0, 2.4, 2.6, 4.9, 5.1].map((t) => breathFrame(t, false))).toEqual([0, 0, 1, 1, 0]);
		expect(breathFrame(3, true)).toBe(0);
	});
	it("the sign flickers to another word only at the tissue stage", () => {
		const t4 = horrorStages(4, 1, "full");
		const words = new Set(Array.from({ length: 90 }, (_, i) => signWord(t4, i * 0.1, false)));
		expect(words).toEqual(new Set([SIGN_WORD, SIGN_ALT]));
		expect(signWord(t4, 6.8, true)).toBe(SIGN_WORD);
		expect(signWord(horrorStages(3, 0.8, "full"), 6.8, false)).toBe(SIGN_WORD);
		expect(signWord(horrorStages(4, 1, "off"), 6.8, false)).toBe(SIGN_WORD);
		expect(signWord(horrorStages(4, 1, "mild"), 6.8, false)).toBe(SIGN_ALT);
	});
});

describe("eyes", () => {
	it("crtMotif: only at the eyes stage, never on faults, a fraction of screens, some faces", () => {
		const full = horrorStages(3, 0.8, "full");
		const seeds = Array.from({ length: 400 }, (_, i) => i);
		const motifs = seeds.map((s) => crtMotif(full, s, 0.8, false));
		const eyes = motifs.filter((m) => m === "eyes").length;
		const faces = motifs.filter((m) => m === "face").length;
		expect(eyes).toBeGreaterThan(50);
		expect(faces).toBeGreaterThan(5);
		expect(eyes + faces).toBeLessThan(400);
		expect(seeds.every((s) => crtMotif(full, s, 0.8, true) === "none")).toBe(true);
		expect(seeds.every((s) => crtMotif(horrorStages(3, 0.8, "mild"), s, 0.8, false) === "none")).toBe(true);
		expect(seeds.every((s) => crtMotif(horrorStages(2, 0.5, "full"), s, 0.5, false) === "none")).toBe(true);
		expect(seeds.every((s) => crtMotif(horrorStages(3, 0.8, "off"), s, 0.8, false) === "none")).toBe(true);
	});
	it("more screens watch as the score rises", () => {
		const c = (score: number) => Array.from({ length: 400 }, (_, i) => crtMotif(horrorStages(3, score, "full"), i, score, false)).filter((m) => m !== "none").length;
		expect(c(1)).toBeGreaterThan(c(0.75));
	});
	it("pupils look toward the cursor, centre inside the dead zone or without a cursor", () => {
		expect(pupilOffset(100, 100, 200, 100)).toEqual({ dx: 1, dy: 0 });
		expect(pupilOffset(100, 100, 0, 300)).toEqual({ dx: -1, dy: 1 });
		expect(pupilOffset(100, 100, 102, 98)).toEqual({ dx: 0, dy: 0 });
		expect(pupilOffset(100, 100, null, null)).toEqual({ dx: 0, dy: 0 });
	});
	it("eases slowly toward the target, independent of frame rate", () => {
		expect(easeToward(0, 10, 0)).toBe(0);
		const one = easeToward(0, 10, 1);
		expect(one).toBeGreaterThan(5);
		expect(one).toBeLessThan(10);
		let v = 0;
		for (let i = 0; i < 60; i++) v = easeToward(v, 10, 1 / 60);
		expect(v).toBeCloseTo(one, 5);
	});
	it("blink only while paused, about every 2.4 s", () => {
		const closed = (paused: boolean) => Array.from({ length: 480 }, (_, i) => eyeClosed(i * 0.01, paused, 4)).filter(Boolean).length;
		expect(closed(false)).toBe(0);
		expect(closed(true)).toBeGreaterThan(30);
		expect(closed(true)).toBeLessThan(120);
	});
});

describe("contamination heat map", () => {
	it("colour ramp runs bile -> flesh -> blood; colour-blind uses blue / orange and differs", () => {
		const lo = contaminationColor(0.4);
		expect(lo).toBe(0x8a8a3a);
		expect(contaminationColor(0.7)).toBe(0xb5877a);
		expect(contaminationColor(1)).not.toBe(contaminationColor(0.7));
		expect(contaminationColor(0.4, true)).toBe(CB.blue);
		expect(contaminationColor(0.7, true)).toBe(CB.orange);
		expect(contaminationColor(0.4, true)).not.toBe(lo);
	});
	it("density: nothing when clean, 0.15 up to 1", () => {
		expect(contaminationDensity(0)).toBe(0);
		expect(contaminationDensity(0.01)).toBe(0);
		expect(contaminationDensity(0.02)).toBeCloseTo(0.167, 2);
		expect(contaminationDensity(1)).toBe(1);
		expect(contaminationDensity(5)).toBe(1);
	});
	it("texels: dithered, transparent over clean and slab-less cells, denser where dirtier", () => {
		const width = 3;
		const slab = new Uint8Array([1, 1, 0]);
		const cont = new Float32Array([0.9, 0.1, 1]);
		const t = contaminationTexels(width, 0, 0, cont, slab);
		expect(t.width).toBe(width * TEXELS_X);
		expect(t.height).toBe(TEXELS_Y);
		expect(t.data.length).toBe(t.width * t.height * 4);
		const covered = (cx: number) => {
			let n = 0;
			for (let y = 0; y < t.height; y++) for (let x = cx * TEXELS_X; x < (cx + 1) * TEXELS_X; x++) n += +(t.data[(y * t.width + x) * 4 + 3] > 0);
			return n;
		};
		expect(covered(0)).toBeGreaterThan(covered(1));
		expect(covered(1)).toBeGreaterThan(0);
		expect(covered(2)).toBe(0); // no slab: never bleeds
		expect(covered(0)).toBeLessThan(TEXELS_X * TEXELS_Y); // dithered, not solid
		const clean = contaminationTexels(width, 0, 0, new Float32Array(3), slab);
		expect(clean.data.every((v) => v === 0)).toBe(true);
	});
	it("texel rows run top = floorMax", () => {
		const slab = new Uint8Array([1, 1]);
		const cont = new Float32Array([0, 1]); // floor 0 clean, floor 1 dirty
		const t = contaminationTexels(1, 0, 1, cont, slab);
		let top = 0;
		let bottom = 0;
		for (let y = 0; y < t.height; y++) {
			for (let x = 0; x < t.width; x++) {
				const on = t.data[(y * t.width + x) * 4 + 3] > 0 ? 1 : 0;
				if (y < TEXELS_Y) top += on;
				else bottom += on;
			}
		}
		expect(top).toBeGreaterThan(bottom);
	});
});

describe("nutrient overlay helpers", () => {
	it("nets get distinct pale-green tints", () => {
		const cols = new Set([0, 1, 2, 3].map(nutrientNetColor));
		expect(cols.size).toBe(4);
		expect(nutrientNetColor(4)).toBe(nutrientNetColor(0));
		expect(nutrientNetColor(-1)).toBe(nutrientNetColor(3));
	});
	it("satisfaction: the net's, 0 without a net, capped while the device reports noNutrient", () => {
		expect(nutrientSatisfaction(undefined, "ok")).toBe(0);
		expect(nutrientSatisfaction({ satisfaction: 1 }, "ok")).toBe(1);
		expect(nutrientSatisfaction({ satisfaction: 0.6 }, "ok")).toBe(0.6);
		expect(nutrientSatisfaction({ satisfaction: 0.9 }, "noNutrient")).toBe(0.4);
		expect(nutrientSatisfaction({ satisfaction: 9 }, "ok")).toBe(1);
	});
});

describe("NO_FX", () => {
	it("is the plain synthetic look at full intensity", () => {
		expect(NO_FX.stage).toBe(0);
		expect(horrorActive(NO_FX.stages)).toBe(false);
	});
});
