/** Pure logic for the Department of Research: node states, plain-English effects, unlocks, build gating. */
import { type ContentDB, nodeTier, researchCommitBlock, type TechBranch, type TechEffect, type TechNode, TREE_NAME } from "@aitower/content";
import type { SimView } from "@aitower/sim";

export const BRANCHES: { id: TechBranch; label: string }[] = [
	{ id: "compute", label: "Compute" },
	{ id: "cooling", label: "Cooling" },
	{ id: "power", label: "Power" },
	{ id: "logistics", label: "Logistics" },
	{ id: "administration", label: "Administration" },
];

export const branchLabel = (b: TechBranch): string => BRANCHES.find((x) => x.id === b)?.label ?? b;

/** `content.tech` and `view.techResearched` can be empty or (in old fixtures) missing; treat both as empty. */
export const techList = (content: ContentDB): TechNode[] => content.tech ?? [];
export const researchedSet = (view: SimView): Set<string> => new Set(view.techResearched ?? []);
export const techName = (content: ContentDB, id: string): string => techList(content).find((t) => t.id === id)?.name ?? id;

/** Unspent research points as shown to the player (whole points; affordability still uses the exact value). */
export const fmtRp = (rp: number): string => `${Math.floor(Math.max(0, rp) + 1e-9).toLocaleString("en-US")} RP`;

export type TechState =
	| { kind: "researched" }
	| { kind: "available" }
	/** Everything else is met but there are not enough points yet. */
	| { kind: "poor"; short: number }
	| { kind: "locked"; reason: string };

/** State of one node, in the order the sim checks: filed, then clearance and prerequisites, then points. */
export function nodeState(node: TechNode, view: SimView, content: ContentDB): TechState {
	const done = researchedSet(view);
	if (done.has(node.id)) return { kind: "researched" };
	const needs: string[] = [];
	const tier = nodeTier(node, view.soul?.bonds ?? { cass: 0, bea: 0, mel: 0, luci: 0 });
	if (view.tier < tier) needs.push(`Level ${tier}`);
	for (const r of node.requires) if (!done.has(r)) needs.push(techName(content, r));
	// Bio and Green Specialist nodes wait for the commit; RP is never spent on them before it.
	const commit = researchCommitBlock(node, view.path);
	if (commit && needs.length === 0) return { kind: "locked", reason: commit };
	if (commit) needs.push(`the commit to ${TREE_NAME[node.requiresCommit as NonNullable<typeof node.requiresCommit>]}`);
	if (needs.length) return { kind: "locked", reason: `Requires ${needs.join(" and ")}` };
	const rp = view.researchPoints ?? 0;
	if (rp + 1e-9 < node.cost) return { kind: "poor", short: Math.ceil(node.cost - rp - 1e-9) };
	return { kind: "available" };
}

const PERK_LABEL: Record<string, string> = {
	failureRate: "failure rate",
	energyPrice: "energy price",
	payout: "contract payouts",
	coolingCapacity: "cooling capacity",
	repairSpeed: "repair speed",
	upkeep: "upkeep costs",
	researchRate: "research points earned",
	botSpeed: "bot speed",
};

/** "−10 %" / "+25 %" for a multiplier (0.9 → −10 %); one decimal only when needed. */
export function fmtFactor(factor: number): string {
	const pct = Math.round((factor - 1) * 1000) / 10;
	const abs = Math.abs(pct);
	const body = Number.isInteger(abs) ? String(abs) : abs.toFixed(1);
	return `${pct < 0 ? "−" : "+"}${body} %`;
}

/** One effect in plain words. `feeShare` (the clerk's cut) is optional, for the feature line. */
export function effectText(e: TechEffect, content?: ContentDB): string {
	if (e.type === "perk") return `${fmtFactor(e.factor)} ${PERK_LABEL[e.kind] ?? e.kind}`;
	const fee = content?.balance?.clerk?.feeShare;
	const cut = fee !== undefined ? ` (keeps ${Math.round(fee * 1000) / 10} % of each job it books)` : "";
	return e.feature === "contractsClerk" ? `Contract Automation: accepts offers for you${cut}` : String(e.feature);
}

/** Names of the facilities and bots whose `tech` is this node. */
export function unlocksFor(techId: string, content: ContentDB): string[] {
	const names: string[] = [];
	for (const f of Object.values(content.facilities)) if (f.tech === techId) names.push(f.name);
	for (const b of Object.values(content.bots)) if (b.tech === techId) names.push(b.name);
	return names;
}

/** Nodes of one branch in display order: by clearance, then cost, then name. */
export function branchNodes(content: ContentDB, branch: TechBranch): TechNode[] {
	return techList(content)
		.filter((t) => t.branch === branch)
		.sort((a, b) => a.minTier - b.minTier || a.cost - b.cost || a.name.localeCompare(b.name));
}

/** The cheapest node that can be researched right now, if any (ties: lower clearance, then name). */
export function cheapestAvailable(view: SimView, content: ContentDB): TechNode | undefined {
	return techList(content)
		.filter((t) => nodeState(t, view, content).kind === "available")
		.sort((a, b) => a.cost - b.cost || a.minTier - b.minTier || a.name.localeCompare(b.name))[0];
}

/** The node that unlocks the Contract Automation, if the content has one. */
export const clerkNode = (content: ContentDB): TechNode | undefined => techList(content).find((t) => t.effects.some((e) => e.type === "feature" && e.feature === "contractsClerk"));

/** Prerequisites with their done flag, for the card. */
export function requirementList(node: TechNode, view: SimView, content: ContentDB): { id: string; name: string; done: boolean }[] {
	const done = researchedSet(view);
	return node.requires.map((id) => ({ id, name: techName(content, id), done: done.has(id) }));
}

/** Palette/shop gate: `blocked` text when the item's `tech` is not researched yet. Items without `tech` are never blocked. */
export function techGate(tech: string | undefined, view: SimView, content: ContentDB): string | null {
	if (!tech || researchedSet(view).has(tech)) return null;
	return `Requires research: ${techName(content, tech)}`;
}
