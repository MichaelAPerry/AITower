/** The toast stack as a pure function: coalescing by key, grouping repeated failures into one, and a cap of two on screen. */
import type { Notice, Severity } from "../notices";

export interface Toast extends Notice {
	id: number;
	count: number;
	until: number;
}

export const TTL = 5000;
/** At most this many toasts on screen at once (the calm pass). */
export const MAX_TOASTS = 2;

const RANK: Record<Severity, number> = { info: 0, good: 1, warn: 2, error: 3 };

/** Add a notice at `now`. A repeat (same key, or same group) updates its toast instead of stacking; over the cap, the least severe, oldest toast goes first. */
export function addToast(list: readonly Toast[], n: Notice, now: number, nextId: () => number): Toast[] {
	const key = n.key ?? n.text;
	const until = now + (n.severity === "error" ? TTL * 1.6 : TTL);
	const hit = n.group ? list.find((t) => t.group?.id === n.group?.id) : list.find((t) => !t.group && (t.key ?? t.text) === key);
	if (hit) {
		const count = hit.count + 1;
		return list.map((t) => (t === hit ? { ...t, text: n.group ? n.group.text(count) : n.text, count, until, severity: RANK[n.severity] > RANK[t.severity] ? n.severity : t.severity } : t));
	}
	const added: Toast = { ...n, key, id: nextId(), count: 1, until };
	const out = [...list, added];
	while (out.length > MAX_TOASTS) {
		// Drop the least severe; among equals the oldest. The toast just added is never the one dropped.
		let drop = 0;
		for (let i = 1; i < out.length - 1; i++) if (RANK[out[i].severity] < RANK[out[drop].severity]) drop = i;
		out.splice(drop, 1);
	}
	return out;
}

/** The label of a counter badge: grouped toasts say the count in their own text. */
export const showCount = (t: Toast): boolean => t.count > 1 && !t.group;
