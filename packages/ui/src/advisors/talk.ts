/**
 * What the advisors say, as pure functions of the live view (no React, no clock, no storage):
 *  - tips: unprompted lines about a real condition (one concept per tip; each fires once per game);
 *  - pitches: when a research node is available and affordable, its advisor makes the case once, with a comparison
 *    from the live floor ("230 PF in the slot AC-1 gives 20");
 *  - answers: what a clicked portrait says: a ranked list from that advisor's area.
 * Numbers come first, then the word; words are {{term|label}} markers drawn as underlined Terms.
 */
import type { AdvisorId, ContentDB, FacilityDef, TechNode } from "@aitower/content";
import type { SimView } from "@aitower/sim";
import { isBuildable } from "../build/catalog";
import { fmtMoney } from "../format";
import { nodeState } from "../research/tech";
import { advisorOfLane } from "./advisors";
import { type AdvisorAction, type HandbookLink, type Suggestion, suggestions } from "./suggest";

/** One thing an advisor says. */
export interface Line {
	/** Concept id: a tip with this id fires once per game. */
	id: string;
	advisor: AdvisorId;
	text: string;
	links: HandbookLink[];
	/** The button: "Show me" for a problem, "Open research" for a pitch. */
	cta?: string;
	action?: AdvisorAction;
	/** Problems (heat, power, broken) may replace a calmer line on screen. */
	urgent: boolean;
}

/** Real seconds a tip stays in the strip before it collapses to a portrait chip. */
export const TIP_SHOW_MS = 20_000;
/** Real seconds of quiet between two tips (they never stack). */
export const TIP_GAP_MS = 8_000;

const fromSuggestion = (s: Suggestion): Line => ({ id: s.id, advisor: s.advisor, text: s.text, links: s.links, cta: s.cta, action: s.action, urgent: s.urgent });

// ─── Facilities, for comparisons ──────────────────────────────────────

const isRackDef = (d: FacilityDef): boolean => d.kind === "rack" && (d.rack?.pflops ?? 0) > 0 && !d.growth && !d.retired;
/** "AC-1" from "AC-1 Air-Cooled Rack"; "Tape Library TL-8000" keeps its full name. */
export const modelCode = (d: FacilityDef): string => (/^[A-Z]{2}-\d\b/.test(d.name) ? d.name.split(" ")[0] : d.name);
export const pfPerKw = (d: FacilityDef): number => (d.rack && d.rack.powerKw > 0 ? d.rack.pflops / d.rack.powerKw : 0);
const fmtNum = (n: number): string => (n >= 100 ? String(Math.round(n)) : String(Math.round(n * 10) / 10));

function rackAdvisor(d: FacilityDef): AdvisorId {
	const c = d.rack?.cooling;
	return c === "air" || c === "dlc" || c === "immersion" ? "cass" : "mel";
}

/** The best compute rack the player can build right now in a slot of this width. */
function bestBuildable(view: SimView, content: ContentDB, width: number): FacilityDef | undefined {
	return Object.values(content.facilities)
		.filter((d) => isRackDef(d) && d.width === width && isBuildable(d, view, content))
		.sort((a, b) => (b.rack?.pflops ?? 0) - (a.rack?.pflops ?? 0))[0];
}

const needsOf = (d: FacilityDef): string => {
	const n: string[] = [];
	if (d.placement?.needsCoolant) n.push("a coolant loop with a {{cdu|CDU}} and a {{chiller|chiller}}");
	if (d.placement?.needsNutrient) n.push("a nutrient line");
	return n.length ? ` It needs ${n.join(" and ")}.` : "";
};

// ─── Pitches ──────────────────────────────────────────────────────────

