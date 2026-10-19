/** Tick stage 1: validate & apply queued commands. */
import type { SimCommand } from "../api";
import type { TickCtx } from "../core/context";
import { planSetClerk } from "../economy/clerk";
import { planRepayLoan, planTakeLoan } from "../economy/credit";
import { spend } from "../economy/ledger";
import { planResearch } from "../research/research";
import { planDemolish } from "./demolish";
import {
	planAcceptContract,
	planBuyBot,
	planBuyParts,
	planCancelJob,
	planDeclineContract,
	planSetEnabled,
} from "./operations";
import { planResolveMemo } from "../ministry/memos";
import { type Plan, type PlanCtx, reject, withFunds } from "./plan";
import { planPlace } from "./placement";
import { normalizeCommand } from "./shape";
import { planConduit, planLift, planSlab } from "./structure";

/**
 * Pure validation of one command against `ctx.state` (includes the cash check). Accepts untrusted input and never
 * throws: structurally bad commands are rejected, and any unexpected error inside a validator becomes a rejection.
 */
export function planCommand(ctx: PlanCtx, raw: unknown): Plan {
	const norm = normalizeCommand(raw);
	return norm.ok ? planNormalized(ctx, norm.cmd) : reject(norm.reason);
}

/** Like `planCommand` for a command that already went through `normalizeCommand`. */
export function planNormalized(ctx: PlanCtx, cmd: SimCommand): Plan {
	try {
		return planChecked(ctx, cmd);
	} catch {
		return reject("malformed command");
	}
}

function planChecked(ctx: PlanCtx, cmd: SimCommand): Plan {
	let plan: Plan;
	switch (cmd.type) {
		case "buildSlab":
			plan = planSlab(ctx, cmd.floor, cmd.x0, cmd.x1);
			break;
		case "place":
			plan = planPlace(ctx, cmd.defId, cmd.floor, cmd.x);
			break;
		case "buildConduit":
			plan = planConduit(ctx, cmd.layer, cmd.cells);
			break;
		case "buildLift":
			plan = planLift(ctx, cmd.x, cmd.floorMin, cmd.floorMax);
			break;
		case "demolish":
			plan = planDemolish(ctx, cmd.floor, cmd.x, cmd.layer);
			break;
		case "setEnabled":
			plan = planSetEnabled(ctx, cmd.facilityId, cmd.enabled);
			break;
		case "acceptContract":
			plan = planAcceptContract(ctx, cmd.contractId);
			break;
		case "declineContract":
			plan = planDeclineContract(ctx, cmd.contractId);
			break;
		case "cancelJob":
			plan = planCancelJob(ctx, cmd.jobId);
			break;
		case "buyParts":
			plan = planBuyParts(ctx, cmd.count);
			break;
		case "buyBot":
			plan = planBuyBot(ctx, cmd.defId);
			break;
		case "resolveMemo":
			plan = planResolveMemo(ctx, cmd.memoId, cmd.choiceId);
			break;
		case "research":
			plan = planResearch(ctx, cmd.techId);
			break;
		case "setClerk":
			plan = planSetClerk(ctx, cmd.policy);
			break;
		case "takeLoan":
			plan = planTakeLoan(ctx, cmd.amount);
			break;
		case "repayLoan":
			plan = planRepayLoan(ctx, cmd.amount);
			break;
		default:
			return reject("unknown command type");
	}
	return withFunds(ctx, plan);
}

export function applyCommands(ctx: TickCtx): void {
	const { state, events } = ctx;
	const queue = state.pending;
	state.pending = [];
	for (const cmd of queue) {
		const plan = planCommand(ctx, cmd);
		if (!plan.ok) {
			events.push({ type: "commandRejected", command: cmd, reason: plan.reason });
			continue;
		}
		if (plan.cost !== 0) spend(state, "construction", plan.cost);
		plan.apply(events);
	}
}
