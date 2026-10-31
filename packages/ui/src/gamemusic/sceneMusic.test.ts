import { achievementContent, loadContent } from "@aitower/content";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SONGS, createTitleMusic } from "../title/titleMusic";
import { currentScene, enterScene, trackForScene, wantedSong } from "./sceneMusic";

const storyIds = (): string[] =>
	Object.values(loadContent().events)
		.filter((e) => e.category === "story")
		.map((e) => e.id);
const galleryIds = (): string[] => achievementContent.scenes.map((s) => s.id);

describe("scene -> track mapping", () => {
	it("sends tense, closing and late-night scenes to the quiet song", () => {
		for (const id of ["obj_greentech", "obj_biotech", "seal_biotech", "seal_greentech", "tip_seal", "cass_night_shift", "ach_hint_mel", "ach_gallery_empty", "ach_bed_luci"]) {
			expect(trackForScene(id)).toBe("quiet");
		}
	});
	it("sends bonding, milestone and celebration scenes to the warm song", () => {
		for (const id of ["st_intro", "rung_syn_1", "rung_green_4", "bond50_cass", "tip_bond", "ach_unlock_bea", "ach_bed_intro"]) {
			expect(trackForScene(id)).toBe("warm");
		}
	});
	it("an unknown scene falls back to warm", () => {
		expect(trackForScene("something_new")).toBe("warm");
	});
	it("covers every real scene with one of the two songs (24 story + 14 gallery)", () => {
		const ids = [...storyIds(), ...galleryIds()];
		expect(ids.length).toBe(38);
		const counts = { warm: 0, quiet: 0 };
		for (const id of ids) counts[trackForScene(id)]++;
		expect(counts).toEqual({ warm: 23, quiet: 15 });
	});
	it("wants the tower loop in play, the scene's song in a scene, and silence off-game", () => {
		expect(wantedSong({ active: true, sceneId: null })).toBe("tower");
		expect(wantedSong({ active: true, sceneId: "seal_biotech" })).toBe("quiet");
		expect(wantedSong({ active: true, sceneId: "bond50_luci" })).toBe("warm");
		expect(wantedSong({ active: false, sceneId: "bond50_luci" })).toBeNull();
	});
	it("tracks open scenes as a stack", () => {
		expect(currentScene()).toBeNull();
		const a = enterScene("st_intro");
		const b = enterScene("seal_biotech");
		expect(currentScene()).toBe("seal_biotech");
		b();
		expect(currentScene()).toBe("st_intro");
		a();
		expect(currentScene()).toBeNull();
	});
	it("has all three new songs titled as tagged", () => {
		expect(SONGS.tower.title).toBe("深夜のゲーム");
		expect(SONGS.warm.title).toBe("夕陽のメロディ");
		expect(SONGS.quiet.title).toBe("Noctune FM");
	});
});

class FakeAudio {
	static all: FakeAudio[] = [];
	loop = false;
	preload = "";
	volume = 1;
	paused = true;
	currentTime = 0;
	duration = 200;
	src = "";
	listeners: Record<string, () => void> = {};
	constructor() {
		FakeAudio.all.push(this);
	}
	play() {
		this.paused = false;
		return Promise.resolve();
	}
	pause() {
		this.paused = true;
	}
	removeAttribute() {
		this.src = "";
	}
	addEventListener(n: string, f: () => void) {
		this.listeners[n] = f;
	}
}

describe("crossfade", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		FakeAudio.all = [];
		vi.stubGlobal("Audio", FakeAudio);
		for (const id of ["tower", "warm", "quiet"] as const) SONGS[id].load = async () => `${id}.mp3`;
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("loops, fades the old song out while the new one fades in, then pauses the old one", async () => {
		const m = createTitleMusic();
		await m.play("tower", 0.5);
		const tower = FakeAudio.all[0] as FakeAudio;
		expect(tower.loop).toBe(true);
		vi.advanceTimersByTime(1000);
		expect(tower.volume).toBeCloseTo(0.5);
		tower.currentTime = 42;
		await m.play("warm", 0.5);
		const warm = FakeAudio.all[1] as FakeAudio;
		expect(warm.src).toBe("warm.mp3");
		vi.advanceTimersByTime(300);
		expect(tower.volume).toBeLessThan(0.5);
		expect(warm.volume).toBeGreaterThan(0);
		expect(tower.paused).toBe(false); // both audible mid-fade
		vi.advanceTimersByTime(1000);
		expect(tower.paused).toBe(true);
		expect(warm.volume).toBeCloseTo(0.5);
		// back to the tower loop: it resumes where it was left
		await m.play("tower", 0.5);
		const again = FakeAudio.all[2] as FakeAudio;
		again.listeners.loadedmetadata?.();
		expect(again.currentTime).toBe(42);
		m.stop();
	});

	it("muting pauses and the level follows the settings; staying on the same song makes no new player", async () => {
		const m = createTitleMusic();
		await m.play("tower", 0.4);
		await m.play("tower", 0.4);
		expect(FakeAudio.all.length).toBe(1);
		m.setLevel(0);
		expect((FakeAudio.all[0] as FakeAudio).paused).toBe(true);
		m.setLevel(0.3);
		expect((FakeAudio.all[0] as FakeAudio).paused).toBe(false);
		expect((FakeAudio.all[0] as FakeAudio).volume).toBeCloseTo(0.3);
		m.stop();
		vi.advanceTimersByTime(1000);
		expect((FakeAudio.all[0] as FakeAudio).paused).toBe(true);
	});
});
