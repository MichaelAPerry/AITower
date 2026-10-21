/** What the reader has seen of the Primer, kept in localStorage (best effort; the Primer works without it). */
const KEY = "aitower.primer.v1";

export interface PrimerProgress {
	/** Chapters opened. */
	read: string[];
	/** Chapters already announced (or that were open when the player first came). Null = first visit. */
	known: string[] | null;
	/** The Primer drawer has been opened at least once. */
	opened: boolean;
	/** An advisor has already offered the Primer. */
	nudged: boolean;
}

const fresh = (): PrimerProgress => ({ read: [], known: null, opened: false, nudged: false });

export function loadProgress(): PrimerProgress {
	try {
		const raw = localStorage.getItem(KEY);
		if (raw) {
			const p = JSON.parse(raw) as Partial<PrimerProgress>;
			return { read: Array.isArray(p.read) ? p.read : [], known: Array.isArray(p.known) ? p.known : null, opened: !!p.opened, nudged: !!p.nudged };
		}
	} catch {
		/* storage unavailable or damaged: start fresh */
	}
	return fresh();
}

export function saveProgress(p: PrimerProgress): void {
	try {
		localStorage.setItem(KEY, JSON.stringify(p));
	} catch {
		/* best effort */
	}
	for (const l of listeners) l(p);
}

export const update = (patch: Partial<PrimerProgress>): PrimerProgress => {
	const next = { ...loadProgress(), ...patch };
	saveProgress(next);
	return next;
};

const listeners = new Set<(p: PrimerProgress) => void>();
export function onProgress(l: (p: PrimerProgress) => void): () => void {
	listeners.add(l);
	return () => {
		listeners.delete(l);
	};
}

export const markRead = (id: string): void => {
	const p = loadProgress();
	if (!p.read.includes(id)) saveProgress({ ...p, read: [...p.read, id] });
};

/** Pure: should the Primer be offered? After the coach marks are done, once, and only if it was never opened. */
export const shouldNudge = (tutorialDone: boolean, p: Pick<PrimerProgress, "opened" | "nudged">): boolean => tutorialDone && !p.opened && !p.nudged;

/** True once the first-session coach marks are finished (or skipped). */
export function tutorialDone(): boolean {
	try {
		const raw = localStorage.getItem("aitower.induction.v2");
		return !!raw && (JSON.parse(raw) as { done?: boolean }).done === true;
	} catch {
		return false;
	}
}
