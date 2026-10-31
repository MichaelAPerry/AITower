import type { SaveSlotInfo } from "@aitower/shared";
import { describe, expect, it, vi } from "vitest";
import { createFakeContent, createFakeStore } from "../dev/fakeStore";
import { agoText, backdropCaption, continueSummary, nextTitleEnding, showTitleAtBoot, startGame, titleBackdrop, titleItems, unlockedTitleEndings } from "./titleState";

describe("title ending pictures", () => {
	const earned = (o: Record<string, number | undefined>) => ({ earned: Object.fromEntries(Object.entries(o).map(([k, at]) => [k, { day: 30, ending: null, at }])) });
	it("none: nothing, and failure endings never count", () => {
		expect(unlockedTitleEndings(earned({}))).toEqual([]);
		expect(unlockedTitleEndings(earned({ end_absorbed: 5, end_bankrupt: 6, fast_win: 7 }))).toEqual([]);
	});
	it("one", () => {
		expect(unlockedTitleEndings(earned({ end_flesh: 10 }))).toEqual(["flesh"]);
	});
	it("several: most recent first, failures ignored", () => {
		expect(unlockedTitleEndings(earned({ end_lattice: 10, end_garden: 30, end_flesh: 20, end_bankrupt: 99 }))).toEqual(["garden", "flesh", "lattice"]);
	});
	it("older profiles without a time keep a fixed order, and sort after timed ones", () => {
		expect(unlockedTitleEndings(earned({ end_garden: undefined, end_lattice: undefined }))).toEqual(["lattice", "garden"]);
		expect(unlockedTitleEndings(earned({ end_lattice: undefined, end_flesh: 5 }))).toEqual(["flesh", "lattice"]);
	});
	it("cycling wraps and starts at the first", () => {
		const l = ["garden", "flesh", "lattice"] as const;
		expect(nextTitleEnding([], undefined)).toBeUndefined();
		expect(nextTitleEnding(l, undefined)).toBe("garden");
		expect(nextTitleEnding(l, "garden")).toBe("flesh");
		expect(nextTitleEnding(l, "lattice")).toBe("garden");
		expect(nextTitleEnding(["flesh"], "flesh")).toBe("flesh");
	});
});

const info = (id: SaveSlotInfo["id"], savedAt = 0): SaveSlotInfo => ({ id, name: id, savedAt, day: 11, cash: 1_103_200, tier: 2 });

describe("title screen state", () => {
	it("shows at boot unless the URL has ?new (the e2e smoke test relies on that)", () => {
		expect(showTitleAtBoot("")).toBe(true);
		expect(showTitleAtBoot("?seed=7")).toBe(true);
		expect(showTitleAtBoot("?new")).toBe(false);
		expect(showTitleAtBoot("?new&seed=7")).toBe(false);
		expect(showTitleAtBoot("?seed=7&new=1")).toBe(false);
	});

	it("first visit with no saves offers Start Lesson 1 first, then Free Build, Settings and Controls", () => {
		expect(titleItems([])).toEqual(["lesson", "new", "achievements", "settings", "controls", "credits"]);
	});

	it("with an autosave it offers Continue first, then the lesson, Free Build, Load, Settings, Controls", () => {
		expect(titleItems([info("auto"), info("slot1")])).toEqual(["continue", "lesson", "new", "load", "achievements", "settings", "controls", "credits"]);
	});

	it("manual saves alone give Load but no Continue", () => {
		expect(titleItems([info("slot2")])).toEqual(["lesson", "new", "load", "achievements", "settings", "controls", "credits"]);
	});

	it("describes how long ago the autosave was written", () => {
		const now = 10_000_000_000;
		expect(agoText(now - 20_000, now)).toBe("just now");
		expect(agoText(now - 5 * 60_000, now)).toBe("5 min ago");
		expect(agoText(now - 3 * 3600_000, now)).toBe("3 h ago");
		expect(agoText(now - 72 * 3600_000, now)).toBe("3 d ago");
		expect(continueSummary(info("auto", now - 3 * 3600_000), now)).toBe("DAY 11 · $1.10M · TIER 2 · 3 h ago");
	});

	it("the game is held paused until the player picks; Continue resumes at 1x", () => {
		const store = createFakeStore(createFakeContent());
		store.setSpeed(0);
		startGame(store, { kind: "continue" });
		expect(store.get().speed).toBe(1);
	});

	it("Start Lesson begins the lesson's site and leaves the clock stopped for the teacher", () => {
		const store = createFakeStore(createFakeContent());
		const newGame = vi.spyOn(store, "newGame");
		startGame(store, { kind: "lesson", scenarioId: "lesson_first_watt" });
		expect(newGame).toHaveBeenCalledWith(undefined, "lesson_first_watt");
		expect(store.get().speed).toBe(0);
	});

	it("Free Build starts a fresh site: stopped for the crawl, else at 1x", () => {
		const store = createFakeStore(createFakeContent());
		const newGame = vi.spyOn(store, "newGame");
		startGame(store, { kind: "new", crawl: true });
		expect(newGame).toHaveBeenCalledTimes(1);
		expect(store.get().speed).toBe(0);
		startGame(store, { kind: "new", scenarioId: "brownfield" });
		expect(store.get().speed).toBe(1);
	});
});

const base = (id: SaveSlotInfo["id"]): SaveSlotInfo => ({ id, name: id, savedAt: 1, day: 1, cash: 1, tier: 1 });

describe("titleBackdrop", () => {
	const info = (id: SaveSlotInfo["id"], day = 5, tier = 3): SaveSlotInfo => ({ ...base(id), day, tier });
	it("shows the saved tower when an autosave exists", () => {
		expect(titleBackdrop([info("slot1"), info("auto", 12, 4)])).toEqual({ kind: "save", day: 12, tier: 4 });
		expect(backdropCaption(titleBackdrop([info("auto", 12, 4)]))).toBe("YOUR TOWER · DAY 12 · LEVEL 4");
	});
	it("falls back to the demo tower with no autosave, no saves, or before the saves load", () => {
		expect(titleBackdrop([info("slot1")])).toEqual({ kind: "demo" });
		expect(titleBackdrop([])).toEqual({ kind: "demo" });
		expect(titleBackdrop(null)).toEqual({ kind: "demo" });
		expect(backdropCaption({ kind: "demo" })).toBe("DEMO TOWER");
	});
});
