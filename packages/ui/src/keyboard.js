import { useEffect, useRef } from "react";
import { applyEscape } from "./menu/escape";
import { drawerForKey } from "./calm/calm";
const SPEED_KEYS = { "1": 0, "2": 1, "3": 3, "4": 10, "5": 30 };
const OVERLAY_KEYS = { n: "normal", h: "heat", p: "power", o: "coolant", u: "nutrient", g: "contamination" };
/**
 * Pure key → action map. WASD and arrows are deliberately unused (the renderer pans the camera with them).
 * Overlay keys: N normal, H heat, P power, O coolant, U nutrient, G contamination ("growth").
 * Drawers: C contracts, R research, T automation, F finance, I gauges, K encyclopedia (one open at a time). ? or F1: help mode. B opens the full build palette.
 * Speed keys follow the button order: 1 = pause, 2 = 1×, 3 = 3×, 4 = 10×, 5 = 30×.
 */
export function keyAction(key) {
    if (key === " " || key === "Spacebar")
        return { type: "togglePause" };
    if (key === "Escape")
        return { type: "escape" };
    if (key === "?" || key === "F1")
        return { type: "help" };
    if (key in SPEED_KEYS)
        return { type: "speed", speed: SPEED_KEYS[key] };
    const k = key.toLowerCase();
    if (k in OVERLAY_KEYS)
        return { type: "overlay", mode: OVERLAY_KEYS[k] };
    if (k === "m")
        return { type: "mute" };
    if (k === "x")
        return { type: "demolish" };
    if (k === "b")
        return { type: "palette" };
    const d = drawerForKey(k);
    if (d)
        return { type: "drawer", id: d };
    return null;
}
const typing = (t) => t instanceof HTMLElement && (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT");
/**
 * Apply one key press. While the menu is open every game hotkey is ignored and only Esc acts (it closes
 * the menu). Returns true if the key was consumed.
 */
export function runKey(store, key, env) {
    const a = keyAction(key);
    if (!a)
        return false;
    const sheets = { research: env.research, ascension: env.ascension, audit: env.audit, drawer: env.drawer };
    if (env.menu.isOpen()) {
        if (a.type === "escape")
            applyEscape(store, env.menu, sheets);
        return a.type === "escape";
    }
    // The research sheet is modal: only Esc and R (both close it) act while it is open.
    if (env.research?.isOpen()) {
        if (a.type === "escape")
            applyEscape(store, env.menu, sheets);
        else if (a.type === "drawer" && a.id === "research")
            env.research.close();
        return a.type === "escape" || (a.type === "drawer" && a.id === "research");
    }
    // The ascension sheet is modal as well: only Esc acts, and it closes the sheet.
    if (env.ascension?.isOpen()) {
        if (a.type === "escape")
            applyEscape(store, env.menu, sheets);
        return a.type === "escape";
    }
    const s = store.get();
    if (s.speed !== 0)
        env.lastSpeed.current = s.speed;
    switch (a.type) {
        case "togglePause":
            store.setSpeed(s.speed === 0 ? env.lastSpeed.current : 0);
            break;
        case "speed":
            store.setSpeed(a.speed);
            break;
        case "overlay":
            store.setOverlay(a.mode);
            break;
        case "mute":
            store.setMuted(!s.muted);
            break;
        case "escape":
            applyEscape(store, env.menu, sheets);
            break;
        case "drawer":
            env.toggleDrawer(a.id);
            break;
        case "palette":
            env.togglePalette();
            break;
        case "help":
            env.toggleHelp?.();
            break;
        case "demolish":
            store.setGhost(null);
            store.setTool(s.tool.kind === "demolish" ? { kind: "select" } : { kind: "demolish" });
            break;
    }
    return true;
}
/** `blocked()` is true while a full-screen notice (title screen, game over) owns the keyboard: no game hotkeys then. */
export function useHudKeyboard(store, toggles, menu, blocked = () => false, sheets = {}) {
    const lastSpeed = useRef(1);
    const toggleRef = useRef(toggles);
    toggleRef.current = toggles;
    const blockedRef = useRef(blocked);
    blockedRef.current = blocked;
    const { research, ascension, audit, drawer } = sheets;
    useEffect(() => {
        const env = { menu, research, ascension, audit, drawer, lastSpeed, toggleDrawer: (id) => toggleRef.current.toggleDrawer(id), togglePalette: () => toggleRef.current.togglePalette(), toggleHelp: () => toggleRef.current.toggleHelp?.() };
        const onKey = (e) => {
            if (e.ctrlKey || e.metaKey || e.altKey || e.repeat)
                return;
            if (blockedRef.current() && !menu.isOpen())
                return;
            // Typing in a field ignores hotkeys, except Esc while the menu is open (it must always close).
            if (typing(e.target) && !(menu.isOpen() && e.key === "Escape"))
                return;
            if (runKey(store, e.key, env))
                e.preventDefault();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [store, menu, research, ascension, audit, drawer]);
}
