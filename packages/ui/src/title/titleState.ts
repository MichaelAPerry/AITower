/** Pure logic for the title screen: when it shows, which entries it offers, and how a pick starts the game. */
import type { GameStore, SaveSlotInfo } from "@aitower/shared";
import { fmtMoney } from "../format";

/** Shown at boot unless the URL has ?new (the e2e smoke test relies on that). */
export const showTitleAtBoot = (search: string): boolean => !new URLSearchParams(search).has("new");

export type TitleItem = "continue" | "lesson" | "new" | "load" | "achievements" | "settings" | "controls";

/**
 * The entries to offer for the saves found. Continue needs the autosave; Load needs any save. The lesson comes right after
 * Continue, so a first visit lands on "Start Lesson 1" (the default); Free Build (the scenarios) follows.
 */
export function titleItems(saves: readonly SaveSlotInfo[]): TitleItem[] {
	const items: TitleItem[] = [];
	if (saves.some((s) => s.id === "auto")) items.push("continue");
	items.push("lesson", "new");
	if (saves.length > 0) items.push("load");
	items.push("achievements", "settings", "controls");
	return items;
}

/** "just now", "5 min ago", "3 h ago", "2 d ago". */
export function agoText(ms: number, now: number): string {
	const m = Math.max(0, Math.floor((now - ms) / 60_000));
	if (m < 1) return "just now";
	if (m < 60) return `${m} min ago`;
	const h = Math.floor(m / 60);
	if (h < 48) return `${h} h ago`;
	return `${Math.floor(h / 24)} d ago`;
}

/** The Continue line: "DAY 11 · $1.10M · TIER 2 · 3 h ago". */
export const continueSummary = (info: SaveSlotInfo, now: number): string => `DAY ${info.day} · ${fmtMoney(info.cash)} · TIER ${info.tier} · ${agoText(info.savedAt, now)}`;

/** What lives behind the menu: the player's saved tower when an autosave exists (the game boots from it), else the starter demo tower. */
export type Backdrop = { kind: "save"; day: number; tier: number } | { kind: "demo" };

export function titleBackdrop(saves: readonly SaveSlotInfo[] | null): Backdrop {
	const auto = saves?.find((s) => s.id === "auto");
	return auto ? { kind: "save", day: auto.day, tier: auto.tier } : { kind: "demo" };
}

export const backdropCaption = (b: Backdrop): string => (b.kind === "save" ? `YOUR TOWER · DAY ${b.day} · LEVEL ${b.tier}` : "DEMO TOWER");

/**
 * Leave the title screen into a game. Continue plays the loaded autosave at 1×. A lesson starts its scripted site paused (the
 * teacher's first line starts the clock). Free Build starts a fresh site of the chosen scenario (the standard start when none is
 * given); with `crawl`, the clock stays stopped: the opening crawl plays first and the HUD sets the speed when it ends.
 */
export function startGame(store: GameStore, how: { kind: "continue" } | { kind: "lesson"; scenarioId: string } | { kind: "new"; scenarioId?: string; crawl?: boolean }): void {
	if (how.kind === "continue") {
		store.setSpeed(1);
		return;
	}
	if (how.kind === "lesson") {
		store.newGame(undefined, how.scenarioId);
		store.setSpeed(0);
		return;
	}
	if (how.scenarioId) store.newGame(undefined, how.scenarioId);
	else store.newGame();
	store.setSpeed(how.crawl ? 0 : 1);
}
