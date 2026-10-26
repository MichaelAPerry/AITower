/**
 * Pure helpers for the Calm HUD: money per hour, Clearance progress, the build dock picks, decision effect chips,
 * and which events are routine enough to stay out of the ticker.
 */
import type { AscensionPath, ContentDB, EventEffect, FacilityDef } from "@aitower/content";
import type { HorrorIntensity } from "@aitower/shared";
import type { CellRef, LedgerDay, SimEvent, SimView } from "@aitower/sim";
import { describeEvent, isNoise } from "../events";
import type { Severity } from "../notices";
import { fmtMoney } from "../format";
import { rackIsHot } from "../objective/heat";
import { installedPflops } from "../objective/objective";

// ─── Drawers ──────────────────────────────────────────────────────────────

export type DrawerId = "contracts" | "research" | "automation" | "insights" | "handbook" | "log";
/** Drawers that have an edge tab and a hotkey (the log opens from the ticker). */
export const DRAWER_TABS: { id: Exclude<DrawerId, "log">; label: string; key: string }[] = [
	{ id: "contracts", label: "Contracts", key: "C" },
	{ id: "research", label: "Research", key: "R" },
	// A is not free: the renderer pans the camera with WASD. T (as in "autoTomation") is.
	{ id: "automation", label: "Automation", key: "T" },
	// Finance and Gauges are one panel now: both F and I open it.
	{ id: "insights", label: "Insights", key: "I" },
	{ id: "handbook", label: "Handbook", key: "H" },
];
/** Extra keys that open a drawer (F was Finance, which lives in Insights now). */
const KEY_ALIAS: Record<string, DrawerId> = { F: "insights", K: "handbook" };
export const drawerForKey = (key: string): DrawerId | null => DRAWER_TABS.find((d) => d.key === key.toUpperCase())?.id ?? KEY_ALIAS[key.toUpperCase()] ?? null;
/** One drawer at a time: pressing the key of the open one closes it. */
export const nextDrawer = (cur: DrawerId | null, pressed: DrawerId): DrawerId | null => (cur === pressed ? null : pressed);

// ─── Money per hour ───────────────────────────────────────────────────────

export const HOUR = 60;
/** The window PER HOUR averages over: 6 game-hours. */
export const RATE_WINDOW = 6 * HOUR;

/** Operating result of a ledger day: revenue minus running costs, leaving out construction (a one-off investment). */
export const operatingNet = (d: LedgerDay): number => d.revenue - (d.energy + d.upkeep + d.penalties + (d.taxes ?? 0) + (d.interest ?? 0) + (d.fees ?? 0));

/**
 * Operating income per game-hour over roughly the last six game-hours. The ledger holds daily totals, so each day is taken
 * at its own average rate: today's rate (total over the minutes elapsed today) for the part of the window that falls in
 * today, and yesterday's rate (total over 24 h) for the rest. Null when there is no ledger yet.
 */
export function perHour(view: Pick<SimView, "tick" | "day" | "ledger">, net: (d: LedgerDay) => number = operatingNet): number | null {
	const rate = (day: number, minutes: number): number | null => {
		const d = view.ledger.find((x) => x.day === day);
		return d && minutes > 0 ? (net(d) / minutes) * HOUR : null;
	};
	const today = Math.max(0, view.tick - view.day * 1440);
	const inToday = Math.min(RATE_WINDOW, today);
	const t = rate(view.day, today);
	const y = rate(view.day - 1, 1440);
	if (inToday >= RATE_WINDOW) return t;
	if (t === null && y === null) return null;
	const rest = RATE_WINDOW - inToday;
	return (((t ?? y ?? 0) * inToday) + ((y ?? t ?? 0) * rest)) / RATE_WINDOW;
}

/** "+$21.4k" / "−$3k" for the PER HOUR readout. */
export const fmtRateHour = (n: number | null): string => (n === null ? "—" : `${n >= 0 ? "+" : "−"}${fmtMoney(Math.abs(n))}`);

// ─── Clearance progress ───────────────────────────────────────────────────

