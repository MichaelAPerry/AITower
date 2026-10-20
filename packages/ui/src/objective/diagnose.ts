/**
 * Plain-English "why isn't this working?" for racks, derived from the view alone (nets, statuses, content kinds).
 * Used by CURRENT ORDERS and the dossier so a dark cabinet always comes with a reason and a fix.
 */
import type { ContentDB } from "@aitower/content";
import type { FacilityView, SimView } from "@aitower/sim";
import { bandText, organoidBand } from "../bio/bio";
import { fmtPower, fmtTemp } from "../format";

/**
 * Floors with facilities that bots cannot get to: the floors of the bots and chargers, widened through any chain of lifts
 * (mirrors the sim's reachableFloors, from the view). Empty when a flying bot exists or nothing anchors the reach.
 */
export function unreachedFloors(view: SimView, content: ContentDB): number[] {
	if ((view.bots ?? []).some((b) => content.bots?.[b.defId]?.flying)) return [];
	const bots = view.bots ?? [];
	const reach = new Set<number>(bots.map((b) => Math.round(b.floor)));
	for (const f of view.facilities) if (kindOf(content, f) === "charger") reach.add(f.floor);
	if (reach.size === 0) return [];
	for (let grew = true; grew; ) {
		grew = false;
		for (const l of view.lifts ?? []) {
			let serves = false;
			for (let f = l.floorMin; f <= l.floorMax && !serves; f++) serves = reach.has(f);
			if (!serves) continue;
			for (let f = l.floorMin; f <= l.floorMax; f++)
				if (!reach.has(f)) {
					reach.add(f);
					grew = true;
				}
		}
	}
	return [...new Set(view.facilities.filter((f) => !reach.has(f.floor)).map((f) => f.floor))].sort((a, b) => a - b);
}

const kindOf = (content: ContentDB, f: FacilityView): string | undefined => content.facilities[f.defId]?.kind;

/** What is wrong with the coolant loop `net` (null = no pipe at all), or null if it has working chillers and CDUs. */
export function coolantLoopProblem(view: SimView, content: ContentDB, net: number | null): string | null {
	if (net === null) return "No coolant pipe under it. Lay a coolant conduit beneath it and run it to a chiller and a CDU.";
	const on = view.facilities.filter((f) => f.coolantNet === net);
	const chillers = on.filter((f) => kindOf(content, f) === "chiller");
	const cdus = on.filter((f) => kindOf(content, f) === "cdu");
	const working = (f: FacilityView): boolean => f.enabled && f.status !== "unpowered";
	const pipe = "A liquid loop needs a chiller and a CDU on the same coolant pipe (a vertical pipe run joins floors).";
	if (chillers.length === 0 && cdus.length === 0) return `Its coolant pipe reaches no chiller or CDU. ${pipe}`;
	if (chillers.length === 0) return `Its coolant loop has a CDU but no chiller. ${pipe}`;
	if (cdus.length === 0) return `Its coolant loop has a chiller but no CDU (Coolant Distribution Unit). ${pipe}`;
	if (!chillers.some(working)) return "The chiller on its loop is off or has no power: lay a power conduit under it.";
	if (!cdus.some(working)) return "The CDU on its loop is off or has no power: lay a power conduit under it.";
	return null;
}

const units = (n: number): string => String(Math.round(n * 10) / 10);

/** What is wrong with the nutrient line `net` (null = no pipe at all), or null if a powered plant feeds enough. */
export function nutrientLoopProblem(view: SimView, content: ContentDB, net: number | null): string | null {
	const plantName = Object.values(content.facilities).find((d) => d.kind === "nutrient")?.name ?? "Nutrient Plant";
	if (net === null) return `No nutrient pipe under it. Lay a nutrient conduit beneath it and run it to a ${plantName} (Wetware tab).`;
	const plants = view.facilities.filter((f) => f.nutrientNet === net && kindOf(content, f) === "nutrient");
	if (plants.length === 0) return `Its nutrient pipe reaches no ${plantName}. Build one on the same pipe (Wetware tab).`;
	if (!plants.some((f) => f.enabled && f.status !== "unpowered")) return `The ${plantName} on its line is off or has no power: lay a power conduit under it.`;
	const n = view.nutrientNets?.find((x) => x.id === net);
	if (n && n.satisfaction < 1) return `Its nutrient line is short: ${units(n.supply)} of ${units(n.demand)} units a tick. Add another ${plantName}, or take some racks off the line.`;
	return null;
}

/** Why a rack is not computing, with the fix; null when it is fine (ok / brownout) or not a rack. */
export function rackProblem(view: SimView, content: ContentDB, f: FacilityView): string | null {
	const def = content.facilities[f.defId];
	if (!def?.rack) return null;
	switch (f.status) {
		case "disabled":
			return "Switched off. Flip MAINS in its details to turn it on.";
		case "failed":
			return view.spareParts > 0
				? "Broken. A maintenance bot is bringing a spare part to repair it."
				: "Broken, and the spare-parts stock is empty. Buy spare parts so a bot can repair it.";
		case "tripped":
			return def.rack.liquidFraction > 0
				? "Overheated and tripped; it restarts once it cools. Give its coolant loop more capacity (another chiller or CDU), and an air handler for the rest of its heat."
				: "Overheated and tripped; it restarts once it cools. Build an air handler (CRAH) within reach of it.";
		case "unpowered":
			return f.powerNet === null
				? "No power. Lay a power conduit under it, connected to a grid tie."
				: "No power. Its power net has no supply left: add a grid tie or genset to that net.";
		case "noCoolant":
			return coolantLoopProblem(view, content, f.coolantNet) ?? "Its coolant loop has no capacity: add a chiller and a CDU to it.";
		case "noNutrient":
			return nutrientLoopProblem(view, content, f.nutrientNet) ?? "Its nutrient line has run dry. Add a nutrient plant to the line.";
		case "tooCold": {
			const bio = def.rack.bio;
			if (!bio) return "Too cold to run. Put it near warm racks or heat the room.";
			const b = organoidBand(bio);
			return `Too cold: the tissue wants ${bandText(bio)} (full speed from ${fmtTemp(b.lo, 0)}) and it is at ${fmtTemp(f.tempC)}. Put it near warm racks or heat the room.`;
		}
		case "throttled": {
			const net = f.coolantNet === null ? undefined : view.coolantNets.find((n) => n.id === f.coolantNet);
			if (def.rack.liquidFraction > 0 && net && net.loadKw > net.capacityKw)
				return `Running hot and slowed down: its coolant loop is over capacity (${fmtPower(net.loadKw)} of ${fmtPower(net.capacityKw)}). Add a chiller or CDU to that loop.`;
			return "Running hot and slowed down. Add cooling near it.";
		}
		case "idle":
			return def.rack.pflops > 0 ? "Idle: no job is using it. Accept a contract marked “Fits your idle racks” (Contracts drawer, C)." : null;
		default:
			return null;
	}
}
