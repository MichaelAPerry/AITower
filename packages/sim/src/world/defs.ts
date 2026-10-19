import type { ContentDB, FacilityDef, OrganoidSpec } from "@aitower/content";
import type { Facility } from "../core/state";

export function getDef(content: ContentDB, defId: string): FacilityDef {
	const d = content.facilities[defId];
	if (!d) throw new Error(`unknown facility def '${defId}'`);
	return d;
}

/** Needs a power conduit under one of its cells (`placement.needsPower` overrides the default). */
export function needsPower(d: FacilityDef): boolean {
	if (d.growth) return false; // growths work without any conduit
	if (d.placement?.needsPower !== undefined) return d.placement.needsPower;
	if (d.facilityKw > 0) return true;
	switch (d.kind) {
		case "rack":
		case "grid_tie":
		case "genset":
		case "ups":
		case "chiller":
			return true;
		case "charger":
			return (d.logistics?.chargeKw ?? 0) > 0;
		default:
			return false;
	}
}

/** Rack rejecting part of its heat into a coolant net. */
export const isLiquidRack = (d: FacilityDef): boolean => d.kind === "rack" && !!d.rack && d.rack.cooling !== "bio" && d.rack.liquidFraction > 0;

/** Rack producing compute (storage racks have 0 PFLOPS). */
export const isComputeRack = (d: FacilityDef): boolean => d.kind === "rack" && !!d.rack && d.rack.pflops > 0;

export const isStorageRack = (d: FacilityDef): boolean => d.kind === "rack" && !!d.rack && d.rack.pflops <= 0 && d.rack.storageTB > 0;

/** Tile bots walk to when servicing a facility. */
export const serviceTile = (f: Pick<Facility, "x" | "width">): number => f.x + (f.width >> 1);

/** A growth: sprouted by the sim, free, needs no conduit, heals itself. */
export const isGrowth = (d: FacilityDef): boolean => d.growth === true;

/** Organoid rack (`cooling: "bio"`), growth or not: counts as organoid compute and may serve `needsBio` contracts. */
export const isBioRack = (d: FacilityDef): boolean => d.kind === "rack" && d.rack?.cooling === "bio";

/** Temperature-band / nutrient parameters of a built organoid rack (growths follow neither). */
export const organoidSpec = (d: FacilityDef): OrganoidSpec | undefined => (d.kind === "rack" && d.rack?.cooling === "bio" && !d.growth ? d.rack.bio : undefined);

/** Draws from a nutrient net: organoid racks and bioreactors (never growths). */
export const isNutrientConsumer = (d: FacilityDef): boolean => !d.growth && (organoidSpec(d) !== undefined || (d.kind === "bioreactor" && (d.bio?.nutrientUse ?? 0) > 0));
