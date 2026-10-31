import { DEFAULT_SETTINGS, normalizeSettings } from "@aitower/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { publishAwards } from "../achievements/awardBus";
import { configureSfx, noticeSfx, playSfx, resetSfxForTests, sfxLevel } from "./sfx";

const listeners = new Map<string, () => void>();
let created = 0;
let started = 0;

function installAudio(): void {
	const param = () => ({ value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
	const node = () => ({ connect: (n: unknown) => n, gain: param(), frequency: param(), type: "", start: () => started++, stop: vi.fn() });
	class FakeCtx {
		state = "running";
		currentTime = 0;
		destination = {};
		constructor() {
			created++;
		}
		createGain = node;
		createOscillator = node;
		resume = async () => {};
	}
	vi.stubGlobal("AudioContext", FakeCtx);
	vi.stubGlobal("window", {
		addEventListener: (t: string, f: () => void) => listeners.set(t, f),
		removeEventListener: (t: string) => listeners.delete(t),
	});
}

afterEach(() => {
	vi.unstubAllGlobals();
	resetSfxForTests();
	listeners.clear();
	created = 0;
	started = 0;
});

describe("sfx settings", () => {
	it("defaults on, normalises and clamps", () => {
		expect(DEFAULT_SETTINGS.sfxEnabled).toBe(true);
		expect(normalizeSettings({}).sfxVolume).toBe(DEFAULT_SETTINGS.sfxVolume);
		expect(normalizeSettings({ sfxVolume: 4, sfxEnabled: false })).toMatchObject({ sfxVolume: 1, sfxEnabled: false });
		expect(normalizeSettings({ sfxEnabled: "yes", sfxVolume: "x" })).toMatchObject({ sfxEnabled: true, sfxVolume: DEFAULT_SETTINGS.sfxVolume });
	});
	it("master, effects volume, switch and mute all apply", () => {
		const s = { ...DEFAULT_SETTINGS, masterVolume: 0.5, sfxVolume: 0.5 };
		expect(sfxLevel(s)).toBeCloseTo(0.25);
		expect(sfxLevel({ ...s, sfxEnabled: false })).toBe(0);
		expect(sfxLevel({ ...s, muted: true })).toBe(0);
		expect(sfxLevel({ ...s, masterVolume: 0 })).toBe(0);
	});
});

describe("sfx playback", () => {
	it("is silent and safe without audio or before a gesture", () => {
		configureSfx(DEFAULT_SETTINGS);
		expect(() => playSfx("chime")).not.toThrow();
		installAudio();
		configureSfx(DEFAULT_SETTINGS);
		playSfx("chime");
		expect(created).toBe(0); // no gesture yet
	});
	it("plays after a gesture, and not when disabled", () => {
		installAudio();
		configureSfx(DEFAULT_SETTINGS);
		listeners.get("pointerdown")?.();
		playSfx("click");
		expect(created).toBe(1);
		expect(started).toBeGreaterThan(0);
		const n = started;
		configureSfx({ ...DEFAULT_SETTINGS, sfxEnabled: false });
		playSfx("complete");
		expect(started).toBe(n);
	});
	it("an achievement award plays the chime", () => {
		installAudio();
		configureSfx(DEFAULT_SETTINGS);
		listeners.get("keydown")?.();
		publishAwards({ won: [], portraits: [], bed: false });
		expect(started).toBe(0); // nothing earned, no sound
		publishAwards({ won: [{ id: "x" } as never], portraits: [], bed: false });
		expect(started).toBeGreaterThan(0);
	});
	it("warnings and errors raise the alert, others stay quiet", () => {
		expect(noticeSfx("error")).toBe("alert");
		expect(noticeSfx("warn")).toBe("alert");
		expect(noticeSfx("good")).toBeNull();
		expect(noticeSfx("info")).toBeNull();
	});
});
