import { loadContent } from "@aitower/content";
import type { FacilityDef } from "@aitower/content";
import type { FacilityStatus, FacilityView } from "@aitower/sim";
import type { Graphics } from "pixi.js";
import { describe, expect, it } from "vitest";
import { GREEN_SPRITE_BY_ID, GREEN_SPRITE_WIDTH, greenSprite, spriteTree } from "../art";
import { FAC_BOTTOM, FAC_TOP, TILE } from "../constants";
import { NO_FX } from "../horror";
import { drawBody, drawLive } from "./facilityArt";

interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
	a: number;
	c: number;
}

/** Records every rect a drawing routine paints (with colour and alpha). */
function recorder(): { g: Graphics; rects: Rect[] } {
	const rects: Rect[] = [];
	let cur: Rect | null = null;
	const g = {
		clear() {},
		rect(x: number, y: number, w: number, h: number) {
			cur = { x, y, w, h, a: 1, c: 0 };
			rects.push(cur);
			return g;
		},
		fill(o: { color: number; alpha?: number }) {
			if (cur) {
				cur.c = o.color;
				cur.a = o.alpha ?? 1;
			}
			return g;
		},
	};
	return { g: g as unknown as Graphics, rects };
}

const content = loadContent();
const TOP = 100;
const defOf = (id: string): FacilityDef => content.facilities[id];
const view = (def: FacilityDef, status: FacilityStatus = "ok", extra: Partial<FacilityView> = {}): FacilityView =>
	({ id: 7, defId: def.id, floor: 0, x: 0, width: def.width, enabled: true, status, tempC: 40, clock: 0.9, health: 1, powerKw: 30, heatKw: 120, jobId: 1, powerNet: 0, coolantNet: null, nutrientNet: null, grown: false, contamination: 0, running: true, charge: 0.6, ...extra }) as FacilityView;
const OPT = { reducedMotion: false, crtEffects: false, colorBlind: false, horrorIntensity: "full" } as const;
const IDS = Object.keys(GREEN_SPRITE_BY_ID);
const sig = (rs: Rect[]): string => rs.map((q) => `${q.x},${q.y},${q.w},${q.h},${q.c},${q.a}`).join(";");

describe("tree sprites: selection", () => {
	it("every listed id exists in the content at the width its sprite was drawn for", () => {
		for (const id of IDS) {
			const def = defOf(id);
			expect(def, id).toBeDefined();
			expect(GREEN_SPRITE_WIDTH[GREEN_SPRITE_BY_ID[id]], id).toContain(def.width);
			expect(greenSprite(def), id).toBe(GREEN_SPRITE_BY_ID[id]);
		}
	});
	it("covers all three trees", () => {
		const trees = new Set(Object.values(GREEN_SPRITE_BY_ID).map((x) => spriteTree(x)));
		expect([...trees].sort()).toEqual(["biotech", "greentech", "synthetic"]);
		expect(greenSprite(defOf("consciousness_transfer"))).toBe("transfer");
	});
	it("a def of another width falls back to base art, and base defs have no green sprite", () => {
		expect(greenSprite({ id: "rack_neuromorphic", width: 3 })).toBeNull();
		expect(greenSprite({ id: "rack_air_gpu", width: 2 })).toBeNull();
		expect(greenSprite({ width: 2 })).toBeNull();
	});
});

describe("tree sprites: drawing", () => {
	it("bodies stay inside their tiles and paint something of their own", () => {
		const bad: string[] = [];
		const seen = new Map<string, string>();
		for (const id of IDS) {
			const def = defOf(id);
			const r = recorder();
			drawBody(r.g, def, 0, TOP);
			if (r.rects.length < 30) bad.push(`${id}: only ${r.rects.length} rects`);
			for (const q of r.rects) if (!(Number.isFinite(q.x + q.y + q.w + q.h) && q.x >= 0 && q.x + q.w <= def.width * TILE && q.y >= TOP && q.y + q.h <= TOP + FAC_BOTTOM)) bad.push(`${id}: ${q.x},${q.y} ${q.w}x${q.h}`);
			const s = sig(r.rects);
			const twin = seen.get(s);
			if (twin) bad.push(`${id} draws the same pixels as ${twin}`);
			seen.set(s, id);
		}
		expect(bad).toEqual([]);
	});
	it("live details stay inside, in every status, still and moving", () => {
		const bad: string[] = [];
		for (const id of IDS)
			for (const status of ["ok", "idle", "throttled", "failed", "tripped", "unpowered"] as const)
				for (const minute of [0, 780])
					for (const rm of [false, true]) {
						const def = defOf(id);
						const r = recorder();
						drawLive(r.g, def, view(def, status), 0, TOP, 3.3, { ...OPT, reducedMotion: rm }, undefined, { ...NO_FX, minute, tick: 99 });
						// Badge sits at TOP + 1; steam may rise 3 px above the body.
						for (const q of r.rects) if (!(Number.isFinite(q.x + q.y + q.w + q.h) && q.x >= 0 && q.x + q.w <= def.width * TILE && q.y >= TOP - 1 && q.y + q.h <= TOP + FAC_BOTTOM)) bad.push(`${id} ${status}: ${q.x},${q.y} ${q.w}x${q.h}`);
					}
		expect(bad).toEqual([]);
	});
	it("animates over time when running, and holds still under reduced motion", () => {
		for (const id of IDS) {
			const def = defOf(id);
			const at = (t: number, rm: boolean): string => {
				const r = recorder();
				drawLive(r.g, def, view(def), 0, TOP, t, { ...OPT, reducedMotion: rm }, undefined, { ...NO_FX, minute: 780, tick: 99 });
				return sig(r.rects);
			};
			expect(at(1.0, false) === at(1.7, false), `${id} should animate`).toBe(false);
			expect(at(1.0, true), `${id} should hold still under reduced motion`).toBe(at(1.7, true));
		}
	});
	it("a stopped facility draws no moving light", () => {
		for (const id of ["rack_neuromorphic", "rack_neuromorphic2", "rack_photonic", "rack_photonic2"]) {
			const def = defOf(id);
			const at = (t: number): string => {
				const r = recorder();
				drawLive(r.g, def, view(def, "unpowered", { enabled: true }), 0, TOP, t, OPT, undefined, NO_FX);
				// The status badge above the body blinks on its own; only the cabinets count.
				return sig(r.rects.filter((q) => q.y >= TOP + FAC_TOP));
			};
			expect(at(1.0), id).toBe(at(1.7));
		}
	});
});
