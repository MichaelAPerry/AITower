import type { SaveSlotInfo } from "@aitower/shared";
import { describe, expect, it, vi } from "vitest";
import { createFakeContent, createFakeStore } from "../dev/fakeStore";
import { agoText, continueSummary, inductionDefault, showTitleAtBoot, startGame, titleItems } from "./titleState";

const info = (id: SaveSlotInfo["id"], savedAt = 0): SaveSlotInfo => ({ id, name: id, savedAt, day: 11, cash: 1_103_200, tier: 2 });

describe("title screen state", () => {
	it("shows at boot unless the URL has ?new (the e2e smoke test relies on that)", () => {
		expect(showTitleAtBoot("")).toBe(true);
		expect(showTitleAtBoot("?seed=7")).toBe(true);
		expect(showTitleAtBoot("?new")).toBe(false);
		expect(showTitleAtBoot("?new&seed=7")).toBe(false);
		expect(showTitleAtBoot("?seed=7&new=1")).toBe(false);
	});

	it("first visit with no saves offers only New game, Settings and Controls, induction on", () => {
		expect(titleItems([])).toEqual(["new", "settings", "controls"]);
		expect(inductionDefault([])).toBe(true);
	});

	it("with an autosave it offers Continue first, then New, Load, Settings, Controls; induction off by default", () => {
		const saves = [info("auto"), info("slot1")];
		expect(titleItems(saves)).toEqual(["continue", "new", "load", "settings", "controls"]);
		expect(inductionDefault(saves)).toBe(false);
	});

	it("manual saves alone give Load but no Continue", () => {
		expect(titleItems([info("slot2")])).toEqual(["new", "load", "settings", "controls"]);
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
		const hooks = { restartInduction: vi.fn(), closeInduction: vi.fn() };
		startGame(store, { kind: "continue" }, hooks);
		expect(store.get().speed).toBe(1);
		expect(hooks.restartInduction).not.toHaveBeenCalled();
		expect(hooks.closeInduction).not.toHaveBeenCalled();
	});

	it("New game with the induction ticked starts a fresh site, restarts the induction and leaves the clock stopped for its first memo", () => {
		const store = createFakeStore(createFakeContent());
		const newGame = vi.spyOn(store, "newGame");
		store.setSpeed(0);
		const hooks = { restartInduction: vi.fn(), closeInduction: vi.fn() };
		startGame(store, { kind: "new", induction: true }, hooks);
		expect(newGame).toHaveBeenCalledTimes(1);
		expect(hooks.restartInduction).toHaveBeenCalledTimes(1);
		expect(hooks.closeInduction).not.toHaveBeenCalled();
		expect(store.get().speed).toBe(0);
	});

	it("New game with the induction unticked closes the induction and runs at 1x", () => {
		const store = createFakeStore(createFakeContent());
		store.setSpeed(0);
		const hooks = { restartInduction: vi.fn(), closeInduction: vi.fn() };
		startGame(store, { kind: "new", induction: false }, hooks);
		expect(hooks.closeInduction).toHaveBeenCalledTimes(1);
		expect(hooks.restartInduction).not.toHaveBeenCalled();
		expect(store.get().speed).toBe(1);
	});
});
