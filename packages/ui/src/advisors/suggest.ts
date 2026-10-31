/**
 * The advisors' problem-spotting: a pure function from the sim view + content to a ranked list of suggestions, each with one
 * action, an owner advisor and Handbook links. No React, no clock, no storage: the strip decides when one may be shown.
 * Text may carry `{{term-id|label}}` markers, drawn as underlined Terms.
 * Mirrors the NEXT logic (objective.ts / diagnose.ts) for the rules they share, and `dockPicks` for the hot-rack test.
 */
import type { AdvisorId, ContentDB, FacilityDef } from "@aitower/content";
import type { CellRef, FacilityView, SimView } from "@aitower/sim";
import { isBuildable } from "../build/catalog";
import type { DrawerId } from "../calm/calm";
import { clearanceProgress } from "../calm/calm";
import { fmtMoney } from "../format";
import { unreachedFloors } from "../objective/diagnose";
import { rackIsHot } from "../objective/heat";
import { cheapestAvailable } from "../research/tech";

/** What the "Show me" button does. */
export type AdvisorAction =
	/** Open the Build catalog on the item's tab and pick it (focus the camera on `focus` when given). */
	| { kind: "build"; defId: string; focus?: CellRef }
	/** Pick the Service lift tool. */
	| { kind: "lift"; focus?: CellRef }
	/** Open the Supplies tab of the catalog (spare parts). */
	| { kind: "supplies"; focus?: CellRef }
	| { kind: "drawer"; drawer: DrawerId; focus?: CellRef }
	/** The Trees panel (points, rungs, seal). */
	| { kind: "trees" }
	/** Open the Department of Research, on one node when `techId` is given. */
	| { kind: "research"; techId?: string };


/** A Handbook link chip: opens the entry (an Encyclopedia or chapter id). */
export interface HandbookLink {
	label: string;
	entry: string;
}

export interface Suggestion {
	/** Stable per kind of problem; also the concept id of its tip, which fires once per game. */
	id: string;
	/** The advisor who owns this area. */
	advisor: AdvisorId;
	/** Handbook links (usually one). */
	links: HandbookLink[];
	/** One or two plain sentences. */
	text: string;
	/** Label of the primary button. */
	cta: string;
	action: AdvisorAction;
	/** Problems (heat, broken, red) may break the quiet interval a little; the rest wait their turn. */
	urgent: boolean;
	/** Catalog items for the "Recommended" row. */
	recommend: string[];
}

const cell = (f: FacilityView): CellRef => ({ x: f.x, floor: f.floor });

const isRack = (f: FacilityView, content: ContentDB): boolean => !!content.facilities[f.defId]?.rack && (content.facilities[f.defId]?.rack?.pflops ?? 0) > 0;

/** Cheapest buildable facility of a kind now (by level and research), or undefined. */
export function cheapestOf(kind: string, view: SimView, content: ContentDB): FacilityDef | undefined {
	return Object.values(content.facilities)
		.filter((d) => d.kind === kind && isBuildable(d, view, content))
		.sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id))[0];
}

/**
 * Racks running hot, by the sim's definition (`rackIsHot`). With `confirmed` (from `watchHeat`) only racks whose heat has
 * lasted count, so a momentary blip never makes an advisor speak.
 */
export function hotRacks(view: SimView, content: ContentDB, confirmed?: ReadonlySet<number>): FacilityView[] {
	return view.facilities.filter((f) => rackIsHot(f, content) && (!confirmed || confirmed.has(f.id)));
}

/** The tower leans to Bio or Green while the Lattice is ahead of it: Cass says so, and where to look. */
function latticePull(view: SimView): Omit<Suggestion, "advisor" | "links"> | null {
	const p = view.path;
	const s = view.soul;
	if (!s || (p !== "biotech" && p !== "greentech") || !(s.sp.synthetic > s.sp[p])) return null;
	const pct = (n: number): number => Math.floor((n / s.spTarget) * 100);
	const name = p === "biotech" ? "the Flesh" : "the Garden";
	return { id: "lattice", urgent: false, recommend: [], cta: "Trees", action: { kind: "trees" }, text: `The Lattice is ahead of ${name}: ${pct(s.sp.synthetic)}% against ${pct(s.sp[p])}%. Retrofit more racks down your tree, or the Lattice ends the world first.` };
}

const cap = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1);

