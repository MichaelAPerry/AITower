/**
 * Plain-language copy and numbers for the Contracts panel. Pure (no React) so it is unit-tested.
 * Every number comes from the sim view and content; only the wording is written here.
 *
 * What the two old unlabeled numbers were: the big one is the payout, the small one is the pay RATE in
 * dollars per PF-hour of work (not a running cost). The sim has no per-job running cost.
 */
import type { ContentDB, ContractSpec, JobKind } from "@aitower/content";
import type { JobView } from "@aitower/sim";
import { payPerPflopHour } from "@aitower/sim";
import { fmtDuration, fmtMoney, fmtPflops } from "../format";

export type Tone = "good" | "warn" | "bad" | "dim";

const HOUR = 60;

/** The in-game clock: the day starts at 06:00, like the alert log. "Day 3, 14:00". */
export function clockText(tick: number): string {
	const day = Math.floor(tick / 1440);
	const min = (Math.round(tick) + 360) % 1440;
	return `Day ${day}, ${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

export const KIND_NAME: Record<JobKind, string> = {
	training: "Teach an AI model",
	finetune: "Polish an AI model",
	inference: "Answer customers",
};

export const KIND_BLURB: Record<JobKind, string> = {
	training: "A big one-off calculation. Your racks crunch numbers until the work is done, and you get paid for it.",
	finetune: "A smaller one-off calculation that tunes an existing AI model. Same idea as training, just shorter.",
	inference: "A customer's AI app needs computing power available the whole time. You are paid for every minute you keep up.",
};

const pf = (n: number): string => `${Math.round(n * 10) / 10} PF`;
const hours = (ticks: number): string => fmtDuration(ticks);

export interface Fact {
	/** Short glyph in the round badge. */
	icon: string;
	label: string;
	sub: string;
	value: string;
	tone?: "good" | "warn" | "money";
}

/** The "what they want / what you get / what it needs" lines of an offer. */
export function offerFacts(spec: ContractSpec, content: ContentDB): Fact[] {
	const out: Fact[] = [];
	const inf = spec.kind === "inference";
	out.push({
		icon: "$",
		label: `Pays ${fmtMoney(spec.payout)} total`,
		sub: inf ? "Paid a little every minute while you keep the service up." : "Part is paid as work gets saved, the rest when the job finishes.",
		value: fmtMoney(spec.payout),
		tone: "money",
	});
	out.push({
		icon: "%",
		label: "Pay rate",
		sub: `${fmtMoney(payPerPflopHour(spec))} for each PF-hour of computing. Higher is a better deal.`,
		value: `${fmtMoney(payPerPflopHour(spec))}/PF-h`,
	});
	if (inf) {
		const need = spec.sustainedPflops ?? spec.work;
		out.push({ icon: "PF", label: `Needs ${pf(need)} for ${hours(spec.durationTicks)}`, sub: "Keep this much computing free the whole time, or you pay small fines.", value: pf(need) });
	} else {
		out.push({
			icon: "PF",
			label: `Needs ${Math.round(spec.work)} PF-hours of work`,
			sub: `For example, ${pf(spec.work / (spec.durationTicks / HOUR) || 0)} of racks finishes it right at the deadline. More racks finish sooner.`,
			value: `${Math.round(spec.work)} PF-h`,
		});
	}
	out.push({
		icon: "⏱",
		label: inf ? `Runs for ${hours(spec.durationTicks)}` : `Due ${hours(spec.durationTicks)} after you start`,
		sub: inf ? "The clock starts when you take the job." : "Miss it and the job is cancelled and you pay a fine.",
		value: hours(spec.durationTicks),
	});
	if (!inf && spec.penalty > 0) out.push({ icon: "!", label: `Fine if late: ${fmtMoney(spec.penalty)}`, sub: "Charged once, if the deadline passes before the work is done.", value: fmtMoney(spec.penalty), tone: "warn" });
	if (inf) {
		const perHour = content.balance.economy.slaPenaltyFactor * (spec.payout / Math.max(1, spec.durationTicks)) * HOUR;
		if (perHour > 0) out.push({ icon: "!", label: "Fine if you fall short", sub: "Only while the service is running and your racks cannot keep up.", value: `about ${fmtMoney(perHour)}/h`, tone: "warn" });
	}
	if (spec.needsLiquid) out.push({ icon: "~", label: "Needs liquid-cooled racks", sub: "Air-cooled racks cannot take this job.", value: "liquid" });
	if (spec.needsBio) out.push({ icon: "~", label: "Needs organoid racks", sub: "Only living-tissue racks can take this job.", value: "organoid" });
	if (spec.storageTB > 0) out.push({ icon: "TB", label: `Needs ${spec.storageTB} TB of storage`, sub: "Powered storage racks hold the data while it runs.", value: `${spec.storageTB} TB` });
	return out;
}

/** One line on whether the player can start it now. */
export function fitText(fits: { ok: true } | { ok: false; reason: string } | undefined): { ok: boolean; text: string } {
	if (!fits || fits.ok) return { ok: true, text: "Fits your idle racks ✓" };
	return { ok: false, text: `Can't start yet: ${fits.reason}` };
}