/** A research node that unlocks a clearly better rack than the best one the player can build in the same slot. */
function rackPitch(node: TechNode, view: SimView, content: ContentDB): Line | null {
	const unlocked = Object.values(content.facilities).filter((d) => d.tech === node.id && isRackDef(d));
	let best: { rack: FacilityDef; old: FacilityDef } | null = null;
	for (const rack of unlocked) {
		const old = bestBuildable(view, content, rack.width);
		const pf = rack.rack?.pflops ?? 0;
		if (!old || pf < 1.5 * (old.rack?.pflops ?? 0)) continue;
		if (!best || pf > (best.rack.rack?.pflops ?? 0)) best = { rack, old };
	}
	if (!best) return null;
	const { rack, old } = best;
	const bio = rack.rack?.cooling === "bio";
	const compare = `${fmtNum(rack.rack?.pflops ?? 0)} PF in the slot ${modelCode(old)} gives ${fmtNum(old.rack?.pflops ?? 0)}`;
	const watts = bio ? ` At ${fmtNum(pfPerKw(rack))} PF per {{kw|kW}} it uses a fraction of the power.` : "";
	return {
		id: `pitch:${node.id}`,
		// The lane's own advisor (data/lanes.json), so the pitch matches the one on the research tree.
		advisor: advisorOfLane(content.lanes?.find((l) => l.id === node.lane)?.advisor ?? "") ?? (bio ? "mel" : rackAdvisor(rack)),
		text: `On your floor ${modelCode(rack)} gives ${compare}.${watts} ${node.name} costs ${Math.round(node.cost).toLocaleString("en-US")} {{rp|RP}}; you hold ${Math.floor(view.researchPoints).toLocaleString("en-US")}.${needsOf(rack)}`,
		links: [{ label: bio ? "Wetware and Biotech" : "Cooling and heat", entry: bio ? "ch:path-biotech" : "ch:heat" }],
		cta: "Open research",
		action: { kind: "research", techId: node.id } as AdvisorAction,
		urgent: false,
	};
}

/** Every pitch that applies now: nodes that are available (prerequisites met) and affordable. */
export function pitches(view: SimView, content: ContentDB): Line[] {
	const out: Line[] = [];
	for (const node of content.tech ?? []) {
		if (nodeState(node, view, content).kind !== "available") continue;
		const p = rackPitch(node, view, content);
		if (p) out.push(p);
	}
	return out.sort((a, b) => a.id.localeCompare(b.id));
}

// ─── Tips ─────────────────────────────────────────────────────────────

/** All unprompted-tip candidates now, problems first, then pitches. The strip filters out what already fired. */
export function tipCandidates(view: SimView, content: ContentDB, confirmedHot?: ReadonlySet<number>): Line[] {
	return [...suggestions(view, content, confirmedHot).map(fromSuggestion), ...pitches(view, content)];
}

/** The next tip to show: the first candidate that has not fired, and is not the one on screen. */
export function nextTip(candidates: readonly Line[], fired: ReadonlySet<string>, onScreen: string | null): Line | null {
	return candidates.find((c) => !fired.has(c.id) && c.id !== onScreen) ?? null;
}

// ─── Ask: a ranked answer from one advisor ────────────────────────────

const isRack = (view: SimView, content: ContentDB) => view.facilities.filter((f) => isRackDef(content.facilities[f.defId] ?? ({} as FacilityDef)));

/** Live status of the advisor's area as one line (numbers first). */
function statusLine(advisor: AdvisorId, view: SimView, content: ContentDB): Line {
	const racks = isRack(view, content);
	const base = { advisor, links: [] as HandbookLink[], urgent: false };
	switch (advisor) {
		case "cass": {
			const hottest = racks.reduce((m, f) => Math.max(m, f.tempC), 0);
			const okC = content.balance.thermal.okC;
			const broken = view.facilities.filter((f) => f.status === "failed").length;
			const crah = view.facilities.filter((f) => content.facilities[f.defId]?.kind === "crah").length;
			return { ...base, id: "ask:cass", links: [{ label: "Cooling and heat", entry: "ch:heat" }], text: racks.length === 0 ? "No racks yet, so nothing to cool. Place one and I will start worrying." : `Hottest rack ${Math.round(hottest)} °C against a ${okC} °C line, ${crah} air handler${crah === 1 ? "" : "s"}, ${broken} broken, ${view.spareParts} spare part${view.spareParts === 1 ? "" : "s"}.` };
		}
		case "bea": {
			const worst = view.powerNets.length ? Math.min(...view.powerNets.map((n) => n.satisfaction)) : 1;
			const backup = view.facilities.filter((f) => ["genset", "ups"].includes(content.facilities[f.defId]?.kind ?? "")).length;
			return { ...base, id: "ask:bea", links: [{ label: "Power", entry: "ch:power" }], text: `${Math.round(view.totalKw)} kW drawn, ${Math.round(worst * 100)}% of it supplied, ${backup === 0 ? "no backup" : `${backup} backup unit${backup === 1 ? "" : "s"}`}. Uptime ${Math.round(view.uptime * 100)}%${view.uptimeTarget > 0 ? ` against ${Math.round(view.uptimeTarget * 100)}%` : ""}.` };
		}
		case "mel": {
			const idle = racks.filter((f) => f.enabled && f.status === "idle").length;
			return { ...base, id: "ask:mel", links: [{ label: "Contracts", entry: "basics:contracts" }], text: `${fmtNum(view.pflops)} PF running across ${racks.length} rack${racks.length === 1 ? "" : "s"}, ${idle} idle. ${view.offers.length} contract${view.offers.length === 1 ? "" : "s"} on offer.` };
		}
		case "luci": {
			const lat = view.soul ? Math.floor((view.soul.sp.synthetic / view.soul.spTarget) * 100) : 0;
			return { ...base, id: "ask:luci", links: [{ label: "How money works", entry: "basics:money" }], text: `Cash ${fmtMoney(view.cash)}${view.loan.principal > 0 ? `, loan ${fmtMoney(view.loan.principal)}` : ""}. The Lattice is ${lat}% of the way there. I have asked the spreadsheet how it feels; it declined to comment.` };
		}
	}
}

