/**
 * Who may place what (docs/TREES.md): the sim's side of `@aitower/content`'s `access`. One function, `placeBlock`, answers
 * "why can this player not place `d` right now?" for the `place` and `upgradeFacility` commands, the Foreman and the UI.
 */
import { access, type Access, type AccessCtx, type AdvisorId, type ContentDB, type FacilityDef, CHAMPION } from "@aitower/content";
import type { SimState } from "../core/state";
import { techGate } from "../research/research";
import { addBond } from "./soul";

export function accessCtx(state: SimState): AccessCtx {
	return {
		path: state.path,
		tier: state.tier,
		bonds: state.bonds,
		sealedOut: state.sealedOut,
		owned: (defId) => {
			let n = 0;
			for (const f of state.facilities) if (f.defId === defId) n++;
			return n;
		},
	};
}

export const placeAccess = (state: SimState, d: FacilityDef): Access => access(d, accessCtx(state));

/**
 * Why `d` cannot be built by this player now (Level, commit / bond rules, research), or null. Cash, floor and site rules are
 * the plan's own business. `ignoreTier` skips everything (scenario setup).
 */
export function placeBlock(state: SimState, content: ContentDB, d: FacilityDef): string | null {
	const a = placeAccess(state, d);
	if (a.tier > state.tier) return `requires tier ${a.tier}`;
	if (a.block) return a.block.text;
	if (!a.preview) {
		const gate = techGate(state, content, d.tech);
		if (gate) return gate;
	}
	return null;
}

/** Placing an item earns its advisor a little trust, once: a Starter set warms its champion, a signature build its own advisor. */
export function bondOnBuild(state: SimState, d: FacilityDef): void {
	const sig = d.unlock?.bond;
	if (sig) {
		const key = `sig:${d.id}`;
		if (!state.bondGiven.includes(key)) {
			state.bondGiven.push(key);
			addBond(state, sig.who as AdvisorId, 1);
		}
		return;
	}
	if (d.tier === "starter" && (d.line === "biotech" || d.line === "greentech")) {
		const key = `starter:${d.line}`;
		if (!state.bondGiven.includes(key)) {
			state.bondGiven.push(key);
			addBond(state, CHAMPION[d.line], 1);
		}
	}
}
