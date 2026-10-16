import { describe, expect, it } from "vitest";
import { DEFAULT_RENDER_OPTIONS, Presentation, changedOptions } from "./presentation";

describe("presentation options", () => {
	it("starts from the defaults: motion and colour-blind off, CRT effects on, full horror", () => {
		const p = new Presentation();
		expect(p.options).toEqual({ reducedMotion: false, crtEffects: true, colorBlind: false, horrorIntensity: "full" });
		expect(p.horrorIntensity).toBe("full");
		expect(DEFAULT_RENDER_OPTIONS.crtEffects).toBe(true);
	});

	it("reports exactly the keys that changed", () => {
		const p = new Presentation();
		expect(p.set({ ...DEFAULT_RENDER_OPTIONS, colorBlind: true })).toEqual(["colorBlind"]);
		expect(p.set({ ...DEFAULT_RENDER_OPTIONS, colorBlind: true, reducedMotion: true, crtEffects: false })).toEqual(["reducedMotion", "crtEffects"]);
		expect(p.options.colorBlind).toBe(true);
		expect(p.options.reducedMotion).toBe(true);
		expect(p.options.crtEffects).toBe(false);
	});

	it("is idempotent: repeating the same values changes nothing", () => {
		const p = new Presentation();
		const o = { ...DEFAULT_RENDER_OPTIONS, colorBlind: true };
		p.set(o);
		const before = p.options;
		for (let i = 0; i < 1000; i++) expect(p.set({ ...o })).toEqual([]);
		expect(p.options).toBe(before);
	});

	it("stores horrorIntensity without reporting a visual change beyond the key itself", () => {
		const p = new Presentation();
		expect(p.set({ ...DEFAULT_RENDER_OPTIONS, horrorIntensity: "mild" })).toEqual(["horrorIntensity"]);
		expect(p.horrorIntensity).toBe("mild");
		expect(p.set({ ...DEFAULT_RENDER_OPTIONS, horrorIntensity: "off" })).toEqual(["horrorIntensity"]);
		expect(p.horrorIntensity).toBe("off");
	});

	it("keeps its own copy, so later mutation of the caller's object has no effect", () => {
		const p = new Presentation();
		const o = { ...DEFAULT_RENDER_OPTIONS };
		p.set(o);
		o.colorBlind = true;
		expect(p.options.colorBlind).toBe(false);
	});

	it("changedOptions compares every key", () => {
		expect(changedOptions(DEFAULT_RENDER_OPTIONS, DEFAULT_RENDER_OPTIONS)).toEqual([]);
		expect(changedOptions(DEFAULT_RENDER_OPTIONS, { ...DEFAULT_RENDER_OPTIONS, reducedMotion: true })).toEqual(["reducedMotion"]);
	});
});
