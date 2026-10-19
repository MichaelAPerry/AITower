/**
 * "Current orders": the single most useful next step for the player, plus where today's money went.
 * Pure function of the view so it is unit-testable; the first matching rule wins.
 */
import type { ContentDB } from "@aitower/content";
import type { CommandResult, SimCommand, SimView } from "@aitower/sim";
import { fmtMoney } from "../format";
import { cheapestAvailable, effectText, fmtRp } from "../research/tech";
import { rackProblem } from "./diagnose";

export type ObjectiveTone = "alert" | "action" | "progress";

export interface Objective {
	tone: ObjectiveTone;
	/** Short imperative, e.g. "Accept a contract". */
	title: string;
	/** One sentence saying exactly where and why. */
	detail: string;
}

export interface MoneyLine {
	income: number;
	costs: number;
	/** e.g. "energy $12k · upkeep $3k" — only non-zero parts. */
	breakdown: string;
}

const ACTIVE = new Set(["queued", "running", "stalled"]);

/** Σ nominal PFLOPS of enabled, healthy compute racks (what tier progress counts). */
export function installedPflops(view: SimView, content: ContentDB): number {
	let p = 0;
	for (const f of view.facilities) {
		const pf = content.facilities[f.defId]?.rack?.pflops ?? 0;
		if (pf > 0 && f.enabled && f.status !== "failed") p += pf;
	}
	return p;
}

