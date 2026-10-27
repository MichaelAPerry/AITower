/**
 * The Encyclopedia as data: pure generation from content (and the view, for lock state) plus search.
 * Basics and glossary are hand-written; facilities, bots and research are generated, so they never drift from the numbers.
 */
import type { ContentDB, FacilityDef, Flavor, TechNode } from "@aitower/content";
import type { SimView } from "@aitower/sim";
import { type TierView, tierView } from "../build/tier";
import { defSpecs, lockText } from "../components/BuildPalette";
import { fmtMoney } from "../format";
import { TERMS } from "../glossary/terms";
import { effectText, nodeState, techGate, techList, unlocksFor } from "../research/tech";

export type Section = "basics" | "facilities" | "bots" | "research" | "glossary";
export const SECTIONS: { id: Section; label: string }[] = [
	{ id: "basics", label: "Basics" },
	{ id: "facilities", label: "Facilities" },
	{ id: "bots", label: "Bots" },
	{ id: "research", label: "Research" },
	{ id: "glossary", label: "Glossary" },
];

export interface Entry {
	id: string;
	section: Section;
	title: string;
	/** Short paragraphs. */
	lines: string[];
	stats: [string, string][];
	/** "Needs: power / coolant / ..." for facilities. */
	needs: string[];
	/** Horror content: while locked, only the name and the unlock requirement show. */
	spoiler: boolean;
	ref?: { kind: "facility" | "bot" | "tech"; id: string };
	/** A real quotation for facility, bot and research pages. */
	flavor?: Flavor;
	/** Facilities: tier, frame class and note. */
	tier?: TierView;
	/** Glossary words: the Handbook chapter that teaches it. */
	at?: string;
	/** Lower-case search text. */
	keywords: string;
}

const BIO_KINDS = new Set(["nutrient", "sterilizer", "quarantine", "bioreactor"]);
const isBioFacility = (d: FacilityDef): boolean => d.category === "bio" || BIO_KINDS.has(d.kind) || !!d.bio || !!d.rack?.bio;
const isSpoilerTech = (t: TechNode): boolean => t.branch === "wetware" || t.path === "biotech";

/** Facility "Needs": what it has to be connected to before it works. */
export function facilityNeeds(def: FacilityDef): string[] {
	const n: string[] = [];
	if (def.placement?.needsPower !== false && (def.facilityKw > 0 || def.rack || def.cooling || def.logistics)) n.push("power");
	if (def.placement?.needsCoolant || def.rack?.cooling === "dlc" || def.rack?.cooling === "immersion") n.push("coolant");
	if (def.rack?.cooling === "air") n.push("air cooling nearby");
	if (def.placement?.needsNutrient || def.rack?.bio) n.push("nutrient");
	return n;
}

const mk = (e: Omit<Entry, "keywords" | "stats" | "needs" | "spoiler"> & Partial<Pick<Entry, "stats" | "needs" | "spoiler">>, extra = ""): Entry => {
	const full: Entry = { stats: [], needs: [], spoiler: false, ...e, keywords: "" };
	full.keywords = `${full.title} ${full.lines.join(" ")} ${full.stats.map(([k, v]) => `${k} ${v}`).join(" ")} ${full.needs.join(" ")} ${extra}`.toLowerCase();
	// Horror entries must not leak through search before they are unlocked.
	if (full.spoiler) full.keywords = full.title.toLowerCase();
	return full;
};

