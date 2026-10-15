import type { GameStore, OverlayMode, Speed } from "@aitower/shared";
import { useEffect, useRef } from "react";

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

export function useHudKeyboard(store: GameStore, toggleBottom: () => void): void {
	const lastSpeed = useRef<Speed>(1);
	const toggleRef = useRef(toggleBottom);
	toggleRef.current = toggleBottom;
	useEffect(() => {
		const onKey = (e: KeyboardEvent): void => {
			if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || typing(e.target)) return;
			const a = keyAction(e.key);
			if (!a) return;
			e.preventDefault();
			const s = store.get();
			if (s.speed !== 0) lastSpeed.current = s.speed;
			switch (a.type) {
				case "togglePause":
					store.setSpeed(s.speed === 0 ? lastSpeed.current : 0);
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
					store.setGhost(null);
					if (s.tool.kind !== "select") store.setTool({ kind: "select" });
					else store.setSelection(null);
					break;
				case "demolish":
					store.setGhost(null);
					store.setTool(s.tool.kind === "demolish" ? { kind: "select" } : { kind: "demolish" });
					break;
				case "toggleBottom":
					toggleRef.current();
					break;
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [store]);
}
