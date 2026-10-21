/**
 * The Datacenter Primer as data. Pure: chapters come from content, and unlocking is a function of the view.
 * Six core chapters (plain, under 120 words each), one "Making the most of Level N" per Level, one per path.
 */
import type { AscensionPath, ContentDB, FacilityDef } from "@aitower/content";
import type { SimView } from "@aitower/sim";
import { fmtMoney } from "../format";

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
	diagram?: DiagramId;
	tryIt: { label: string; id: TryId };
	unlock: Unlock;
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
	const k = (id: string, title: string, blocks: string[], diagram: DiagramId, tryIt: Chapter["tryIt"]): Chapter => ({
		id: `ch:${id}`,
		group: "core",
		title,
		blocks: blocks.map((p) => ({ p })),
		diagram,
		tryIt,
		unlock: { kind: "always" },
		keywords: `${title} ${blocks.join(" ")}`.toLowerCase(),
	});
	return [
		k("what", "What is a datacenter?", ["A datacenter is a big building full of computers. Companies pay you to use them for giant jobs, like teaching an AI.", "The computers live in tall cabinets called racks. Every rack needs three helpers: power to run, cooling so it stays cool, and a bot to fix it when it breaks.", "You earn money when racks finish jobs. Your goal is to grow the tower and keep it running."], "center", { label: "Open the Racks catalog", id: "catalog" }),
		k("power", "Power", [`Computers eat electricity. It comes in from the city through a grid intake. Yours gives up to ${grid / 1000} MW. One air-cooled rack uses ${rack?.powerKw ?? 40} kW, so the lines fill up fast.`, "Wires under the floor carry power to each machine. If there is not enough, machines slow down. That is a brownout. If there is none, they stop.", "A battery keeps things going for a short gap. A generator keeps them going longer."], "power", { label: "Show me the Power map", id: "power" }),
		k("heat", "Heat & cooling", ["Computers turn electricity into thinking, and also into heat. A lot of heat.", `Up to ${t.okC} °C a rack is happy. Past that it slows down. At ${t.tripC} °C it switches itself off to stay safe.`, "An air handler blows cool air over the racks around it. A chiller is like a fridge for water. The cold water cools racks that are too hot for air. Put an air handler close to every rack."], "heat", { label: "Show me the heat", id: "heat" }),
		k("break", "Why racks break", ["Computers wear out. Hot racks wear out faster.", `When a part breaks, the rack shows BROKEN and stops earning. A maintenance bot walks over to fix it, but it needs a spare part first. A part costs ${fmtMoney(c.structure.sparePart)}.`, "No parts means no repair. Keep a few in the depot. Keep racks cool, too, and fewer things will break."], "break", { label: "Open the Supplies tab", id: "parts" }),
		k("uptime", "Uptime & reputation", [`Uptime is how much of the time your racks are up and working. Clients need to count on you. Level 2 needs ${pct(up[1] ?? 0)}. Level 5 needs ${pct(up[4] ?? 0)}.`, `Reputation is the trust score, from 0 to 100. A day at or over the target adds ${b.standing.dailyGood}. A day under takes points away. A failed job costs ${Math.abs(b.standing.jobFailed)}. At 0 you are shut down.`], "uptime", { label: "Open Insights", id: "insights" }),
		k("money", "Money", [`You started with ${fmtMoney(b.startingCash)}. Money comes in when a job finishes. It goes out for power, upkeep, repairs and late fines.`, `At midnight the Ministry takes ${Math.round(b.tax.profitShare * 100)}% of the day's profit as tax.`, "PER HOUR at the top shows if you are ahead right now. Red with no job running is only upkeep. Take a job and it turns green."], "money", { label: "Open Contracts", id: "contracts" }),
	];
}

