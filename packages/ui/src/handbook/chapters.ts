/**
 * The Handbook chapters as data. Pure: chapters come from content, and unlocking is a function of the view.
 * Six core chapters (compact, under 170 words each, each ending in a "Speak the language" block), one "Making the most of Level N" per Level, one per path.
 */
import type { AscensionPath, ContentDB, FacilityDef, Flavor } from "@aitower/content";
import type { SimView } from "@aitower/sim";
import { fmtMoney } from "../format";
import { termById } from "../glossary/terms";

export type DiagramId = "center" | "power" | "heat" | "break" | "uptime" | "money";
/** What a chapter's "Try it" button does in the game. */
export type TryId = "catalog" | "power" | "heat" | "parts" | "insights" | "contracts" | "research";
export type Unlock = { kind: "always" } | { kind: "level"; n: number } | { kind: "path"; path: AscensionPath };

export interface Block {
	h?: string;
	p: string;
}
export interface Chapter {
	id: string;
	group: "core" | "level" | "path";
	title: string;
	blocks: Block[];
	/** "Speak the language": ids of glossary terms this chapter teaches (see glossary/terms.ts). */
	terms?: string[];
	diagram?: DiagramId;
	tryIt: { label: string; id: TryId };
	unlock: Unlock;
	/** A real quotation shown atop the chapter (all verified in docs/QUOTES.md). */
	flavor?: Flavor;
	/** Lower-case search text. */
	keywords: string;
}

type Slice = Pick<SimView, "tier" | "path" | "affinity">;

/** From this Level a path chapter opens once the path holds at least this share of the tower's leanings. */
export const PATH_MIN_LEVEL = 3;
export const PATH_SHARE = 0.5;
/** Level at which every path chapter opens (Ascension is on offer). */
export const PATH_ALL_LEVEL = 5;

export function isUnlocked(u: Unlock, v: Slice): boolean {
	if (u.kind === "always") return true;
	if (u.kind === "level") return v.tier >= u.n;
	return v.path === u.path || v.tier >= PATH_ALL_LEVEL || (v.tier >= PATH_MIN_LEVEL && v.affinity[u.path] >= PATH_SHARE);
}

const PATH_NAME: Record<AscensionPath, string> = { biotech: "Biotech", greentech: "Greentech", synthetic: "Synthetic" };

/** "Unlocks at ..." for a locked chapter, or null when it is open. */
export function lockText(u: Unlock, v: Slice): string | null {
	if (isUnlocked(u, v)) return null;
	if (u.kind === "level") return `Unlocks at Level ${u.n}`;
	if (u.kind === "path") return `Unlocks at Level ${PATH_ALL_LEVEL}, or sooner when ${PATH_NAME[u.path]} leads your tower (from Level ${PATH_MIN_LEVEL})`;
	return null;
}

/** Ids of the chapters open for this view. */
export const unlockedIds = (chapters: readonly Chapter[], v: Slice): string[] => chapters.filter((c) => isUnlocked(c.unlock, v)).map((c) => c.id);
/** Chapters in `open` the reader has not been told about yet. */
export const newlyOpen = (open: readonly string[], known: readonly string[]): string[] => open.filter((id) => !known.includes(id));

/** Words in the chapter body (the "Speak the language" block is reference, not reading, and is not counted). */
export const wordCount = (c: Chapter): number => c.blocks.reduce((n, b) => n + b.p.split(/\s+/).filter(Boolean).length, 0);

const pct = (n: number): string => `${Math.round(n * 100)}%`;
const nm = (c: ContentDB, id: string): string => c.facilities[id]?.name ?? id;
const list = (xs: string[], max = 4): string => (xs.length > max ? `${xs.slice(0, max).join(", ")} and more` : xs.join(", "));