/** "Why this over that" from the live content: coolant choices for Cass, tissue against racks for Mel. */
function compareLine(advisor: AdvisorId, view: SimView, content: ContentDB): Line | null {
	const racks = Object.values(content.facilities).filter((d) => isRackDef(d) && d.unlockTier <= Math.max(3, view.tier));
	if (advisor === "cass") {
		// Immersion starts at Level 4 (the Two-Phase Tank), so Cass compares what Level 4 holds.
		const upTo4 = Object.values(content.facilities).filter((d) => isRackDef(d) && d.unlockTier <= Math.max(4, view.tier));
		const topOf = (cool: string): FacilityDef | undefined => upTo4.filter((d) => d.rack?.cooling === cool).sort((a, b) => (b.rack?.pflops ?? 0) - (a.rack?.pflops ?? 0))[0];
		const air = topOf("air");
		const dlc = topOf("dlc");
		const imm = topOf("immersion");
		if (!air || !dlc || !imm) return null;
		return {
			id: "compare:cooling",
			advisor,
			text: `Air tops out at ${modelCode(air)}, ${fmtNum(air.rack?.pflops ?? 0)} PF a cabinet, for ${fmtMoney(air.cost)}. {{dlc|Liquid}} reaches ${fmtNum(dlc.rack?.pflops ?? 0)} PF in ${modelCode(dlc)} but needs a loop, a {{cdu|CDU}} and a chiller. {{immersion|Immersion}} ${modelCode(imm)} reaches ${fmtNum(imm.rack?.pflops ?? 0)} PF and a plumbing problem.`,
			links: [{ label: "Coolant loops", entry: "basics:loops" }],
			urgent: false,
		};
	}
	if (advisor === "mel") {
		const bio = racks.filter((d) => d.rack?.cooling === "bio").sort((a, b) => pfPerKw(b) - pfPerKw(a))[0];
		const conv = racks.filter((d) => d.rack?.cooling !== "bio").sort((a, b) => pfPerKw(b) - pfPerKw(a))[0];
		if (!bio || !conv || !bio.rack?.bio) return null;
		return {
			id: "compare:wetware",
			advisor,
			text: `${modelCode(bio)} tissue gives ${fmtNum(pfPerKw(bio))} PF per {{kw|kW}}; the best rack, ${modelCode(conv)}, gives ${fmtNum(pfPerKw(conv))}. The price: ${bio.rack.bio.targetC} °C held within ${bio.rack.bio.toleranceC} °C, ${bio.rack.bio.nutrientUse} nutrient units a tick, and contamination.`,
			links: [{ label: "Wetware and Biotech", entry: "ch:path-biotech" }],
			urgent: false,
		};
	}
	return null;
}

export interface Answer {
	advisor: AdvisorId;
	/** Most important first. */
	lines: Line[];
}

/** A clicked portrait: this advisor's open problems first, then pitches, then their status and comparison. At most four lines. */
export function answerFor(advisor: AdvisorId, view: SimView, content: ContentDB, confirmedHot?: ReadonlySet<number>): Answer {
	const mine = tipCandidates(view, content, confirmedHot).filter((l) => l.advisor === advisor);
	const lines = [...mine, statusLine(advisor, view, content)];
	const cmp = compareLine(advisor, view, content);
	if (cmp) lines.push(cmp);
	return { advisor, lines: lines.slice(0, 4) };
}
