/** What the side panel shows for one tech, as plain data (cost, have, short, ETA, what is needed, what it leads to). Pure. */
import type { ContentDB, TechNode } from "@aitower/content";
import type { SimView } from "@aitower/sim";
import { type Step, branchView, chain, etaText, isSpoilerTech } from "./researchText";
import { nodeState } from "./tech";
import { leadsTo } from "./treeState";

export interface PanelFacts {
	state: "done" | "ready" | "short" | "locked";
	cost: number;
	have: number;
	short: number;
	eta: string;
	needs: Step[];
	leads: TechNode[];
	masked: boolean;
	/** Why Start is off, in words (null when it is on or the tech is done). */
	why: string | null;
}

/** Facts for the side panel. Spoiler (Flesh and biotech) techs stay sealed until they can be started, as before. */
export function panelFacts(node: TechNode, view: SimView, content: ContentDB): PanelFacts {
	const s = nodeState(node, view, content);
	const have = Math.floor(Math.max(0, view.researchPoints ?? 0) + 1e-9);
	const masked = isSpoilerTech(node) && s.kind !== "researched" && s.kind !== "available" && s.kind !== "poor";
	const flesh = branchView(content, view, "wetware");
	const fleshOpen = flesh.ready.length + flesh.next.length + flesh.done.length > 0;
	const leads = leadsTo(content, node.id).filter((c) => !isSpoilerTech(c) || fleshOpen);
	const short = s.kind === "poor" ? s.short : 0;
	return {
		state: s.kind === "researched" ? "done" : s.kind === "available" ? "ready" : s.kind === "poor" ? "short" : "locked",
		cost: node.cost,
		have,
		short,
		eta: s.kind === "researched" ? "" : etaText(node.cost, view, content),
		needs: chain(node, view, content),
		leads,
		masked,
		why: s.kind === "poor" ? `Need ${short.toLocaleString("en-US")} more RP (you have ${have.toLocaleString("en-US")}). Racks earn points while they run jobs.` : s.kind === "locked" ? s.reason.replace("Requires ", "First: ") : null,
	};
}

/** Progress toward a pinned goal, 0..1. */
export const goalProgress = (cost: number, rp: number): number => Math.max(0, Math.min(1, rp / Math.max(1, cost)));