function core(c: ContentDB): Chapter[] {
	const b = c.balance;
	const t = b.thermal;
	const up = b.tiers.uptime;
	const grid = c.facilities.grid_tie?.power?.capacityKw ?? 1500;
	const rack = c.facilities.rack_air_gpu?.rack;
	const k = (id: string, title: string, blocks: string[], diagram: DiagramId, tryIt: Chapter["tryIt"], terms: string[]): Chapter => ({
		id: `ch:${id}`,
		group: "core",
		title,
		blocks: blocks.map((p) => ({ p })),
		terms,
		diagram,
		tryIt,
		unlock: { kind: "always" },
		keywords: `${title} ${blocks.join(" ")} ${terms.map((x) => { const d = termById(x); return d ? `${d.name} ${d.aka ?? ""} ${d.def}` : ""; }).join(" ")}`.toLowerCase(),
	});
	return [
		k("what", "What is a datacenter?", ["A datacenter turns electricity into compute and sells the compute. The product is capacity: operations delivered on schedule, billed by the job or by the hour.", "The unit you build around is the rack, a cabinet of servers. It draws power, gives off the same power as heat, and fails at a predictable rate. Everything else in the building exists to feed racks, cool them and replace them.", "The compute is sold two ways. Training is a big one-off job with a deadline. Inference is a standing service that has to answer whenever users ask.", "AItower is that loop: racks earn from contracts, power, cooling and repairs eat the margin, and the compute you run decides which way the world ends."], "center", { label: "Open the Racks catalog", id: "catalog" }, ["it-load", "rack", "pflops", "training", "inference"]),
		k("power", "Power", [`Power is measured in kW, a rate: how hard something pulls right now. Capacity is the ceiling, the most a supply can deliver. A rack at full load pulls ${rack?.powerKw ?? 40} kW; a grid intake has a capacity (yours is ${grid / 1000} MW). Load must stay under capacity, and the gap between them is headroom. Operators keep some in hand.`, "A PDU steps power down for the racks. A UPS bridges the seconds between a grid failure and a generator starting. N+1 means one spare unit beyond what the load needs, so a single failure is not an outage.", "Load above capacity is a brownout: machines slow down. With no supply they stop. The Power overlay shows where it runs short."], "power", { label: "Show me the Power map", id: "power" }, ["kw", "capacity", "headroom", "mw", "kwh", "rack-density", "pdu", "ups", "genset", "redundancy", "brownout"]),
		k("heat", "Heat & cooling", [`Every watt a rack draws leaves as heat, so cooling load equals IT load. Racks run normally up to ${t.okC} °C, throttle as they approach ${t.throttleC} °C, and trip offline at ${t.tripC} °C.`, "Air cooling moves heat with fans. A CRAH blows room air over chilled-water coils, and containment keeps hot exhaust from mixing with cold supply. Air gives out at a few tens of kW per rack. Denser racks use direct-to-chip liquid cooling or sit in immersion tanks, on a loop where a chiller makes cold water and a CDU hands it to the racks.", "The scorecard is PUE: total facility power divided by IT power. Everything above 1.0 is overhead, mostly cooling."], "heat", { label: "Show me the heat", id: "heat" }, ["crah", "crac", "aisle", "chiller", "cdu", "dlc", "immersion", "pue", "wue", "heat-reuse", "tdp", "throttle", "cop"]),
		k("break", "Why racks break", ["Hardware fails at a steady rate, and heat raises it. At fleet scale something is always broken, so operators plan around failure rather than against it.", `A failed part leaves the rack BROKEN and earning nothing. A maintenance bot repairs it, but needs a spare from a depot (${fmtMoney(c.structure.sparePart)} each). Reliability is MTBF, the mean time between failures. Repair speed is MTTR. Availability is roughly MTBF ÷ (MTBF + MTTR), so spares and bots shrink the half you control.`, "Training jobs survive failures by checkpointing: they save progress at intervals, so a dead rack costs the work since the last save, not the whole job."], "break", { label: "Open the Supplies tab", id: "parts" }, ["mtbf", "mttr", "checkpointing"]),
		k("uptime", "Uptime", [`Uptime is the share of time capacity was available, and the industry counts it in nines: 99.9% allows about 8.8 hours of downtime a year, 99.99% about 53 minutes. Your Level targets run from ${pct(up[1] ?? 0)} at Level 2 to ${pct(up[4] ?? 0)} at Level 5.`, "Customers buy availability through an SLA, a contract with penalties. Inside the company the working target is the SLO, set tighter than the SLA so you breach the contract only after missing your own goal.", "The quarterly inspection grades your uptime against your Level's target, with a cash grant or fine."], "uptime", { label: "Open Insights", id: "insights" }, ["uptime", "nines", "sla", "slo"]),
		k("money", "Money", [`You start with ${fmtMoney(b.startingCash)}. Building is capex, a one-time cost. Power, upkeep and repairs are opex, paid continuously. Every rack has to earn back its capex while covering its opex.`, "Utilisation is the lever: a rack with no job still costs opex. That is why PER HOUR at the top turns red when nothing is running and green once a contract is.", `Electricity is the biggest running cost. Large operators lock its price with a PPA, a long-term power purchase agreement, instead of paying the spot rate. At midnight the Ministry takes ${Math.round(b.tax.profitShare * 100)}% of the day's profit.`], "money", { label: "Open Contracts", id: "contracts" }, ["capex", "utilisation", "ppa"]),
	];
}

