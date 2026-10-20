import { planNormalized } from "../commands/apply";
import { spend } from "../economy/ledger";
import { techGate } from "../research/research";
/** Validate, charge and apply one command like `applyCommands` does; false when it was rejected. */
export function runCommand(ctx, cmd) {
    const plan = planNormalized(ctx, cmd);
    if (!plan.ok)
        return false;
    if (plan.cost !== 0)
        spend(ctx.state, "construction", plan.cost);
    plan.apply(ctx.events);
    return true;
}
/** Buildable now: tier and research gates pass, not a growth. */
export function buildable(ctx, d) {
    return !d.growth && d.unlockTier <= ctx.state.tier && techGate(ctx.state, ctx.content, d.tech) === null;
}
