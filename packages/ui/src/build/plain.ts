/**
 * Plain-language copy and numbers for the Build catalog and its Inspector. Pure: no React, so it is unit-tested.
 * Every number comes from content; only the wording is written here.
 */
import type { BuildCategory, ContentDB, FacilityDef } from "@aitower/content";
import type { SimView } from "@aitower/sim";
import type { Tool } from "@aitower/shared";
import { bandText } from "../bio/bio";
import { fmtMoney, fmtPflops, fmtPower } from "../format";
import { techGate, techName } from "../research/tech";

export type Tab = "structure" | BuildCategory | "supplies";

export const CATEGORY_LABEL: Record<Tab, string> = {
	structure: "Structure",
	rack: "Racks",
	power: "Power",
	cooling: "Cooling",
	logistics: "Logistics",
	bio: "Wetware",
	supplies: "Supplies",
};

export type StatIcon = "bolt" | "drop" | "star" | "demolish" | "slab" | "leaf" | "lift" | "$";
export interface Stat {
	icon: StatIcon;
	label: string;
	/** One plain sentence under the label. */
	sub: string;
	value: string;
	tone?: "warn" | "money";
}

/** What the catalog and Inspector show for one buildable thing: a floor/conduit/lift/demolish tool, or a facility. */
export interface CatalogItem {
	key: string;
	name: string;
	category: Tab;
	tool: Tool;
	cost: number;
	/** Cost as shown on the card. */
	costText: string;
	blurb: string;
	stats: Stat[];
	/** Encyclopedia entry for the "?" link. */
	entry?: string;
	def?: FacilityDef;
	icon?: StatIcon;
	danger?: boolean;
}

const KIND_BLURB: Partial<Record<FacilityDef["kind"], string>> = {
	grid_tie: "Your connection to the city's power. Reliable, and you pay for what you use.",
	genset: "A backup generator. It starts when power runs short, but the fuel is pricey.",
	ups: "A battery. It keeps everything running during an outage until a generator starts.",
	solar: "Panels that make free power in daylight and nothing at night.",
	wind: "A wind turbine. Free power while the wind blows.",
	bioreactor: "Burns nutrient liquid to make power. Strong, but it leaks contamination.",
	crah: "An air handler. It cools the air around the racks close to it.",
	chiller: "Chills the water in your coolant pipes. Liquid-cooled racks need one.",
	cdu: "Passes cold water on to liquid racks, so several racks can share one loop.",
	heat_export: "Takes heat out of the air and sells it to the neighbourhood heating.",
	carbon: "Soaks up carbon and earns carbon credits every day.",
	depot: "A shelf of spare parts. Repair bots fetch from here when a rack breaks.",
	charger: "A dock where repair bots recharge. New bots arrive here.",
	nutrient: "Makes the nutrient liquid that wetware racks feed on. It travels down nutrient pipes.",
	sterilizer: "Cleans contamination off the tiles near it.",
	quarantine: "A sealed door that stops contamination from spreading through.",
};

/** One or two friendly sentences for a facility. */
export function plainBlurb(def: FacilityDef): string {
	if (def.rack) {
		const c = def.rack.cooling;
		if (c === "bio") return "Living tissue that does computing. It likes a steady 37 °C and needs nutrient pipes.";
		if (def.rack.pflops <= 0) return "Shelves of disks that hold the data your jobs need. No storage, no big jobs.";
		if (c === "air") return "A cabinet full of computers that run your customers' jobs. They get hot, so keep an air handler close.";
		if (c === "dlc") return "A powerful cabinet cooled by liquid pipes. It does more work, but needs a coolant loop.";
		return "Computers sunk in a bath of special liquid. Very strong, and it needs a coolant loop.";
	}
	return KIND_BLURB[def.kind] ?? "Part of your datacenter.";
}

const days = (perDay: number): string => (perDay >= 1 ? "several times a day" : `about 1 in ${Math.max(1, Math.round(1 / perDay))} days`);