/** Hand-written advice per Level: what to build next and the mistakes people make. */
function levelAdvice(n: number, c: ContentDB): { next: string; mistakes: string } {
	const N = (id: string) => nm(c, id);
	switch (n) {
		case 1:
			return {
				next: `Place two or three ${N("rack_air_gpu")}s, an ${N("crah_unit")} beside them, and a ${N("grid_tie")}. Add a ${N("parts_depot")} and a ${N("bot_charger")}. Then take a Training job in Contracts.`,
				mistakes: "A rack with no air handler in reach throttles. No depot means broken racks stay broken. Idle racks earn nothing and still cost upkeep, so keep utilisation up with a contract running.",
			};
		case 2:
			return {
				next: `Lay a coolant pipe, add a ${N("chiller")} and a ${N("cdu")}, then a ${N("rack_dlc_gpu")}. Research opens the stronger air and power gear.`,
				mistakes: "A liquid rack with no coolant shows NO COOLANT and does nothing. A chiller needs a CDU to distribute its cold water. Watch the power budget as density climbs: kW per rack adds up fast.",
			};
		case 3:
			return {
				next: "Research cooling and power before density. Add a bigger UPS or turbine, then denser racks. Read the chapter for the path you are leaning toward.",
				mistakes: "Adding racks faster than power and cooling is the classic one. Spreading research thin is the other. Pick a direction and follow it.",
			};
		case 4:
			return {
				next: `Grow the grid (${N("grid_tie")} upgrades), then cooling that keeps up: free-air chillers and blade racks. Start building toward the path you like best.`,
				mistakes: "Racks outgrow the grid. Uptime slips because nobody watched it while the tower grew. The blast radius of a failure scales with the size of the tower.",
			};
		default:
			return {
				next: "Select a rack and press a Retrofit button to start a tree. Click the gauges in the top strip to see all three trees and what each needs next.",
				mistakes: "Spreading racks over all three trees: each tree scores only its own racks. Ignoring a tree's seal until it closes.",
			};
	}
}

function levelChapter(n: number, c: ContentDB): Chapter {
	const { pflops, uptime, reward } = c.balance.tiers;
	const defs = Object.values(c.facilities).filter((d) => d.unlockTier === n && !d.growth && !d.retired);
	const ready = defs.filter((d) => !d.tech).map((d) => d.name);
	const later = defs.filter((d) => !!d.tech).map((d) => d.name);
	const adv = levelAdvice(n, c);
	const top = n >= pflops.length;
	const news = [ready.length ? `${n === 1 ? "You start with" : "Ready to build"}: ${list(ready, 6)}.` : "", later.length ? `Research unlocks: ${list(later, 5)}.` : ""].filter(Boolean).join(" ");
	const blocks: Block[] = [
		{ h: "What is new", p: news || `Nothing new to build. Research is where Level ${n} pays off.` },
		{ h: "Build next", p: adv.next },
		{ h: "Mistakes to avoid", p: adv.mistakes },
		{ h: top ? "After this" : `Reach Level ${n + 1}`, p: top ? `There is no Level ${n + 1}. Grow compute and push your tree to its Singularity; keep uptime at ${pct(uptime[n - 1] ?? 0)} for a good inspection.` : `Install ${pflops[n]} PF of compute, and have ${c.balance.tiers.techs?.[n] ?? 0} nodes researched (the Research drawer, R). The check happens at midnight and pays ${fmtMoney(reward[n])}.` },
	];
	return { id: `ch:level${n}`, group: "level", title: `Making the most of Level ${n}`, blocks, tryIt: { label: top ? "Open Insights" : "See my progress", id: "insights" }, unlock: { kind: "level", n }, keywords: `level ${n} ${blocks.map((x) => x.p).join(" ")}`.toLowerCase() };
}

