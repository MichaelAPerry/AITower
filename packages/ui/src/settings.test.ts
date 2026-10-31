import { DEFAULT_SETTINGS, normalizeSettings } from "@aitower/shared";
import { describe, expect, it } from "vitest";
import { HEAT_RAMP_COLORBLIND, HEAT_RAMP_TEMPS, densityFor, effectiveHudScale, uiScaleFactor, heatRamp, hudScale, isSmallScreen, settingsToClasses, settingsToCssVars } from "./settings";

const s = (p: Partial<typeof DEFAULT_SETTINGS>) => ({ ...DEFAULT_SETTINGS, ...p });

describe("settings → CSS", () => {
	it("maps textScale to --hud-scale", () => {
		expect(settingsToCssVars(s({ textScale: 1 }))).toEqual({ "--hud-scale": "1" });
		expect(settingsToCssVars(s({ textScale: 1.5 }))).toEqual({ "--hud-scale": "1.5" });
		expect(settingsToCssVars(s({ textScale: 0.85 }))).toEqual({ "--hud-scale": "0.85" });
	});
	it("clamps stale or broken textScale values into 0.85..1.5", () => {
		expect(hudScale({ textScale: 3 })).toBe(1.5);
		expect(hudScale({ textScale: 0.2 })).toBe(0.85);
		expect(hudScale({ textScale: Number.NaN })).toBe(1);
		expect(hudScale({ textScale: "big" as unknown as number })).toBe(1);
		expect(settingsToCssVars(s({ textScale: 1.0000001 }))["--hud-scale"]).toBe("1");
	});
	it("emits root classes for reduced motion, colour-blind and CRT off", () => {
		expect(settingsToClasses(DEFAULT_SETTINGS)).toEqual([]);
		expect(settingsToClasses(s({ reducedMotion: true }))).toEqual(["is-reduced-motion"]);
		expect(settingsToClasses(s({ colorBlind: true }))).toEqual(["is-colorblind"]);
		expect(settingsToClasses(s({ crtEffects: false }))).toEqual(["no-crt"]);
		expect(settingsToClasses(s({ reducedMotion: true, colorBlind: true, crtEffects: false }))).toEqual(["is-reduced-motion", "is-colorblind", "no-crt"]);
	});
});

describe("heat ramp", () => {
	it("exports the plasma stops the renderer implements", () => {
		expect([...HEAT_RAMP_COLORBLIND]).toEqual(["#0d0887", "#6a00a8", "#b12a90", "#e16462", "#fca636", "#f0f921"]);
		expect(HEAT_RAMP_COLORBLIND.length).toBe(HEAT_RAMP_TEMPS.length);
	});
	it("switches the legend ramp and keeps the temperatures", () => {
		const std = heatRamp(false);
		const cb = heatRamp(true);
		expect(std.map(([t]) => t)).toEqual([18, 24, 30, 36, 42, 50]);
		expect(cb.map(([t]) => t)).toEqual([18, 24, 30, 36, 42, 50]);
		expect(std[0][1]).toBe("var(--heat-18)");
		expect(cb.map(([, c]) => c)).toEqual([...HEAT_RAMP_COLORBLIND]);
	});
});

describe("layout helpers", () => {
	it("derives density from the effective (zoomed) size", () => {
		expect(densityFor(1920, 1080, 1)).toBe("normal");
		expect(densityFor(1280, 720, 1)).toBe("tight");
		expect(densityFor(1280, 720, 0.85)).toBe("normal");
		expect(densityFor(1280, 720, 1.5)).toBe("cramped");
		expect(densityFor(1440, 900, 1.5)).toBe("cramped");
		expect(densityFor(1920, 1080, 1.5)).toBe("tight");
	});
	it("flags small screens below 1024 wide or 640 tall", () => {
		expect(isSmallScreen(1024, 640)).toBe(false);
		expect(isSmallScreen(1023, 900)).toBe(true);
		expect(isSmallScreen(1440, 639)).toBe(true);
		expect(isSmallScreen(390, 844)).toBe(true);
	});
});

describe("UI scale", () => {
	it("defaults to auto", () => {
		expect(DEFAULT_SETTINGS.uiScale).toBe("auto");
		expect(normalizeSettings({}).uiScale).toBe("auto");
	});
	it("keeps the three presets and repairs anything else to auto", () => {
		for (const u of [1, 1.25, 1.5]) expect(normalizeSettings({ uiScale: u }).uiScale).toBe(u);
		for (const bad of [2, "125", null, Number.NaN, "big"]) expect(normalizeSettings({ uiScale: bad }).uiScale).toBe("auto");
		expect(normalizeSettings({ uiScale: "auto" }).uiScale).toBe("auto");
	});
	it("auto picks 100% at 1280x720 and 1920x1080, 125% at 2560x1440, 150% at 4K", () => {
		const a = s({ uiScale: "auto" });
		expect(uiScaleFactor(a, 1280, 720)).toBe(1);
		expect(uiScaleFactor(a, 1920, 1080)).toBe(1);
		expect(uiScaleFactor(a, 2560, 1440)).toBe(1.25);
		expect(uiScaleFactor(a, 3840, 2160)).toBe(1.5);
		expect(uiScaleFactor(a, 3840, 1080)).toBe(1);
	});
	it("a fixed preset ignores the window and multiplies the text scale into --hud-scale", () => {
		expect(uiScaleFactor(s({ uiScale: 1.5 }), 1280, 720)).toBe(1.5);
		expect(settingsToCssVars(s({ uiScale: 1.25 }), { width: 1280, height: 720 })).toEqual({ "--hud-scale": "1.25" });
		expect(settingsToCssVars(s({ uiScale: 1.5, textScale: 1.1 }), { width: 1920, height: 1080 })).toEqual({ "--hud-scale": "1.65" });
		expect(settingsToCssVars(s({ uiScale: "auto" }), { width: 2560, height: 1440 })).toEqual({ "--hud-scale": "1.25" });
		expect(effectiveHudScale(s({ uiScale: 1.5 }), 1920, 1080)).toBe(1.5);
	});
});
