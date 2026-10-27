/**
 * Plain-language copy and grouping for the Research panel. Pure: no React, so it is unit-tested.
 * Every number comes from content or the view; only the wording is written here.
 */
import { type TierView, tierView } from "../build/tier";
import type { AscensionPath, ContentDB, TechBranch, TechNode, } from "@aitower/content";
import type { SimView } from "@aitower/sim";
import { plainBlurb, plainStats } from "../build/plain";
import { fmtDuration } from "../format";
import { effectText, nodeState, researchedSet, techList, techName, unlocksFor } from "./tech";

export type NodeGroup = "done" | "ready" | "next" | "later";

export const TAB_LABEL: Record<TechBranch, string> = { compute: "Compute", cooling: "Cooling", power: "Power", logistics: "Logistics", administration: "Admin", wetware: "Wetware" };
const TAB_ORDER: TechBranch[] = ["compute", "cooling", "power", "logistics", "administration", "wetware"];

/** Wetware and biotech-path nodes keep their secrets until they can actually be started (same rule as the Encyclopedia). */
export const isSpoilerTech = (t: TechNode): boolean => t.branch === "wetware" || t.path === "biotech";

/**
 * Where a node sits for the player. ready = everything but points is met (or points too); next = one step away,
 * i.e. every missing prerequisite is itself ready; later = anything further out (hidden behind "N more later").
 */
export function groupOf(node: TechNode, view: SimView, content: ContentDB): NodeGroup {
	const s = nodeState(node, view, content);
	if (s.kind === "researched") return "done";
	if (s.kind !== "locked") return "ready";
	const done = researchedSet(view);
	const missing = node.requires.filter((r) => !done.has(r));
	// Only the clearance is missing: it is coming soon.
	if (missing.length === 0) return node.minTier <= view.tier + 1 ? "next" : "later";
	const byId = new Map(techList(content).map((t) => [t.id, t]));
	const near = missing.every((id) => {
		const n = byId.get(id);
		return n !== undefined && nodeState(n, view, content).kind !== "locked";
	});
	return near ? "next" : "later";
}

export interface BranchView {
	branch: TechBranch;
	ready: TechNode[];
	next: TechNode[];
	done: TechNode[];
	laterCount: number;
}

const byOrder = (a: TechNode, b: TechNode): number => a.minTier - b.minTier || a.cost - b.cost || a.name.localeCompare(b.name);

export function branchView(content: ContentDB, view: SimView, branch: TechBranch): BranchView {
	const out: BranchView = { branch, ready: [], next: [], done: [], laterCount: 0 };
	for (const n of techList(content).filter((t) => t.branch === branch).sort(byOrder)) {
		const g = groupOf(n, view, content);
		if (g === "later") out.laterCount++;
		else out[g].push(n);
	}
	return out;
}

/** Branch tabs to show. Wetware stays out of sight until something in it can be reached. */
export function tabsFor(content: ContentDB, view: SimView): { id: TechBranch; label: string; ready: number }[] {
	const tabs: { id: TechBranch; label: string; ready: number }[] = [];
	for (const id of TAB_ORDER) {
		if (!techList(content).some((t) => t.branch === id)) continue;
		const b = branchView(content, view, id);
		if (id === "wetware" && b.ready.length + b.next.length + b.done.length === 0) continue;
		tabs.push({ id, label: TAB_LABEL[id], ready: b.ready.filter((n) => nodeState(n, view, content).kind === "available").length });
	}
	return tabs;
}

/** Research points per game minute at the current output (delivered PFLOPS x balance rate x researched perks). */
export function rpPerMinute(view: SimView, content: ContentDB): number {
	let mult = 1;
	const done = researchedSet(view);
	for (const t of techList(content)) if (done.has(t.id)) for (const e of t.effects) if (e.type === "perk" && e.kind === "researchRate") mult *= e.factor;
	return Math.max(0, ((view.pflops ?? 0) * (content.balance?.research?.pointsPerPflopHour ?? 0) * mult) / 60);
}

/** "Rate" in the unit a student can feel: points per game hour. */
export const rpPerHour = (view: SimView, content: ContentDB): number => rpPerMinute(view, content) * 60;