export interface Clearance {
	tier: number;
	/** Null at the top Clearance. */
	next: number | null;
	have: number;
	need: number;
	/** 0..1 */
	frac: number;
	uptime: number;
	uptimeNeed: number;
	uptimeOk: boolean;
	/** Researched nodes the next Level asks for, and how many are held now. */
	techs: number;
	techsDone: number;
	techsOk: boolean;
}

export function clearanceProgress(view: SimView, content: ContentDB): Clearance {
	const { pflops, uptime } = content.balance.tiers;
	const have = installedPflops(view, content);
	const need = pflops[view.tier] ?? 0;
	const uptimeNeed = uptime[view.tier] ?? 0;
	const top = view.tier >= pflops.length;
	const techs = top ? 0 : (view.tierNeed?.techs ?? content.balance.tiers.techs?.[view.tier] ?? 0);
	const techsDone = view.tierNeed?.techsDone ?? view.techResearched?.length ?? 0;
	return { techs, techsDone, techsOk: techsDone >= techs, tier: view.tier, next: top ? null : view.tier + 1, have, need, frac: top ? 1 : need > 0 ? Math.min(1, have / need) : 1, uptime: view.uptime, uptimeNeed, uptimeOk: top || view.uptime >= uptimeNeed };
}

// ─── Build dock ───────────────────────────────────────────────────────────

export type DockPick = { kind: "place"; defId: string } | { kind: "parts" };

const buildable = (d: FacilityDef, view: SimView, content: ContentDB): boolean =>
	!d.growth && !d.retired && d.unlockTier <= view.tier && (!d.tech || view.techResearched.includes(d.tech)) && content.facilities[d.id] === d;

/**
 * The (at most) 3 most useful builds for the current state, in this order of need: a CRAH when racks run hot, parts when the
 * cage is empty and something is broken, a nutrient plant when organoid racks starve, more power when a net is short, a rack
 * when no compute is idle; then cheap defaults (rack, CRAH, depot) to fill the dock.
 */
export function dockPicks(view: SimView, content: ContentDB): DockPick[] {
	const defs = Object.values(content.facilities).filter((d) => buildable(d, view, content));
	const byKind = (kind: string, cheapest = true): FacilityDef | undefined => defs.filter((d) => d.kind === kind).sort((a, b) => (cheapest ? a.cost - b.cost : b.cost - a.cost))[0];
	const rackDef = defs.filter((d) => d.rack && d.rack.pflops > 0 && d.rack.cooling === "air").sort((a, b) => a.cost - b.cost)[0] ?? defs.filter((d) => d.rack && d.rack.pflops > 0 && !d.rack.bio).sort((a, b) => a.cost - b.cost)[0];
	const racks = view.facilities.filter((f) => content.facilities[f.defId]?.rack);
	const hot = racks.some((f) => rackIsHot(f, content));
	const broken = view.facilities.some((f) => f.status === "failed");
	const idle = racks.filter((f) => f.status === "idle" && (content.facilities[f.defId]?.rack?.pflops ?? 0) > 0).length;
	const starving = racks.some((f) => f.status === "noNutrient");
	const shortPower = view.powerNets.some((n) => n.satisfaction < 1);

	const out: DockPick[] = [];
	const add = (p: DockPick | undefined): void => {
		if (!p || out.length >= 3) return;
		const key = p.kind === "place" ? p.defId : "parts";
		if (!out.some((o) => (o.kind === "place" ? o.defId : "parts") === key)) out.push(p);
	};
	const place = (d: FacilityDef | undefined): DockPick | undefined => (d ? { kind: "place", defId: d.id } : undefined);
	if (hot) add(place(byKind("crah")));
	if (view.spareParts === 0 && broken) add({ kind: "parts" });
	if (starving) add(place(byKind("nutrient")));
	if (shortPower) add(place(byKind("genset")) ?? place(byKind("grid_tie")));
	if (idle === 0) add(place(rackDef));
	add(place(rackDef));
	add(place(byKind("crah")));
	add(view.spareParts < 3 ? { kind: "parts" } : place(byKind("depot")));
	return out;
}

// ─── Decision effect chips ────────────────────────────────────────────────

const pathLabel = (p: string): string => (p === "synthetic" ? "Synthetic" : p === "greentech" ? "Greentech" : p === "biotech" ? "Biotech" : p);