/** The numbers a first-time player needs, each with a plain sentence. */
export function plainStats(def: FacilityDef): Stat[] {
	const s: Stat[] = [];
	const r = def.rack;
	if (r) {
		s.push({ icon: "bolt", label: "Power", sub: "Electricity it uses", value: fmtPower(r.powerKw + def.facilityKw) });
		if (r.cooling === "air") s.push({ icon: "drop", label: "Heat", sub: "Needs an air handler nearby", value: "Air", tone: "warn" });
		else if (r.cooling === "bio") s.push({ icon: "drop", label: "Heat", sub: "Must stay in a narrow warm band", value: r.bio ? bandText(r.bio) : "37 °C" });
		else s.push({ icon: "drop", label: "Heat", sub: "Needs a coolant pipe, a chiller and a CDU", value: r.cooling === "dlc" ? "Liquid" : "Bath" });
		if (r.pflops > 0) s.push({ icon: "star", label: "Earns", sub: "Compute for your jobs", value: fmtPflops(r.pflops), tone: "money" });
		if (r.storageTB > 0) s.push({ icon: "star", label: "Storage", sub: "Room for job data", value: `${r.storageTB.toLocaleString("en-US")} TB`, tone: "money" });
		if (r.bio) s.push({ icon: "leaf", label: "Food", sub: "Nutrient liquid it drinks each minute", value: `${r.bio.nutrientUse}` });
		if (r.failurePerDay > 0) s.push({ icon: "demolish", label: "Breaks", sub: "Keep spare parts stocked", value: days(r.failurePerDay) });
	} else {
		if (def.power) {
			s.push({ icon: "bolt", label: def.kind === "ups" ? "Backup power" : "Makes", sub: def.kind === "ups" ? "How much it can hand out at once" : "Electricity it can make", value: fmtPower(def.power.capacityKw) });
			if (def.power.storageKwh) s.push({ icon: "bolt", label: "Holds", sub: "How much it can store", value: `${def.power.storageKwh.toLocaleString("en-US")} kWh` });
			if (def.power.startDelayTicks) s.push({ icon: "bolt", label: "Wake-up", sub: "Time before it starts helping", value: `${def.power.startDelayTicks} min` });
			if (def.power.costPerKwh) s.push({ icon: "$", label: "Fuel", sub: "What each kWh costs you", value: `$${def.power.costPerKwh}`, tone: "warn" });
		}
		if (def.cooling) {
			s.push({ icon: "drop", label: "Cools", sub: def.kind === "cdu" ? "Heat from liquid racks it can pass on" : "Heat it can remove", value: fmtPower(def.cooling.capacityKw) });
			if (def.cooling.radius) s.push({ icon: "drop", label: "Reach", sub: "Racks this close get cooled", value: `${def.cooling.radius} tiles` });
			if (def.cooling.cop) s.push({ icon: "bolt", label: "Thrift", sub: "Heat moved per 1 kW of electricity", value: `${def.cooling.cop}x` });
		}
		if (def.logistics) {
			s.push(def.kind === "depot" ? { icon: "demolish", label: "Holds", sub: "Spare parts it can keep", value: String(def.logistics.capacity) } : { icon: "bolt", label: "Bays", sub: "Bots that can recharge at once", value: String(def.logistics.capacity) });
		}
		if (def.green?.exportKw) s.push({ icon: "drop", label: "Takes heat", sub: "Heat it can sell on", value: `${fmtPower(def.green.exportKw)} · ${def.green.radius ?? 0} tiles` });
		if (def.green?.creditsPerDay) s.push({ icon: "$", label: "Earns", sub: "Carbon credits each day", value: String(def.green.creditsPerDay), tone: "money" });
		if (def.bio?.nutrientCapacity) s.push({ icon: "leaf", label: "Makes", sub: "Nutrient liquid per minute", value: String(def.bio.nutrientCapacity) });
		if (def.bio?.cleanRate) s.push({ icon: "leaf", label: "Cleans", sub: "Contamination within reach", value: `${def.bio.radius ?? 0} tiles` });
		if (def.facilityKw > 0) s.push({ icon: "bolt", label: "Power", sub: "Electricity it uses itself", value: fmtPower(def.facilityKw) });
	}
	const p = def.placement;
	if (p?.needsCoolant) s.push({ icon: "drop", label: "Needs", sub: "A coolant pipe under it", value: "Pipe" });
	if (p?.needsNutrient) s.push({ icon: "leaf", label: "Needs", sub: "A nutrient pipe under it", value: "Pipe" });
	if (p?.minFloor !== undefined) s.push({ icon: "lift", label: "Floor", sub: "It only fits on upper floors", value: `${p.minFloor}+` });
	s.push({ icon: "slab", label: "Size", sub: "Floor space it takes", value: `${def.width} tile${def.width === 1 ? "" : "s"}` });
	s.push({ icon: "$", label: "Costs", sub: `Then ${fmtMoney(def.upkeepPerDay)} a day to run`, value: fmtMoney(def.cost) });
	return s;
}

