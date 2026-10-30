import { loadContent } from "@aitower/content";
import type { FacilityView } from "@aitower/sim";
import type { Graphics } from "pixi.js";
import { afterEach, describe, expect, it } from "vitest";
import { NO_FX } from "./horror";
import { drawLive } from "./pixi/facilityArt";
import { SHUT_SECONDS, UPLOAD_SECONDS, doorOpen, forceTransfer, startTransfer, transferPhase, transferSeconds, uploadFraction, walkSeconds } from "./transferAnim";

afterEach(() => {
	for (const id of [1, 2, 7]) forceTransfer(id, null);
});

describe("transfer animation timing", () => {
	it("a run starts, advances with the clock and ends", () => {
		startTransfer(1, 10, 3);
		expect(transferPhase(1, 9.9)).toBeNull();
		expect(transferPhase(1, 11)?.s).toBeCloseTo(1, 6);
		expect(transferPhase(1, 10 + transferSeconds(3) + 0.1)).toBeNull();
		expect(transferPhase(1, 11)).toBeNull();
	});

	it("the door is open when the person arrives and shut when the upload begins", () => {
		const walk = 3;
		expect(doorOpen({ s: 0, walk })).toBe(0);
		expect(doorOpen({ s: walk, walk })).toBe(1);
		expect(doorOpen({ s: walk + SHUT_SECONDS, walk })).toBeCloseTo(0, 6);
		expect(doorOpen({ s: walk + SHUT_SECONDS + 1, walk })).toBe(0);
		expect(uploadFraction({ s: walk + SHUT_SECONDS - 0.1, walk })).toBe(0);
		expect(uploadFraction({ s: walk + SHUT_SECONDS + UPLOAD_SECONDS / 2, walk })).toBeCloseTo(0.5, 6);
		expect(uploadFraction({ s: walk + SHUT_SECONDS + UPLOAD_SECONDS + 1, walk })).toBe(1);
	});

	it("a walk lasts between 1.5 and 6 seconds, longer for a farther lift", () => {
		expect(walkSeconds(5)).toBe(1.5);
		expect(walkSeconds(72)).toBeCloseTo(4, 6);
		expect(walkSeconds(-72)).toBeCloseTo(4, 6);
		expect(walkSeconds(10_000)).toBe(6);
	});
});

interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
	c: number;
	a: number;
}

describe("the pod of the Consciousness Transfer Unit", () => {
	const content = loadContent();
	const def = content.facilities.consciousness_transfer;
	const view = { id: 7, defId: def.id, floor: 0, x: 0, width: def.width, enabled: true, status: "ok", tempC: 24, clock: 0.9, health: 1, powerKw: 90, heatKw: 0, jobId: null, powerNet: 0, coolantNet: null, nutrientNet: null, grown: false, contamination: 0 } as unknown as FacilityView;
	const draw = (t: number): string => {
		const rects: Rect[] = [];
		let cur: Rect | null = null;
		const g = {
			rect(x: number, y: number, w: number, h: number) {
				cur = { x, y, w, h, c: 0, a: 1 };
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
		drawLive(g as unknown as Graphics, def, view, 0, 100, t, { reducedMotion: true, crtEffects: false, colorBlind: false, horrorIntensity: "full" }, undefined, NO_FX);
		return rects.map((q) => `${q.x},${q.y},${q.w},${q.h},${q.c},${q.a}`).join(";");
	};

	it("looks different at each stage of a transfer, and the same again once it is over", () => {
		const idle = draw(5);
		const frames = [0.5, 3, 3.7, 4.5, 5.5].map((s) => {
			forceTransfer(7, s, 3);
			return draw(5);
		});
		expect(new Set([idle, ...frames]).size).toBe(frames.length + 1);
		forceTransfer(7, null);
		expect(draw(5)).toBe(idle);
	});
});
