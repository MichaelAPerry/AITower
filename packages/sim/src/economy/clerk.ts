/** Contracts Clerk: standing order that accepts offers automatically (for a fee, see `earnJob` in compute). */
import type { JobKind } from "@aitower/content";
import { type ClerkPolicy, payPerPflopHour } from "../api";
import { planAcceptContract } from "../commands/operations";
import { type Plan, type PlanCtx, accept, reject } from "../commands/plan";
import type { TickCtx } from "../core/context";
import { clerkUnlocked } from "../research/research";

export const JOB_KINDS: readonly JobKind[] = ["training", "finetune", "inference"];

export const defaultClerkPolicy = (): ClerkPolicy => ({ enabled: false, kinds: [...JOB_KINDS], minPayPerPflopHour: 0, maxPenalty: 0, allowLiquid: true });

const isNonNegative = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;

/** Validates a policy of unknown shape; returns a clean copy (kinds de-duplicated, first occurrence order) or the reason. */
export function checkPolicy(raw: unknown): { ok: true; policy: ClerkPolicy } | { ok: false; reason: string } {
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false, reason: "policy must be an object" };
	const p = raw as Record<string, unknown>;
	if (typeof p.enabled !== "boolean") return { ok: false, reason: "policy.enabled must be true or false" };
	if (typeof p.allowLiquid !== "boolean") return { ok: false, reason: "policy.allowLiquid must be true or false" };
	if (!Array.isArray(p.kinds) || p.kinds.length === 0) return { ok: false, reason: "policy.kinds must list at least one job kind" };
	const kinds: JobKind[] = [];
	for (const k of p.kinds) {
		if (typeof k !== "string" || !JOB_KINDS.includes(k as JobKind)) return { ok: false, reason: `unknown job kind '${String(k)}'` };
		if (!kinds.includes(k as JobKind)) kinds.push(k as JobKind);
	}
	if (!isNonNegative(p.minPayPerPflopHour)) return { ok: false, reason: "policy.minPayPerPflopHour must be a number ≥ 0" };
	if (!isNonNegative(p.maxPenalty)) return { ok: false, reason: "policy.maxPenalty must be a number ≥ 0" };
	return { ok: true, policy: { enabled: p.enabled, kinds, minPayPerPflopHour: p.minPayPerPflopHour, maxPenalty: p.maxPenalty, allowLiquid: p.allowLiquid } };
}

export function planSetClerk(ctx: PlanCtx, policy: unknown): Plan {
	const { state, content } = ctx;
	if (!clerkUnlocked(state, content)) return reject("the Contracts Clerk is locked: research it first");
	const checked = checkPolicy(policy);
	if (!checked.ok) return reject(checked.reason);
	return accept(0, () => {
		state.clerkPolicy = checked.policy;
	});
}

/** Tick stage 9a (after offers are generated): accept at most one matching offer, the oldest that can start. */
export function clerkStep(ctx: TickCtx): void {
	const { state, content, events } = ctx;
	const policy = state.clerkPolicy;
	if (!policy.enabled || state.offers.length === 0 || !clerkUnlocked(state, content)) return;
	for (const offer of state.offers) {
		const spec = offer.spec;
		if (!policy.kinds.includes(spec.kind)) continue;
		if (spec.needsLiquid && !policy.allowLiquid) continue;
		if (payPerPflopHour(spec) < policy.minPayPerPflopHour) continue;
		if (policy.maxPenalty > 0 && spec.penalty > policy.maxPenalty) continue;
		const plan = planAcceptContract(ctx, offer.id, true);
		if (!plan.ok) continue;
		const jobId = state.nextId.job;
		plan.apply(events);
		state.clerkAccepted++;
		events.push({ type: "clerkAccepted", contractId: offer.id, jobId });
		return;
	}
}
