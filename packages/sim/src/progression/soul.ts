/**
 * The Soul (docs/SOUL.md, docs/REFRAME.md): Singularity points, the secret seal numbers and advisor bonds.
 *
 *  - SP: hourly, every running TREE rack (a rack retrofitted down a tree; base racks are neutral) adds its delivered PFLOPS ×
 *    `spPerPflopHour` × the tree's weight × the tree's factor to its own tree only:
 *      Synthetic  factor 1;
 *      Bio        factor 1 − bio seal;
 *      Green      factor (greenFloor + (1 − greenFloor) × green score) × (1 − green seal).
 *  - Seal = scar (placing an item, permanent) + residue (running items, decisions; cleanable, never below 0).
 *  - At `sealMax` a tree is closed: no new retrofits to it, and its racks stop scoring (the factor is 0).
 *  - The first tree to `spTarget` wins. There is no commit and no bond gate: bonds only change scenes and the epilogue.
 */
import { type AdvisorId, type AscensionPath, type ContentDB, type FacilityDef, SEALED_TREES, type SealedTree, treeOf, TREES } from "@aitower/content";
import type { TickCtx } from "../core/context";
import { TICKS_PER_HOUR } from "../core/constants";
import { GensetMode, type SimState } from "../core/state";
import { minuteOfDay } from "../core/time";
import { setGameOver } from "./gameOver";
import { getDef } from "../world/defs";

export const sealOf = (state: SimState, tree: SealedTree): number => state.sealScar[tree] + state.sealResidue[tree];

/** 0..1, 1 = sealed. */
export const sealShare = (state: SimState, content: ContentDB, tree: SealedTree): number => Math.min(1, sealOf(state, tree) / content.balance.soul.sealMax);

export const isSealed = (state: SimState, content: ContentDB, tree: SealedTree): boolean => sealOf(state, tree) >= content.balance.soul.sealMax;

/** A closed tree takes no new retrofits and its racks stop scoring. The Lattice never closes. */
export const isClosed = (state: SimState, content: ContentDB, tree: AscensionPath): boolean => tree !== "synthetic" && isSealed(state, content, tree);

export function addBond(state: SimState, advisor: AdvisorId, amount: number): void {
	if (!Number.isFinite(amount) || !(advisor in state.bonds)) return;
	state.bonds[advisor] = Math.min(100, Math.max(0, state.bonds[advisor] + amount));
}

export function addResidue(state: SimState, tree: SealedTree, amount: number): void {
	if (!Number.isFinite(amount)) return;
	state.sealResidue[tree] = Math.max(0, state.sealResidue[tree] + amount);
}

export function addSp(state: SimState, path: AscensionPath, amount: number): void {
	if (!Number.isFinite(amount)) return;
	state.sp[path] = Math.max(0, state.sp[path] + amount);
}

/** Placing a facility scars each tree by its positive seal values (never refunded). */
export function scarOnPlace(state: SimState, d: FacilityDef): void {
	for (const t of SEALED_TREES) {
		const v = d.seal?.[t] ?? 0;
		if (v > 0) state.sealScar[t] += v;
	}
}

/** The Green speed factor from the green score alone: half speed on any power, full speed on clean power. */
export const greenSpeed = (state: SimState, content: ContentDB): number => {
	const f = content.balance.soul.greenFloor;
	return f + (1 - f) * state.greenScore;
};

/** The factor a tree's racks score at right now (0 when the tree is closed). */
export function treeFactor(state: SimState, content: ContentDB, tree: AscensionPath): number {
	if (tree === "synthetic") return 1;
	const open = 1 - sealShare(state, content, tree);
	return tree === "greentech" ? greenSpeed(state, content) * open : open;
}

/** A facility counts as running for the soul when enabled and not failed; a genset only while it runs. */
function running(d: FacilityDef, f: SimState["facilities"][number]): boolean {
	if (!f.enabled || f.failed) return false;
	if (d.kind === "genset") return f.gensetMode === GensetMode.Running;
	return true;
}

