import type { GameState, GameStore } from "@aitower/shared";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

/**
 * Wrap `store.subscribe` so that pure sim-view churn (every frame at high speed) re-renders the
 * HUD at most every `ms`, while UI-state changes (speed, tool, overlay, selection, mute, settings, save status) notify at once.
 */
export function throttledSubscribe(store: GameStore, ms = 100): (cb: () => void) => () => void {
	return (cb) => {
		let prev = store.get();
		let last = 0;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const fire = (): void => {
			timer = undefined;
			last = Date.now();
			cb();
		};
		const unsub = store.subscribe(() => {
			const s = store.get();
			const urgent =
				s.speed !== prev.speed || s.overlay !== prev.overlay || s.tool !== prev.tool || s.selection !== prev.selection || s.muted !== prev.muted || s.settings !== prev.settings || s.saveStatus !== prev.saveStatus;
			prev = s;
			const now = Date.now();
			if (urgent || now - last >= ms) {
				if (timer) clearTimeout(timer);
				fire();
			} else if (!timer) timer = setTimeout(fire, ms - (now - last));
		});
		return () => {
			unsub();
			if (timer) clearTimeout(timer);
		};
	};
}

/** Current GameState; re-renders on store changes (throttled for view churn). */
export function useGameState(store: GameStore): GameState {
	const subscribe = useMemo(() => throttledSubscribe(store), [store]);
	return useSyncExternalStore(subscribe, () => store.get(), () => store.get());
}

/** Window size in CSS pixels; updates on resize. Server render and tests get a desktop size. */
export function useViewport(): { width: number; height: number } {
	const read = (): { width: number; height: number } => (typeof window === "undefined" ? { width: 1440, height: 900 } : { width: window.innerWidth, height: window.innerHeight });
	const [size, setSize] = useState(read);
	// biome-ignore lint/correctness/useExhaustiveDependencies: `read` is a pure function of window and is deliberately not a dependency
	useEffect(() => {
		const on = (): void => setSize((s) => {
			const n = read();
			return n.width === s.width && n.height === s.height ? s : n;
		});
		on();
		window.addEventListener("resize", on);
		return () => window.removeEventListener("resize", on);
	}, []);
	return size;
}