/** Short pay line for a list card. */
export const payLine = (spec: ContractSpec): string => `Pays ${fmtMoney(spec.payout)}`;

/** One-line summary of what a card needs: "240 PF-h in 12h" / "40 PF for 6h". */
export function needLine(spec: ContractSpec): string {
	return spec.kind === "inference" ? `${pf(spec.sustainedPflops ?? spec.work)} for ${hours(spec.durationTicks)}` : `${Math.round(spec.work)} PF-hours in ${hours(spec.durationTicks)}`;
}

export interface JobStatusText {
	label: string;
	detail: string;
	tone: Tone;
}

/** Plain status of a running job, plus whether it will make the deadline at its current speed. */
export function jobStatus(j: JobView, tick: number, content: ContentDB): JobStatusText {
	const left = j.deadline - tick;
	const inf = j.kind === "inference";
	if (j.status === "queued") return { label: "Waiting for free racks", detail: "No rack is working on it yet. It starts as soon as a suitable rack is free.", tone: "warn" };
	if (j.status === "stalled") {
		const why = "Its racks are off, too hot, broken, or out of storage. Check Insights, then the heat map.";
		if (inf) {
			const perHour = content.balance.economy.slaPenaltyFactor * (j.payout / Math.max(1, j.total)) * HOUR;
			return { label: "Falling behind", detail: `${why} Fines of about ${fmtMoney(perHour)} an hour can build up while it lasts.`, tone: "bad" };
		}
		return { label: "Stalled", detail: `${why} The deadline keeps getting closer.`, tone: "bad" };
	}
	if (inf) return { label: "Running", detail: `Serving customers with ${fmtPflops(j.pflops)}. ${fmtDuration(Math.max(0, left))} to go.`, tone: "good" };
	const remaining = Math.max(0, j.total - j.progress);
	const needHours = j.pflops > 0 ? remaining / j.pflops : Number.POSITIVE_INFINITY;
	const leftHours = Math.max(0, left) / HOUR;
	if (needHours > leftHours) return { label: "Running, but too slow", detail: `At this speed it needs about ${fmtDuration(needHours * HOUR)} and the deadline is in ${fmtDuration(Math.max(0, left))}. Add racks or free some up.`, tone: "warn" };
	return { label: "Running", detail: `On track: about ${fmtDuration(needHours * HOUR)} left at ${fmtPflops(j.pflops)}. Due in ${fmtDuration(Math.max(0, left))}.`, tone: "good" };
}

export type Selection = { kind: "offer" | "job"; id: number };

/**
 * What the Inspector shows: the player's pick if it still exists, else the job they were sent to, else the offer that fits
 * (the one the tutorial points at), else any offer, else a running job.
 */
export function pickSelection(
	sel: Selection | null | undefined,
	focusJobId: number | null,
	offers: readonly { id: number }[],
	liveJobs: readonly { id: number }[],
	fitting: number | undefined,
): Selection | null {
	if (sel?.kind === "offer" && offers.some((o) => o.id === sel.id)) return sel;
	if (sel?.kind === "job" && liveJobs.some((j) => j.id === sel.id)) return sel;
	if (focusJobId !== null && liveJobs.some((j) => j.id === focusJobId)) return { kind: "job", id: focusJobId };
	if (fitting !== undefined) return { kind: "offer", id: fitting };
	if (offers[0]) return { kind: "offer", id: offers[0].id };
	if (liveJobs[0]) return { kind: "job", id: liveJobs[0].id };
	return null;
}
