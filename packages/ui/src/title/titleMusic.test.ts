import { afterEach, describe, expect, it, vi } from "vitest";
import { createTitleMusic, MUSIC_CREDIT, SONG_ORDER, SONGS, musicLevel, songFor } from "./titleMusic";

describe("title music", () => {
	it("plays the title song on the normal title and the tree's song on an ending picture", () => {
		expect(songFor(undefined)).toBe("title");
		expect(songFor("garden")).toBe("garden");
		expect(songFor("lattice")).toBe("lattice");
		expect(songFor("flesh")).toBe("flesh");
	});
	it("scales by master and music volume, and is silent when muted", () => {
		expect(musicLevel({ masterVolume: 0.8, musicVolume: 0.5, muted: false })).toBeCloseTo(0.4);
		expect(musicLevel({ masterVolume: 1, musicVolume: 1, muted: true })).toBe(0);
		expect(musicLevel({ masterVolume: 2, musicVolume: 2, muted: false })).toBe(1);
	});
	it("has a titled song for each tree", () => {
		expect(SONG_ORDER).toEqual(["title", "garden", "lattice", "flesh", "tower", "warm", "quiet"]);
		for (const id of SONG_ORDER) expect(SONGS[id].title.length).toBeGreaterThan(0);
		expect(MUSIC_CREDIT).toContain("Suno");
	});
});

/** Fake Audio element that records every instance, its src and whether it is still sounding. */
class FakeAudio {
	static all: FakeAudio[] = [];
	loop = false;
	preload = "";
	volume = 1;
	paused = true;
	currentTime = 0;
	duration = 100;
	src = "";
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
	addEventListener() {}
}
const sounding = () => FakeAudio.all.filter((a) => !a.paused && a.src !== "");

describe("music hand-over from title to game", () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		FakeAudio.all = [];
	});
	it("stops the title song when the game starts, then plays only the tower loop", async () => {
		vi.useFakeTimers();
		vi.stubGlobal("Audio", FakeAudio);
		const title = createTitleMusic();
		await title.play("title", 0.5);
		expect(sounding().length).toBe(1);
		const titleEl = FakeAudio.all[0];
		title.stop(); // TitleScreen unmounts when a game starts
		const game = createTitleMusic(); // GameMusic's player
		await game.play("tower", 0.5);
		vi.advanceTimersByTime(1000);
		expect(titleEl.paused).toBe(true);
		expect(titleEl.src).toBe("");
		const live = sounding();
		expect(live.length).toBe(1);
		expect(live[0]).not.toBe(titleEl);
		expect(live[0].loop).toBe(true);
		game.stop();
		vi.advanceTimersByTime(1000);
		expect(sounding().length).toBe(0);
	});
	it("only ever offers the session-5 songs (no old tracks)", () => {
		expect([...SONG_ORDER].sort()).toEqual(["flesh", "garden", "lattice", "quiet", "title", "tower", "warm"]);
	});
});
