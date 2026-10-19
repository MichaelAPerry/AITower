import type { ContentDB } from "@aitower/content";
import type { AuditGrade, CellRef, SimCommand, SimEvent, SimView } from "@aitower/sim";
import { fmtMoney, fmtPct } from "./format";
import { gradeTone } from "./finance/finance";
import { effectText, unlocksFor } from "./research/tech";
import type { Severity } from "./notices";

export interface Described {
	text: string;
	severity: Severity;
	/** Cell to focus when clicked (facility events). */
	cell?: CellRef;
	/** Show as a toast when it happens. */
	toast: boolean;
}

const commandName: Record<SimCommand["type"], string> = {
	buildSlab: "Build slab",
	place: "Place",
	buildConduit: "Build conduit",
	buildLift: "Build lift",
	demolish: "Demolish",
	setEnabled: "Toggle",
	acceptContract: "Accept contract",
	declineContract: "Decline contract",
	cancelJob: "Cancel job",
	buyParts: "Buy parts",
	buyBot: "Buy bot",
	resolveMemo: "Answer memo",
	research: "Research",
	setClerk: "Clerk orders",
	takeLoan: "Take loan",
	repayLoan: "Repay loan",
	choosePath: "Choose path",
};

const gradeSeverity = (g: AuditGrade): Severity => {
	const t = gradeTone(g);
	return t === "green" ? "good" : t === "amber" ? "info" : "warn";
};

