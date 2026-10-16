/**
 * "Current orders": the single most useful next step for the player, plus where today's money went.
 * Pure function of the view so it is unit-testable; the first matching rule wins.
 */
import type { ContentDB } from "@aitower/content";
import type { CommandResult, SimCommand, SimView } from "@aitower/sim";
import { fmtMoney } from "../format";

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
		return {
			tone: "alert",
			title: "The Treasury is in the red",
			detail: "Accept a contract marked “Fits your idle racks”, and stop spending until cash is positive. A full day below $0 means bankruptcy.",
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
			return {
				tone: "progress",
				title: `Next: Clearance ${next + 1}`,
				detail: `Install ${need} PFLOPS (now ${have}): build ${more} more ${air?.name ?? "compute cabinet"}${more === 1 ? "" : "s"} (Racks tab, ${air ? fmtMoney(air.cost) : ""} each) within reach of an air handler. Uptime must stay ≥ ${Math.round(uptime * 100)}%.`,
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
	];
	const costs = parts.reduce((s, [, v]) => s + v, 0);
	const breakdown = parts
		.filter(([, v]) => v > 0.5)
		.map(([k, v]) => `${k} ${fmtMoney(v)}`)
		.join(" · ");
	return { income: d.revenue, costs, breakdown };
}
