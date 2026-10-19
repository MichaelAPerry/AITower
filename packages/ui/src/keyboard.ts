import type { GameStore, OverlayMode, Speed } from "@aitower/shared";
import { useEffect, useRef } from "react";
import { applyEscape, type Closable } from "./menu/escape";
import type { MenuController } from "./menu/menuController";
import { type DrawerId, drawerForKey } from "./calm/calm";

export type KeyAction =
	| { type: "togglePause" }
	| { type: "speed"; speed: Speed }
	| { type: "overlay"; mode: OverlayMode }
	| { type: "mute" }
	| { type: "escape" }
	| { type: "demolish" }
	| { type: "drawer"; id: DrawerId }
	| { type: "palette" };

const SPEED_KEYS: Record<string, Speed> = { "1": 0, "2": 1, "3": 3, "4": 10, "5": 30 };
const OVERLAY_KEYS: Record<string, OverlayMode> = { n: "normal", h: "heat", p: "power", o: "coolant", u: "nutrient", g: "contamination" };

/**
 * Pure key → action map. WASD and arrows are deliberately unused (the renderer pans the camera with them).
 * Overlay keys: N normal, H heat, P power, O coolant, U nutrient, G contamination ("growth").
 * Drawers: C contracts, R research, F finance, I gauges (one open at a time). B opens the full build palette.
 * Speed keys follow the button order: 1 = pause, 2 = 1×, 3 = 3×, 4 = 10×, 5 = 30×.
 */
export function keyAction(key: string): KeyAction | null {
	if (key === " " || key === "Spacebar") return { type: "togglePause" };
	if (key === "Escape") return { type: "escape" };
	if (key in SPEED_KEYS) return { type: "speed", speed: SPEED_KEYS[key] };
	const k = key.toLowerCase();
	if (k in OVERLAY_KEYS) return { type: "overlay", mode: OVERLAY_KEYS[k] };
	if (k === "m") return { type: "mute" };
	if (k === "x") return { type: "demolish" };
	if (k === "b") return { type: "palette" };
	const d = drawerForKey(k);
	if (d) return { type: "drawer", id: d };
	return null;
}

const typing = (t: EventTarget | null): boolean =>
	t instanceof HTMLElement && (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT");

export interface KeyEnv {
	menu: MenuController;
	/** Open the drawer, or close it if it is the one already open. */
	toggleDrawer: (id: DrawerId) => void;
	/** Open or close the full build palette. */
	togglePalette: () => void;
	/** The research sheet: R toggles it (opening pauses the game, closing restores the speed). */
	research?: MenuController;
	/** FORM A-5, the ascension sheet: modal like research, but only Esc acts (its own handler closes it too). */
	ascension?: MenuController;
	/** The quarterly audit sheet: only Esc closes it; the game keeps running under it. */
	audit?: Closable;
	/** The open edge drawer or build palette: Esc closes it before cancelling the tool. */
	drawer?: Closable;
	/** Last non-zero speed, for the space-bar toggle. */
	lastSpeed: { current: Speed };
}

/**
 * Apply one key press. While the menu is open every game hotkey is ignored and only Esc acts (it closes
 * the menu). Returns true if the key was consumed.
 */
export function runKey(store: GameStore, key: string, env: KeyEnv): boolean {
	const a = keyAction(key);
	if (!a) return false;
	const sheets = { research: env.research, ascension: env.ascension, audit: env.audit, drawer: env.drawer };
	if (env.menu.isOpen()) {
		if (a.type === "escape") applyEscape(store, env.menu, sheets);
		return a.type === "escape";
	}
	// The research sheet is modal: only Esc and R (both close it) act while it is open.
	if (env.research?.isOpen()) {
		if (a.type === "escape") applyEscape(store, env.menu, sheets);
		else if (a.type === "drawer" && a.id === "research") env.research.close();
		return a.type === "escape" || (a.type === "drawer" && a.id === "research");
	}
	// The ascension sheet is modal as well: only Esc acts, and it closes the sheet.
	if (env.ascension?.isOpen()) {
		if (a.type === "escape") applyEscape(store, env.menu, sheets);
		return a.type === "escape";
	}
	const s = store.get();
	if (s.speed !== 0) env.lastSpeed.current = s.speed;
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
		case "demolish":
			store.setGhost(null);
			store.setTool(s.tool.kind === "demolish" ? { kind: "select" } : { kind: "demolish" });
			break;
	}
	return true;
}

/** `blocked()` is true while a full-screen notice (title screen, game over) owns the keyboard: no game hotkeys then. */
export function useHudKeyboard(store: GameStore, toggles: { toggleDrawer: (id: DrawerId) => void; togglePalette: () => void }, menu: MenuController, blocked: () => boolean = () => false, sheets: { research?: MenuController; ascension?: MenuController; audit?: Closable; drawer?: Closable } = {}): void {
	const lastSpeed = useRef<Speed>(1);
	const toggleRef = useRef(toggles);
	toggleRef.current = toggles;
	const blockedRef = useRef(blocked);
	blockedRef.current = blocked;
	const { research, ascension, audit, drawer } = sheets;
	useEffect(() => {
		const env: KeyEnv = { menu, research, ascension, audit, drawer, lastSpeed, toggleDrawer: (id) => toggleRef.current.toggleDrawer(id), togglePalette: () => toggleRef.current.togglePalette() };
		const onKey = (e: KeyboardEvent): void => {
			if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
			if (blockedRef.current() && !menu.isOpen()) return;
			// Typing in a field ignores hotkeys, except Esc while the menu is open (it must always close).
			if (typing(e.target) && !(menu.isOpen() && e.key === "Escape")) return;
			if (runKey(store, e.key, env)) e.preventDefault();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [store, menu, research, ascension, audit, drawer]);
}