/** Hand-written advice per Level: what to build next and the mistakes people make. */
function levelAdvice(n: number, c: ContentDB): { next: string; mistakes: string } {
	const N = (id: string) => nm(c, id);
	switch (n) {
		case 1:
			return {
				next: `Place two or three ${N("rack_air_gpu")}s, an ${N("crah_unit")} beside them, and a ${N("grid_tie")}. Add a ${N("parts_depot")} and a ${N("bot_charger")}. Then take a Training job in Contracts.`,
				mistakes: "Racks with no air handler close by get hot. No depot means broken racks wait for ever. Idle racks earn nothing, so always have a job running.",
			};
		case 2:
			return {
				next: `Lay a coolant pipe, add a ${N("chiller")} and a ${N("cdu")}, then a ${N("rack_dlc_gpu")}. Research opens the stronger air and power gear.`,
				mistakes: "A liquid rack with no coolant shows NO COOLANT and does nothing. A chiller needs a CDU to share its cold. Do not let power run short as racks pile up.",
			};
		case 3:
			return {
				next: "Spend research on cooling and power first. Add a bigger battery or turbine, then denser racks. Read the Primer chapter for the path that fits your plans.",
				mistakes: "Adding racks faster than power and cooling is the big one. Another is spreading research thin. Pick a direction and follow it.",
			};
		case 4:
			return {
				next: `Grow the grid (${N("grid_tie")} upgrades), then cooling that keeps up: free-air chillers and blade racks. Start building toward the path you like best.`,
				mistakes: "Racks outgrow the grid. Uptime slips because nobody watched it while the tower got big. A big tower makes a big mess when it fails.",
			};
		default:
			return {
				next: "Open FORM A-5 and choose a path when you are ready. Read that path's chapter first. Keep uptime high while you build toward it.",
				mistakes: "Signing the form without reading it. The choice cannot be undone. Letting uptime slip while you decide.",
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
		{ h: top ? "After this" : `Reach Level ${n + 1}`, p: top ? `There is no Level ${n + 1}. Keep uptime at ${pct(uptime[n - 1] ?? 0)} or better, grow compute, and choose a path with Ascension.` : `Install ${pflops[n]} PF of compute, have ${c.balance.tiers.techs?.[n] ?? 0} nodes researched (the Research drawer, R) and keep uptime at ${pct(uptime[n])} or better. The check happens at midnight and pays ${fmtMoney(reward[n])}.` },
	];
	return { id: `ch:level${n}`, group: "level", title: `Making the most of Level ${n}`, blocks, tryIt: { label: top ? "Open Insights" : "See my progress", id: "insights" }, unlock: { kind: "level", n }, keywords: `level ${n} ${blocks.map((x) => x.p).join(" ")}`.toLowerCase() };
}

const BIO = new Set(["nutrient", "sterilizer", "quarantine", "bioreactor"]);
const GREEN = new Set(["solar", "wind", "heat_export", "carbon"]);
const onPath = (p: AscensionPath, d: FacilityDef): boolean => !d.growth && (p === "biotech" ? d.category === "bio" || BIO.has(d.kind) || !!d.rack?.bio : p === "greentech" ? GREEN.has(d.kind) : d.kind === "rack" && d.unlockTier >= 4 && !d.rack?.bio);

function pathChapter(p: AscensionPath, c: ContentDB): Chapter {
	const e = c.balance.endings;
	const gx = e.greenExemplar ?? { minScore: 0.7, pflops: 3000 };
	const mm = e.millionMinds ?? { minScore: 0.85, pflops: 3600 };
	const gear = Object.values(c.facilities)
		.filter((d) => onPath(p, d))
		.sort((a, b) => a.unlockTier - b.unlockTier)
		.map((d) => d.name);
	const researchNodes = c.tech.filter((t) => t.path === p).map((t) => t.name);
	const unlocks = `Machines: ${list(gear, 5)}. Research: ${list(researchNodes, 3)}.`;
	const text: Record<AscensionPath, { earn: string; win: string; risk: string }> = {
		biotech: {
			earn: "Leanings grow when you pick Biotech answers in memos, research the Wetware steps, and keep nutrient plants and organoid cabinets running.",
			win: `Feed the annex and hold the tanks at 37 °C. Living cabinets give about three times the compute for each kW. A Living Tower needs ${e.livingTower.pflops} PF with lots of growth. A Clean Tower needs ${e.cleanTower.pflops} PF with very little. Choose one and stay with it.`,
			risk: "Growth spreads if you do not keep it in check. Sterile bays and quarantine locks cost money but keep it tidy. The Ministry will say it is all under control.",
		},
		greentech: {
			earn: "Leanings grow when you pick Greentech answers in memos, research the sun, wind and heat steps, and keep panels, masts and heat links running.",
			win: `Your Green Score rises with the share of power from the weather and the heat you sell. Reach ${pct(gx.minScore)} with ${gx.pflops} PF to be an exemplar. Sell waste heat. Grow algae for carbon credits.`,
			risk: `Some days are dark and still. The weather power drops to ${pct(c.balance.green.droughtFactor)} for ${c.balance.green.droughtHours} hours. Keep a generator warm and a battery full.`,
		},
		synthetic: {
			earn: "Leanings grow when you pick Synthetic answers in memos, research the Continuity steps, and run the newest top-tier racks.",
			win: `Your Refinement is uptime multiplied by the share of compute on top-tier racks. Reach ${pct(mm.minScore)} with ${mm.pflops} PF. Cool lattice racks on a cryo loop. Keep everything running behind monitors and a backup vault.`,
			risk: "One long outage hurts twice, because Refinement counts uptime. The minds are polite, but they do not like being switched off.",
		},
	};
	const t = text[p];
	const blocks: Block[] = [
		{ h: "How you earn it", p: `${t.earn} Your Ascension form shows the share for each path.` },
		{ h: "What it unlocks", p: unlocks },
		{ h: "How to score high", p: t.win },
		{ h: "Risks", p: t.risk },
	];
	const name = PATH_NAME[p];
	return { id: `ch:path-${p}`, group: "path", title: `Making the most of the ${name} path`, blocks, tryIt: { label: "Open Research", id: "research" }, unlock: { kind: "path", path: p }, keywords: `${name} path ascension ${blocks.map((x) => x.p).join(" ")}`.toLowerCase() };
}

/** Every chapter in reading order: core, then Levels, then paths. */
export function buildChapters(c: ContentDB): Chapter[] {
	const levels = Array.from({ length: c.balance.tiers.pflops.length }, (_, i) => levelChapter(i + 1, c));
	return [...core(c), ...levels, ...(["biotech", "greentech", "synthetic"] as const).map((p) => pathChapter(p, c))];
}

/** Old "More..." targets that now have a Primer chapter. */
const CHAPTER_OF: Record<string, string> = { "basics:power": "ch:power", "basics:cooling": "ch:heat", "basics:loops": "ch:heat", "basics:parts": "ch:break", "basics:reputation": "ch:uptime", "basics:money": "ch:money", "basics:level": "ch:uptime" };
/** The Primer page that an encyclopedia-style id should open: a chapter if there is one, else the id itself. */
export const primerTarget = (id: string): string => CHAPTER_OF[id] ?? id;
