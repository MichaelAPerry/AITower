import type { GameState } from "@aitower/shared";
import { useEffect, useRef } from "react";

const KEY = "aitower.cursorHint.placements";
/** The hint shows for the first few placements of a player's life, then never again. */
export const CURSOR_HINT_PLACEMENTS = 3;

const read = (): number => {
	try {
		const n = Number(localStorage.getItem(KEY));
		return Number.isFinite(n) && n > 0 ? n : 0;
	} catch {
		return 0;
	}
};
const write = (n: number): void => {
	try {
		localStorage.setItem(KEY, String(n));
	} catch {
		/* private window or blocked storage: the hint just shows again next time */
	}
};

/** Should the "Esc to stop" tip show for a player who has made `placements` placements so far? */
export const cursorHintVisible = (placements: number): boolean => placements < CURSOR_HINT_PLACEMENTS;

/**
 * A small "Esc to stop" tag that follows the cursor while a build tool is armed, for the first few placements only.
 * (Replaces the old "TOOL ARMED" banner and the Put-tool-down button: Esc and right-click still drop the tool.)
 */
export function CursorHint({ state }: { state: GameState }) {
	const armed = state.tool.kind !== "select";
	const placed = useRef(read());
	const lastSeen = useRef<unknown>(null);
	const el = useRef<HTMLDivElement>(null);

	// Count placements from the event log (newest last), once each.
	useEffect(() => {
		const log = state.log;
		let fresh = 0;
		for (let i = log.length - 1; i >= 0 && log[i] !== lastSeen.current; i--) if (log[i].event.type === "built") fresh++;
		lastSeen.current = log[log.length - 1] ?? null;
		if (fresh > 0) {
			placed.current += fresh;
			write(placed.current);
		}
	}, [state.log]);

	useEffect(() => {
		if (!armed) return;
		const move = (e: PointerEvent): void => {
			const n = el.current;
			if (!n) return;
			n.style.transform = `translate(${e.clientX + 18}px, ${e.clientY + 20}px)`;
			n.style.opacity = "1";
		};
		window.addEventListener("pointermove", move);
		return () => window.removeEventListener("pointermove", move);
	}, [armed]);

	if (!armed || !cursorHintVisible(placed.current)) return null;
	return (
		<div ref={el} className="ui-cursorhint" aria-hidden="true">
			Esc to stop
		</div>
	);
}
