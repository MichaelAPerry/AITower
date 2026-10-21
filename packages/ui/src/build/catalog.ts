/** Catalog lookup shared by the build bar, the catalog grid and the Inspector. */
import type { BuildCategory, ContentDB, FacilityDef } from "@aitower/content";
import type { SimView } from "@aitower/sim";
import type { Tool } from "@aitower/shared";
import { techGate } from "../research/tech";
import { conduitUnitCost, toolKey } from "../tools/controller";
import { type CatalogItem, type Tab, facilityItem, lockReason, structureItems } from "./plain";

export const structure = (content: ContentDB): CatalogItem[] => structureItems(content, conduitUnitCost(content, "nutrient"));

/** Buildable facilities of a category: those the player can build now first (by level, then cost), locked ones separately. */
export function categoryDefs(content: ContentDB, view: SimView, cat: BuildCategory): { open: FacilityDef[]; locked: FacilityDef[] } {
	const defs = Object.values(content.facilities)
		.filter((d) => d.category === cat && !d.growth && !d.retired)
		.sort((a, b) => a.unlockTier - b.unlockTier || a.cost - b.cost || a.id.localeCompare(b.id));
	return { open: defs.filter((d) => !lockReason(d, view, content)), locked: defs.filter((d) => lockReason(d, view, content)) };
}

/** Find a catalog item by key (a structure tool key or a facility id). */
export function findItem(key: string | null | undefined, content: ContentDB): CatalogItem | null {
	if (!key) return null;
	const s = structure(content).find((i) => i.key === key);
	if (s) return s;
	const d = content.facilities[key];
	return d && !d.growth ? facilityItem(d) : null;
}

/** The catalog item the armed tool belongs to, if any. */
export function itemForTool(tool: Tool, content: ContentDB): CatalogItem | null {
	if (tool.kind === "select") return null;
	if (tool.kind === "place") return findItem(tool.defId, content);
	return structure(content).find((i) => toolKey(i.tool) === toolKey(tool)) ?? null;
}

/** The tab a tool belongs to. */
export function tabForItem(item: CatalogItem): Tab {
	return item.category;
}

export const isBuildable = (d: FacilityDef, view: SimView, content: ContentDB): boolean => !d.growth && !d.retired && !lockReason(d, view, content) && !techGate(d.tech, view, content);
