/** Rack ↔ job allocation: release of bad racks (with checkpoint rollback), storage gating, auto-scheduler. */
import type { ContentDB } from "@aitower/content";
import type { SimEvent } from "../api";
import { MIN_POWERED_SATISFACTION, TRAINING_MAX_RACKS } from "../core/constants";
import { findById } from "../core/grid";
import type { Facility, Job, SimState } from "../core/state";
import { getDef, isComputeRack, isStorageRack } from "../world/defs";

export const isActive = (job: Job): boolean => job.status === "queued" || job.status === "running" || job.status === "stalled";

export const sustainedPflops = (job: Job): number => job.spec.sustainedPflops ?? job.spec.work;

export function releaseJobRacks(state: SimState, job: Job): void {
	for (const id of job.rackIds) {
		const r = findById(state.facilities, id);
		if (r && r.jobId === job.id) r.jobId = -1;
	}
	job.rackIds = [];
}

const rackDown = (r: Facility | undefined): boolean => !r || r.failed || r.tripped || !r.enabled;

/** Drop failed / tripped / disabled / demolished racks; training jobs roll back to their checkpoint. */
export function releaseBadRacks(state: SimState, events: SimEvent[]): void {
	for (const job of state.jobs) {
		if (!isActive(job) || job.rackIds.length === 0) continue;
		let lost = false;
		job.rackIds = job.rackIds.filter((id) => {
			const r = findById(state.facilities, id);
			if (!rackDown(r)) return true;
			if (r && r.jobId === job.id) r.jobId = -1;
			lost = true;
			return false;
		});
		if (lost && job.spec.kind !== "inference") {
			const lostWork = job.progress - job.lastCheckpoint;
			job.progress = job.lastCheckpoint;
			job.sinceCheckpoint = 0;
			events.push({ type: "jobRolledBack", jobId: job.id, lostWork });
		}
	}
}

/** Σ storageTB of powered, healthy storage racks. */
export function storageCapacityTB(state: SimState, content: ContentDB): number {
	let tb = 0;
	for (const f of state.facilities) {
		const d = getDef(content, f.defId);
		if (isStorageRack(d) && !rackDown(f) && f.sat >= MIN_POWERED_SATISFACTION) tb += d.rack?.storageTB ?? 0;
	}
	return tb;
}

/**
 * Jobs (oldest first) whose datasets fit in storage; the newest that don't fit stall and give up
 * their racks. Returns the set of job ids allowed to run and updates `state.storageUtil`.
 */
export function applyStorageLimit(state: SimState, content: ContentDB): Set<number> {
	const cap = storageCapacityTB(state, content);
	const ok = new Set<number>();
	let used = 0;
	for (const job of state.jobs) {
		if (!isActive(job)) continue;
		const need = job.spec.storageTB;
		if (need <= 0 || used + need <= cap) {
			used += need;
			ok.add(job.id);
		} else releaseJobRacks(state, job);
	}
	state.storageUtil = cap > 0 ? Math.min(1, used / cap) : 0;
	return ok;
}

function isFreeRack(content: ContentDB, f: Facility): boolean {
	const d = getDef(content, f.defId);
	return isComputeRack(d) && f.jobId < 0 && !rackDown(f) && !f.noCoolant && f.sat >= MIN_POWERED_SATISFACTION;
}

/** Auto-scheduler: oldest job first; inference until sustainedPflops is met, training up to 8 racks. */
export function allocateRacks(state: SimState, content: ContentDB, runnable: Set<number>): void {
	let wanted = false;
	for (const job of state.jobs) {
		if (isActive(job) && runnable.has(job.id)) {
			wanted = true;
			break;
		}
	}
	if (!wanted) return; // nothing to place: skip the facility scan
	const free = state.facilities.filter((f) => isFreeRack(content, f));
	if (free.length === 0) return;
	for (const job of state.jobs) {
		if (!isActive(job) || !runnable.has(job.id)) continue;
		const needLiquid = job.spec.needsLiquid;
		const inference = job.spec.kind === "inference";
		let have = 0;
		if (inference) for (const id of job.rackIds) have += pflopsOf(state, content, id);
		for (let i = 0; i < free.length; i++) {
			const r = free[i];
			if (r.jobId >= 0) continue;
			if (inference ? have >= sustainedPflops(job) : job.rackIds.length >= TRAINING_MAX_RACKS) break;
			const d = getDef(content, r.defId);
			if (needLiquid && d.rack?.cooling === "air") continue;
			r.jobId = job.id;
			job.rackIds.push(r.id);
			have += d.rack?.pflops ?? 0;
		}
	}
}

function pflopsOf(state: SimState, content: ContentDB, id: number): number {
	const r = findById(state.facilities, id);
	return r ? (getDef(content, r.defId).rack?.pflops ?? 0) : 0;
}

/** Installed compute: Σ nominal PFLOPS of enabled, non-failed racks. */
export function installedPflops(state: SimState, content: ContentDB): number {
	let p = 0;
	for (const f of state.facilities) {
		const d = getDef(content, f.defId);
		if (isComputeRack(d) && f.enabled && !f.failed) p += d.rack?.pflops ?? 0;
	}
	return p;
}
