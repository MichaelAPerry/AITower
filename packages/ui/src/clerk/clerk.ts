/** Pure logic for the Contracts Clerk: would it take an offer, standing-order edits, copy. */
import type { ContentDB, ContractSpec, JobKind } from "@aitower/content";
import type { ClerkPolicy, CommandResult } from "@aitower/sim";
import { payPerPflopHour } from "@aitower/sim";
import { fmtMoney } from "../format";
import { clerkNode } from "../research/tech";

export const JOB_KINDS: JobKind[] = ["training", "finetune", "inference"];

export interface ClerkVerdict {
	/** Every rule of the standing order passes (and the offer fits the idle racks). */
	takes: boolean;
	/** Plain reason it would skip the offer; null when it would take it. */
	why: string | null;
}

/**
 * Would the clerk take this offer under `policy`? Mirrors the sim's rules: kind, pay rate, penalty cap, liquid cooling,
 * then the same start check as accepting by hand (`fits`, from `canBuild({type:"acceptContract"})`; omit it to skip that rule).
 * The ON/OFF switch is not part of the verdict: the row shows it separately.
 */
export function clerkVerdict(policy: ClerkPolicy, spec: ContractSpec, fits?: CommandResult): ClerkVerdict {
	const skip = (why: string): ClerkVerdict => ({ takes: false, why });
	if (!policy.kinds.includes(spec.kind)) return skip(`${spec.kind} jobs are not on its list`);
	const rate = payPerPflopHour(spec);
	if (rate + 1e-9 < policy.minPayPerPflopHour) return skip(`pays ${fmtRate(rate)}, under your minimum ${fmtRate(policy.minPayPerPflopHour)}`);
	if (policy.maxPenalty > 0 && spec.penalty > policy.maxPenalty) return skip(`penalty ${fmtMoney(spec.penalty)} is over your cap ${fmtMoney(policy.maxPenalty)}`);
	if (spec.needsLiquid && !policy.allowLiquid) return skip("needs liquid cooling and you said no");
	if (fits && !fits.ok) return skip(`can't start: ${fits.reason}`);
	return { takes: true, why: null };
}

/** The line shown on an offer row. */
export function clerkRowText(enabled: boolean, v: ClerkVerdict): string {
	if (!enabled) return v.takes ? "Clerk is off (would take it)" : "Clerk is off";
	return v.takes ? "Clerk will take it" : `Clerk skips: ${v.why}`;
}

/** $ per PFLOP-hour, e.g. "$12.5/PF·h". */
export function fmtRate(r: number, unit = true): string {
	if (!Number.isFinite(r)) return "—";
	return `$${r >= 100 ? Math.round(r) : r >= 10 ? r.toFixed(1) : r.toFixed(2)}${unit ? "/PF·h" : ""}`;
}

/** The slip shown while the clerk is not researched. */
export function clerkLockedText(content: ContentDB): string {
	const n = clerkNode(content);
	return n ? `Hire a Contracts Clerk: research ${n.name} (${n.cost} RP)` : "Hire a Contracts Clerk: research it in the Department of Research";
}

/** Toggle one job kind. The list never goes empty (the sim rejects that), and keeps the canonical order. */
export function toggleKind(kinds: readonly JobKind[], kind: JobKind): JobKind[] {
	const next = kinds.includes(kind) ? kinds.filter((k) => k !== kind) : JOB_KINDS.filter((k) => k === kind || kinds.includes(k));
	return next.length ? next : [...kinds];
}

/** Parse a number box: a finite value ≥ 0, else null (the policy is left alone until it is valid). */
export function parseAmount(text: string): number | null {
	const t = text.trim().replace(/^\$/, "").replace(/,/g, "");
	if (t === "") return null;
	const n = Number(t);
	return Number.isFinite(n) && n >= 0 ? n : null;
}

export const feePercent = (content: ContentDB): number => Math.round((content.balance?.clerk?.feeShare ?? 0) * 1000) / 10;

