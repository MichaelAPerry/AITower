/** Research: tech perks, gating, the `research` command and RP income. */
import type { ContentDB, FeatureId, PerkKind, TechNode } from "@aitower/content";
import { type Plan, type PlanCtx, accept, reject } from "../commands/plan";
import type { SimState } from "../core/state";
import { AFFINITY_PER_TECH, addAffinity, techPath } from "../progression/affinity";

const PERKS: readonly PerkKind[] = ["failureRate", "energyPrice", "payout", "coolingCapacity", "repairSpeed", "upkeep", "researchRate", "botSpeed"];

interface PerkCache {
	content: ContentDB;
	techCount: number;
	researched: number;
	factors: Record<PerkKind, number>;
}

/** Perk products depend only on the researched list; recomputed when it grows (or the content changes). Not state. */
const cache = new WeakMap<string[], PerkCache>();

export function techNode(content: ContentDB, id: string): TechNode | undefined {
	return content.tech.find((t) => t.id === id);
}

export const isResearched = (state: SimState, id: string): boolean => state.techResearched.includes(id);

/** Product of the factors of every researched node's perk of `kind` (1 when none). Memo modifiers are separate. */
export function perk(state: SimState, content: ContentDB, kind: PerkKind): number {
	const list = state.techResearched;
	let c = cache.get(list);
	if (!c || c.content !== content || c.techCount !== content.tech.length || c.researched !== list.length) {
		const factors = Object.fromEntries(PERKS.map((k) => [k, 1])) as Record<PerkKind, number>;
		for (const id of list) {
			const node = techNode(content, id);
			if (!node) continue;
			for (const e of node.effects) if (e.type === "perk") factors[e.kind] *= e.factor;
		}
		c = { content, techCount: content.tech.length, researched: list.length, factors };
		cache.set(list, c);
	}
	return c.factors[kind];
}

/** A researched node grants the feature. */
export function featureUnlocked(state: SimState, content: ContentDB, feature: FeatureId): boolean {
	for (const id of state.techResearched) {
		const node = techNode(content, id);
		if (node?.effects.some((e) => e.type === "feature" && e.feature === feature)) return true;
	}
	return false;
}

/** The Contracts Clerk is available once a researched node grants the `contractsClerk` feature. */
export const clerkUnlocked = (state: SimState, content: ContentDB): boolean => featureUnlocked(state, content, "contractsClerk");

/** The Foreman is available once a researched node grants the `foreman` feature. */
export const foremanUnlocked = (state: SimState, content: ContentDB): boolean => featureUnlocked(state, content, "foreman");

/** Reason a facility / bot gated by `tech` cannot be built or bought yet, or null. */
export function techGate(state: SimState, content: ContentDB, tech: string | undefined): string | null {
	if (tech === undefined || isResearched(state, tech)) return null;
	return `requires research: ${techNode(content, tech)?.name ?? tech}`;
}

const rp = (n: number): string => String(Math.floor(n * 10) / 10);

export function planResearch(ctx: PlanCtx, techId: string): Plan {
	const { state, content } = ctx;
	const node = techNode(content, techId);
	if (!node) return reject(`unknown tech '${techId}'`);
	if (isResearched(state, node.id)) return reject(`already researched: ${node.name}`);
	for (const req of node.requires) {
		if (!isResearched(state, req)) return reject(`missing prerequisite: ${techNode(content, req)?.name ?? req}`);
	}
	if (node.path !== undefined && state.path !== node.path) return reject(`requires the ${node.path} path`);
	if (state.tier < node.minTier) return reject(`requires Clearance ${node.minTier}`);
	if (state.researchPoints < node.cost) return reject(`needs ${rp(node.cost)} RP, have ${rp(state.researchPoints)}`);
	return accept(0, (events) => {
		state.researchPoints = Math.max(0, state.researchPoints - node.cost);
		state.techResearched.push(node.id);
		const lean = techPath(content, node);
		if (lean) addAffinity(state, lean, AFFINITY_PER_TECH);
		events.push({ type: "researched", techId: node.id });
	});
}

/** Grant RP (lifetime total included). */
export function earnResearch(state: SimState, points: number): void {
	if (!(points > 0)) return;
	state.researchPoints += points;
	state.stats.researchPointsEarned += points;
}
