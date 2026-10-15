import type { ContentDB, FacilityDef } from "@aitower/content";
import type { Facility } from "../core/state";

export function getDef(content: ContentDB, defId: string): FacilityDef {
	const d = content.facilities[defId];
	if (!d) throw new Error(`unknown facility def '${defId}'`);
	return d;
}

/** Needs a power conduit under one of its cells (`placement.needsPower` overrides the default). */
export function needsPower(d: FacilityDef): boolean {
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
export const isLiquidRack = (d: FacilityDef): boolean => d.kind === "rack" && !!d.rack && d.rack.liquidFraction > 0;

/** Rack producing compute (storage racks have 0 PFLOPS). */
export const isComputeRack = (d: FacilityDef): boolean => d.kind === "rack" && !!d.rack && d.rack.pflops > 0;

export const isStorageRack = (d: FacilityDef): boolean => d.kind === "rack" && !!d.rack && d.rack.pflops <= 0 && d.rack.storageTB > 0;

/** Tile bots walk to when servicing a facility. */
export const serviceTile = (f: Pick<Facility, "x" | "width">): number => f.x + (f.width >> 1);
