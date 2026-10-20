import { useEffect, useState } from "react";
import type { PanelProps } from "../components/context";
import { newlyOpen, unlockedIds } from "./chapters";
import { useChapters, useProgress } from "./PrimerDrawer";
import { loadProgress, update } from "./progress";
import "./primer.css";

const SHOW_MS = 16000;

/** True when a chapter that is open has not been read: drives the dot on the Primer tab. */
export function useUnreadPrimer(content: PanelProps["content"], view: PanelProps["state"]["view"]): boolean {
	const chapters = useChapters(content);
	const p = useProgress();
	return unlockedIds(chapters, view).some((id) => !p.read.includes(id));
}

/**
 * A calm note when a Primer chapter unlocks: "New Primer chapter: ... Read". The first visit only records what is already open,
 * so nobody is greeted by a pile of notes.
 */
export function PrimerPrompt({ content, state, setUi }: Pick<PanelProps, "content" | "state" | "setUi">) {
	const chapters = useChapters(content);
	useProgress();
	const open = unlockedIds(chapters, state.view).join(",");
	const [note, setNote] = useState<{ ids: string[] } | null>(null);
	useEffect(() => {
		const ids = open ? open.split(",") : [];
		const p = loadProgress();
		if (p.known === null) {
			update({ known: ids });
			return;
		}
		const fresh = newlyOpen(ids, p.known);
		if (fresh.length === 0) return;
		update({ known: [...p.known, ...fresh] });
		setNote({ ids: fresh });
	}, [open]);
	useEffect(() => {
		if (!note) return;
		const t = setTimeout(() => setNote(null), SHOW_MS);
		return () => clearTimeout(t);
	}, [note]);
	if (!note) return null;
	const first = chapters.find((c) => c.id === note.ids[0]);
	if (!first) return null;
	const text = note.ids.length > 1 ? `${note.ids.length} new Primer chapters` : `New Primer chapter: ${first.title}`;
	return (
		<div className="pr-new" role="status" aria-live="polite" data-primer-new>
			<span>
				<b>{text}</b>
			</span>
			<button
				type="button"
				className="ui-btn is-on"
				onClick={() => {
					setUi({ drawer: "primer", encyId: first.id, paletteOpen: false, buildHover: null });
					setNote(null);
				}}
			>
				Read
			</button>
			<button type="button" className="ui-btn ui-icon-btn" aria-label="Dismiss" onClick={() => setNote(null)}>
				×
			</button>
		</div>
	);
}
