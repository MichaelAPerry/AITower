/**
 * The Encyclopedia as data: pure generation from content (and the view, for lock state) plus search.
 * Basics and glossary are hand-written; facilities, bots and research are generated, so they never drift from the numbers.
 */
import type { ContentDB, FacilityDef, TechNode } from "@aitower/content";
import type { SimView } from "@aitower/sim";
import { defSpecs, lockText } from "../components/BuildPalette";
import { fmtMoney } from "../format";
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
		L("contracts", "Contracts: training and inference", "A contract is a job a client pays for. Accept one in Contracts (C), and your racks work on it until it is done.", "Training jobs are big, have a deadline, and pay well. Inference jobs are steady and small, and pay by the hour of work. Some need stored data or liquid cooling, and the card says so before you accept.", "Missing a deadline costs money and Reputation."),
		L("power", "Power", "Racks, coolers and bots all draw electrical power. A grid connection brings it in; conduits (the power lines under the floor) carry it to machines.", "If supply is short, machines slow down (a brownout). With none at all they stop and show NO POWER over them.", "A generator or battery (UPS) bridges short outages. Solar and wind help if you have them."),
		L("cooling", "Cooling and heat", `Every watt a rack uses becomes heat. Racks run fine up to ${t.okC} °C, slow down (throttle) toward ${t.throttleC} °C, and trip offline at ${t.tripC} °C.`, "Air handlers cool nearby racks on their floor. Hot air rises, so top floors run warmer. HOT over a rack means it is throttling.", "The Gauges drawer (I) has a heat overlay (H) that shows where it builds up."),
		L("loops", "Coolant loops", "Liquid-cooled racks need a coolant line under them, running from a chiller through a distribution unit (CDU).", "Lay the pipe with the coolant tool, connect a chiller, then add a CDU for capacity. A rack over its loop's capacity shows NO COOLANT.", "Liquid cooling moves much more heat than air, which is what lets you pack in powerful racks."),
		L("lifts", "Lifts and bots", `Maintenance bots repair broken parts. They walk the floors and ride lifts between them (up to ${c.lift.capacity} per car), so a tower with several floors needs a lift.`, "Chargers recharge and house the bots. Flying drones skip the lift. Hover a bot or lift in the tower to see its name."),
		L("parts", "Spare parts", `Bots need a spare part for each repair, from a depot. A part costs ${fmtMoney(c.structure.sparePart)}.`, "Racks fail now and then. A rack with BROKEN over it is waiting for a bot and a part, so keep the depot stocked."),
		L("research", "Research", "Racks and finished jobs earn research points (RP). Spend them in Research (R) on new machines, cooling, power and perks.", `Each step needs its prerequisites and a high enough Level. The first level-up needs ${pf[1]} PF of compute${tn[1] ? ` and ${tn[1]} researched nodes` : ""}.`),
		L("level", "Level", `Your Level rises when you have installed enough compute, kept uptime high and researched enough nodes. Level 2 needs ${pf[1]} PF compute, ${Math.round((up[1] ?? 0) * 100)}% uptime${tn[1] ? ` and ${tn[1]} researched nodes` : ""}.`, `Each later Level asks for more: ${pf.slice(2).join(", ")} PF${tn.length > 2 ? ` and ${tn.slice(2).join(", ")} researched nodes` : ""}.`, "Each Level unlocks bigger machines and larger contracts, and pays a bonus."),
		L("reputation", "Reputation", `Reputation (0 to 100) is the Compute Authority's trust in you. You start at ${b.standing.start}.`, `A day that meets your level's uptime target raises it (+${b.standing.dailyGood}); a day below it lowers it by ${Math.abs(b.standing.dailyNearMiss)} for a near miss, up to ${Math.abs(b.standing.dailyBad)} for a big one; a failed job costs ${Math.abs(b.standing.jobFailed)}. At 0 you are shut down.`),
		L("memos", "Memos and the Compute Authority", "The Compute Authority is the Ministry body you answer to. It sends memos to your Inbox with choices: take the offer, decline it, or file it for later.", "Each choice has a price and a payoff, shown as chips on the memo. Most can wait; urgent ones say so."),
		L("paths", "Paths and Ascension", `At Level ${b.ascension.minTier} the Compute Authority offers Ascension: a one-time, permanent choice of direction for your tower.`, `Paths on offer: ${c.paths.map((p) => p.name).join(", ")}.`, "The choice is irreversible. Read the form before you sign."),
		L("automation", "Automation", "Standing orders let routine chores run themselves, such as booking contracts or ordering spare parts.", `They are unlocked by research. The Foreman can place up to ${b.automation.foremanPerHour} builds per game hour on its own.`),
	];
}

function glossary(): Entry[] {
	const G = (term: string, ...lines: string[]): Entry => mk({ id: `glossary:${term.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, section: "glossary", title: term, lines });
	return [
		G("Rack", "A tall cabinet of computers. It needs power, cooling and a bot to repair it. Racks earn money by running jobs."),
		G("Reputation", "Your trust score, from 0 to 100. Good days raise it, failed jobs and missed uptime lower it. At 0 you are shut down."),
		G("Overlay", "A colour view over the floor, such as Heat or Power, that shows what is hot or short of power."),
		G("PF", "Petaflop: a quadrillion calculations per second. The game's unit of compute, shown like \"80 PF compute\"."),
		G("PFLOPS", "Petaflops per second of computing power. Same unit as PF; this is what contracts are measured in."),
		G("kW", "Kilowatt: 1,000 watts of power. A rack might draw tens of kW."),
		G("MW", "Megawatt: 1,000 kW. Big towers draw several."),
		G("kWh", "Kilowatt-hour: energy. Running 1 kW for one hour. This is what the power bill charges for."),
		G("CDU", "Coolant distribution unit. Shares a chiller's cold liquid between liquid-cooled racks on the same loop."),
		G("CRAH", "Computer room air handler. A fan-and-coil unit that cools the air around nearby racks."),
		G("Chiller", "Makes the cold liquid for a coolant loop. It uses electricity, more when it is hot outside."),
		G("COP", "Coefficient of performance: heat moved per unit of electricity. Higher is cheaper to run."),
		G("PUE", "Power usage effectiveness: total power divided by IT power. 1.0 is perfect; the closer, the less you waste on cooling."),
		G("Uptime", "The share of time your compute is available. Contracts, Level and Reputation all depend on it."),
		G("UPS", "Uninterruptible power supply: a battery that carries the tower through short power gaps."),
		G("Genset", "A backup generator. Starts after a short delay when power runs short, and burns fuel."),
		G("Throttle", "A hot rack slows itself to stay safe. Less compute, same power bill."),
		G("Brownout", "Not enough power for everything on the line, so machines run slow."),
		G("DLC", "Direct liquid cooling: coolant piped to the chips. Moves more heat than air."),
		G("RP", "Research points. Earned from delivered compute and finished jobs; spent on research."),
		G("Tick", "One game minute. The simulation advances one tick at a time."),
	];
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
					lines: [d.description],
					stats: defSpecs(d).filter(([k]) => k !== "Needs"),
					needs: facilityNeeds(d),
					spoiler: isBioFacility(d),
					ref: { kind: "facility", id: d.id },
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
