/**
 * Tiny in-package notice bus. The tool controller (pure, no DOM) and HUD buttons
 * publish rejection reasons here; the <Toasts> component subscribes and shows them.
 */
export type Severity = "info" | "good" | "warn" | "error";

export interface Notice {
	text: string;
	severity: Severity;
	/** Notices with the same key coalesce into one toast with a counter. */
	key?: string;
}

type Listener = (n: Notice) => void;
const listeners = new Set<Listener>();

export function pushNotice(n: Notice): void {
	for (const l of listeners) l(n);
}

export function onNotice(l: Listener): () => void {
	listeners.add(l);
	return () => {
		listeners.delete(l);
	};
}