/** "−$160k", "★−4", "2 racks fail": one effect as a compact chip. */
export function effectChip(e: EventEffect): string {
	const sign = (n: number): string => (n >= 0 ? "+" : "−");
	const mult = (f: number): string => `×${Math.round(f * 100) / 100}`;
	switch (e.type) {
		case "cash":
			return `${sign(e.amount)}${fmtMoney(Math.abs(e.amount))}`;
		case "ambient":
			return `${sign(e.deltaC)}${Math.abs(e.deltaC)}°C`;
		case "gridCap":
			return `grid ${mult(e.factor)}`;
		case "energyPrice":
			return `energy ${mult(e.factor)}`;
		case "payout":
			return `pay ${mult(e.factor)}`;
		case "failureRate":
			return `faults ${mult(e.factor)}`;
		case "failRacks":
			return `${e.count} rack${e.count === 1 ? "" : "s"} fail`;
		case "spareParts":
			return `${sign(e.count)}${Math.abs(e.count)} parts`;
		case "affinity":
			return `${pathLabel(e.path)} ${sign(e.amount)}${Math.abs(e.amount)}`;
		// The Soul's effects are secret or narrative: never a chip.
		case "seal":
		case "bond":
		case "sp":
		case "commitPath":
			return "";
	}
}

/** The chip as React content: affinity effects get a path-coloured pill, everything else plain text. */
export function chipParts(effects: readonly EventEffect[]): { text: string; path?: AscensionPath }[] {
	return visibleEffects(effects).map((e) => (e.type === "affinity" ? { text: effectChip(e), path: e.path } : { text: effectChip(e) }));
}

/** The compact consequence of a choice: its effects joined with " · ", or "no effect". */
export const choiceChips = (effects: readonly EventEffect[]): string => {
	const v = visibleEffects(effects);
	return v.length ? v.map(effectChip).join(" · ") : "no effect";
};

/** Effects the player may see as chips (seal, bond, SP and commit effects are hidden). */
export const visibleEffects = (effects: readonly EventEffect[]): EventEffect[] => effects.filter((e) => effectChip(e) !== "");

// ─── Ticker ───────────────────────────────────────────────────────────────

/**
 * Events the game handles by itself: robots repairing, jobs starting, racks recovering, routine offers, and a failed
 * component while parts are in stock. They stay out of the ticker (the Alerts log still has them).
 */
export function isRoutine(ev: SimEvent, view: Pick<SimView, "spareParts">): boolean {
	switch (ev.type) {
		case "repaired":
		case "jobStarted":
		case "rackRecovered":
		case "contractOffered":
		case "contractExpired":
		case "rackThrottled":
		case "gensetStarted":
		case "gensetStopped":
		case "built":
		case "demolished":
		case "newDay":
		case "liftArrived":
		case "clerkAccepted":
		case "decisionIssued": // the decision card announces itself
		case "decisionDeferred":
			return true;
		case "componentFailed":
			return view.spareParts > 0;
		default:
			return false;
	}
}

/** One line of the ticker or the alert log. Hourly sums of `earned`, `autoBuilt` and `autoBought` are one line each. */
export interface FeedLine {
	key: string;
	/** Tick of the latest event folded into this line. */
	tick: number;
	text: string;
	severity: Severity;
	cell?: CellRef;
}

const hourOf = (tick: number): number => Math.floor(tick / HOUR);
const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/**
 * Turn log entries into feed lines. Events that arrive in streams are folded per game-hour so they cannot drown the rest:
 * payouts (`earned`), the Foreman's builds (`autoBuilt`) and the stores' purchases (`autoBought`, per kind). Everything else
 * is one line per event. Lines keep the order of their latest event. `keep` filters entries first (the ticker drops routine ones).
 */
