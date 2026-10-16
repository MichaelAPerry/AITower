/**
 * Tick stage 6: allocation, delivered compute, job progress, payouts / penalties.
 * Racks deliver only if they were allocated at power-solve time (`busy`), so newly allocated
 * racks start contributing next tick, when their full power is drawn.
 */
import type { TickCtx } from "../core/context";
import { EPS, FINISHED_JOB_RETENTION_TICKS, TICKS_PER_HOUR, TRAINING_PROGRESS_PAY_SHARE } from "../core/constants";
import { findById } from "../core/grid";
import type { Job, SimState } from "../core/state";
import { earn, spend } from "../economy/ledger";
import { powerFactor } from "../power/powerSolve";
import { getDef } from "../world/defs";
import { allocateRacks, applyStorageLimit, isActive, releaseBadRacks, releaseJobRacks, sustainedPflops } from "./allocation";

function updateRackClocks(ctx: TickCtx): number {
	let total = 0;
	for (const f of ctx.state.facilities) {
		const d = getDef(ctx.content, f.defId);
		if (d.kind !== "rack" || !d.rack) continue;
		const down = !f.enabled || f.failed || f.tripped;
		f.clock = down ? 0 : f.thermalClock * powerFactor(f.sat);
		f.pflops = f.busy && f.jobId >= 0 ? d.rack.pflops * f.clock : 0;
		total += f.pflops;
	}
	return total;
}

function finish(state: SimState, job: Job, status: "completed" | "failed"): void {
	releaseJobRacks(state, job);
	job.status = status;
	job.finishedAt = state.tick;
	job.pflops = 0;
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
	allocateRacks(state, content, runnable);

	for (const job of state.jobs) {
		if (!isActive(job)) continue;
		const delivered = deliveredBy(state, job);
		job.pflops = delivered;
		const rate = job.spec.payout / Math.max(1, job.spec.durationTicks);

		if (job.spec.kind === "inference") {
			job.progress++;
			if (delivered + EPS >= sustainedPflops(job)) {
				earn(state, rate);
				job.earned += rate;
			} else if (job.earned > 0) {
				// SLA breach: the service was running and fell short (failures, brownout). A job that has not started
				// serving yet is not penalised; acceptance already checked that it can start.
				spend(state, "penalties", content.balance.economy.slaPenaltyFactor * rate);
			}
			if (job.progress >= job.total) {
				finish(state, job, "completed");
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
						earn(state, due);
						job.earned += due;
					}
				}
			}
			if (job.progress + EPS >= job.total) {
				job.progress = job.total;
				earn(state, job.spec.payout - job.earned); // the balance not already paid at checkpoints
				job.earned = job.spec.payout;
				finish(state, job, "completed");
				events.push({ type: "jobCompleted", jobId: job.id, payout: job.spec.payout });
				continue;
			}
			if (state.tick >= job.deadline) {
				spend(state, "penalties", job.spec.penalty);
				finish(state, job, "failed");
				events.push({ type: "jobFailed", jobId: job.id, penalty: job.spec.penalty });
				continue;
			}
		}
		job.status = !runnable.has(job.id) ? "stalled" : delivered > 0 ? "running" : job.rackIds.length > 0 ? "stalled" : "queued";
	}

	// Prune long-finished jobs.
	state.jobs = state.jobs.filter((j) => isActive(j) || state.tick - j.finishedAt < FINISHED_JOB_RETENTION_TICKS);
}