/** Delivered PFLOPS of the tree racks right now, by tree. */
export function treePflops(state: SimState, content: ContentDB): Record<AscensionPath, number> {
	const pf: Record<AscensionPath, number> = { synthetic: 0, biotech: 0, greentech: 0 };
	for (const f of state.facilities) {
		if (f.pflops <= 0) continue;
		const t = treeOf(getDef(content, f.defId));
		if (t) pf[t] += f.pflops;
	}
	return pf;
}

/** SP a day each tree earns at the current delivered compute, weight and factor. */
export function spRates(state: SimState, content: ContentDB): Record<AscensionPath, number> {
	const s = content.balance.soul;
	const pf = treePflops(state, content);
	const out: Record<AscensionPath, number> = { synthetic: 0, biotech: 0, greentech: 0 };
	for (const t of TREES) out[t] = pf[t] * s.spPerPflopHour * 24 * s.spWeights[t] * treeFactor(state, content, t);
	return out;
}

/** The highest rung of each tree that the tower holds a rack at (0 = none). */
export function rungsHeld(state: SimState, content: ContentDB): Record<AscensionPath, number> {
	const out: Record<AscensionPath, number> = { synthetic: 0, biotech: 0, greentech: 0 };
	for (const f of state.facilities) {
		const d = getDef(content, f.defId);
		const t = treeOf(d);
		if (t && !f.grown && (d.rung ?? 0) > out[t]) out[t] = d.rung ?? 0;
	}
	return out;
}

/** The tree with the most installed tree-rack compute (ties and none: null). It only colours the world and the music. */
export function leadingTree(state: SimState, content: ContentDB): AscensionPath | null {
	const pf: Record<AscensionPath, number> = { synthetic: 0, biotech: 0, greentech: 0 };
	for (const f of state.facilities) {
		const d = getDef(content, f.defId);
		const t = treeOf(d);
		if (t && !f.grown) pf[t] += d.rack?.pflops ?? 0;
	}
	let best: AscensionPath | null = null;
	for (const t of TREES) if (pf[t] > 0 && (best === null || pf[t] > pf[best])) best = t;
	if (best !== null && TREES.some((t) => t !== best && pf[t] === pf[best as AscensionPath])) return null;
	return best;
}

/** Hourly: seal residue from running facilities, SP accrual, and the three wins. */
export function soulStep(ctx: TickCtx): void {
	const { state, content } = ctx;
	if (minuteOfDay(state.tick) % TICKS_PER_HOUR !== 0 || state.gameOver) return;
	const s = content.balance.soul;
	const resid: Record<SealedTree, number> = { biotech: 0, greentech: 0 };
	const pf: Record<AscensionPath, number> = { synthetic: 0, biotech: 0, greentech: 0 };
	for (const f of state.facilities) {
		const d = getDef(content, f.defId);
		if (d.seal && running(d, f)) for (const t of SEALED_TREES) resid[t] += d.seal[t] ?? 0;
		if (d.kind !== "rack" || f.pflops <= 0) continue;
		const t = treeOf(d);
		if (t) pf[t] += f.pflops;
	}
	// Points first, at the seal the hour started with; then what the running buildings do to the seal.
	for (const t of TREES) addSp(state, t, pf[t] * s.spPerPflopHour * s.spWeights[t] * treeFactor(state, content, t));
	for (const t of SEALED_TREES) addResidue(state, t, (resid[t] * s.residuePerDay) / 24);
	soulWins(ctx);
}

const ENDING_OF: Record<AscensionPath, "singularity" | "flesh" | "garden"> = { synthetic: "singularity", biotech: "flesh", greentech: "garden" };

/** The first tree at its target ends the game; if two cross in the same hour, the one furthest past it wins. */
export function soulWins(ctx: TickCtx): void {
	const { state, content, events } = ctx;
	const target = content.balance.soul.spTarget;
	if (state.gameOver) return;
	let win: AscensionPath | null = null;
	for (const t of TREES) if (state.sp[t] >= target && (win === null || state.sp[t] > state.sp[win])) win = t;
	if (win) setGameOver(state, "victory", events, ENDING_OF[win]);
}
