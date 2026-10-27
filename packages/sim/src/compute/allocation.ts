/** Rack ↔ job allocation: release of bad racks (with checkpoint rollback), storage gating, auto-scheduler. */
import type { ContentDB, ContractSpec } from "@aitower/content";
import type { SimEvent } from "../api";
import { ACCEPT_DEADLINE_MARGIN, MIN_POWERED_SATISFACTION, TICKS_PER_HOUR, TRAINING_MAX_RACKS } from "../core/constants";
import { findById } from "../core/grid";
import type { Facility, Job, SimState } from "../core/state";
import { getDef, isBioRack, isComputeRack, isStorageRack } from "../world/defs";

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
export function applyStorageLimit(state: SimState, content: ContentDB, events?: SimEvent[]): Set<number> {
	const cap = storageCapacityTB(state, content);
	const ok = new Set<number>();
	let used = 0;
	for (const job of state.jobs) {
		if (!isActive(job)) continue;
		const need = job.spec.storageTB;
		if (need <= 0 || used + need <= cap) {
			used += need;
			ok.add(job.id);
		} else {
			// Announced once, on the move into a storage stall (a stalled job is not stalled again).
			if (events && job.status !== "stalled") events.push({ type: "jobStalledStorage", jobId: job.id, needTB: need, capacityTB: cap });
			releaseJobRacks(state, job);
		}
	}
	state.storageUtil = cap > 0 ? Math.min(1, used / cap) : 0;
	return ok;
}

function isFreeRack(content: ContentDB, f: Facility): boolean {
	const d = getDef(content, f.defId);
	return isComputeRack(d) && f.jobId < 0 && !rackDown(f) && !f.noCoolant && !f.noNutrient && f.sat >= MIN_POWERED_SATISFACTION;
}

/** Can this rack serve a job? Liquid contracts need liquid-cooled racks (not air, not organoid); bio contracts need organoid racks. */
export function rackSuits(spec: { needsLiquid: boolean; needsBio?: boolean }, d: ReturnType<typeof getDef>): boolean {
	if (spec.needsLiquid && (d.rack?.cooling === "air" || d.rack?.cooling === "bio")) return false;
	if (spec.needsBio && !isBioRack(d)) return false;
	return true;
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
		const inference = job.spec.kind === "inference";
		let have = 0;
		if (inference) for (const id of job.rackIds) have += pflopsOf(state, content, id);
		for (let i = 0; i < free.length; i++) {
			const r = free[i];
			if (r.jobId >= 0) continue;
			if (inference ? have >= sustainedPflops(job) : job.rackIds.length >= TRAINING_MAX_RACKS) break;
			const d = getDef(content, r.defId);
			if (!rackSuits(job.spec, d)) continue;
			r.jobId = job.id;
			job.rackIds.push(r.id);
			have += (d.rack?.pflops ?? 0) * r.clock;
		}
	}
}