export function feedLines(log: readonly { tick: number; event: SimEvent }[], view: SimView, content: ContentDB, horror: HorrorIntensity, keep: (ev: SimEvent) => boolean = () => true): FeedLine[] {
	const out = new Map<string, FeedLine>();
	const sums = new Map<string, { n: number; amount: number; jobs: Set<number>; first?: FeedLine }>();
	const put = (key: string, line: FeedLine): void => {
		out.delete(key); // re-inserting moves the line to the end: it is the newest
		out.set(key, line);
	};
	log.forEach((e, i) => {
		const ev = e.event;
		if (isNoise(ev) || !keep(ev)) return;
		const h = hourOf(e.tick);
		const own = describeEvent(ev, view, content, horror);
		if (ev.type === "earned" || ev.type === "autoBuilt" || ev.type === "autoBought") {
			const key = ev.type === "autoBought" ? `${ev.type}:${ev.what}:${h}` : `${ev.type}:${h}`;
			const s = sums.get(key) ?? { n: 0, amount: 0, jobs: new Set<number>() };
			sums.set(key, s);
			s.n += ev.type === "autoBought" ? ev.count : 1;
			if (ev.type === "earned") {
				s.amount += ev.amount;
				s.jobs.add(ev.jobId);
			}
			const base: FeedLine = { key, tick: e.tick, severity: own.severity, cell: own.cell, text: own.text };
			s.first ??= base;
			let text = s.first.text; // a single event keeps its own wording
			let cell = s.first.cell;
			if (ev.type === "earned" && s.n > 1) text = `Contracts paid ${fmtMoney(s.amount)} this hour (${plural(s.n, "payout")}${s.jobs.size > 1 ? `, ${plural(s.jobs.size, "job")}` : ""})`;
			else if (ev.type === "autoBuilt" && s.n > 1) {
				text = `The Works Foreman placed ${s.n} facilities this hour`;
				cell = undefined;
			}
			else if (ev.type === "autoBought") text = ev.what === "parts" ? `Stores bought ${plural(s.n, "spare part")}` : `Stores bought ${plural(s.n, "bot")}`;
			put(key, { ...base, text, cell });
			return;
		}
		put(`e${i}`, { key: `e${i}`, tick: e.tick, text: own.text, severity: own.severity, cell: own.cell });
	});
	return [...out.values()];
}

export type MaintTone = "ok" | "amber" | "red";

export interface MaintenanceReadout {
	parts: string;
	bots: string;
	repairs: string;
	tone: MaintTone;
	title: string;
}

/**
 * The top-strip maintenance readout: spare parts in stock, bots busy of total, racks waiting for repair. Amber when parts are
 * out or repairs are queued; red when a broken rack cannot be reached at all, or repairs wait on an empty cage.
 */
export function maintenanceReadout(view: SimView): MaintenanceReadout | null {
	const m = view.maintenance;
	if (!m) return null;
	const open = view.workOrders?.length ?? 0;
	// No bots, no depot and nothing broken: maintenance is not part of the game yet, so show nothing.
	if (m.botsTotal === 0 && m.partsCapacity === 0 && m.parts === 0 && open === 0) return null;
	const out = m.parts === 0;
	let tone: MaintTone = "ok";
	if (out || m.waiting > 0 || m.noRoute > 0) tone = "amber";
	if (m.noRoute > 0 || (out && open > 0) || (open > 0 && m.botsTotal === 0)) tone = "red";
	const why: string[] = [];
	if (m.noRoute > 0) why.push(`${m.noRoute} broken rack${m.noRoute === 1 ? " is" : "s are"} out of reach of every bot: extend or power a lift to ${m.noRoute === 1 ? "it" : "them"}.`);
	if (out) why.push(open > 0 ? "No spare parts: repairs cannot finish. Buy parts." : "No spare parts in stock.");
	if (m.botsTotal === 0 && open > 0) why.push("There are no repair bots.");
	if (m.waiting > 0 && !out && m.noRoute === 0) why.push(`${m.waiting} repair${m.waiting === 1 ? " is" : "s are"} waiting for a free bot.`);
	return {
		parts: `${m.parts}`,
		bots: `${m.botsBusy}/${m.botsTotal}`,
		repairs: `${open}`,
		tone,
		title: [`Spare parts in stock: ${m.parts}${m.partsCapacity > 0 ? ` of ${m.partsCapacity}` : ""}`, `Repair bots busy: ${m.botsBusy} of ${m.botsTotal}`, `Broken racks waiting: ${open}`, ...why].join("\n"),
	};
}