/** Turn a SimEvent into human words. Unknown ids degrade gracefully ("#12"). */
export function describeEvent(ev: SimEvent, view: SimView, content: ContentDB): Described {
	const fac = (id: number): { name: string; cell?: CellRef } => {
		const f = view.facilities.find((f) => f.id === id);
		if (!f) return { name: `facility #${id}` };
		const def = content.facilities[f.defId];
		return { name: `${def?.name ?? f.defId} #${id} (F${f.floor})`, cell: { x: f.x, floor: f.floor } };
	};
	const job = (id: number): string => {
		const j = view.jobs.find((j) => j.id === id);
		return j ? `${j.clientName} ${j.kind}` : `Job #${id}`;
	};
	const offer = (id: number): string => {
		const o = view.offers.find((o) => o.id === id);
		return o ? `${o.clientName} (${o.kind})` : `#${id}`;
	};
	switch (ev.type) {
		case "commandRejected":
			return { text: `${commandName[ev.command.type]} rejected: ${ev.reason}`, severity: "warn", toast: true };
		case "built":
			return { text: `Built ${ev.what} at F${ev.floor} x${ev.x}`, severity: "info", cell: { x: ev.x, floor: ev.floor }, toast: false };
		case "demolished":
			return { text: `Demolished at F${ev.floor} x${ev.x}`, severity: "info", cell: { x: ev.x, floor: ev.floor }, toast: false };
		case "rackThrottled": {
			const f = fac(ev.facilityId);
			return { text: `${f.name} throttling — running hot`, severity: "warn", cell: f.cell, toast: false };
		}
		case "rackTripped": {
			const f = fac(ev.facilityId);
			return { text: `${f.name} TRIPPED on over-temperature`, severity: "error", cell: f.cell, toast: true };
		}
		case "rackRecovered": {
			const f = fac(ev.facilityId);
			return { text: `${f.name} back online`, severity: "good", cell: f.cell, toast: false };
		}
		case "componentFailed": {
			const f = fac(ev.facilityId);
			return { text: `${f.name} component failed — repair queued`, severity: "error", cell: f.cell, toast: true };
		}
		case "repaired": {
			const f = fac(ev.facilityId);
			return { text: `${f.name} repaired by bot #${ev.botId}`, severity: "good", cell: f.cell, toast: false };
		}
		case "powerShortfall":
			return { text: `Power shortfall on net ${ev.netId} — ${fmtPct(ev.satisfaction, 0)} supplied`, severity: "error", toast: true };
		case "gensetStarted": {
			const f = fac(ev.facilityId);
			return { text: `${f.name} started`, severity: "warn", cell: f.cell, toast: false };
		}
		case "gensetStopped": {
			const f = fac(ev.facilityId);
			return { text: `${f.name} stopped`, severity: "info", cell: f.cell, toast: false };
		}
		case "upsDepleted": {
			const f = fac(ev.facilityId);
			return { text: `${f.name} battery depleted`, severity: "error", cell: f.cell, toast: true };
		}
		case "contractOffered":
			return { text: `New offer: ${offer(ev.contractId)}`, severity: "info", toast: false };
		case "contractExpired":
			return { text: `Offer #${ev.contractId} expired`, severity: "info", toast: false };
		case "jobStarted":
			return { text: `${job(ev.jobId)} started`, severity: "info", toast: false };
		case "jobCompleted":
			return { text: `${job(ev.jobId)} completed · +${fmtMoney(ev.payout)}`, severity: "good", toast: true };
		case "jobFailed":
			return { text: `${job(ev.jobId)} failed · penalty ${fmtMoney(ev.penalty)}`, severity: "error", toast: true };
		case "jobRolledBack":
			return { text: `${job(ev.jobId)} rolled back to checkpoint`, severity: "warn", toast: false };
		case "liftArrived":
			return { text: `Lift #${ev.liftId} at F${ev.floor}`, severity: "info", toast: false };
		case "tierUp":
			return { text: `Tier ${ev.tier} reached! Bonus +${fmtMoney(ev.reward)}`, severity: "good", toast: true };
		case "newDay":
			return { text: `Day ${ev.day} begins`, severity: "info", toast: false };
		case "bankrupt":
			return { text: "WARNING: Treasury below zero for a full day (insolvency notice)", severity: "error", toast: true };
		case "memoIssued": {
			const m = view.memos.find((m) => m.eventId === ev.eventId);
			return { text: m ? `Memo received from the Ministry: ${m.title}` : "A memo has arrived from the Ministry", severity: "info", toast: false };
		}
		case "memoResolved": {
			const h = view.memoHistory.find((h) => h.memoId === ev.memoId);
			const label = h ? content.events.find((e) => e.id === h.eventId)?.choices.find((c) => c.id === h.choiceId)?.label : undefined;
			const stamp = label ?? ev.choiceId.toUpperCase();
			const head = ev.auto ? `Memo unanswered and filed as ${stamp}` : `Memo stamped ${stamp}`;
			return { text: h ? `${head}. ${h.outcome}` : `${head}.`, severity: "info", toast: true };
		}
		case "standingChanged":
			return {
				text: `Ministry standing ${ev.delta >= 0 ? "rises" : "falls"} by ${Math.abs(ev.delta)} to ${ev.standing}`,
				severity: ev.delta < 0 ? "warn" : "good",
				toast: ev.delta <= -5 || ev.standing < 25,
			};
		case "gameOver":
			return {
				text: ev.kind === "victory" ? "COMMENDATION issued by the Ministry" : ev.kind === "shutdown" ? "NOTICE OF TERMINATION: licence withdrawn, Ministry standing is zero" : "NOTICE OF TERMINATION: foreclosed for insolvency",
				severity: ev.kind === "victory" ? "good" : "error",
				toast: false,
			};
		case "researched": {
			const node = content.tech?.find((t) => t.id === ev.techId);
			const gives = [...(node?.effects.map((e) => effectText(e, content)) ?? []), ...(unlocksFor(ev.techId, content).length ? [`new in the build menu: ${unlocksFor(ev.techId, content).join(", ")}`] : [])];
			return { text: `Research filed: ${node?.name ?? ev.techId}${gives.length ? `. ${gives.join("; ")}` : ""}`, severity: "good", toast: true };
		}
		case "clerkAccepted": {
			const fee = content.balance?.clerk?.feeShare;
			return { text: `The Contracts Clerk accepted ${job(ev.jobId)}${fee ? ` (fee ${Math.round(fee * 1000) / 10} % of its earnings)` : ""}`, severity: "info", toast: false };
		}
		case "loanTaken": {
			const rate = view.loan?.dailyRate;
			return { text: `Credit Office: loan of ${fmtMoney(ev.amount)} approved${rate ? `; interest accrues at ${Math.round(rate * 10000) / 100} % a day` : ""}`, severity: "info", toast: false };
		}
		case "loanRepaid":
			return { text: `Credit Office: ${fmtMoney(ev.amount)} repaid. The Ministry thanks you for your promptness`, severity: "good", toast: false };
		// M3 placeholders (M3-T4 words these properly).
		case "pathChosen":
			return { text: `Ascension path filed: ${ev.path}`, severity: "info", toast: true };
		case "growthSprouted":
			return { text: `An asset has been registered at ${fac(ev.facilityId).name}`, severity: "info", toast: false, cell: fac(ev.facilityId).cell };
		case "botMutated":
			return { text: `Automaton #${ev.botId} has been reclassified (${ev.trait})`, severity: "info", toast: false };
		case "contaminationIrreversible":
			return { text: "The building has been recertified as an organism", severity: "warn", toast: true };
		case "quarterReport": {
			const r = view.reports?.find((r) => r.quarter === ev.quarter);
			return { text: `Quarterly audit ${ev.quarter} filed: grade ${ev.grade}${r ? `. ${r.remark}` : ""}`, severity: gradeSeverity(ev.grade), toast: false };
		}
	}
}

/** Events too chatty for the alert feed. */
export const isNoise = (ev: SimEvent): boolean => ev.type === "liftArrived";

/** Coalescing key for toasts (repeated shortfalls on the same net merge). */
export function eventKey(ev: SimEvent): string {
	switch (ev.type) {
		case "powerShortfall":
			return `ps:${ev.netId}`;
		case "rackTripped":
		case "componentFailed":
		case "upsDepleted":
			return `${ev.type}:${ev.facilityId}`;
		case "commandRejected":
			return `rej:${ev.reason}`;
		default:
			return JSON.stringify(ev);
	}
}
