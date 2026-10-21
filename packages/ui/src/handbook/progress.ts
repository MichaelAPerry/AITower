/** What the reader has seen of the Handbook, kept in localStorage (best effort; the Handbook works without it). The key keeps its old name so progress survives the rename. */
const KEY = "aitower.primer.v1";

export interface HandbookProgress {
	/** Chapters opened. */
	read: string[];
	/** Chapters already announced (or that were open when the player first came). Null = first visit. */
	known: string[] | null;
	/** The Handbook drawer has been opened at least once. */
	opened: boolean;
	/** Unused since M6.4 (kept so saved progress still parses). */
	nudged: boolean;
}

const fresh = (): HandbookProgress => ({ read: [], known: null, opened: false, nudged: false });

export function loadProgress(): HandbookProgress {
	try {
		const raw = localStorage.getItem(KEY);
		if (raw) {
			const p = JSON.parse(raw) as Partial<HandbookProgress>;
			return { read: Array.isArray(p.read) ? p.read : [], known: Array.isArray(p.known) ? p.known : null, opened: !!p.opened, nudged: !!p.nudged };
		}
	} catch {
		/* storage unavailable or damaged: start fresh */
	}
	return fresh();
}

export function saveProgress(p: HandbookProgress): void {
	try {
		localStorage.setItem(KEY, JSON.stringify(p));
	} catch {
		/* best effort */
	}
	for (const l of listeners) l(p);
}

export const update = (patch: Partial<HandbookProgress>): HandbookProgress => {
	const next = { ...loadProgress(), ...patch };
	saveProgress(next);
	return next;
};

const listeners = new Set<(p: HandbookProgress) => void>();
export function onProgress(l: (p: HandbookProgress) => void): () => void {
	listeners.add(l);
	return () => {
		listeners.delete(l);
	};
}

export const markRead = (id: string): void => {
	const p = loadProgress();
	if (!p.read.includes(id)) saveProgress({ ...p, read: [...p.read, id] });
};
