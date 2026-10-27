/**
 * Racks retrofit down three trees (docs/REFRAME.md). Pure and shared by the sim (which enforces it) and the UI (which says what a
 * rack can become and why not), so the two never disagree.
 *
 *   Base rack  : AC-1, AC-3, IA-1. Neutral: it scores for no tree.
 *   Tree rack  : four rungs per tree (`FacilityDef.rung`, one per Level 2-5). Reached only by retrofitting a rack in place.
 *   Retrofit   : a base rack becomes rung 1 of the chosen tree; a tree rack advances one rung within its own tree; switching trees
 *                goes back to rung 1 of the other tree. Cost = new rack cost − 50 % of the old rack's cost (a rack of another tree
 *                is valued as the plain base rack, so there is no refund trick).
 */
import type { AdvisorId, AscensionPath, ContentDB, FacilityDef } from "./schema";

export const TREES: readonly AscensionPath[] = ["synthetic", "biotech", "greentech"];
export const TREE_RUNGS = 4;
export const TREE_NAME: Record<AscensionPath, string> = { synthetic: "The Lattice", biotech: "The Flesh", greentech: "The Garden" };
/** The branch names the player sees on the Retrofit buttons. */
export const BRANCH_NAME: Record<AscensionPath, string> = { synthetic: "Synthetic", biotech: "Bio", greentech: "Green" };
export const ADVISOR_NAME: Record<AdvisorId, string> = { luci: "Luci", mel: "Mel", bea: "Bea", cass: "Cass" };

/** The rack a rack of another tree is valued as when it switches trees. */
export const SWITCH_BASE_ID = "rack_air_gpu";
/** The share of the old rack's cost that comes off a retrofit (the demolish refund). */
export const RETROFIT_REFUND = 0.5;

/** A tree rack is reached only by retrofitting; it is not in the build menu and cannot be placed. */
export const isRetrofitOnly = (d: FacilityDef): boolean => d.rung !== undefined;

/** A base rack: a compute rack that belongs to no tree (AC-1, AC-3, IA-1). */
export const isBaseRack = (d: FacilityDef): boolean => d.kind === "rack" && !!d.rack && d.rack.pflops > 0 && !d.growth && !d.retired && d.rung === undefined && (d.line === undefined || d.line === "shared");

/** Can this rack be retrofitted at all (a base rack or a tree rack)? */
export const isRetrofittable = (d: FacilityDef): boolean => !d.growth && !d.retired && (d.rung !== undefined || isBaseRack(d));

/** The tree a rack scores for, or null (a base rack, or anything that is not a tree rack). */
export const treeOf = (d: FacilityDef): AscensionPath | null => (d.rung !== undefined && (d.line === "synthetic" || d.line === "biotech" || d.line === "greentech") ? d.line : null);

/** The rack at `rung` of `tree`, if the content has one. */
export function treeRack(content: Pick<ContentDB, "facilities">, tree: AscensionPath, rung: number): FacilityDef | undefined {
	return Object.values(content.facilities).find((d) => d.line === tree && d.rung === rung && !d.retired && !d.growth);
}

/** The four rungs of a tree, in order (missing rungs are skipped). */
export function treeLadder(content: Pick<ContentDB, "facilities">, tree: AscensionPath): FacilityDef[] {
	const out: FacilityDef[] = [];
	for (let r = 1; r <= TREE_RUNGS; r++) {
		const d = treeRack(content, tree, r);
		if (d) out.push(d);
	}
	return out;
}

/** What retrofitting `from` toward `tree` makes: the next rung of its own tree, or rung 1 for a base rack or a rack of another tree. Null at the top. */
export function retrofitTarget(content: Pick<ContentDB, "facilities">, from: FacilityDef, tree: AscensionPath): { to: FacilityDef; switching: boolean } | null {
	if (!isRetrofittable(from)) return null;
	const own = treeOf(from);
	if (own === tree) {
		const to = treeRack(content, tree, (from.rung ?? 0) + 1);
		return to ? { to, switching: false } : null;
	}
	const to = treeRack(content, tree, 1);
	return to ? { to, switching: own !== null } : null;
}

/** Retrofit price: the new rack's cost minus half the old rack's (a rack of another tree counts as a plain AC-1), never below 0. */
export function retrofitCost(content: Pick<ContentDB, "facilities">, from: FacilityDef, to: FacilityDef): number {
	const own = treeOf(from);
	const basis = own !== null && own !== treeOf(to) ? (content.facilities[SWITCH_BASE_ID]?.cost ?? 0) : from.cost;
	return Math.max(0, to.cost - RETROFIT_REFUND * basis);
}

/** Facilities that upgrade directly from `defId`, by id (support items; racks retrofit instead). */
export function upgradesTo(content: Pick<ContentDB, "facilities">, defId: string): FacilityDef[] {
	return Object.values(content.facilities)
		.filter((d) => d.upgradesFrom === defId && !d.growth && !d.retired && d.rung === undefined)
		.sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** Upgrade price: the new item's cost minus half of the old one's (never below 0). */
export const upgradeCost = (from: FacilityDef, to: FacilityDef, refund = 0.5): number => Math.max(0, to.cost - refund * from.cost);
