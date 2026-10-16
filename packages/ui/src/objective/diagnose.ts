/**
 * Plain-English "why isn't this working?" for racks, derived from the view alone (nets, statuses, content kinds).
 * Used by CURRENT ORDERS and the dossier so a dark cabinet always comes with a reason and a fix.
 */
import type { ContentDB } from "@aitower/content";
import type { FacilityView, SimView } from "@aitower/sim";
import { fmtPower } from "../format";

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
	if (cdus.length === 0) return `Its coolant loop has a chiller but no CDU (Coolant Distribution Manifold). ${pipe}`;
	if (!chillers.some(working)) return "The chiller on its loop is off or has no power: lay a power conduit under it.";
	if (!cdus.some(working)) return "The CDU on its loop is off or has no power: lay a power conduit under it.";
	return null;
}

/** Why a rack is not computing, with the fix; null when it is fine (ok / brownout) or not a rack. */
export function rackProblem(view: SimView, content: ContentDB, f: FacilityView): string | null {
	const def = content.facilities[f.defId];
	if (!def?.rack) return null;
	switch (f.status) {
		case "disabled":
			return "Switched off. Flip MAINS in its dossier to turn it on.";
		case "failed":
			return view.spareParts > 0
				? "Broken. A maintenance automaton is bringing a spare part to repair it."
				: "Broken, and the parts cage is empty. Buy spare parts so an automaton can repair it.";
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
		case "throttled": {
			const net = f.coolantNet === null ? undefined : view.coolantNets.find((n) => n.id === f.coolantNet);
			if (def.rack.liquidFraction > 0 && net && net.loadKw > net.capacityKw)
				return `Running hot and slowed down: its coolant loop is over capacity (${fmtPower(net.loadKw)} of ${fmtPower(net.capacityKw)}). Add a chiller or CDU to that loop.`;
			return "Running hot and slowed down. Add cooling near it.";
		}
		case "idle":
			return def.rack.pflops > 0 ? "Idle: no job is using it. Accept a contract marked “Fits your idle racks” (Contracts tab)." : null;
		default:
			return null;
	}
}
