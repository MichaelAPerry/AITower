/**
 * The Soul (docs/SOUL.md): Singularity points, the secret seal numbers and advisor bonds.
 *
 *  - SP: hourly, every running rack adds its delivered PFLOPS × the line weight × `spPerPflopHour` to each tree. Synthetic always
 *    accrues; Bio and Green only after committing to them, scaled by (1 − seal/sealMax), Green also by the green score.
 *  - Seal = scar (placing an item, permanent) + residue (running items, decisions; cleanable, never below 0).
 *  - A committed Bio/Green tree whose seal reaches `sealMax` rejects the player: the path falls back to Synthetic.
 *  - The first tree to `spTarget` wins (the committed tree is checked first).
 */
import { type AdvisorId, type AscensionPath, CHAMPION, type ContentDB, type FacilityDef, SEALED_TREES, type SealedTree, type TreeLine } from "@aitower/content";
import type { TickCtx } from "../core/context";
import { TICKS_PER_HOUR } from "../core/constants";
import { GensetMode, type SimState } from "../core/state";
import { minuteOfDay } from "../core/time";
import { setGameOver } from "./gameOver";
import { getDef } from "../world/defs";

export const lineOf = (d: FacilityDef): TreeLine => d.line ?? "shared";

export const sealOf = (state: SimState, tree: SealedTree): number => state.sealScar[tree] + state.sealResidue[tree];

/** 0..1, 1 = sealed. */
export const sealShare = (state: SimState, content: ContentDB, tree: SealedTree): number => Math.min(1, sealOf(state, tree) / content.balance.soul.sealMax);

export const isSealed = (state: SimState, content: ContentDB, tree: SealedTree): boolean => sealOf(state, tree) >= content.balance.soul.sealMax;

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

/** Why the player may not commit to `path` right now, or null. */
export function commitBlock(state: SimState, content: ContentDB, path: AscensionPath): string | null {
	if (path === "synthetic") return null;
	const s = content.balance.soul;
	if (state.sealedOut.includes(path) || isSealed(state, content, path)) return `${path === "biotech" ? "The Flesh" : "The Garden"} is closed to this tower`;
	const champ = CHAMPION[path];
	if (state.bonds[champ] < s.bondCommit) return `needs ${champ === "mel" ? "Dr. Mel Kiorre" : "Bea Altasar"}'s trust (bond ${s.bondCommit})`;
	return null;
}

/** A facility counts as running for the soul when enabled and not failed; a genset only while it runs. */
function running(d: FacilityDef, f: SimState["facilities"][number]): boolean {
	if (!f.enabled || f.failed) return false;
	if (d.kind === "genset") return f.gensetMode === GensetMode.Running;
	return true;
}

/** Hourly: seal residue from running facilities, SP accrual, lock-out, and the three wins. */
export function soulStep(ctx: TickCtx): void {
	const { state, content, events } = ctx;
	if (minuteOfDay(state.tick) % TICKS_PER_HOUR !== 0 || state.gameOver) return;
	const s = content.balance.soul;
	const w = s.spWeights;
	const resid: Record<SealedTree, number> = { biotech: 0, greentech: 0 };
	const pf: Record<TreeLine, number> = { shared: 0, synthetic: 0, biotech: 0, greentech: 0 };
	for (const f of state.facilities) {
		const d = getDef(content, f.defId);
		if (d.seal && running(d, f)) for (const t of SEALED_TREES) resid[t] += d.seal[t] ?? 0;
		if (d.kind === "rack" && f.pflops > 0) pf[lineOf(d)] += f.pflops;
	}
	for (const t of SEALED_TREES) addResidue(state, t, (resid[t] * s.residuePerDay) / 24);

	const sum = (path: AscensionPath): number => {
		let n = 0;
		for (const [line, k] of Object.entries(w[path])) n += pf[line as TreeLine] * (k ?? 0);
		return n * s.spPerPflopHour;
	};
	addSp(state, "synthetic", sum("synthetic"));
	if (state.path === "biotech") addSp(state, "biotech", sum("biotech") * (1 - sealShare(state, content, "biotech")));
	if (state.path === "greentech") addSp(state, "greentech", sum("greentech") * state.greenScore * (1 - sealShare(state, content, "greentech")));

	// Lock-out: the committed tree rejects a tower that sealed it.
	const p = state.path;
	if ((p === "biotech" || p === "greentech") && isSealed(state, content, p)) {
		state.path = "synthetic";
		if (!state.sealedOut.includes(p)) state.sealedOut.push(p);
		events.push({ type: "sealedOut", path: p });
	}
	soulWins(ctx);
}

/** The first tree at its target ends the game; the committed tree is checked before Synthetic. */
export function soulWins(ctx: TickCtx): void {
	const { state, content, events } = ctx;
	const target = content.balance.soul.spTarget;
	if (state.gameOver) return;
	if (state.path === "biotech" && state.sp.biotech >= target) setGameOver(state, "victory", events, "flesh");
	else if (state.path === "greentech" && state.sp.greentech >= target) setGameOver(state, "victory", events, "garden");
	else if (state.sp.synthetic >= target) setGameOver(state, "victory", events, "singularity");
}
