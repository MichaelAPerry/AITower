/**
 * ASCENSION. Pure logic for the sheet that commits the tower to a path at Clearance `balance.ascension.minTier`.
 * The choice is irreversible, so the sheet asks once more before dispatching `choosePath`.
 */
import type { AscensionPath, ContentDB } from "@aitower/content";
import type { GameStore } from "@aitower/shared";
import type { CommandResult, SimView } from "@aitower/sim";
import { pushNotice } from "../notices";

export interface PathRow {
	id: AscensionPath;
	name: string;
	description: string;
	/** False: stamped COMING SOON, no button. */
	available: boolean;
	chosen: boolean;
}

/** The paths as listed on the sheet, in the content's order. */
export function pathRows(content: ContentDB, view: Pick<SimView, "path">): PathRow[] {
	return (content.paths ?? []).map((p) => ({ id: p.id, name: p.name, description: p.description, available: p.available, chosen: view.path === p.id }));
}

/** Clearance is high enough, no path is chosen yet, and at least one path can be chosen. */
export function ascensionDue(view: Pick<SimView, "tier" | "path">, content: ContentDB): boolean {
	const min = content.balance?.ascension?.minTier;
	return min !== undefined && view.tier >= min && view.path === null && (content.paths ?? []).some((p) => p.available);
}

/** The choice just filed. The sim applies commands on the next tick, so the HUD must not offer the form again meanwhile. */
export interface PathFiled {
	path: AscensionPath;
	tick: number;
}

/** True between filing and the next tick (when the path appears in the view, or the sim has refused it). */
export const pathPending = (filed: PathFiled | null | undefined, view: Pick<SimView, "path" | "tick">): boolean => !!filed && view.path === null && view.tick <= filed.tick;

/** The path to ask confirmation for: only an available path of this content. */
export function pathToConfirm(content: ContentDB, id: AscensionPath): AscensionPath | null {
	return (content.paths ?? []).some((p) => p.id === id && p.available) ? id : null;
}

export const confirmQuestion = (name: string): string => `Commit to ${name}? This cannot be undone.`;

/** Dispatch the irreversible choice. Returns the filing marker on success; a refusal is shown as a notice. */
export function filePath(store: GameStore, content: ContentDB, id: AscensionPath): PathFiled | null {
	if (!pathToConfirm(content, id)) return null;
	const r: CommandResult = store.dispatch({ type: "choosePath", path: id });
	if (!r.ok) {
		pushNotice({ text: r.reason, severity: "warn", key: `path:${r.reason}` });
		return null;
	}
	return { path: id, tick: store.get().view.tick };
}

/** Path order and colours (one hue per path; used by the bars, the decision chips and the sheet). */
export const PATH_ORDER: readonly AscensionPath[] = ["biotech", "greentech", "synthetic"];
export const PATH_COLOR: Record<AscensionPath, string> = { biotech: "#d9669c", greentech: "#4ee08a", synthetic: "#9b8cff" };

/** The path with the largest affinity share; null when all are zero or the top two tie. */
export function leadingPath(affinity: Record<AscensionPath, number>): AscensionPath | null {
	const sorted = [...PATH_ORDER].sort((a, b) => affinity[b] - affinity[a]);
	return affinity[sorted[0]] > 0 && affinity[sorted[0]] > affinity[sorted[1]] ? sorted[0] : null;
}

/** The path the sheet opens with selected: the leading one if it can be chosen. */
export function preselectedPath(content: ContentDB, affinity: Record<AscensionPath, number>): AscensionPath | null {
	const lead = leadingPath(affinity);
	return lead ? pathToConfirm(content, lead) : null;
}

/** "Biotech 62%" style label for a share. */
export const sharePct = (share: number): string => `${Math.round(share * 100)}%`;