const BIO = new Set(["nutrient", "sterilizer", "quarantine", "bioreactor"]);
const GREEN = new Set(["solar", "wind", "heat_export", "carbon"]);
const onPath = (p: AscensionPath, d: FacilityDef): boolean => !d.growth && (p === "biotech" ? d.category === "bio" || BIO.has(d.kind) || !!d.rack?.bio : p === "greentech" ? GREEN.has(d.kind) : d.kind === "rack" && d.unlockTier >= 4 && !d.rack?.bio);

function pathChapter(p: AscensionPath, c: ContentDB): Chapter {
	const target = c.balance.soul?.spTarget ?? 1000;
	const gear = Object.values(c.facilities)
		.filter((d) => onPath(p, d))
		.sort((a, b) => a.unlockTier - b.unlockTier)
		.map((d) => d.name);
	const researchNodes = c.tech.filter((t) => t.path === p).map((t) => t.name);
	const unlocks = `Machines: ${list(gear, 5)}. Research: ${list(researchNodes, 3)}.`;
	const text: Record<AscensionPath, { earn: string; win: string; risk: string }> = {
		biotech: {
			earn: "Retrofit racks to the Bio line (Level 2 and up, after the Wetware Annex research). Running Bio racks earn Bio Singularity points.",
			win: `Feed the annex and hold the tanks at 37 °C. Living cabinets give about three times the compute for each kW. The Flesh Remembers at ${target} Bio points. Only Bio racks score for the Flesh, so retrofit your racks up the Bio line.`,
			risk: "Growth spreads if you do not contain it, and at 99% corruption the tower absorbs you. Some machines hurt the tissue. Mel will tell you which ones, once she trusts you.",
		},
		greentech: {
			earn: "Retrofit racks to the Green line (Level 2 and up, after the Neuromorphic Bench research). Running Green racks earn Green Singularity points, scaled by your Green Score.",
			win: `Your Green Score rises with the share of power from the weather and the heat you sell. Green-line racks earn the most. The Garden opens at ${target} Green points. Sell waste heat (heat reuse) and grow algae for carbon credits.`,
			risk: `Some days are dark and still. Weather-dependent supply drops to ${pct(c.balance.green.droughtFactor)} for ${c.balance.green.droughtHours} hours. Keep a genset ready and a UPS charged.`,
		},
		synthetic: {
			earn: "The default. Every running rack that is not on the Bio or Green line feeds the Lattice, and the Synthetic line feeds it twice over.",
			win: `The Lattice closes at ${target} Synthetic points. Cool lattice racks on a cryo loop, and keep everything running behind monitors and a backup vault.`,
			risk: "The Lattice fills even while you build toward another tree. Watch its bar.",
		},
	};
	const t = text[p];
	const blocks: Block[] = [
		{ h: "How you earn it", p: `${t.earn} Your Singularity bars show each tree's progress.` },
		{ h: "What it unlocks", p: unlocks },
		{ h: "How to score high", p: t.win },
		{ h: "Risks", p: t.risk },
	];
	const name = PATH_NAME[p];
	return { id: `ch:path-${p}`, group: "path", title: `Making the most of the ${name} path`, blocks, ...(p === "greentech" ? { terms: ["heat-reuse", "ppa", "pue"] } : {}), tryIt: { label: "Open Research", id: "research" }, unlock: { kind: "path", path: p }, keywords: `${name} path ascension ${blocks.map((x) => x.p).join(" ")}`.toLowerCase() };
}

