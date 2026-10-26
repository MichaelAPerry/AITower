/**
 * Who may place what (docs/TREES.md). Pure and shared by the sim (which enforces it) and the UI (which says why an item is
 * locked), so the two never disagree. It reads only the facility definition and a small slice of the game state.
 *
 *   Shared     : everyone.
 *   Starter    : research only, any path ("feet wet" Bio and Green items; they never scar their own tree).
 *   Specialist : a Bio or Green line; needs the commit to that path.
 *   Synthetic  : the default path; closes to new placement once the player commits to Bio or Green.
 *   Signature  : an advisor's bond opens it (some also need the commit).
 */
import type { AdvisorId, AscensionPath, ContentDB, FacilityDef, TechNode } from "./schema";

export type CatalogueGroup = "shared" | "starter" | "specialist" | "synthetic" | "signature";

export const GROUP_LABEL: Record<CatalogueGroup, string> = { shared: "Shared", starter: "Starter", specialist: "Specialist", synthetic: "Synthetic", signature: "Signature" };

export const TREE_NAME: Record<AscensionPath, string> = { synthetic: "The Lattice", biotech: "The Flesh", greentech: "The Garden" };
export const ADVISOR_NAME: Record<AdvisorId, string> = { luci: "Luci", mel: "Mel", bea: "Bea", cass: "Cass" };

export function catalogueGroup(d: FacilityDef): CatalogueGroup {
	if (d.unlock?.bond) return "signature";
	if (d.tier === "starter") return "starter";
	if (d.tier === "specialist") return "specialist";
	if (d.line === "synthetic") return "synthetic";
	return "shared";
}

/** The slice of the game state the rules read. */
export interface AccessCtx {
	/** The committed path (null before the commit; Synthetic is the default path). */
	path: AscensionPath | null;
	tier: number;
	bonds: Record<AdvisorId, number>;
	/** Trees that rejected the player (sealed out). */
	sealedOut?: readonly AscensionPath[];
	/** How many of a facility the tower holds (for previews). */
	owned?: (defId: string) => number;
}

export type AccessKind = "commit" | "bond" | "closed";

export interface AccessBlock {
	kind: AccessKind;
	/** Short chip text: "Commit to The Garden", "Bea's bond 60". */
	short: string;
	/** A full sentence for the placement refusal. */
	text: string;
}

export interface Access {
	block: AccessBlock | null;
	/** The Level this item opens at for this player (an advisor's bond may open it early). */
	tier: number;
	/** A preview stands in for the commit; the research gate is waived with it. */
	preview: boolean;
}

/** The path a specialist item needs, or null. */
export function commitFor(d: FacilityDef): AscensionPath | null {
	if (d.unlock?.commit) return d.unlock.commit;
	if (d.tier === "specialist" && (d.line === "biotech" || d.line === "greentech")) return d.line;
	return null;
}

export const bondText = (who: AdvisorId, min: number): string => `${ADVISOR_NAME[who]}'s bond ${min}`;

/** The Level `d` opens at for this player: its `unlockTier`, or the early Level when the advisor's bond allows it. */
export function effectiveTier(d: FacilityDef, ctx: Pick<AccessCtx, "bonds">): number {
	const e = d.unlock?.early;
	return e && ctx.bonds[e.who] >= e.min ? Math.min(d.unlockTier, e.tier) : d.unlockTier;
}

/** Commit, bond and line rules for placing `d` (research and cash are checked elsewhere). The Level is reported, not enforced here. */
export function access(d: FacilityDef, ctx: AccessCtx): Access {
	const tier = effectiveTier(d, ctx);
	const none = (preview = false): Access => ({ block: null, tier, preview });
	const u = d.unlock;
	if (u?.bond && ctx.bonds[u.bond.who] < u.bond.min) {
		const short = bondText(u.bond.who, u.bond.min);
		return { block: { kind: "bond", short, text: `needs ${short}` }, tier, preview: false };
	}
	const need = commitFor(d);
	if (need && ctx.path !== need) {
		const p = u?.preview;
		if (p && ctx.bonds[p.who] >= p.min && (ctx.owned?.(d.id) ?? 0) < p.max) return none(true);
		if (ctx.sealedOut?.includes(need)) return { block: { kind: "closed", short: `${TREE_NAME[need]} is closed`, text: `${TREE_NAME[need]} has closed its door on this tower` }, tier, preview: false };
		const short = `Commit to ${TREE_NAME[need]}`;
		const text = p && ctx.bonds[p.who] >= p.min ? `${short} (the ${p.max} preview units are built)` : short;
		return { block: { kind: "commit", short, text }, tier, preview: false };
	}
	// The Lattice line closes to new placement once the player commits to Bio or Green.
	if (d.line === "synthetic" && (ctx.path === "biotech" || ctx.path === "greentech")) {
		const short = `Closed: you chose ${TREE_NAME[ctx.path]}`;
		return { block: { kind: "closed", short, text: `${d.name} belongs to ${TREE_NAME.synthetic}, closed to new building once you commit to ${TREE_NAME[ctx.path]}` }, tier, preview: false };
	}
	return none();
}

/** Why a tech node cannot be researched for lack of a commit, or null. */
export function researchCommitBlock(node: TechNode, path: AscensionPath | null): string | null {
	return node.requiresCommit && path !== node.requiresCommit ? `Commit to ${TREE_NAME[node.requiresCommit]} to research` : null;
}

/** The Level a node opens at for this player (the bond may open it early). */
export function nodeTier(node: TechNode, bonds: Record<AdvisorId, number>): number {
	const e = node.earlyTier;
	return e && bonds[e.who] >= e.min ? Math.min(node.minTier, e.tier) : node.minTier;
}

/** Facilities that upgrade directly from `defId`, by id. */
export function upgradesTo(content: Pick<ContentDB, "facilities">, defId: string): FacilityDef[] {
	return Object.values(content.facilities)
		.filter((d) => d.upgradesFrom === defId && !d.growth && !d.retired)
		.sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** Upgrade price: the new item's cost minus half of the old one's (never below 0). */
export const upgradeCost = (from: FacilityDef, to: FacilityDef, refund = 0.5): number => Math.max(0, to.cost - refund * from.cost);