/** The structure tools (floors, pipes, lifts, demolish) as catalog items. */
export function structureItems(content: ContentDB, nutrientTile: number): CatalogItem[] {
	const st = content.structure;
	const mk = (key: string, name: string, tool: Tool, icon: StatIcon, costText: string, blurb: string, how: string, extra: Stat[] = [], danger = false): CatalogItem => ({
		key,
		name,
		category: "structure",
		tool,
		cost: 0,
		costText,
		blurb,
		icon,
		danger,
		stats: [...extra, { icon: "$", label: "Costs", sub: how, value: costText }],
	});
	return [
		mk("slab", "Floor slab", { kind: "slab" }, "slab", `${fmtMoney(st.slabPerTile)}/tile`, "The ground everything stands on. Drag along a floor to lay it. Floors above the ground need slab underneath.", `Basement slab is ${fmtMoney(st.basementSlabPerTile)} a tile`),
		mk("conduit-power", "Power pipe", { kind: "conduit", layer: "power" }, "bolt", `${fmtMoney(st.powerConduitPerTile)}/tile`, "Carries electricity from your power sources to your racks. Drag to draw a line, up and down floors too.", "Drag a corner-shaped run"),
		mk("conduit-coolant", "Coolant pipe", { kind: "conduit", layer: "coolant" }, "drop", `${fmtMoney(st.coolantConduitPerTile)}/tile`, "Carries cold water between chillers and liquid-cooled racks.", "Drag a corner-shaped run"),
		mk("conduit-nutrient", "Nutrient pipe", { kind: "conduit", layer: "nutrient" }, "leaf", `${fmtMoney(nutrientTile)}/tile`, "Carries nutrient liquid from a nutrient plant to wetware racks.", "Drag a corner-shaped run"),
		mk("lift", "Service lift", { kind: "lift" }, "lift", `${fmtMoney(st.liftBase)}+${fmtMoney(st.liftPerFloor)}/fl`, "Lets repair bots change floors. Every floor it passes needs slab at that spot.", `Plus ${fmtMoney(st.liftPerFloor)} for each floor it spans`),
		mk("demolish", "Demolish", { kind: "demolish" }, "demolish", "50% back", "Removes whatever is on top in a tile: a machine first, then a lift, a pipe, then the slab. You get half the money back.", "Click or drag over tiles", [], true),
	];
}

export function facilityItem(def: FacilityDef): CatalogItem {
	return {
		key: def.id,
		name: def.name,
		category: def.category,
		tool: { kind: "place", defId: def.id },
		cost: def.cost,
		costText: fmtMoney(def.cost),
		blurb: plainBlurb(def),
		stats: plainStats(def),
		entry: `fac:${def.id}`,
		def,
	};
}

/** The tech/level reason a facility cannot be built yet, or null. */
export function lockReason(def: FacilityDef, view: SimView, content: ContentDB): { level?: number; tech?: string } | null {
	const tech = techGate(def.tech, view, content) ? def.tech : undefined;
	const level = def.unlockTier > view.tier ? def.unlockTier : undefined;
	return tech || level ? { level, tech } : null;
}

/**
 * The single "Coming at Level N" row: the next level's items, then research-gated items, then a count of the rest.
 * Returns no lines when nothing is locked.
 */
export function lockedSummary(locked: FacilityDef[], view: SimView, content: ContentDB): string[] {
	const byLevel = locked.filter((d) => d.unlockTier > view.tier);
	const byTech = locked.filter((d) => d.unlockTier <= view.tier);
	const lines: string[] = [];
	let shown = 0;
	if (byLevel.length) {
		const next = Math.min(...byLevel.map((d) => d.unlockTier));
		const names = byLevel.filter((d) => d.unlockTier === next).map((d) => d.name);
		lines.push(`Coming at Level ${next}: ${names.join(", ")}`);
		shown += names.length;
	}
	const techs = [...new Set(byTech.map((d) => d.tech).filter((t): t is string => !!t))];
	for (const t of techs) {
		const names = byTech.filter((d) => d.tech === t).map((d) => d.name);
		lines.push(`Research "${techName(content, t)}" to unlock ${names.join(", ")}`);
		shown += names.length;
	}
	const rest = locked.length - shown;
	if (rest > 0) lines.push(`${rest} more at higher Levels`);
	return lines;
}
