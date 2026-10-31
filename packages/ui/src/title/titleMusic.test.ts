import { describe, expect, it } from "vitest";
import { MUSIC_CREDIT, SONG_ORDER, SONGS, musicLevel, songFor } from "./titleMusic";

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
