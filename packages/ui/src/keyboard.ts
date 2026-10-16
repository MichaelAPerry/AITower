import type { GameStore, OverlayMode, Speed } from "@aitower/shared";
import { useEffect, useRef } from "react";
import { applyEscape } from "./menu/escape";
import type { MenuController } from "./menu/menuController";

export type KeyAction =
	| { type: "togglePause" }
	| { type: "speed"; speed: Speed }
	| { type: "overlay"; mode: OverlayMode }
	| { type: "mute" }
	| { type: "escape" }
	| { type: "demolish" }
	| { type: "toggleBottom" };

const SPEED_KEYS: Record<string, Speed> = { "1": 0, "2": 1, "3": 3, "4": 10, "5": 30 };
const OVERLAY_KEYS: Record<string, OverlayMode> = { n: "normal", h: "heat", p: "power", c: "coolant" };

/**
 * Pure key → action map. WASD and arrows are deliberately unused (the renderer pans the camera with them).
 * Speed keys follow the button order: 1 = pause, 2 = 1×, 3 = 3×, 4 = 10×, 5 = 30×.
 */
export function keyAction(key: string): KeyAction | null {
	if (key === " " || key === "Spacebar") return { type: "togglePause" };
	if (key === "Escape") return { type: "escape" };
	if (key === "`") return { type: "toggleBottom" };
	if (key in SPEED_KEYS) return { type: "speed", speed: SPEED_KEYS[key] };
	const k = key.toLowerCase();
	if (k in OVERLAY_KEYS) return { type: "overlay", mode: OVERLAY_KEYS[k] };
	if (k === "m") return { type: "mute" };
	if (k === "x") return { type: "demolish" };
	return null;
}

const typing = (t: EventTarget | null): boolean =>
	t instanceof HTMLElement && (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT");

export interface KeyEnv {
	menu: MenuController;
	toggleBottom: () => void;
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
	if (env.menu.isOpen()) {
		if (a.type === "escape") applyEscape(store, env.menu);
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
			applyEscape(store, env.menu);
			break;
		case "demolish":
			store.setGhost(null);
			store.setTool(s.tool.kind === "demolish" ? { kind: "select" } : { kind: "demolish" });
			break;
		case "toggleBottom":
			env.toggleBottom();
			break;
	}
	return true;
}

export function useHudKeyboard(store: GameStore, toggleBottom: () => void, menu: MenuController): void {
	const lastSpeed = useRef<Speed>(1);
	const toggleRef = useRef(toggleBottom);
	toggleRef.current = toggleBottom;
	useEffect(() => {
		const env: KeyEnv = { menu, lastSpeed, toggleBottom: () => toggleRef.current() };
		const onKey = (e: KeyboardEvent): void => {
			if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
			// Typing in a field ignores hotkeys, except Esc while the menu is open (it must always close).
			if (typing(e.target) && !(menu.isOpen() && e.key === "Escape")) return;
			if (runKey(store, e.key, env)) e.preventDefault();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [store, menu]);
}
