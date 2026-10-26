/**
 * The four advisors (M6.3), pure data and helpers: who they are, how text with {{term|label}} markers splits, how a
 * decision's MAGI vote and price line are composed. No React, no clock.
 */
import type { AdvisorId, ContentDB, EventEffect } from "@aitower/content";
import type { DecisionView } from "@aitower/sim";
import { effectChip, visibleEffects } from "../calm/calm";

export interface AdvisorInfo {
	id: AdvisorId;
	name: string;
	/** First name, for tight spots. */
	first: string;
	role: string;
	/** Areas they speak for. */
	areas: string;
	/** Portrait and ring colour (a CSS colour, picked to stay distinct from the other three). */
	color: string;
	/** One dry line shown under the name in the Ask card. */
	motto: string;
}

export const ADVISORS: Record<AdvisorId, AdvisorInfo> = {
	cass: { id: "cass", name: "Cass Parr", first: "Cass", role: "Cooling and Facilities", areas: "Air, liquid and immersion cooling, repairs, logistics", color: "#7fdcff", motto: "Somebody has to keep it cold. Did you sleep?" },
	bea: { id: "bea", name: "Bea Altasar", first: "Bea", role: "Power Engineer", areas: "Grid, backup, storage, green power", color: "#9be564", motto: "If something here burns diesel, I lost the argument." },
	mel: { id: "mel", name: "Dr. Mel Kiorre", first: "Mel", role: "Compute and Wetware", areas: "Racks, tissue, synthetic minds", color: "#c58bff", motto: "Is it still yours if it grew in a jar?" },
	luci: { id: "luci", name: "Luci Ferro", first: "Luci", role: "CFO and Logistics", areas: "Money, contracts, the Authority", color: "#ff5d6c", motto: "I sign the cheques. You'll like me eventually." },
};

/** Which tree each advisor argues for (Cass argues for nobody's Singularity). */
export const ADVISOR_TREE: Record<AdvisorId, "synthetic" | "biotech" | "greentech" | null> = { luci: "synthetic", mel: "biotech", bea: "greentech", cass: null };

export const ADVISOR_ORDER: readonly AdvisorId[] = ["cass", "bea", "mel", "luci"];

/** Which advisor sells a research lane (data/lanes.json names them in full). */
export const advisorOfLane = (laneAdvisor: string): AdvisorId | undefined => ADVISOR_ORDER.find((id) => ADVISORS[id].name === laneAdvisor);

// ─── Text with Terms ──────────────────────────────────────────────────

export type Seg = { text: string } | { term: string; text: string };

/** Split "...a {{ups|UPS}} carries..." into plain and Term segments. A marker without a label uses the id. */
export function parseMarkup(s: string): Seg[] {
	const out: Seg[] = [];
	const re = /\{\{([a-z0-9-]+)(?:\|([^}]*))?\}\}/g;
	let last = 0;
	for (let m = re.exec(s); m; m = re.exec(s)) {
		if (m.index > last) out.push({ text: s.slice(last, m.index) });
		out.push({ term: m[1], text: m[2] ?? m[1] });
		last = m.index + m[0].length;
	}
	if (last < s.length) out.push({ text: s.slice(last) });
	return out;
}

/** The text with markers reduced to their labels (for aria and tests). */
export const plainText = (s: string): string => parseMarkup(s).map((g) => g.text).join("");

// ─── Decisions: effects, MAGI vote, price ─────────────────────────────

/** Effects of one choice of a decision, from the event definition. */
export const effectsOf = (content: ContentDB, d: Pick<DecisionView, "eventId">, choiceId: string): EventEffect[] =>
	content.events.find((e) => e.id === d.eventId)?.choices.find((c) => c.id === choiceId)?.effects ?? [];

/** The cash a choice takes (positive) or pays (negative), in dollars. */
export const cashCost = (effects: readonly EventEffect[]): number => effects.reduce((s, e) => (e.type === "cash" ? s - e.amount : s), 0);

/** Luci's line: what the recommended option costs, set against the alternative. */
export function priceLine(content: ContentDB, d: DecisionView, fmtMoney: (n: number) => string): string {
	const rec = d.choices.find((c) => c.id === d.recommended);
	const other = d.choices.find((c) => c.id !== d.recommended);
	if (!rec) return "";
	const cost = (id: string): string => {
		const c = cashCost(effectsOf(content, d, id));
		return c > 0 ? `costs ${fmtMoney(c)}` : c < 0 ? `pays ${fmtMoney(-c)}` : "costs nothing now";
	};
	const tail = other ? ` ${other.label} ${cost(other.id)}.` : "";
	return `${rec.label} ${cost(rec.id)}.${tail}`;
}

/** "2 to 1 for" / "1 to 2 against": the tally of a MAGI vote on the recommended option. */
export function tally(votes: readonly { approve: boolean }[]): { yes: number; no: number; text: string } {
	const yes = votes.filter((v) => v.approve).length;
	const no = votes.length - yes;
	return { yes, no, text: yes >= no ? `${yes} to ${no} for` : `${yes} to ${no} against` };
}

const span = (ticks: number): string => (ticks % 1440 === 0 ? `${ticks / 1440}d` : ticks >= 120 ? `${Math.round(ticks / 60)}h` : `${ticks}m`);

/** One effect as a plain chip, timed effects carrying their duration ("ambient +4°C · 1d"). */
export function effectText(e: EventEffect): string {
	const base = effectChip(e);
	return "durationTicks" in e ? `${base} · ${span(e.durationTicks)}` : base;
}

/** Chips for one choice, in order, with affinity effects flagged for a path-coloured pill. */
export const choiceChipList = (effects: readonly EventEffect[]): { text: string; path?: "biotech" | "greentech" | "synthetic" }[] =>
	visibleEffects(effects).map((e) => (e.type === "affinity" ? { text: effectChip(e), path: e.path } : { text: effectText(e) }));
