import { fmtMoney } from "../format";
import { DEFAULT_SCENARIO } from "./scenarios";
/** Shown at boot unless the URL has ?new (the e2e smoke test relies on that). */
export const showTitleAtBoot = (search) => !new URLSearchParams(search).has("new");
/**
 * The entries to offer for the saves found. Continue needs the autosave; Load needs any save.
 * With no saves (first visit) only New game, Settings and Controls remain.
 */
export function titleItems(saves) {
    const items = [];
    if (saves.some((s) => s.id === "auto"))
        items.push("continue");
    items.push("new");
    if (saves.length > 0)
        items.push("load");
    items.push("settings", "controls");
    return items;
}
/**
 * The induction box is ticked by default on a first visit and when there is nothing to continue. The induction is written for
 * the standard start, so it is unticked by default for any other scenario.
 */
export const inductionDefault = (saves, scenarioId = DEFAULT_SCENARIO) => saves.length === 0 && scenarioId === DEFAULT_SCENARIO;
/** "just now", "5 min ago", "3 h ago", "2 d ago". */
export function agoText(ms, now) {
    const m = Math.max(0, Math.floor((now - ms) / 60_000));
    if (m < 1)
        return "just now";
    if (m < 60)
        return `${m} min ago`;
    const h = Math.floor(m / 60);
    if (h < 48)
        return `${h} h ago`;
    return `${Math.floor(h / 24)} d ago`;
}
/** The Continue line: "DAY 11 · $1.10M · TIER 2 · 3 h ago". */
export const continueSummary = (info, now) => `DAY ${info.day} · ${fmtMoney(info.cash)} · TIER ${info.tier} · ${agoText(info.savedAt, now)}`;
/**
 * Leave the title screen into a game. Continue plays the loaded autosave at 1×. New game starts a fresh site of the chosen
 * scenario (the standard start when none is given); with the induction on, the induction takes over the clock (its first memo
 * stops it) instead of running at 1×. With `crawl`, the clock stays stopped: the opening crawl plays first and the HUD sets
 * the speed when it ends.
 */
export function startGame(store, how, hooks) {
    if (how.kind === "continue") {
        store.setSpeed(1);
        return;
    }
    if (how.scenarioId)
        store.newGame(undefined, how.scenarioId);
    else
        store.newGame();
    if (how.induction) {
        hooks.restartInduction();
        store.setSpeed(0);
    }
    else {
        hooks.closeInduction();
        store.setSpeed(how.crawl ? 0 : 1);
    }
}
