import type { ContentDB } from "@aitower/content";
import type { GameState } from "@aitower/shared";
import { useEffect, useRef, useState } from "react";
import { describeEvent, eventKey } from "../events";
import { type Notice, onNotice, type Severity } from "../notices";
import { addToast, showCount, type Toast } from "./toastList";

const GLYPH: Record<Severity, string> = { error: "✕", warn: "▲", good: "✓", info: "·" };

/** Toast stack: important sim events from `state.log` plus notices (command rejections). */
export function Toasts({ content, state }: { content: ContentDB; state: GameState }) {
	const [toasts, setToasts] = useState<Toast[]>([]);
	const cursor = useRef<{ tick: number; n: number } | null>(null);
	const nextId = useRef(1);

	const add = (n: Notice): void => {
		const now = Date.now();
		setToasts((list) => addToast(list, n, now, () => nextId.current++));
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: subscribe once on mount; `add` only touches refs and functional setState, so a stale closure is harmless
	useEffect(() => onNotice(add), []);

	// New log entries → toasts. Entries present at mount are skipped. The cursor is (tick, count at that
	// tick) so it works even if the app rebuilds entry objects; a tick going backwards (load) resets it.
	// biome-ignore lint/correctness/useExhaustiveDependencies: intentionally keyed on the log only: re-running on view/content changes would re-scan entries already toasted
	useEffect(() => {
		const log = state.log;
		const last = log[log.length - 1];
		const countAt = (tick: number): number => log.reduce((n, e) => n + (e.tick === tick ? 1 : 0), 0);
		const c = cursor.current;
		if (!c || !last || last.tick < c.tick) {
			cursor.current = last ? { tick: last.tick, n: countAt(last.tick) } : { tick: -1, n: 0 };
			return;
		}
		let atTick = 0;
		for (const e of log) {
			if (e.tick < c.tick) continue;
			if (e.tick === c.tick && ++atTick <= c.n) continue;
			const d = describeEvent(e.event, state.view, content, state.settings.horrorIntensity);
			if (d.toast) add({ text: d.text, severity: d.severity, key: eventKey(e.event), group: d.group });
		}
		cursor.current = { tick: last.tick, n: countAt(last.tick) };
	}, [state.log]);

	useEffect(() => {
		if (!toasts.length) return;
		const next = Math.min(...toasts.map((t) => t.until)) - Date.now();
		const h = setTimeout(() => setToasts((l) => l.filter((t) => t.until > Date.now())), Math.max(50, next));
		return () => clearTimeout(h);
	}, [toasts]);

	return (
		<div className="ui-toasts" aria-live="polite">
			{toasts.map((t) => {
				return (
					// biome-ignore lint/a11y/noStaticElementInteractions: click-to-dismiss is a mouse convenience on a non-essential toast
					// biome-ignore lint/a11y/useKeyWithClickEvents: click-to-dismiss is a mouse convenience; toasts also expire on their own and are mirrored in the keyboard-reachable log
					<div key={t.id} className={`ui-toast sev-${t.severity}`} onClick={() => setToasts((l) => l.filter((x) => x.id !== t.id))} title="Click to dismiss">
						<span className="ui-toast-glyph" aria-hidden="true">
							{GLYPH[t.severity]}
						</span>
						<span className="ui-toast-text">{t.text}</span>
						{showCount(t) && <span className="ui-toast-count">×{t.count}</span>}
					</div>
				);
			})}
		</div>
	);
}
