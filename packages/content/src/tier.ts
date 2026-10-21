/**
 * Facility tier ladder (docs/mockups/m6-redesign.html section 03). Pure and computed from `unlockTier`, the lane of the
 * gating tech and the path; it never changes a balance number. Sim, UI and render share it.
 *
 *   Standard : core-ladder items at Level 1 or 2.
 *   Advanced : core-ladder items at Level 3.
 *   Frontier : core-ladder items at Level 4 and 5.
 *   Path     : gated by a path lane (Wetware, Green, Synthetic), any Level.
 */
import type { AscensionPath, ContentDB, FacilityDef } from "./schema";

export type FacilityTier = "standard" | "advanced" | "frontier" | "path";

/** Cheapest first. Used for "up to" caps. Path sits outside the ladder. */
export const TIER_ORDER: readonly Exclude<FacilityTier, "path">[] = ["standard", "advanced", "frontier"];

export const TIER_LABEL: Record<FacilityTier, string> = { standard: "Standard", advanced: "Advanced", frontier: "Frontier", path: "Path" };

export interface TierInfo {
	tier: FacilityTier;
	/** Set for Path items. */
	path?: AscensionPath;
}

const LANE_PATH: Record<string, AscensionPath> = { wet: "biotech", green: "greentech", syn: "synthetic" };

/** The path an item belongs to, or undefined for the core ladder. */
export function facilityPath(def: FacilityDef, content: Pick<ContentDB, "tech">): AscensionPath | undefined {
	const node = def.tech ? content.tech.find((t) => t.id === def.tech) : undefined;
	const lane = node?.lane;
	if (lane && LANE_PATH[lane]) return LANE_PATH[lane];
	if (node?.path) return node.path;
	if (def.growth || def.bio || def.rack?.bio) return "biotech";
	if (def.green) return "greentech";
	return undefined;
}

/** The tier of a facility: exactly one of Standard, Advanced, Frontier or Path. */
export function facilityTier(def: FacilityDef, content: Pick<ContentDB, "tech">): TierInfo {
	const path = facilityPath(def, content);
	if (path) return { tier: "path", path };
	return { tier: def.unlockTier <= 2 ? "standard" : def.unlockTier === 3 ? "advanced" : "frontier" };
}

/** Rank on the ladder (0 Standard, 1 Advanced, 2 Frontier); Path items are -1 (off the ladder). */
export const tierRank = (t: FacilityTier): number => TIER_ORDER.indexOf(t as (typeof TIER_ORDER)[number]);

/** One number a card compares across the catalogue: PFLOPS for racks, kW capacity for power and cooling, else null. */
export function outputOf(def: FacilityDef): { value: number; unit: "PF" | "kW" } | null {
	if (def.rack && def.rack.pflops > 0) return { value: def.rack.pflops, unit: "PF" };
	if (def.power && def.power.capacityKw > 0) return { value: def.power.capacityKw, unit: "kW" };
	if (def.cooling && def.cooling.capacityKw > 0) return { value: def.cooling.capacityKw, unit: "kW" };
	return null;
}

/** The output of `def` as a 0..1 share of the best item of the same kind in the catalogue (null when it has none). */
export function outputShare(def: FacilityDef, content: Pick<ContentDB, "facilities">): number | null {
	const o = outputOf(def);
	if (!o) return null;
	let best = 0;
	for (const d of Object.values(content.facilities)) {
		if (d.growth || d.retired) continue;
		const x = outputOf(d);
		if (x && x.unit === o.unit && d.kind === def.kind) best = Math.max(best, x.value);
	}
	return best > 0 ? Math.min(1, o.value / best) : null;
}

/** Balance note from the design doc: shown on the card of the item where a line stops improving. */
export const AIR_TOPS_OUT = "Air tops out here";
const AIR_TOPS_OUT_IDS: ReadonlySet<string> = new Set(["rack_air_gpu3", "rack_air_gpu2"]);
export const tierNote = (def: FacilityDef): string | undefined => (AIR_TOPS_OUT_IDS.has(def.id) ? AIR_TOPS_OUT : undefined);

/** What a rack's cooling line is (the Foreman's "Racks: Air / Liquid / Immersion line"). */
export type RackLine = "air" | "liquid" | "immersion";
export function rackLine(def: FacilityDef): RackLine | null {
	const c = def.rack?.cooling;
	if (!c || def.rack!.pflops <= 0) return null;
	return c === "air" ? "air" : c === "dlc" ? "liquid" : c === "immersion" ? "immersion" : null;
}
