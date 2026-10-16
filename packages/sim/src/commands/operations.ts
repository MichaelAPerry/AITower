/** Non-construction commands: setEnabled, contracts, jobs, parts, bots. */
import { findById } from "../core/grid";
import type { Job } from "../core/state";
import { spend } from "../economy/ledger";
import { getDef } from "../world/defs";
import { addBot, chargerSpot, findChargerWithSpace } from "../world/entities";
import { releaseJobRacks } from "../compute/allocation";
import { accept, type Plan, type PlanCtx, reject } from "./plan";

export function planSetEnabled(ctx: PlanCtx, facilityId: number, enabled: boolean): Plan {
	const f = findById(ctx.state.facilities, facilityId);
	if (!f) return reject("no such facility");
	return accept(0, () => {
		f.enabled = enabled === true;
	});
}

export function planAcceptContract(ctx: PlanCtx, contractId: number): Plan {
	const s = ctx.state;
	const offer = findById(s.offers, contractId);
	if (!offer) return reject("no such offer");
	return accept(0, (events) => {
		s.offers = s.offers.filter((o) => o.id !== contractId);
		const spec = offer.spec;
		const isInference = spec.kind === "inference";
		const job: Job = {
			id: s.nextId.job++,
			contractId,
			spec,
			status: "queued",
			acceptedAt: s.tick,
			deadline: s.tick + spec.durationTicks,
			progress: 0,
			total: isInference ? spec.durationTicks : spec.work,
			lastCheckpoint: 0,
			sinceCheckpoint: 0,
			pflops: 0,
			rackIds: [],
			earned: 0,
			finishedAt: -1,
		};
		s.jobs.push(job);
		events.push({ type: "jobStarted", jobId: job.id });
	});
}

export function planDeclineContract(ctx: PlanCtx, contractId: number): Plan {
	const s = ctx.state;
	if (!findById(s.offers, contractId)) return reject("no such offer");
	return accept(0, () => {
		s.offers = s.offers.filter((o) => o.id !== contractId);
	});
}

/** Cancelling breaches the contract: training/finetune pay their penalty. */
export function planCancelJob(ctx: PlanCtx, jobId: number): Plan {
	const s = ctx.state;
	const job = findById(s.jobs, jobId);
	if (!job || job.status === "completed" || job.status === "failed") return reject("no active job with that id");
	return accept(0, (events) => {
		const penalty = job.spec.kind === "inference" ? 0 : job.spec.penalty;
		spend(s, "penalties", penalty);
		releaseJobRacks(s, job);
		job.status = "failed";
		job.finishedAt = s.tick;
		job.pflops = 0;
		events.push({ type: "jobFailed", jobId, penalty });
	});
}

export function planBuyParts(ctx: PlanCtx, count: number): Plan {
	const s = ctx.state;
	if (!Number.isInteger(count) || count <= 0) return reject("count must be a positive integer");
	let room = 0;
	for (const f of s.facilities) {
		const d = getDef(ctx.content, f.defId);
		if (d.kind === "depot") room += Math.max(0, (d.logistics?.capacity ?? 0) - f.stored);
	}
	if (room < count) return reject(room === 0 ? "no depot space" : `only ${room} depot slots free`);
	return accept(count * ctx.content.structure.sparePart, () => {
		stockParts(ctx, count);
	});
}

/** Put parts into depots in id order up to capacity. Returns how many did not fit. */
export function stockParts(ctx: PlanCtx, count: number): number {
	let left = count;
	for (const f of ctx.state.facilities) {
		if (left <= 0) break;
		const d = getDef(ctx.content, f.defId);
		if (d.kind !== "depot") continue;
		const n = Math.min(left, Math.max(0, (d.logistics?.capacity ?? 0) - f.stored));
		f.stored += n;
		left -= n;
	}
	return left;
}

export function planBuyBot(ctx: PlanCtx, defId: string): Plan {
	const s = ctx.state;
	const def = Object.hasOwn(ctx.content.bots, defId) ? ctx.content.bots[defId] : undefined;
	if (!def) return reject(`unknown bot '${defId}'`);
	const chargerId = findChargerWithSpace(s, ctx.content);
	if (chargerId < 0) return reject("no charger with a free dock");
	return accept(def.cost, () => {
		const spot = chargerSpot(s, chargerId);
		if (spot) addBot(s, defId, spot.floor, spot.x, chargerId);
	});
}