export function currentObjective(view: SimView, content: ContentDB, canBuild: (cmd: SimCommand) => CommandResult): Objective {
	const active = view.jobs.filter((j) => ACTIVE.has(j.status));

	if (view.cash < 0) {
		const room = view.loan ? view.loan.max - view.loan.principal : 0;
		const credit = room > 0 ? ` Or borrow up to ${fmtMoney(room)} from the Ministry Credit Office (Finance tab): it is interest, not income.` : "";
		return {
			tone: "alert",
			title: "The Treasury is in the red",
			detail: `Accept a contract marked “Fits your idle racks”, and stop spending until cash is positive. A full day below $0 means bankruptcy.${credit}`,
		};
	}

	const urgent = view.memos.find((m) => m.expiresAt - view.tick <= 120);
	if (urgent) {
		return { tone: "alert", title: "A Ministry memo is about to auto-file", detail: `Answer “${urgent.title}” in the memo inbox (top bar), or it is filed as its default choice.` };
	}

	const broken = view.facilities.filter((f) => f.status === "failed").length;
	if (broken > 0 && view.spareParts === 0) {
		return {
			tone: "alert",
			title: `${broken} rack${broken === 1 ? " is" : "s are"} broken and the parts cage is empty`,
			detail: "Buy spare parts (bottom of the left panel) so the maintenance automaton can repair them.",
		};
	}

	// Cabinets that can't run at all (no power, no working coolant loop) are money sunk for nothing: say why, first.
	const dead = view.facilities.filter((f) => f.enabled && (f.status === "unpowered" || f.status === "noCoolant") && (content.facilities[f.defId]?.rack?.pflops ?? 0) > 0);
	if (dead.length > 0) {
		const f = dead[0];
		const name = content.facilities[f.defId]?.name ?? "cabinet";
		return {
			tone: "alert",
			title: `${dead.length} compute cabinet${dead.length === 1 ? " can't" : "s can't"} run`,
			detail: `${name} on F${f.floor} (x${f.x}): ${rackProblem(view, content, f) ?? "it is not running."}`,
		};
	}

	// Idle racks earn nothing: whenever an offer can start on them, taking it is the best next step.
	const fitting = view.offers.find((o) => canBuild({ type: "acceptContract", contractId: o.id }).ok);
	if (fitting) {
		return {
			tone: "action",
			title: active.length === 0 ? "Accept a contract" : "Accept another contract",
			detail: `Contracts tab (bottom panel): stamp ACCEPT on an offer marked “Fits your idle racks”, e.g. ${fitting.clientName}. ${active.length === 0 ? "Your racks earn nothing while idle." : "Some racks are idle and earning nothing."}`,
		};
	}
	if (active.length === 0) {
		if (view.offers.length > 0) {
			return {
				tone: "action",
				title: "No offer fits your idle racks",
				detail: "Each offer shows why it can't start. Decline it, wait for a smaller one, or build more compute cabinets (Racks tab).",
			};
		}
		return { tone: "action", title: "Waiting for contract offers", detail: "New offers arrive every few game-hours. Speed up the clock (3× or 10×) to get one sooner." };
	}

	// Slow-burn nudges, only once the racks are busy: a clerk that was hired but never switched on, and research points going to waste.
	if (view.clerk?.unlocked && !view.clerk.policy.enabled) {
		return {
			tone: "action",
			title: "Switch on your Contracts Clerk",
			detail: "Contracts tab: flip the clerk's standing order to ON and it will accept matching offers for you (it keeps a fee from each job).",
		};
	}
	const tech = cheapestAvailable(view, content);
	if (tech) {
		const fx = tech.effects.map((e) => effectText(e, content)).join(", ");
		return {
			tone: "action",
			title: "File a research request (R)",
			detail: `Department of Research: ${tech.name} costs ${tech.cost} RP and you have ${fmtRp(view.researchPoints)}.${fx ? ` It gives ${fx}.` : ""}`,
		};
	}

	const tiers = content.balance.tiers;
	const next = view.tier; // tiers.pflops[view.tier] is the requirement for tier + 1
	if (next < tiers.pflops.length) {
		const need = tiers.pflops[next];
		const have = installedPflops(view, content);
		const uptime = tiers.uptime[next];
		if (have < need) {
			const air = content.facilities.rack_air_gpu;
			const per = air?.rack?.pflops ?? 20;
			const more = Math.ceil((need - have) / per);
			const plural = (n: number) => (n === 1 ? "" : "s");
			let build = `build ${more} more ${air?.name ?? "compute cabinet"}${plural(more)} (Racks tab, ${air ? fmtMoney(air.cost) : ""} each) within reach of an air handler`;
			// Once liquid cabinets are unlocked, offer them too (fewer, bigger, but they need a coolant loop).
			let best: { name: string; cost: number; pflops: number } | undefined;
			for (const d of Object.values(content.facilities))
				if (d.rack && d.rack.liquidFraction > 0 && d.rack.pflops > per && d.unlockTier <= view.tier && (!best || d.rack.pflops > best.pflops)) best = { name: d.name, cost: d.cost, pflops: d.rack.pflops };
			if (best) {
				const k = Math.ceil((need - have) / best.pflops);
				build += `, or ${k} ${best.name}${plural(k)} (${fmtMoney(best.cost)} each) on a coolant loop with a chiller and a CDU`;
			}
			const idle = view.facilities.filter((f) => f.status === "idle" && (content.facilities[f.defId]?.rack?.pflops ?? 0) > 0).length;
			const idleNote = idle > 0 ? ` ${idle} cabinet${idle === 1 ? " is" : "s are"} idle, waiting for an offer that fits.` : "";
			return {
				tone: "progress",
				title: `Next: Clearance ${next + 1}`,
				detail: `Install ${need} PFLOPS (now ${have}): ${build}. Uptime must stay ≥ ${Math.round(uptime * 100)}%.${idleNote}`,
			};
		}
		return {
			tone: "progress",
			title: `Next: Clearance ${next + 1}`,
			detail: `Compute is enough (${have} PFLOPS). Keep uptime ≥ ${Math.round(uptime * 100)}% through the day; clearance is reviewed at midnight.`,
		};
	}
	return { tone: "progress", title: "Top clearance reached", detail: "Keep the Treasury growing and the Ministry's standing high." };
}

/** Today's money so far: what came in, what went out, and on what. */
export function moneyToday(view: SimView): MoneyLine {
	const d = view.ledger.at(-1);
	if (!d) return { income: 0, costs: 0, breakdown: "" };
	const parts: [string, number][] = [
		["energy", d.energy],
		["upkeep", d.upkeep],
		["penalties", d.penalties],
		["construction", d.construction],
		["taxes", d.taxes ?? 0],
		["interest", d.interest ?? 0],
		["fees", d.fees ?? 0],
	];
	const costs = parts.reduce((s, [, v]) => s + v, 0);
	const breakdown = parts
		.filter(([, v]) => v > 0.5)
		.map(([k, v]) => `${k} ${fmtMoney(v)}`)
		.join(" · ");
	return { income: d.revenue, costs, breakdown };
}