/** Chapter epigraphs. Each is a real quotation, verified in docs/QUOTES.md. */
export const CHAPTER_FLAVOR: Record<string, Flavor> = {
	"ch:what": { quote: "We can only see a short distance ahead, but we can see plenty there that needs to be done.", author: "Alan Turing", source: "Computing Machinery and Intelligence, Mind, 1950" },
	"ch:power": { quote: "Electricity ought to be as cheap as oxygen, for it can not be destroyed.", author: "Thomas Edison", source: "Quoted in The Fra, April 1910" },
	"ch:heat": { quote: "The law that entropy always increases, holds, I think, the supreme position among the laws of Nature.", author: "Arthur Eddington", source: "The Nature of the Physical World, 1928" },
	"ch:break": { quote: "Everything fails all the time.", author: "Werner Vogels", source: "The Next Web conference, 2008 (reported by TNW, 4 April 2008)" },
	"ch:uptime": { quote: "Simplicity is prerequisite for reliability.", author: "Edsger W. Dijkstra", source: "EWD498, 1975" },
	"ch:money": { quote: "Remember that time is money.", author: "Benjamin Franklin", source: "Advice to a Young Tradesman, 1748" },
	"ch:level1": { quote: "For which of you, intending to build a tower, sitteth not down first, and counteth the cost, whether he have sufficient to finish it?", author: "King James Bible", source: "Luke 14:28 (KJV, 1611)" },
	"ch:level2": { quote: "Hence plan to throw one away; you will, anyhow.", author: "Fred Brooks", source: "The Mythical Man-Month, 1975" },
	"ch:level3": { quote: "Plans are worthless, but planning is everything.", author: "Dwight D. Eisenhower", source: "Address to the National Defense Executive Reserve Conference, 14 November 1957" },
	"ch:level4": { quote: "The complexity for minimum component costs has increased at a rate of roughly a factor of two per year.", author: "Gordon Moore", source: "Cramming more components onto integrated circuits, Electronics, 1965" },
	"ch:level5": { quote: "Go to, let us build us a city and a tower, whose top may reach unto heaven", author: "King James Bible", source: "Genesis 11:4 (KJV, 1611)" },
	"ch:path-biotech": { quote: "It was on a dreary night of November that I beheld the accomplishment of my toils.", author: "Mary Shelley", source: "Frankenstein, ch. 5" },
	"ch:path-greentech": { quote: "Those who contemplate the beauty of the earth find reserves of strength that will endure as long as life lasts.", author: "Rachel Carson", source: "The Sense of Wonder, 1965" },
	"ch:path-synthetic": { quote: "I see no limit to the capabilities of machines.", author: "Claude Shannon", source: "Omni, August 1987" },
};

/** Every chapter in reading order: core, then Levels, then paths. */
export function buildChapters(c: ContentDB): Chapter[] {
	const levels = Array.from({ length: c.balance.tiers.pflops.length }, (_, i) => levelChapter(i + 1, c));
	return [...core(c), ...levels, ...(["biotech", "greentech", "synthetic"] as const).map((p) => pathChapter(p, c))].map((ch) => (CHAPTER_FLAVOR[ch.id] ? { ...ch, flavor: CHAPTER_FLAVOR[ch.id] } : ch));
}

/** Old "More..." targets that now have a Handbook chapter. */
const CHAPTER_OF: Record<string, string> = { "basics:power": "ch:power", "basics:cooling": "ch:heat", "basics:loops": "ch:heat", "basics:parts": "ch:break", "basics:singularity": "ch:path-synthetic", "basics:money": "ch:money", "basics:level": "ch:uptime" };
/** The Handbook page that an encyclopedia-style id should open: a chapter if there is one, else the id itself. */
export const primerTarget = (id: string): string => CHAPTER_OF[id] ?? id;

/**
 * Handbook search over chapters: every word must appear. Open chapters match on their whole text; locked ones only on their
 * title, so a locked article exists in the results but gives nothing away.
 */
export function searchChapters(chapters: readonly Chapter[], query: string, view: Slice): Chapter[] {
	const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
	if (words.length === 0) return [];
	return chapters.filter((c) => words.every((w) => (isUnlocked(c.unlock, view) ? c.keywords : c.title.toLowerCase()).includes(w)));
}
