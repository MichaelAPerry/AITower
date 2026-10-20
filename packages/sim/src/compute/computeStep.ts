/**
 * Tick stage 6: allocation, delivered compute, job progress, payouts / penalties.
 * Racks deliver only if they were allocated at power-solve time (`busy`), so newly allocated
 * racks start contributing next tick, when their full power is drawn.
 */
import type { TickCtx } from "../core/context";
import { EPS, FINISHED_JOB_RETENTION_TICKS, TICKS_PER_HOUR, TRAINING_PROGRESS_PAY_SHARE } from "../core/constants";
import { findById } from "../core/grid";
import { minuteOfDay } from "../core/time";
import type { Job, SimState } from "../core/state";
import { earn, spend } from "../economy/ledger";
import { recordJobOutcome } from "../economy/stats";
import { earnResearch, perk } from "../research/research";
import { powerFactor } from "../power/powerSolve";
import { getDef } from "../world/defs";
import { allocateRacks, applyStorageLimit, isActive, releaseBadRacks, releaseJobRacks, sustainedPflops } from "./allocation";

function updateRackClocks(ctx: TickCtx): number {
	let total = 0;
	let organoid = 0;
	for (const f of ctx.state.facilities) {
		const d = getDef(ctx.content, f.defId);
		if (d.kind !== "rack" || !d.rack) continue;
		const down = !f.enabled || f.failed || f.tripped;
		f.clock = down ? 0 : f.thermalClock * powerFactor(f.sat) * f.nutrientSat;
		f.pflops = f.busy && f.jobId >= 0 ? d.rack.pflops * f.clock : 0;
		total += f.pflops;
		if (d.rack.cooling === "bio") organoid += f.pflops;
	}
	ctx.state.metrics.organoidPflops = organoid;
	return total;
}

function finish(state: SimState, job: Job, status: "completed" | "failed"): void {
	releaseJobRacks(state, job);
	job.status = status;
	job.finishedAt = state.tick;
	job.pflops = 0;
}

/** Pay a job: revenue stays gross; a clerk-accepted job's fee is withheld (cash and `fees`, not revenue). */
function earnJob(ctx: TickCtx, job: Job, amount: number): void {
	const { state, content } = ctx;
	earn(state, amount);
	if (job.clerk && amount > 0) spend(state, "fees", amount * content.balance.clerk.feeShare);
	// `earned` events: training checkpoints and the completion balance at once; inference streams are summed per game-hour.
	if (amount > 0) {
		if (job.spec.kind === "inference") job.unreported += amount;
		else ctx.events.push({ type: "earned", jobId: job.id, amount });
	}
}

/** Emit and clear a job's pending inference revenue. */
export function flushEarned(events: TickCtx["events"], job: Job): void {
	if (job.unreported > 0) events.push({ type: "earned", jobId: job.id, amount: job.unreported });
	job.unreported = 0;
}

/** A job completed: bonus RP, lifetime and audit counters. */
function jobCompleted(ctx: TickCtx, job: Job): void {
	finish(ctx.state, job, "completed");
	earnResearch(ctx.state, ctx.content.balance.research.pointsPerJob);
	recordJobOutcome(ctx.state, "completed");
}

function deliveredBy(state: SimState, job: Job): number {
	let p = 0;
	for (const id of job.rackIds) p += findById(state.facilities, id)?.pflops ?? 0;
	return p;
}

export function computeStep(ctx: TickCtx): void {
	const { state, content, events } = ctx;
	releaseBadRacks(state, events);
	const runnable = applyStorageLimit(state, content);
	state.metrics.pflops = updateRackClocks(ctx);
	if (state.metrics.pflops > state.stats.peakPflops) state.stats.peakPflops = state.metrics.pflops;
	const rpPerPflopHour = content.balance.research.pointsPerPflopHour * perk(state, content, "researchRate");
	allocateRacks(state, content, runnable);

	for (const job of state.jobs) {
		if (!isActive(job)) continue;
		const delivered = deliveredBy(state, job);
		job.pflops = delivered;
		if (delivered > 0) {
			const pflopHours = delivered / TICKS_PER_HOUR;
			state.stats.pflopHours += pflopHours;
			earnResearch(state, pflopHours * rpPerPflopHour);
		}
		const rate = job.spec.payout / Math.max(1, job.spec.durationTicks);

		if (job.spec.kind === "inference") {
			job.progress++;
			if (delivered + EPS >= sustainedPflops(job)) {
				earnJob(ctx, job, rate);
				job.earned += rate;
			} else if (job.earned > 0) {
				// SLA breach: the service was running and fell short (failures, brownout). A job that has not started
				// serving yet is not penalised; acceptance already checked that it can start.
				spend(state, "penalties", content.balance.economy.slaPenaltyFactor * rate);
			}
			if (job.progress >= job.total) {
				flushEarned(events, job);
				jobCompleted(ctx, job);
				events.push({ type: "jobCompleted", jobId: job.id, payout: job.earned });
				continue;
			}
		} else {
			if (delivered > 0) {
				job.progress += delivered / TICKS_PER_HOUR;
				job.sinceCheckpoint++;
				if (job.sinceCheckpoint >= job.spec.checkpointTicks) {
					job.lastCheckpoint = job.progress;
					job.sinceCheckpoint = 0;
					// Milestone billing: checkpointed (rollback-safe) work is paid as it lands, so a long run shows income.
					const due = job.spec.payout * TRAINING_PROGRESS_PAY_SHARE * Math.min(1, job.lastCheckpoint / job.total) - job.earned;
					if (due > 0) {
						earnJob(ctx, job, due);
						job.earned += due;
					}
				}
			}
			if (job.progress + EPS >= job.total) {
				job.progress = job.total;
				earnJob(ctx, job, job.spec.payout - job.earned); // the balance not already paid at checkpoints
				job.earned = job.spec.payout;
				jobCompleted(ctx, job);
				events.push({ type: "jobCompleted", jobId: job.id, payout: job.spec.payout });
				continue;
			}
			if (state.tick >= job.deadline) {
				spend(state, "penalties", job.spec.penalty);
				finish(state, job, "failed");
				recordJobOutcome(state, "failed");
				events.push({ type: "jobFailed", jobId: job.id, penalty: job.spec.penalty });
				continue;
			}
		}
		job.status = !runnable.has(job.id) ? "stalled" : delivered > 0 ? "running" : job.rackIds.length > 0 ? "stalled" : "queued";
	}

	// Once per game-hour: inference revenue, summed per job.
	if (minuteOfDay(state.tick) % TICKS_PER_HOUR === 0) for (const job of state.jobs) if (isActive(job)) flushEarned(events, job);

	// Prune long-finished jobs.
	state.jobs = state.jobs.filter((j) => isActive(j) || state.tick - j.finishedAt < FINISHED_JOB_RETENTION_TICKS);
}
