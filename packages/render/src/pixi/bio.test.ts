import type { SimView } from "@aitower/sim";
import type { Graphics } from "pixi.js";
import { describe, expect, it } from "vitest";
import { createVarietyScene } from "../dev/varietyScene";
import { horrorStages } from "../horror";
import { Bots } from "./bots";
import { drawNutrient } from "./conduits";
import { HorrorLayer } from "./horror";
import { fixtureContent } from "../dev/fixtureView";
import { varietyContent } from "../dev/varietyScene";

interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
	color: number;
	alpha: number;
}
function recorder(): { g: Graphics; rects: Rect[] } {
	const rects: Rect[] = [];
	let cur: Rect | null = null;
	const g = {
		clear() {
			rects.length = 0;
		},
		rect(x: number, y: number, w: number, h: number) {
			cur = { x, y, w, h, color: -1, alpha: 1 };
			rects.push(cur);
			return g;
		},
		fill(o: { color: number; alpha?: number }) {
			if (cur) {
				cur.color = o.color;
				cur.alpha = o.alpha ?? 1;
			}
			return g;
		},
		poly() {
			return g;
		},
	};
	return { g: g as unknown as Graphics, rects };
}
const content = varietyContent(fixtureContent);
const view = (): SimView => createVarietyScene().view;

describe("nutrient conduit layer", () => {
	it("draws a pale-green line on every nutrient cell, with hangers and ends, and nothing without nutrient", () => {
		const v = view();
		const r = recorder();
		drawNutrient(r.g, v);
		expect(r.rects.length).toBeGreaterThan(50);
		const none = recorder();
		drawNutrient(none.g, { ...v, nutrient: new Uint8Array(v.nutrient.length) });
		expect(none.rects.length).toBe(0);
	});
	it("the overlay colour callback paints every cell with its own colour", () => {
		const v = view();
		const r = recorder();
		drawNutrient(r.g, v, () => 0x123456);
		expect(r.rects.length).toBeGreaterThan(0);
		expect(r.rects.some((q) => q.color === 0x123456)).toBe(true);
	});
	it("links vertically adjacent nutrient cells with a riser", () => {
		const v = view();
		const w = v.width;
		const nut = new Uint8Array(v.nutrient.length);
		nut[0 * w + 5] = 1;
		nut[1 * w + 5] = 1;
		const r = recorder();
		drawNutrient(r.g, { ...v, nutrient: nut });
		expect(r.rects.some((q) => q.h >= 40 && q.w <= 2)).toBe(true);
	});
});

describe("mutated bots", () => {
	const pos = (b: { x: number; floor: number }) => ({ x: b.x, y: b.floor });
	const vel = () => ({ x: 0, y: 0 });
	const bots = new Bots(content);
	const rects = (v: SimView, h?: ReturnType<typeof horrorStages>): number => {
		const g = bots.g;
		bots.draw(v, pos, vel, 1, { reducedMotion: false }, h);
		return g.context.instructions.length;
	};
	const withTrait = (trait: "fleshed" | "tendriled" | null): SimView => {
		const v = view();
		return { ...v, bots: v.bots.filter((b) => b.id === 1).map((b) => ({ ...b, trait })) };
	};
	it("fleshed gets a flesh patch, tendriled gets tendrils; plain bots get nothing", () => {
		const full = horrorStages(2, 0.5, "full");
		const base = rects(withTrait(null), full);
		expect(rects(withTrait("fleshed"), full)).toBeGreaterThan(base);
		expect(rects(withTrait("tendriled"), full)).toBeGreaterThan(base);
		expect(rects(withTrait("tendriled"), full)).toBeGreaterThan(rects(withTrait("fleshed"), full));
	});
	it("the second eye needs the eyes stage at full intensity", () => {
		const t = withTrait("fleshed");
		const early = rects(t, horrorStages(2, 0.5, "full"));
		expect(rects(t, horrorStages(3, 0.8, "full"))).toBeGreaterThan(early);
		expect(rects(t, horrorStages(3, 0.8, "mild"))).toBe(early);
	});
	it("with horror off a plain amber band marks the trait instead", () => {
		const t = withTrait("fleshed");
		const off = rects(t, horrorStages(3, 0.8, "off"));
		expect(off).toBeGreaterThan(rects(withTrait(null), horrorStages(3, 0.8, "off")));
		expect(off).toBeLessThan(rects(t, horrorStages(2, 0.5, "full")));
	});
	it("no horror argument draws the plain bot", () => {
		expect(rects(withTrait("fleshed"))).toBe(rects(withTrait(null)));
	});
});

describe("horror decal layer", () => {
	const count = (s: ReturnType<typeof horrorStages>): number => {
		const l = new HorrorLayer();
		l.rebuild(view(), 1, s);
		return l.decals.context.instructions.length;
	};
	it("draws nothing before stage 1 or when off; more at every higher stage", () => {
		expect(count(horrorStages(0, 0, "full"))).toBe(0);
		expect(count(horrorStages(4, 1, "off"))).toBe(0);
		const c = [1, 2, 4].map((st) => count(horrorStages(st as 1 | 2 | 4, [0, 0.25, 0.5, 0.75, 1][st], "full")));
		expect(c[0]).toBeGreaterThan(0);
		expect(c[1]).toBeGreaterThan(c[0]);
		expect(c[2]).toBeGreaterThan(c[1]);
	});
	it("only rebuilds when the layout or the stage key changes", () => {
		const l = new HorrorLayer();
		const s = horrorStages(2, 0.5, "full");
		expect(l.needsRebuild(7, s)).toBe(true);
		l.rebuild(view(), 7, s);
		expect(l.needsRebuild(7, s)).toBe(false);
		expect(l.needsRebuild(8, s)).toBe(true);
		expect(l.needsRebuild(7, horrorStages(2, 0.5, "mild"))).toBe(true);
		expect(l.needsRebuild(7, horrorStages(2, 0.51, "full"))).toBe(false);
	});
	it("walls breathe only from stage 3, and hold still under reduced motion", () => {
		const l = new HorrorLayer();
		const v = view();
		const opt = (rm: boolean) => ({ reducedMotion: rm, crtEffects: true, colorBlind: false, horrorIntensity: "full" as const });
		const calm = horrorStages(2, 0.5, "full");
		const breathing = horrorStages(3, 0.8, "full");
		l.updateBreath(v, calm, 3, opt(false));
		expect(l.breath.context.instructions.length).toBe(0);
		l.updateBreath(v, breathing, 1, opt(false)); // frame 0
		expect(l.breath.context.instructions.length).toBe(0);
		l.updateBreath(v, breathing, 3, opt(false)); // frame 1: inflated
		expect(l.breath.context.instructions.length).toBeGreaterThan(0);
		l.updateBreath(v, breathing, 3, opt(true));
		expect(l.breath.context.instructions.length).toBe(0);
	});
	it("beads and vein pulses move only when motion is allowed", () => {
		const l = new HorrorLayer();
		l.rebuild(view(), 1, horrorStages(2, 0.5, "full"));
		const vp = { x0: -1e6, x1: 1e6, y0: -1e6, y1: 1e6 };
		const s = horrorStages(2, 0.5, "full");
		l.update(vp, s, 1, { reducedMotion: false, crtEffects: true, colorBlind: false, horrorIntensity: "full" });
		expect(l.live.context.instructions.length).toBeGreaterThan(0);
		l.update(vp, s, 1, { reducedMotion: true, crtEffects: true, colorBlind: false, horrorIntensity: "full" });
		expect(l.live.context.instructions.length).toBe(0);
	});
});