function basics(c: ContentDB): Entry[] {
	const b = c.balance;
	const pf = b.tiers.pflops;
	const up = b.tiers.uptime;
	const tn = b.tiers.techs ?? [];
	const t = b.thermal;
	const L = (id: string, title: string, ...lines: string[]): Entry => mk({ id: `basics:${id}`, section: "basics", title, lines });
	return [
		L("money", "How money works", `You start with ${fmtMoney(b.startingCash)}. Contracts pay when they finish; builds, upkeep and electricity take money out every day.`, "PER HOUR at the top shows whether you are ahead right now. Red with no contract running is just upkeep.", `At midnight the Ministry takes ${Math.round(b.tax.profitShare * 100)}% of a day's profit as tax. Open Finance (F) for the ledger.`),
		L("contracts", "Contracts: training and inference", "A contract is a job a client pays for. Accept one in Contracts (C), and your racks work on it until it is done.", "Training jobs are big, have a deadline, and pay well. Inference jobs are steady and small, and pay by the hour of work. Some need stored data or liquid cooling, and the card says so before you accept.", "Missing a deadline costs money."),
		L("power", "Power", "Racks, coolers and bots all draw electrical power. A grid connection brings it in; conduits (the power lines under the floor) carry it to machines.", "If supply is short, machines slow down (a brownout). With none at all they stop and show NO POWER over them.", "A generator or battery (UPS) bridges short outages. Solar and wind help if you have them."),
		L("cooling", "Cooling and heat", `Every watt a rack uses becomes heat. Racks run fine up to ${t.okC} °C, slow down (throttle) toward ${t.throttleC} °C, and trip offline at ${t.tripC} °C.`, "Air handlers cool nearby racks on their floor. Hot air rises, so top floors run warmer. HOT over a rack means it is throttling.", "The Gauges drawer (I) has a heat overlay (E) that shows where it builds up."),
		L("loops", "Coolant loops", "Liquid-cooled racks need a coolant line under them, running from a chiller through a distribution unit (CDU).", "Lay the pipe with the coolant tool, connect a chiller, then add a CDU for capacity. A rack over its loop's capacity shows NO COOLANT.", "Liquid cooling moves much more heat than air, which is what lets you pack in powerful racks."),
		L("lifts", "Lifts and bots", `Maintenance bots repair broken parts. They walk the floors and ride lifts between them (up to ${c.lift.capacity} per car), so a tower with several floors needs a lift.`, "A lift needs power: lay a power conduit under or right beside its shaft, or its car stays dark and no bot will route through it. Chargers recharge and house the bots. Flying drones skip the lift. Hover a bot or lift in the tower to see its name."),
		L("parts", "Spare parts", `Bots need a spare part for each repair, from a depot. A part costs ${fmtMoney(c.structure.sparePart)}.`, "Racks fail now and then. A rack marked BROKEN #2 is second in the repair queue; NO ROUTE means no bot can reach its floor yet (a lift is missing, unpowered or not joined to the bots' floor). Keep the depot stocked."),
		L("research", "Research", "Racks and finished jobs earn research points (RP). Spend them in Research (R) on new machines, cooling, power and perks.", `Each step needs its prerequisites and a high enough Level. The first level-up needs ${pf[1]} PF of compute${tn[1] ? ` and ${tn[1]} researched nodes` : ""}.`),
		L("level", "Level", `Your Level rises when you have installed enough compute and researched enough nodes. Level 2 needs ${pf[1]} PF compute${tn[1] ? ` and ${tn[1]} researched nodes` : ""}. Each Level also sets an uptime target (${Math.round((up[1] ?? 0) * 100)}% at Level 2) that the quarterly inspection grades.`, `Each later Level asks for more: ${pf.slice(2).join(", ")} PF${tn.length > 2 ? ` and ${tn.slice(2).join(", ")} researched nodes` : ""}.`, "Each Level unlocks bigger machines and larger contracts, and pays a bonus."),
		L("singularity", "The Singularity: three trees", `The game ends when one tree reaches ${b.soul.spTarget} Singularity points. Each tree scores only from its own racks: Synthetic (the Lattice), Bio (the Flesh) and Green (the Garden).`, "Base racks (AC-1, AC-3, IA-1) score nothing. Select a rack and press Retrofit to turn it into the next rung of a tree, in place, for the new price less half the old one.", "Bio and Green racks slow down as their seal fills; at 100 a tree closes, with no new retrofits and no more points. Click the gauges in the top strip for the Trees panel."),
		L("advisors", "Advisors and decisions", "Four advisors speak for the tower: Cass Parr (cooling and facilities), Bea Altasar (power), Dr. Mel Kiorre (compute and wetware) and Luci Ferro (money and logistics).", "Click a portrait in the strip at the bottom to ask what to worry about. A decision pauses the game and never expires.", "Each advisor recommends a choice, and each has her own agenda: Luci wants the Lattice, Mel the Flesh, Bea the Garden, and Cass wants you to stay human. Taking her advice raises her bond; overruling her lowers it. Click the Singularity bars to see the bonds."),
		L("paths", "Retrofitting a rack", "Each tree has four rungs. A rack moves up one rung at a time, in place, and each rung needs a Level and a research node.", "Switching a rack to another tree starts that tree at rung 1. The old rack is valued as a plain AC-1.", "A retrofit needs the coolant or nutrient pipe under the rack. A wider rack needs a free tile beside it."),
		L("automation", "Automation", "Standing orders let routine chores run themselves, such as booking contracts or ordering spare parts.", `They are unlocked by research. The Foreman can place up to ${b.automation.foremanPerHour} builds per game hour on its own.`),
	];
}

/** The Words list: one entry per term in glossary/terms.ts (the single source of truth). */
function glossary(): Entry[] {
	return TERMS.map((t) => mk({ id: `glossary:${t.id}`, section: "glossary", title: t.name, lines: [t.def, `In AItower: ${t.game}`], at: t.at === "words" ? undefined : t.at }, t.aka ?? "")).sort((x, y) => x.title.localeCompare(y.title, "en", { sensitivity: "base" }));
}

