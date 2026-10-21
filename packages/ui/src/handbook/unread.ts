import type { PanelProps } from "../components/context";
import { unlockedIds } from "./chapters";
import { useChapters, useProgress } from "./HandbookDrawer";

/** True when a chapter that is open has not been read: drives the quiet dot on the Handbook tab (the only place it shows). */
export function useUnreadHandbook(content: PanelProps["content"], view: PanelProps["state"]["view"]): boolean {
	const chapters = useChapters(content);
	const p = useProgress();
	return unlockedIds(chapters, view).some((id) => !p.read.includes(id));
}
