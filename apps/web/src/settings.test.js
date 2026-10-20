import { DEFAULT_SETTINGS } from "@aitower/shared";
import { loadContent } from "@aitower/content";
import { describe, expect, it } from "vitest";
import { SETTINGS_KEY, loadSettings, mergeSettings } from "./settings";
import { createMemoryBackend } from "./saveBackend";
import { createGameStore } from "./store";
import { fakeAudio, fakeRenderer, memoryStorage } from "./testUtils";
const content = loadContent();
describe("loadSettings", () => {
    it("defaults when nothing is stored, with the OS reduced-motion preference", () => {
        expect(loadSettings(memoryStorage(), false)).toEqual(DEFAULT_SETTINGS);
        expect(loadSettings(memoryStorage(), true)).toEqual({ ...DEFAULT_SETTINGS, reducedMotion: true });
        expect(loadSettings(null, false)).toEqual(DEFAULT_SETTINGS);
    });
    it("treats garbage as not stored", () => {
        for (const bad of ["{oops", "42", "null", '"x"'])
            expect(loadSettings(memoryStorage({ [SETTINGS_KEY]: bad }), true)).toEqual({ ...DEFAULT_SETTINGS, reducedMotion: true });
    });
    it("normalises stored values and keeps a stored reducedMotion over the OS preference", () => {
        const s = loadSettings(memoryStorage({ [SETTINGS_KEY]: JSON.stringify({ masterVolume: 7, textScale: "big", reducedMotion: false, horrorIntensity: "mild" }) }), true);
        expect(s).toMatchObject({ masterVolume: 1, textScale: 1, reducedMotion: false, horrorIntensity: "mild" });
    });
});
describe("mergeSettings", () => {
    it("ignores undefined and clamps", () => {
        const s = mergeSettings({ ...DEFAULT_SETTINGS, crtEffects: false }, { masterVolume: 5, muted: undefined });
        expect(s.masterVolume).toBe(1);
        expect(s.crtEffects).toBe(false);
        expect(s.muted).toBe(false);
    });
});
describe("store settings", () => {
    const make = (init = {}, prefersReducedMotion = false) => {
        const storage = memoryStorage(init);
        const { audio, calls } = fakeAudio();
        const { renderer, options } = fakeRenderer();
        const store = createGameStore(content, renderer, audio, { backend: createMemoryBackend(), storage, prefersReducedMotion });
        return { storage, store, calls, options };
    };
    it("applies initial settings to audio and renderer at boot", () => {
        const { store, calls, options } = make({}, true);
        expect(calls).toEqual(["muted:false", "volume:0.8", "music:0.6", "horror:full"]);
        expect(options).toEqual([{ reducedMotion: true, crtEffects: true, colorBlind: false, horrorIntensity: "full" }]);
        expect(store.get().settings.reducedMotion).toBe(true);
    });
    it("setSettings merges, normalises, persists and applies", () => {
        const { store, storage, calls, options } = make();
        store.setSettings({ masterVolume: 0.3, colorBlind: true, crtEffects: false, horrorIntensity: "off", textScale: 9 });
        const s = store.get().settings;
        expect(s).toMatchObject({ masterVolume: 0.3, colorBlind: true, crtEffects: false, horrorIntensity: "off", textScale: 1.5 });
        expect(JSON.parse(storage.data.get(SETTINGS_KEY))).toEqual(s);
        expect(calls.slice(-4)).toEqual(["muted:false", "volume:0.3", "music:0.6", "horror:off"]);
        expect(options.at(-1)).toEqual({ reducedMotion: false, crtEffects: false, colorBlind: true, horrorIntensity: "off" });
    });
    it("keeps muted in sync, and setMuted persists", () => {
        const { store, storage, calls } = make();
        store.setMuted(true);
        expect(store.get().muted).toBe(true);
        expect(store.get().settings.muted).toBe(true);
        expect(calls.at(-4)).toBe("muted:true");
        expect(JSON.parse(storage.data.get(SETTINGS_KEY)).muted).toBe(true);
    });
    it("survives a reload (new store, same storage)", () => {
        const a = make();
        a.store.setSettings({ masterVolume: 0.1, autosave: false, reducedMotion: true });
        const b = make(Object.fromEntries(a.storage.data));
        expect(b.store.get().settings).toEqual(a.store.get().settings);
        expect(b.options[0]?.reducedMotion).toBe(true);
    });
    it("does not throw when storage or audio fail", () => {
        const { store } = make();
        expect(() => store.setSettings({ muted: true })).not.toThrow();
        const bad = createGameStore(content, null, { resume: async () => { }, update: () => { }, destroy: () => { }, setMuted: () => { throw new Error("x"); }, setVolume: () => { }, setMusicVolume: () => { }, setHorrorIntensity: () => { } }, { backend: createMemoryBackend(), storage: null, prefersReducedMotion: false });
        expect(() => bad.setSettings({ muted: true })).not.toThrow();
        expect(bad.get().settings.muted).toBe(true);
    });
});
