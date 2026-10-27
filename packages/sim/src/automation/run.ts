/** Shared helpers of the automation orders. */
import { type FacilityDef, isRetrofitOnly } from "@aitower/content";
import type { SimCommand } from "../api";
import { planNormalized } from "../commands/apply";
import type { TickCtx } from "../core/context";
import { spend } from "../economy/ledger";
import { placeBlock } from "../progression/access";

/** Validate, charge and apply one command like `applyCommands` does; false when it was rejected. */
export function runCommand(ctx: TickCtx, cmd: SimCommand): boolean {
	const plan = planNormalized(ctx, cmd);
	if (!plan.ok) return false;
	if (plan.cost !== 0) spend(ctx.state, "construction", plan.cost);
	plan.apply(ctx.events);
	return true;
}

/** Buildable now: the Level and research rules pass (the Foreman only builds what the player may place), not a growth, not a tree rack (those come from retrofits). */
export function buildable(ctx: TickCtx, d: FacilityDef): boolean {
	return !d.growth && !d.retired && !isRetrofitOnly(d) && placeBlock(ctx.state, ctx.content, d) === null;
}
