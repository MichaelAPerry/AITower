/**
 * "Current orders": the single most useful next step for the player, plus where today's money went.
 * Pure function of the view so it is unit-testable; the first matching rule wins.
 */
import type { ContentDB } from "@aitower/content";
import type { CommandResult, SimCommand, SimView } from "@aitower/sim";
import { fmtMoney } from "../format";
import { cheapestAvailable, effectText, fmtRp } from "../research/tech";
import { ascensionDue, type PathFiled, pathPending } from "../ascension/ascension";
import { rackProblem, unreachedFloors } from "./diagnose";

export type ObjectiveTone = "alert" | "action" | "progress";

export interface Objective {
	tone: ObjectiveTone;
	/** Short imperative, e.g. "Accept a contract". */
	title: string;
	/** One sentence saying exactly where and why. */
	detail: string;
	/** A button the orders offer: open FORM A-5 (the Ascension sheet). */
	action?: "ascension";
	/** Hotkey that opens where to act (shown on the NEXT chip): "C" contracts, "R" research. */
	key?: string;
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

export function currentObjective(view: SimView, content: ContentDB, canBuild: (cmd: SimCommand) => CommandResult, filed: PathFiled | null = null): Objective {
	const active = view.jobs.filter((j) => ACTIVE.has(j.status));

	// A sandbox lot has no bankruptcy, so a negative balance is no warning there.
	if (view.cash < 0 && !view.sandbox) {
		const room = view.loan ? view.loan.max - view.loan.principal : 0;
		const credit = room > 0 ? ` Or borrow up to ${fmtMoney(room)} from the Credit Facility (Finance tab): it is interest, not income.` : "";
		return {
			tone: "alert",
			title: "The Treasury is in the red",
			detail: `Accept a contract marked “Fits your idle racks”, and stop spending until cash is positive. A full day below $0 means bankruptcy.${credit}`,
		};
	}

	const urgent = view.memos.find((m) => m.expiresAt - view.tick <= 120);
	if (urgent) {
		return { tone: "alert", title: "An Authority memo is about to auto-resolve", detail: `Answer “${urgent.title}” in the memo inbox (top bar), or it resolves to its default choice.` };
	}

	const broken = view.facilities.filter((f) => f.status === "failed").length;
	if (broken > 0 && view.spareParts === 0) {
		return {
			tone: "alert",
			title: `${broken} rack${broken === 1 ? " is" : "s are"} broken and the spare-parts stock is empty`,
			detail: "Buy spare parts (the build dock, bottom left) so a maintenance bot can repair them.",
		};
	}

	// Cabinets that can't run at all (no power, no working coolant loop) are money sunk for nothing: say why, first.
	const dead = view.facilities.filter((f) => f.enabled && (f.status === "unpowered" || f.status === "noCoolant" || f.status === "noNutrient") && (content.facilities[f.defId]?.rack?.pflops ?? 0) > 0);
	if (dead.length > 0) {
		const f = dead[0];
		const name = content.facilities[f.defId]?.name ?? "cabinet";
		return {
			tone: "alert",
			title: `${dead.length} compute cabinet${dead.length === 1 ? " can't" : "s can't"} run`,
			detail: `${name} on F${f.floor} (x${f.x}): ${rackProblem(view, content, f) ?? "it is not running."}`,
		};
	}

	// Organoid tissue below its band runs slow or dies: say where and how to warm it.
	const cold = view.facilities.filter((f) => f.enabled && f.status === "tooCold" && (content.facilities[f.defId]?.rack?.pflops ?? 0) > 0);
	if (cold.length > 0) {
		const f = cold[0];
		const name = content.facilities[f.defId]?.name ?? "organoid rack";
		return {
			tone: "alert",
			title: `${cold.length} organoid rack${cold.length === 1 ? " is" : "s are"} too cold`,
			detail: `${name} on F${f.floor} (x${f.x}): ${rackProblem(view, content, f) ?? "it is below its band."}`,
		};
	}

	// Clearance reached for the Ascension: the one irreversible decision of the game.
	if (ascensionDue(view, content) && !pathPending(filed, view)) {
		return {
			tone: "action",
			title: "Choose your Ascension path",
			detail: `Clearance ${view.tier} entitles the tower to commit to one path. The election is final: it cannot be amended or withdrawn. Open the review below to read the options.`,
			action: "ascension",
		};
	}

	// Facilities on a floor no bot can reach cannot be serviced: say which floor and the fix.
	const unreached = unreachedFloors(view, content);
	if (unreached.length > 0) {
		const f = unreached[0];
		return { tone: "action", title: `F${f} has no lift access: extend a lift`, detail: `F${f} has facilities that maintenance bots cannot reach, so they cannot be repaired or serviced. Drag a lift from a served floor up or down to F${f} (Build, Service lift); extending costs per added floor.` };
	}

	// Idle racks earn nothing: whenever an offer can start on them, taking it is the best next step.
	const fitting = view.offers.find((o) => canBuild({ type: "acceptContract", contractId: o.id }).ok);
	if (fitting) {
		return {
			tone: "action",
			title: active.length === 0 ? "Accept a contract" : "Accept another contract",
			key: "C",
			detail: `Contracts drawer (C): press ACCEPT on an offer marked “Fits your idle racks”, e.g. ${fitting.clientName}. ${active.length === 0 ? "Your racks earn nothing while idle." : "Some racks are idle and earning nothing."}`,
		};
	}
	if (active.length === 0) {
		if (view.offers.length > 0) {
			return {
				tone: "action",
				title: "No offer fits your idle racks",
				detail: "Each offer shows why it can't start. Decline it, wait for a smaller one, or build more compute cabinets (build dock, More).",
			};
		}
		return { tone: "action", title: "Waiting for contract offers", detail: "New offers arrive every few game-hours. Speed up the clock (3× or 10×) to get one sooner." };
	}

	// Slow-burn nudges, only once the racks are busy: a clerk that was hired but never switched on, and research points going to waste.
	if (view.clerk?.unlocked && !view.clerk.policy.enabled) {
		return {
			tone: "action",
			title: "Switch on Contract Automation",
			key: "C",
			detail: "Contracts drawer (C): turn Contract Automation ON and it accepts matching offers for you (it takes a fee from each job).",
		};
	}
	const tech = cheapestAvailable(view, content);
	if (tech) {
		const fx = tech.effects.map((e) => effectText(e, content)).join(", ");
		return {
			tone: "action",
			title: "Start a research project",
			key: "R",
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
			let build = `build ${more} more ${air?.name ?? "compute cabinet"}${plural(more)} (build dock, ${air ? fmtMoney(air.cost) : ""} each) within reach of an air handler`;
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
	return { tone: "progress", title: "Top clearance reached", detail: "Keep the Treasury growing and the Compute Authority's standing high." };
}

/** "Living Tower: 2 of 3 days" for the ending the tower is closest to; null when none (the secret ending is never announced). */
export function endingLine(view: SimView, content: ContentDB): string | null {
	const p = view.endingProgress;
	if (!p || p.ending === "absorbed") return null;
	const title = content.endings?.find((e) => e.id === p.ending)?.title ?? p.ending;
	const days = Math.min(Math.floor(p.days), p.needed);
	return `${title}: ${days} of ${p.needed} day${p.needed === 1 ? "" : "s"}`;
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