/** How long until `cost` is in hand: "about 3h", "ready now", or why we cannot say. */
export function etaText(cost: number, view: SimView, content: ContentDB): string {
	const short = cost - (view.researchPoints ?? 0);
	if (short <= 1e-9) return "You have enough right now.";
	const rate = rpPerMinute(view, content);
	if (rate <= 0) return "No points are coming in. Put racks to work on a job to earn them.";
	return `At your current speed, about ${fmtDuration(Math.ceil(short / rate))} of game time to save up.`;
}

const PERK_WHY: Record<string, string> = {
	failureRate: "Racks break less often, so you spend less on repairs and lose less uptime.",
	energyPrice: "Your power bill gets smaller every day.",
	payout: "Every new contract pays a little more.",
	coolingCapacity: "Your cooling machines move more heat, so racks run cooler or you can fit more of them.",
	repairSpeed: "Broken racks get fixed faster, so they earn again sooner.",
	upkeep: "Daily running costs shrink.",
	researchRate: "You earn research points faster, so everything else here arrives sooner.",
	botSpeed: "Your bots walk and fly faster, so jobs on the floor get done sooner.",
};

/** Hand-written plain names and reasons for the nodes a beginner meets first. Everything else is generated. */
const OVERRIDES: Record<string, { plain: string; why: string }> = {
	contracts_clerk: { plain: "A helper that books jobs for you", why: "You will not have to watch the job board all day. The helper takes fitting jobs for a small cut." },
	batch_cards: { plain: "Better compute cards", why: "Your jobs pay more, so every rack you own earns more money." },
	desk_fan_standard: { plain: "Stronger air cooling", why: "Hot racks are the most common early problem. This lets your air coolers do more." },
	surge_memo: { plain: "Fewer power surges", why: "Racks break less often, so you spend less time and money on repairs." },
	offpeak_petition: { plain: "Cheaper electricity", why: "Power is your biggest bill. This makes every kWh cost less." },
	pit_crew: { plain: "Faster repairs", why: "A broken rack earns nothing. Bots fix them quicker, so they get back to work sooner." },
	brass_gearing: { plain: "Faster bots", why: "Bots reach broken racks sooner and carry parts faster." },
	reading_room: { plain: "Earn research points faster", why: "More points means you open the rest of the tree sooner." },
	works_foreman: { plain: "A helper that builds for you", why: "Set a standing order and it places routine builds while you do other things." },
	chilled_loop: { plain: "Water cooling, step one", why: "Water carries heat far better than air. This opens the way to chillers and liquid-cooled racks." },
};

const KIND_WHY: Record<string, string> = {
	rack: "More compute in each rack means bigger jobs and more money from the same floor space.",
	grid_tie: "A stronger connection to the city lets you power a bigger tower.",
	genset: "Backup power for when the grid fails, so racks do not shut down.",
	ups: "Batteries keep your racks alive through an outage while a generator starts.",
	crah: "Cooler racks break less often and can run harder.",
	chiller: "Liquid-cooled racks need a chiller to get rid of their heat.",
	cdu: "One loop can serve more liquid-cooled racks.",
	depot: "A bigger parts store means repairs never wait for stock.",
	charger: "Bots recharge faster, so more of their time goes on repairs.",
	solar: "Free power in daylight lowers your bill.",
	wind: "Free power while the wind blows lowers your bill.",
	heat_export: "Selling your waste heat earns money and lowers your cooling load.",
	carbon: "It earns carbon credits and improves your green score.",
};

function nameList(names: string[]): string {
	return names.length <= 2 ? names.join(" and ") : `${names[0]}, ${names[1]} and ${names.length - 2} more`;
}

/** A short plain name for the card ("Unlocks Chiller", "Fewer rack breakdowns"). */
export function plainName(node: TechNode, content: ContentDB): string {
	const o = OVERRIDES[node.id];
	if (o) return o.plain;
	const unlocks = unlocksFor(node.id, content);
	if (unlocks.length) return `Unlocks ${nameList(unlocks)}`;
	if (node.effects.length) return effectText(node.effects[0], content).replace(/^([+−-])/, "$1");
	return "A step on the way to better machines";
}