/** Every entry, in display order. Pure. */
export function buildEntries(c: ContentDB): Entry[] {
	const out = basics(c);
	const facs = Object.values(c.facilities)
		.filter((d) => !d.growth)
		.sort((a, b) => a.unlockTier - b.unlockTier || a.cost - b.cost || a.id.localeCompare(b.id));
	for (const d of facs) {
		out.push(
			mk(
				{
					id: `fac:${d.id}`,
					section: "facilities",
					title: d.name,
					lines: [d.description, ...(tierView(d, c).note ? [`${tierView(d, c).note}.`] : [])],
					tier: tierView(d, c),
					stats: defSpecs(d).filter(([k]) => k !== "Needs"),
					needs: facilityNeeds(d),
					spoiler: isBioFacility(d),
					ref: { kind: "facility", id: d.id },
					flavor: d.flavor,
				},
				`${d.kind} ${d.category}`,
			),
		);
	}
	for (const bot of Object.values(c.bots).sort((a, b) => a.cost - b.cost)) {
		out.push(
			mk({
				id: `bot:${bot.id}`,
				section: "bots",
				title: bot.name,
				lines: [`Repairs broken parts. ${bot.flying ? "Flies between floors, no lift needed." : "Walks the floors and rides lifts."}`],
				stats: [
					["Cost", fmtMoney(bot.cost)],
					["Speed", `${bot.speed} tiles/min`],
					["Battery", `${bot.batteryTicks} min`],
					["Repair time", `${bot.repairTicks} min`],
					...(bot.carry && bot.carry > 1 ? ([["Carries", `${bot.carry} parts`]] as [string, string][]) : []),
				],
				ref: { kind: "bot", id: bot.id },
				flavor: bot.flavor,
			}),
		);
	}
	for (const n of [...techList(c)].sort((a, b) => a.minTier - b.minTier || a.cost - b.cost)) {
		const unlocks = unlocksFor(n.id, c);
		out.push(
			mk(
				{
					id: `tech:${n.id}`,
					section: "research",
					title: n.name,
					lines: [n.description, ...(unlocks.length ? [`Unlocks: ${unlocks.join(", ")}.`] : []), ...n.effects.map((e) => effectText(e, c))],
					stats: [
						["Cost", `${n.cost} RP`],
						["Branch", n.branch],
						["Needs Level", String(n.minTier)],
					],
					spoiler: isSpoilerTech(n),
					ref: { kind: "tech", id: n.id },
					flavor: n.flavor,
				},
				n.branch,
			),
		);
	}
	return [...out, ...glossary()];
}

/** What stands between the player and this entry, or null if it is open. */
export function lockFor(e: Entry, view: SimView, c: ContentDB): string | null {
	if (!e.ref) return null;
	if (e.ref.kind === "facility") {
		const d = c.facilities[e.ref.id];
		return d ? lockText(d, view, c) : null;
	}
	if (e.ref.kind === "bot") {
		const g = techGate(c.bots[e.ref.id]?.tech, view, c);
		return g ? `Locked: ${g.replace("Requires research: ", "")}` : null;
	}
	const n = techList(c).find((t) => t.id === e.ref?.id);
	if (!n) return null;
	const s = nodeState(n, view, c);
	return s.kind === "locked" ? `Locked: ${s.reason.replace("Requires ", "needs ")}` : null;
}

/** Case-insensitive search: every word must appear; title hits first, then section order. Empty query returns all. */
export function searchEntries(entries: readonly Entry[], query: string): Entry[] {
	const words = query.toLowerCase().split(/\s+/).filter(Boolean);
	if (words.length === 0) return entries.slice();
	const scored: { e: Entry; s: number; i: number }[] = [];
	entries.forEach((e, i) => {
		if (!words.every((w) => e.keywords.includes(w))) return;
		const title = e.title.toLowerCase();
		const s = words.every((w) => title.startsWith(w)) ? 0 : words.every((w) => title.includes(w)) ? 1 : 2;
		scored.push({ e, s, i });
	});
	return scored.sort((a, b) => a.s - b.s || a.i - b.i).map((x) => x.e);
}

export const sectionOf = (id: string): Section | null => {
	const p = id.split(":")[0];
	return p === "basics" ? "basics" : p === "fac" ? "facilities" : p === "bot" ? "bots" : p === "tech" ? "research" : p === "glossary" ? "glossary" : null;
};

/** The entry for a facility's "More..." link. */
export const facilityEntryId = (defId: string): string => `fac:${defId}`;