/** What a rack delivers right now: nominal PFLOPS × its clock (thermal throttle, brownout, nutrient). A throttled rack must not count as full, or a job stops claiming idle racks while it runs short. */
function pflopsOf(state: SimState, content: ContentDB, id: number): number {
	const r = findById(state.facilities, id);
	return r ? (getDef(content, r.defId).rack?.pflops ?? 0) * r.clock : 0;
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

/**
 * Can this offer start right now? Plays out the same greedy claims as `allocateRacks` for every active job first
 * (a running training job keeps absorbing free racks up to its cap), then checks what is left, plus free storage.
 * Pure: never changes state. Used to refuse contracts that would only sit in a queue accruing penalties.
 */
export function acceptCheck(
	state: SimState,
	content: ContentDB,
	spec: ContractSpec,
	margin: { deadline: number; compute: number } = { deadline: ACCEPT_DEADLINE_MARGIN, compute: 1 },
): { ok: true } | { ok: false; reason: string } {
	const free = state.facilities.filter((f) => isFreeRack(content, f));
	const claimed = new Set<number>();
	const claim = (spec: { needsLiquid: boolean; needsBio?: boolean }, enough: (have: number, count: number) => boolean, have0: number, count0: number) => {
		let have = have0;
		let count = count0;
		for (const r of free) {
			if (enough(have, count)) break;
			if (claimed.has(r.id)) continue;
			const d = getDef(content, r.defId);
			if (!rackSuits(spec, d)) continue;
			claimed.add(r.id);
			have += (d.rack?.pflops ?? 0) * r.clock;
			count++;
		}
		return have;
	};
	for (const job of state.jobs) {
		if (!isActive(job)) continue;
		if (job.spec.kind === "inference") {
			let have = 0;
			for (const id of job.rackIds) have += pflopsOf(state, content, id);
			const need = sustainedPflops(job);
			claim(job.spec, (h) => h >= need, have, 0);
		} else claim(job.spec, (_h, n) => n >= TRAINING_MAX_RACKS, 0, job.rackIds.length);
	}

	let idlePflops = 0;
	let idleRacks = 0;
	/** What a new training job would get: the first idle racks, up to its cap (as allocateRacks hands them out). */
	let trainPflops = 0;
	let anyCompatible = false;
	for (const f of state.facilities) {
		const d = getDef(content, f.defId);
		if (isComputeRack(d) && rackSuits(spec, d)) anyCompatible = true;
	}
	for (const r of free) {
		if (claimed.has(r.id)) continue;
		const d = getDef(content, r.defId);
		if (!rackSuits(spec, d)) continue;
		idlePflops += d.rack?.pflops ?? 0;
		if (idleRacks < TRAINING_MAX_RACKS) trainPflops += d.rack?.pflops ?? 0;
		idleRacks++;
	}
	const pf = (n: number) => `${Math.round(n * 10) / 10} PF`;
	if (spec.needsBio && !anyCompatible) return { ok: false, reason: "needs organoid racks (none installed)" };
	if (spec.needsLiquid && !anyCompatible) return { ok: false, reason: "needs liquid-cooled racks (none installed)" };
	if (spec.kind === "inference") {
		const need = (spec.sustainedPflops ?? spec.work) * margin.compute;
		if (idlePflops + 1e-9 < need) return { ok: false, reason: `not enough idle compute: needs ${pf(need)}${margin.compute > 1 ? " with a safety margin" : ""}, ${pf(idlePflops)} idle` };
	} else if (idleRacks === 0) {
		let busy = 0;
		let offline = 0;
		for (const f of state.facilities) {
			const d = getDef(content, f.defId);
			if (!isComputeRack(d) || !rackSuits(spec, d)) continue;
			if (f.jobId >= 0 || claimed.has(f.id)) busy++;
			else if (!isFreeRack(content, f)) offline++;
		}
		const parts = [busy ? `${busy} busy with current jobs` : "", offline ? `${offline} offline (unpowered, failed, tripped or uncooled)` : ""].filter(Boolean);
		return { ok: false, reason: `no idle racks${parts.length ? `: ${parts.join(", ")}` : ""}` };
	} else {
		// Would it finish in time on the racks it gets now? Otherwise it is a guaranteed missed-deadline penalty (sandbox has no deadlines).
		const needHours = trainPflops > 0 ? spec.work / trainPflops : Number.POSITIVE_INFINITY;
		const haveHours = (spec.durationTicks * margin.deadline) / TICKS_PER_HOUR;
		if (!state.sandbox && needHours > haveHours) {
			const h = (n: number) => `${Math.ceil(n)} h`;
			return { ok: false, reason: `too slow for the deadline: your idle racks (${pf(trainPflops)}) need about ${h(needHours)}, the deadline allows ${h(spec.durationTicks / TICKS_PER_HOUR)}` };
		}
	}

	if (spec.storageTB > 0) {
		let used = 0;
		for (const job of state.jobs) if (isActive(job)) used += job.spec.storageTB;
		const freeTB = storageCapacityTB(state, content) - used;
		if (spec.storageTB > freeTB) return { ok: false, reason: `not enough free storage: needs ${spec.storageTB} TB, ${Math.max(0, Math.round(freeTB))} TB free` };
	}
	return { ok: true };
}
