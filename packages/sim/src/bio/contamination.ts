/**
 * Tick stage 8c: the contamination field (0..1 per slab cell). Flux-form (pairwise, conserving) diffusion between open
 * neighbours (`diffusion` sideways, × `slabFactor` between floors, × `quarantineLeak` across a quarantine cell), then decay,
 * then emission (organoid racks × load, bioreactors, growths), then sterilizers, then clamp. Unbuilt cells hold nothing and
 * pass nothing. Also derives `contaminatedShare` and raises the sticky `irreversible` flag.
 */
import type { TickCtx } from "../core/context";
import { CONTAMINATED_CELL, CONTAMINATION_FLOOR, EPS } from "../core/constants";
import { floorCount } from "../core/grid";
import { powerFactor } from "../power/powerSolve";
import { getDef, isGrowth } from "../world/defs";
import { ensureBioIndex, rackLoad } from "./index";

/** Add contamination (clamped to 1) at a cell; used for one-off sources such as a fleshed bot's repair. */
export function addContamination(state: { contamination: Float32Array; width: number; floorMin: number }, x: number, floor: number, amount: number): void {
	const i = (floor - state.floorMin) * state.width + x;
	state.contamination[i] = Math.min(1, state.contamination[i] + amount);
}

export function contaminationStep(ctx: TickCtx): void {
	const { state, content, events, scratch } = ctx;
	const bio = content.balance.bio;
	const idx = ensureBioIndex(ctx);
	const w = state.width;
	const h = floorCount(state);
	const n = w * h;
	const C = state.contamination;
	const slab = state.slab;
	// Nothing emits and nothing is contaminated: every pass below would write zeros back (diffusion of zeros, decay of
	// zero, the share stays 0, `irreversible` needs a positive share), so skip them. Exactly equivalent, and the common
	// case for a tower without organoids.
	if (idx.emitters.length === 0) {
		let clean = true;
		for (let i = 0; i < n; i++) if (C[i] !== 0) { clean = false; break; }
		if (clean) {
			state.contaminatedShare = 0;
			return;
		}
	}
	const next = scratch.tempB;
	const mask = idx.mask;
	mask.fill(0);
	for (const f of idx.quarantines) {
		if (!f.enabled) continue;
		for (let k = 0; k < f.width; k++) mask[(f.floor - state.floorMin) * w + f.x + k] = 1;
	}
	const kH = Math.min(0.25, Math.max(0, bio.diffusion));
	const kV = Math.min(0.25, Math.max(0, bio.diffusion * bio.slabFactor));
	const leak = Math.min(1, Math.max(0, bio.quarantineLeak));
	for (let i = 0; i < n; i++) next[i] = slab[i] ? C[i] : 0;
	for (let row = 0; row < h; row++) {
		for (let x = 0; x < w; x++) {
			const i = row * w + x;
			if (!slab[i]) continue;
			if (x + 1 < w && slab[i + 1]) {
				const flow = kH * (mask[i] || mask[i + 1] ? leak : 1) * (C[i + 1] - C[i]);
				next[i] += flow;
				next[i + 1] -= flow;
			}
			if (row + 1 < h && slab[i + w]) {
				const flow = kV * (mask[i] || mask[i + w] ? leak : 1) * (C[i + w] - C[i]);
				next[i] += flow;
				next[i + w] -= flow;
			}
		}
	}
	const keep = 1 - Math.min(1, Math.max(0, bio.decay));
	for (let i = 0; i < n; i++) next[i] *= keep;

	// Emission.
	for (const f of idx.emitters) {
		if (!f.enabled) continue;
		const d = getDef(content, f.defId);
		let e = 0;
		if (isGrowth(d) || d.kind === "bioreactor") e = d.kind === "bioreactor" && f.nutrientSat <= EPS ? 0 : (d.bio?.contamination ?? 0);
		else e = (d.rack?.bio?.contamination ?? 0) * rackLoad(state, content, f);
		if (e <= 0) continue;
		const base = (f.floor - state.floorMin) * w + f.x;
		for (let k = 0; k < f.width; k++) if (slab[base + k]) next[base + k] += e;
	}

	// Sterilizers.
	const factor = state.irreversible ? bio.irreversibleCleanFactor : 1;
	for (const f of idx.sterilizers) {
		if (!f.enabled) continue;
		const d = getDef(content, f.defId);
		const rate = (d.bio?.cleanRate ?? 0) * powerFactor(f.sat) * factor;
		if (rate <= 0) continue;
		const r = d.bio?.radius ?? 0;
		const x0 = Math.max(0, f.x - r);
		const x1 = Math.min(w - 1, f.x + f.width - 1 + r);
		const base = (f.floor - state.floorMin) * w;
		for (let x = x0; x <= x1; x++) if (slab[base + x]) next[base + x] = Math.max(0, next[base + x] - rate);
	}

	let built = 0;
	let hot = 0;
	for (let i = 0; i < n; i++) {
		if (!slab[i]) {
			C[i] = 0;
			continue;
		}
		built++;
		let v = next[i];
		v = v > 1 ? 1 : v < CONTAMINATION_FLOOR ? 0 : v;
		C[i] = v;
		if (C[i] >= CONTAMINATED_CELL) hot++;
	}
	state.contaminatedShare = built > 0 ? hot / built : 0;
	if (!state.irreversible && state.contaminatedShare >= bio.irreversibleShare && bio.irreversibleShare > 0) {
		state.irreversible = true;
		events.push({ type: "contaminationIrreversible" });
	}
}
