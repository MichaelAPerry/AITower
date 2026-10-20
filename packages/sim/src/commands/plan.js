export const reject = (reason) => ({ ok: false, reason });
export const accept = (cost, apply) => ({ ok: true, cost, apply });
/** Shared cash check; refunds (cost ≤ 0) always pass. */
export function withFunds(ctx, plan) {
    if (plan.ok && plan.cost > 0 && plan.cost > ctx.state.cash)
        return reject(`insufficient funds (need $${Math.ceil(plan.cost)})`);
    return plan;
}
export const toResult = (plan) => (plan.ok ? { ok: true } : { ok: false, reason: plan.reason });
