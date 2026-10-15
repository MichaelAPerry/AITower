import type { ContentDB } from "@aitower/content";
import type { GameState } from "@aitower/shared";
import { useEffect, useRef, useState } from "react";
import { describeEvent, eventKey } from "../events";
import { type Notice, onNotice, type Severity } from "../notices";
import { Stamp } from "./common";

/** Severity → [stamp, ink, slip header]. */
const SLIP: Record<Severity, [string, "red" | "green" | "amber" | "ink", string]> = {
	error: ["URGENT", "red", "TELEX · OPS CONTROL"],
	warn: ["NOTICE", "amber", "INTERDEPT. MEMO"],
	good: ["COMMENDATION", "green", "MINISTRY CIRCULAR"],
	info: ["NOTICE", "ink", "INTERDEPT. MEMO"],
};

interface Toast extends Notice {
	id: number;
	count: number;
	until: number;
}

const TTL = 5000;
const MAX = 5;

/** Toast stack: important sim events from `state.log` plus notices (command rejections). */
export function Toasts({ content, state }: { content: ContentDB; state: GameState }) {
	const [toasts, setToasts] = useState<Toast[]>([]);
	const cursor = useRef<{ tick: number; n: number } | null>(null);
	const nextId = useRef(1);

	const add = (n: Notice): void => {
		const now = Date.now();
		setToasts((list) => {
			const key = n.key ?? n.text;
			const hit = list.find((t) => (t.key ?? t.text) === key);
			if (hit) return list.map((t) => (t === hit ? { ...t, text: n.text, count: t.count + 1, until: now + TTL } : t));
			return [...list, { ...n, key, id: nextId.current++, count: 1, until: now + (n.severity === "error" ? TTL * 1.6 : TTL) }].slice(-MAX);
		});
	};

	useEffect(() => onNotice(add), []);

	// New log entries → toasts. Entries present at mount are skipped. The cursor is (tick, count at that
	// tick) so it works even if the app rebuilds entry objects; a tick going backwards (load) resets it.
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
			const d = describeEvent(e.event, state.view, content);
			if (d.toast) add({ text: d.text, severity: d.severity, key: eventKey(e.event) });
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
				const [stamp, tone, head] = SLIP[t.severity] ?? SLIP.info;
				return (
					<div key={t.id} className={`ui-toast sev-${t.severity}`} onClick={() => setToasts((l) => l.filter((x) => x.id !== t.id))} title="Click to file away">
						<span className="ui-toast-head">
							{head} · NO. {String(t.id).padStart(4, "0")}
						</span>
						<span className="ui-toast-text">{t.text}</span>
						{t.count > 1 && <span className="ui-toast-count">×{t.count}</span>}
						<Stamp tone={tone} className="ui-toast-stamp">
							{stamp}
						</Stamp>
					</div>
				);
			})}
		</div>
	);
}
