import { describe, expect, it } from "vitest";
import { Interpolator, effectiveAlpha, hashArrays, lerpSample } from "./interp";
import { badgeFor, ledCue, LED } from "./status";

describe("interpolation", () => {
	it("lerps between the last two ticks", () => {
		const it2 = new Interpolator();
		it2.beginTick();
		it2.push(1, 0, 0);
		it2.endTick();
		expect(it2.get(1, 0.5)).toEqual({ x: 0, y: 0 });
		it2.beginTick();
		it2.push(1, 1, 0.5);
		it2.endTick();
		expect(it2.get(1, 0)).toEqual({ x: 0, y: 0 });
		expect(it2.get(1, 0.5)).toEqual({ x: 0.5, y: 0.25 });
		expect(it2.get(1, 1)).toEqual({ x: 1, y: 0.5 });
		expect(it2.velocity(1)).toEqual({ x: 1, y: 0.5 });
	});

	it("snaps on teleports and drops vanished ids", () => {
		const ip = new Interpolator(2);
		ip.beginTick();
		ip.push(1, 0, 0);
		ip.push(2, 0, 0);
		ip.endTick();
		ip.beginTick();
		ip.push(1, 10, 0);
		ip.endTick();
		expect(ip.get(1, 0)).toEqual({ x: 10, y: 0 });
		expect(ip.get(2, 0.5)).toBeNull();
		expect(ip.size).toBe(1);
	});

	it("clamps alpha and settles when paused", () => {
		expect(lerpSample({ x: 0, y: 0 }, { x: 2, y: 2 }, 2)).toEqual({ x: 2, y: 2 });
		expect(effectiveAlpha(0.3, 50, 250)).toBe(0.3);
		expect(effectiveAlpha(0, 400, 250)).toBe(1);
	});

	it("hash changes when array contents change", () => {
		const a = new Uint8Array([0, 1, 0]);
		const h1 = hashArrays(a);
		a[2] = 1;
		expect(hashArrays(a)).not.toBe(h1);
		expect(hashArrays(new Uint8Array([1]), new Uint8Array([]))).not.toBe(hashArrays(new Uint8Array([]), new Uint8Array([1])));
	});
});

describe("status cues", () => {
	it("maps LEDs per spec", () => {
		expect(ledCue("ok", true).color).toBe(LED.ok);
		expect(ledCue("throttled", true).color).toBe(LED.amber);
		expect(ledCue("tripped", true).color).toBe(LED.red);
		expect(ledCue("failed", true).mode).toBe("blink");
		expect(ledCue("idle", true).color).toBe(LED.idle);
		expect(ledCue("unpowered", true).mode).toBe("off");
		expect(ledCue("ok", false).mode).toBe("off");
	});
	it("badges", () => {
		expect(badgeFor("failed")).toBe("wrench");
		expect(badgeFor("noCoolant")).toBe("noCoolant");
		expect(badgeFor("unpowered")).toBe("noPower");
		expect(badgeFor("ok")).toBeNull();
	});
});
