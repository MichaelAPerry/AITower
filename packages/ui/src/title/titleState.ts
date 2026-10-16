/** Pure logic for the title screen: when it shows, which entries it offers, and how a pick starts the game. */
import type { GameStore, SaveSlotInfo } from "@aitower/shared";
import { fmtMoney } from "../format";

/** Shown at boot unless the URL has ?new (the e2e smoke test relies on that). */
export const showTitleAtBoot = (search: string): boolean => !new URLSearchParams(search).has("new");

export type TitleItem = "continue" | "new" | "load" | "settings" | "controls";

/**
 * The entries to offer for the saves found. Continue needs the autosave; Load needs any save.
 * With no saves (first visit) only New game, Settings and Controls remain.
 */
export function titleItems(saves: readonly SaveSlotInfo[]): TitleItem[] {
	const items: TitleItem[] = [];
	if (saves.some((s) => s.id === "auto")) items.push("continue");
	items.push("new");
	if (saves.length > 0) items.push("load");
	items.push("settings", "controls");
	return items;
}

/** The induction box is ticked by default on a first visit and when there is nothing to continue. */
export const inductionDefault = (saves: readonly SaveSlotInfo[]): boolean => saves.length === 0;

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

export interface StartHooks {
	/** Reopen the induction from step 1. */
	restartInduction(): void;
	/** Close the induction for good. */
	closeInduction(): void;
}

/**
 * Leave the title screen into a game. Continue plays the loaded autosave at 1×. New game starts a fresh site;
 * with the induction on, the induction takes over the clock (its first memo stops it) instead of running at 1×.
 */
export function startGame(store: GameStore, how: { kind: "continue" } | { kind: "new"; induction: boolean }, hooks: StartHooks): void {
	if (how.kind === "continue") {
		store.setSpeed(1);
		return;
	}
	store.newGame();
	if (how.induction) {
		hooks.restartInduction();
		store.setSpeed(0);
	} else {
		hooks.closeInduction();
		store.setSpeed(1);
	}
}
