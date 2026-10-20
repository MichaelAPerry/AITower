/**
 * Path affinity: raw points per ascension path, nudged by memo choices (`affinity` effects), research (+AFFINITY_PER_TECH
 * for a node that leans to a path) and, once per game-hour, by what is running (AFFINITY_PER_FACILITY_HOUR each).
 * `SimView.affinity` reports the shares.
 */
import type { AscensionPath, ContentDB, FacilityDef, TechNode } from "@aitower/content";
import type { TickCtx } from "../core/context";
import { TICKS_PER_HOUR } from "../core/constants";
import { minuteOfDay } from "../core/time";
import type { SimState } from "../core/state";
import { getDef } from "../world/defs";

export const AFFINITY_PER_TECH = 3;
export const AFFINITY_PER_FACILITY_HOUR = 0.01;
/** Rack Clearance from which a non-bio rack counts as synthetic. */
export const SYNTHETIC_RACK_TIER = 4;

export const AFFINITY_PATHS: readonly AscensionPath[] = ["biotech", "greentech", "synthetic"];

/** The path a facility leans to, or null. Growths never count. */
export function facilityPath(d: FacilityDef): AscensionPath | null {
	if (d.growth) return null;
	switch (d.kind) {
		case "nutrient":
		case "sterilizer":
		case "quarantine":
		case "bioreactor":
			return "biotech";
		case "solar":
		case "wind":
		case "heat_export":
		case "carbon":
			return "greentech";
		case "rack":
			if (d.rack?.cooling === "bio") return "biotech";
			return d.unlockTier >= SYNTHETIC_RACK_TIER ? "synthetic" : null;
		default:
			return null;
	}
}

/** The path a tech node leans to: its own `path`, else the wetware branch (biotech), else the path of a facility it unlocks. */
export function techPath(content: ContentDB, node: TechNode): AscensionPath | null {
	if (node.path !== undefined) return node.path;
	if (node.branch === "wetware") return "biotech";
	for (const id of Object.keys(content.facilities).sort()) {
		const d = content.facilities[id];
		if (d.tech === node.id) {
			const p = facilityPath(d);
			if (p) return p;
		}
	}
	return null;
}

export function addAffinity(state: SimState, path: AscensionPath, amount: number): void {
	if (!Number.isFinite(amount)) return;
	state.affinity[path] = Math.max(0, state.affinity[path] + amount);
}

export function affinityShares(state: SimState): Record<AscensionPath, number> {
	const a = state.affinity;
	const total = a.biotech + a.greentech + a.synthetic;
	if (!(total > 0)) return { biotech: 0, greentech: 0, synthetic: 0 };
	return { biotech: a.biotech / total, greentech: a.greentech / total, synthetic: a.synthetic / total };
}

/** Hourly: each running (enabled, not failed) path facility adds a little. */
export function affinityStep(ctx: TickCtx): void {
	const { state, content } = ctx;
	if (minuteOfDay(state.tick) % TICKS_PER_HOUR !== 0) return;
	for (const f of state.facilities) {
		if (!f.enabled || f.failed) continue;
		const p = facilityPath(getDef(content, f.defId));
		if (p) addAffinity(state, p, AFFINITY_PER_FACILITY_HOUR);
	}
}