/** One plain sentence on why this research helps, from what it unlocks and what it changes. */
export function whyText(node: TechNode, content: ContentDB): string {
	const o = OVERRIDES[node.id];
	if (o) return o.why;
	const parts: string[] = [];
	const fac = Object.values(content.facilities).filter((f) => f.tech === node.id);
	if (fac.length) parts.push(fac[0].rack && fac[0].rack.pflops <= 0 ? "Some jobs need lots of storage. Without it you cannot take them." : (KIND_WHY[fac[0].kind] ?? plainBlurb(fac[0])));
	const bots = Object.values(content.bots).filter((b) => b.tech === node.id);
	if (bots.length) parts.push(`You can buy ${nameList(bots.map((b) => b.name))} to help on the floor.`);
	for (const e of node.effects) {
		if (e.type === "perk") parts.push(PERK_WHY[e.kind] ?? "");
		else parts.push(e.feature === "contractsClerk" ? "A helper books jobs for you." : "A helper builds routine things for you.");
	}
	const text = parts.filter(Boolean).join(" ");
	return text || "It is a stepping stone: it is needed before the better machines further along.";
}

/** The "What you get" lines: each unlocked machine or bot with its real numbers, then the perks. */
export function getLines(node: TechNode, content: ContentDB): { title: string; sub: string; tier?: TierView }[] {
	const out: { title: string; sub: string; tier?: TierView }[] = [];
	for (const f of Object.values(content.facilities)) {
		if (f.tech !== node.id) continue;
		const key = plainStats(f).filter((s) => s.label !== "Size" && s.label !== "Costs").slice(0, 2);
		out.push({ title: `Build: ${f.name}`, tier: tierView(f, content), sub: [plainBlurb(f), ...key.map((s) => `${s.label} ${s.value}.`)].join(" ") });
	}
	for (const b of Object.values(content.bots)) {
		if (b.tech !== node.id) continue;
		out.push({ title: `Buy bot: ${b.name}`, sub: `${b.flying ? "Flies between floors. " : ""}Fixes a part in ${b.repairTicks} min, runs ${b.batteryTicks} min per charge${b.carry && b.carry > 1 ? `, carries ${b.carry} parts` : ""}.` });
	}
	for (const e of node.effects) out.push({ title: e.type === "perk" ? effectText(e, content) : "New helper", sub: e.type === "perk" ? "Permanent, and it stacks with other research." : effectText(e, content) });
	return out;
}

export interface Step {
	id: string;
	name: string;
	done: boolean;
}

/** The chain of things needed first, with a tick for each one finished. Clearance comes last. */
export function chain(node: TechNode, view: SimView, content: ContentDB): Step[] {
	const done = researchedSet(view);
	const steps: Step[] = node.requires.map((id) => ({ id, name: techName(content, id), done: done.has(id) }));
	if (node.minTier > 1) steps.push({ id: "_tier", name: `Level ${node.minTier}`, done: view.tier >= node.minTier });
	return steps;
}

export const PATH_NOTE = (p: AscensionPath): string => `Researching this leans your tower toward the ${p} path.`;

/** The node to pre-select: the cheapest one you can start, else the cheapest you are saving for, else the first next-up. */
export function defaultPick(content: ContentDB, view: SimView, branch: TechBranch): string | null {
	const b = branchView(content, view, branch);
	return (b.ready.find((n) => nodeState(n, view, content).kind === "available") ?? b.ready[0] ?? b.next[0] ?? b.done[0])?.id ?? null;
}

/** The branch to open on: the one with the cheapest startable node, else the first with anything ready. */
export function defaultBranch(content: ContentDB, view: SimView): TechBranch {
	const tabs = tabsFor(content, view);
	const startable = techList(content).filter((n) => nodeState(n, view, content).kind === "available");
	const ready = techList(content).filter((n) => groupOf(n, view, content) === "ready" && tabs.some((t) => t.id === n.branch));
	const best = (startable.length ? startable : ready).sort((a, b) => a.cost - b.cost)[0];
	return best?.branch ?? tabs[0]?.id ?? "compute";
}
