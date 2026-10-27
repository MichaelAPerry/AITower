/**
 * Tree colours and the affinity helpers. (The commit sheet FORM A-5 is gone: docs/REFRAME.md has no commit; a rack is retrofitted
 * toward a tree from the rack inspector, and the Trees panel shows how each tree is doing.)
 */
import type { AscensionPath } from "@aitower/content";

/** Path order and colours (one hue per path; used by the bars, the decision chips and the panels). */
export const PATH_ORDER: readonly AscensionPath[] = ["biotech", "greentech", "synthetic"];
export const PATH_COLOR: Record<AscensionPath, string> = { biotech: "#d9669c", greentech: "#4ee08a", synthetic: "#9b8cff" };

/** The path with the largest affinity share; null when all are zero or the top two tie. */
export function leadingPath(affinity: Record<AscensionPath, number>): AscensionPath | null {
	const sorted = [...PATH_ORDER].sort((a, b) => affinity[b] - affinity[a]);
	return affinity[sorted[0]] > 0 && affinity[sorted[0]] > affinity[sorted[1]] ? sorted[0] : null;
}

/** "Biotech 62%" style label for a share. */
export const sharePct = (share: number): string => `${Math.round(share * 100)}%`;