const META: Record<string, { advisor: AdvisorId; links: HandbookLink[] }> = {
	cash: { advisor: "luci", links: [{ label: "How money works", entry: "basics:money" }] },
	parts: { advisor: "cass", links: [{ label: "Spare parts", entry: "basics:parts" }] },
	hot: { advisor: "cass", links: [{ label: "Cooling and heat", entry: "ch:heat" }] },
	power: { advisor: "bea", links: [{ label: "Power", entry: "ch:power" }] },
	uptime: { advisor: "bea", links: [{ label: "Uptime", entry: "ch:uptime" }] },
	backup: { advisor: "bea", links: [{ label: "Power", entry: "ch:power" }] },
	lift: { advisor: "cass", links: [{ label: "Lifts and bots", entry: "basics:lifts" }] },
	lattice: { advisor: "cass", links: [{ label: "Advisors", entry: "basics:advisors" }] },
	idle: { advisor: "mel", links: [{ label: "Contracts", entry: "basics:contracts" }] },
	research: { advisor: "mel", links: [{ label: "Research", entry: "basics:research" }] },
	level: { advisor: "luci", links: [{ label: "Level", entry: "basics:level" }] },
};

/** All suggestions that apply to this view, most important first. Empty when the tower is fine. */
export function suggestions(view: SimView, content: ContentDB, confirmedHot?: ReadonlySet<number>): Suggestion[] {
	const out: Omit<Suggestion, "advisor" | "links">[] = [];
	const defs = content.facilities;
	const racks = view.facilities.filter((f) => isRack(f, content));
	/** "an Air Handler", "a Battery Bank". */
	const name = (d: FacilityDef): string => d.name;
	const an = (d: FacilityDef): string => `${/^[AEIOU]/i.test(d.name) ? "an" : "a"} ${d.name}`;

	// Cash.
	const cheapRack = Object.values(defs)
		.filter((d) => (d.rack?.pflops ?? 0) > 0 && isBuildable(d, view, content))
		.sort((a, b) => a.cost - b.cost)[0];
	if (!view.sandbox && racks.length > 0 && cheapRack && view.cash < cheapRack.cost) {
		out.push({
			id: "cash",
			text: `Cash is ${fmtMoney(view.cash)}, less than one more cabinet. Hold off building and let jobs refill the Treasury.`,
			cta: "Show me",
			action: { kind: "drawer", drawer: "contracts" },
			urgent: view.cash < 0,
			recommend: [],
		});
	}

	// Broken racks and no spare parts.
	const broken = view.facilities.filter((f) => f.status === "failed");
	if (broken.length > 0 && view.spareParts === 0) {
		out.push({
			id: "parts",
			text: `${broken.length} machine${broken.length === 1 ? " is" : "s are"} broken and the spare-parts cage is empty. Buy some and a repair bot gets to work.`,
			cta: "Show me",
			action: { kind: "supplies", focus: cell(broken[0]) },
			urgent: true,
			recommend: [],
		});
	}

	// Hot racks → air handler.
	const hot = hotRacks(view, content, confirmedHot);
	const crah = cheapestOf("crah", view, content);
	if (hot.length > 0 && crah) {
		out.push({
			id: "hot",
			text: `${Math.round(Math.max(...hot.map((f) => f.tempC)))} °C in ${hot.length === 1 ? "a rack" : `${hot.length} racks`}, over the ${content.balance.thermal.okC} °C line, so ${hot.length === 1 ? "it is" : "they are"} {{throttle|throttling}}. All power ends up as heat. ${cap(an(crah))} within a few tiles removes it.`,
			cta: "Show me",
			action: { kind: "build", defId: crah.id, focus: cell(hot[0]) },
			urgent: true,
			recommend: [crah.id],
		});
	}

	// Power short, uptime below target, no backup.
	const genset = cheapestOf("genset", view, content);
	const ups = cheapestOf("ups", view, content);
	const short = view.powerNets.some((n) => n.satisfaction < 1) || racks.some((f) => f.enabled && (f.status === "unpowered" || f.status === "brownout"));
	const backupDefs = view.facilities.filter((f) => ["genset", "ups"].includes(defs[f.defId]?.kind ?? ""));
	if (short && (genset || ups)) {
		const pick = genset ?? (ups as FacilityDef);
		out.push({
			id: "power",
			text: `Racks are getting ${Math.round(Math.min(1, ...view.powerNets.map((n) => n.satisfaction)) * 100)}% of the power they ask for: a {{brownout|brownout}}. ${cap(an(pick))} adds supply${ups && ups !== pick ? `; ${an(ups)} evens out the dips` : ""}.`,
			cta: "Show me",
			action: { kind: "build", defId: pick.id },
			urgent: true,
			recommend: [pick.id, ...(ups && ups !== pick ? [ups.id] : [])],
		});
	}
	const settled = view.tick >= 1440; // the 24 h uptime figure needs a day behind it
	if (settled && racks.length > 0 && view.uptime < view.uptimeTarget && (ups || genset)) {
		const pick = ups ?? (genset as FacilityDef);
		out.push({
			id: "uptime",
			text: `Uptime is ${Math.round(view.uptime * 100)}%, under the ${Math.round(view.uptimeTarget * 100)}% your level asks for. ${cap(an(pick))} keeps racks up through a power dip.`,
			cta: "Show me",
			action: { kind: "build", defId: pick.id },
			urgent: false,
			recommend: [pick.id],
		});
	}
	if (settled && racks.length >= 3 && backupDefs.length === 0 && (ups || genset)) {
		const pick = ups ?? (genset as FacilityDef);
		out.push({
			id: "backup",
			text: `${racks.length} racks and nothing behind them. A {{ups|UPS}} carries the load for seconds, until a {{genset|genset}} starts. ${cap(an(pick))} fits.`,
			cta: "Show me",
			action: { kind: "build", defId: pick.id },
			urgent: false,
			recommend: [pick.id],
		});
	}

	// Floors with machines and no lift.
	const lonely = unreachedFloors(view, content);
	if (lonely.length > 0) {
		const f = lonely[0];
		const at = view.facilities.find((x) => x.floor === f);
		out.push({
			id: "lift",
			text: `Floor ${f} has machines no bot can reach, so nothing there can be repaired. Extend a Service lift up to it.`,
			cta: "Show me",
			action: { kind: "lift", focus: at ? cell(at) : undefined },
			urgent: false,
			recommend: [],
		});
	}

	// The Lattice outrunning the leading tree.
	const pull = latticePull(view);
	if (pull) out.push(pull);

	// Idle racks and an offer that fits.
	const idle = racks.filter((f) => f.enabled && f.status === "idle");
	if (idle.length > 0 && view.offers.length > 0) {
		out.push({
			id: "idle",
			text: `${idle.length} rack${idle.length === 1 ? " is" : "s are"} idle and earning nothing. There ${view.offers.length === 1 ? "is a contract" : "are contracts"} waiting.`,
			cta: "Show me",
			action: { kind: "drawer", drawer: "contracts", focus: cell(idle[0]) },
			urgent: false,
			recommend: [],
		});
	}

	// Nothing researched.
	const tech = cheapestAvailable(view, content);
	if (view.techResearched.length === 0 && tech && view.researchPoints >= tech.cost) {
		out.push({
			id: "research",
			text: `You have ${Math.floor(view.researchPoints)} research points and nothing researched. ${tech.name} is ready to start.`,
			cta: "Show me",
			action: { kind: "research" },
			urgent: false,
			recommend: [],
		});
	}

	// Level-up due or near.
	{
		const c = clearanceProgress(view, content);
		if (c.next !== null && c.frac >= 1 && !c.techsOk) {
			out.push({ id: "level", text: `Compute is enough for Level ${c.next}, but research is short: ${c.techsDone} of ${c.techs} nodes done.`, cta: "Show me", action: { kind: "research" }, urgent: false, recommend: [] });
		} else if (c.next !== null && c.frac >= 1 && !c.uptimeOk) {
			out.push({ id: "level", text: `Compute is enough for Level ${c.next}. Hold uptime at ${Math.round(c.uptimeNeed * 100)}% or better and it comes at midnight.`, cta: "Show me", action: { kind: "drawer", drawer: "insights" }, urgent: false, recommend: [] });
		} else if (c.next !== null && c.frac >= 0.6 && c.frac < 1 && cheapRack) {
			out.push({
				id: "level",
				text: `Level ${c.next} is close: ${Math.round(c.have)} of ${c.need} PF compute. One or two more ${name(cheapRack)}s would do it.`,
				cta: "Show me",
				action: { kind: "build", defId: cheapRack.id },
				urgent: false,
				recommend: [cheapRack.id],
			});
		}
	}
	return out.map((o) => ({ ...o, ...(META[o.id] ?? { advisor: "luci" as AdvisorId, links: [] }) }));
}

/** Def ids for the catalog's "Recommended" row: from every applying suggestion, in rank order, at most `max`. */
export function recommendedIds(list: readonly Suggestion[], max = 3): string[] {
	const ids: string[] = [];
	for (const s of list) for (const id of s.recommend) if (!ids.includes(id) && ids.length < max) ids.push(id);
	return ids;
}
