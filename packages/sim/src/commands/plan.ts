import type { ContentDB } from "@aitower/content";
import type { CommandResult, SimEvent } from "../api";
import type { SimState } from "../core/state";

/** A validated command: `cost` is charged as construction (negative = refund) before `apply` runs. */
export type Plan = { ok: false; reason: string } | { ok: true; cost: number; apply: (events: SimEvent[]) => void };

export interface PlanCtx {
	state: SimState;
	content: ContentDB;
}

export const reject = (reason: string): Plan => ({ ok: false, reason });

export const accept = (cost: number, apply: (events: SimEvent[]) => void): Plan => ({ ok: true, cost, apply });

/** Shared cash check; refunds (cost ≤ 0) always pass. */
export function withFunds(ctx: PlanCtx, plan: Plan): Plan {
	if (plan.ok && plan.cost > 0 && plan.cost > ctx.state.cash) return reject(`insufficient funds (need $${Math.ceil(plan.cost)})`);
	return plan;
}

export const toResult = (plan: Plan): CommandResult => (plan.ok ? { ok: true } : { ok: false, reason: plan.reason });
