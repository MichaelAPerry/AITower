/** Node states, spoiler masking and the state signature for the research tree. Pure. */
import type { ContentDB, TechNode } from "@aitower/content";
import type { SimView } from "@aitower/sim";
import { isSpoilerTech } from "./researchText";
import { nodeState, techList } from "./tech";

/** done = researched. avail = can start now. poor = everything met but points. locked = a prerequisite or path is missing. lvl = the Level is too low. */
export type TreeState = "done" | "avail" | "poor" | "locked" | "lvl";

export function treeState(node: TechNode, view: SimView, content: ContentDB): TreeState {
	const s = nodeState(node, view, content);
	if (s.kind === "researched") return "done";
	if (s.kind === "available") return "avail";
	if (s.kind === "poor") return "poor";
	return view.tier < node.minTier ? "lvl" : "locked";
}

/** Wetware and biotech nodes show only their name and requirement until they can be started. */
export const isMasked = (node: TechNode, state: TreeState): boolean => isSpoilerTech(node) && state !== "done" && state !== "avail" && state !== "poor";

const CH: Record<TreeState, string> = { done: "d", avail: "a", poor: "p", locked: "l", lvl: "v" };

/** One character per node: the tree is rebuilt only when this string (or the selection or lane filter) changes. */
export function stateSignature(content: ContentDB, view: SimView): { states: Map<string, TreeState>; sig: string } {
	const states = new Map<string, TreeState>();
	let sig = `${view.tier}:`;
	for (const n of techList(content)) {
		const s = treeState(n, view, content);
		states.set(n.id, s);
		sig += CH[s];
	}
	return { states, sig };
}

/** Techs that list `id` as a prerequisite, in content order. */
export const leadsTo = (content: ContentDB, id: string): TechNode[] => techList(content).filter((t) => t.requires.includes(id));
