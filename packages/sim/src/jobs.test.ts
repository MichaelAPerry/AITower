import type { ContractSpec } from "@aitower/content";
import { describe, expect, it } from "vitest";
import { failRack } from "./reliability/reliabilityStep";
import type { SimImpl } from "./sim";
import { exec, facilityOf, makeContent, newSim, run, scenario } from "./test/fixture";

const farm = scenario("farm", {
	slabs: [[0, 0, 47]],
	conduits: [["power", 0, 0, 47]],
	facilities: [
		{ defId: "grid_tie", floor: 0, x: 0 },
		{ defId: "rack_air_gpu", floor: 0, x: 6 },
		{ defId: "rack_air_gpu", floor: 0, x: 8 },
		{ defId: "rack_air_gpu", floor: 0, x: 10 },
		{ defId: "rack_air_gpu", floor: 0, x: 12 },
		{ defId: "crah_unit", floor: 0, x: 14 },
		{ defId: "crah_unit", floor: 0, x: 4 },
		{ defId: "rack_storage", floor: 0, x: 20 },
	],
});

const training = (over: Partial<ContractSpec> = {}): ContractSpec => ({
	clientId: "t",
	clientName: "Trainer",
	kind: "training",
	work: 40,
	durationTicks: 1440,
	payout: 100_000,
	penalty: 30_000,
	needsLiquid: false,
	storageTB: 0,
	checkpointTicks: 60,
	...over,
});

/** Inject an offer and accept it; returns the job id. */
function acceptSpec(sim: SimImpl, spec: ContractSpec): number {
	const id = sim.state.nextId.contract++;
	sim.state.offers.push({ id, spec, expiresAt: sim.state.tick + 1000 });
	const ev = exec(sim, { type: "acceptContract", contractId: id });
	const started = ev.find((e) => e.type === "jobStarted");
	if (started?.type !== "jobStarted") throw new Error("job not started");
	return started.jobId;
}

const noOffers = () => makeContent([farm], { economy: { slaPenaltyFactor: 1.5, maxOffers: 0, offerIntervalTicks: 100, offerExpiryTicks: 100 } });

describe("jobs", () => {
	it("training progresses at Σ pflops × clock / 60 PFLOP-h per tick and pays on completion", () => {
		const sim = newSim(noOffers(), "farm");
		const jobId = acceptSpec(sim, training());
		const job = sim.state.jobs.find((j) => j.id === jobId);
		expect(job?.rackIds).toHaveLength(4); // all free compute racks (≤ 8)
		run(sim, 1); // racks now drawing full power
		expect(job?.pflops).toBeCloseTo(80, 6);
		expect(job?.progress).toBeCloseTo(80 / 60, 6);
		const revenue0 = sim.state.today.revenue;
		const events = run(sim, 40);
		const done = events.find((e) => e.type === "jobCompleted");
		expect(done).toEqual({ type: "jobCompleted", jobId, payout: 100_000 });
		expect(sim.state.today.revenue - revenue0).toBe(100_000);
		expect(job?.status).toBe("completed");
		expect(sim.state.facilities.every((f) => f.jobId < 0)).toBe(true);
	});

	it("rolls back to the last checkpoint when an allocated rack fails", () => {
		const sim = newSim(noOffers(), "farm");
		const jobId = acceptSpec(sim, training({ work: 1_000_000 }));
		const job = sim.state.jobs.find((j) => j.id === jobId);
		if (!job) throw new Error("no job");
		run(sim, 90);
		expect(job.lastCheckpoint).toBeGreaterThan(0);
		expect(job.progress).toBeGreaterThan(job.lastCheckpoint);
		const expectedLost = job.progress - job.lastCheckpoint;
		const checkpoint = job.lastCheckpoint;
		const rack = facilityOf(sim, "rack_air_gpu", 1);
		failRack(sim.state, rack, []);
		const events = sim.step();
		const rb = events.find((e) => e.type === "jobRolledBack");
		expect(rb).toMatchObject({ type: "jobRolledBack", jobId });
		expect(rb && rb.type === "jobRolledBack" ? rb.lostWork : 0).toBeCloseTo(expectedLost, 9);
		expect(job.rackIds).not.toContain(rack.id);
		expect(rack.jobId).toBe(-1);
		// Progress restarted from the checkpoint; 3 racks (the 4th is new to it next tick) keep working.
		expect(job.progress).toBeGreaterThanOrEqual(checkpoint);
		expect(job.progress).toBeLessThan(checkpoint + 1.5);
		expect(sim.state.workOrders).toHaveLength(1);
	});

	it("inference streams pay while meeting sustained PFLOPS, SLA penalty otherwise", () => {
		const sim = newSim(noOffers(), "farm");
		const spec: ContractSpec = { ...training(), kind: "inference", work: 30, sustainedPflops: 30, durationTicks: 100, payout: 10_000 };
		const jobId = acceptSpec(sim, spec);
		const job = sim.state.jobs.find((j) => j.id === jobId);
		expect(job?.rackIds).toHaveLength(2); // 2 × 20 ≥ 30
		const pen0 = sim.state.today.penalties;
		const rev0 = sim.state.today.revenue;
		const events = run(sim, 100);
		// The accept tick counted as tick 1 (racks not yet busy) → one penalty tick.
		expect(sim.state.today.penalties - pen0).toBeCloseTo(0, 9);
		expect(sim.state.today.revenue - rev0).toBeCloseTo(99 * 100, 6);
		const done = events.find((e) => e.type === "jobCompleted");
		expect(done).toMatchObject({ jobId });
		expect(job?.status).toBe("completed");
	});

	it("datasets need storage racks; jobs that don't fit stall", () => {
		const sim = newSim(noOffers(), "farm");
		const a = acceptSpec(sim, training({ work: 1e6, storageTB: 1500 }));
		const b = acceptSpec(sim, training({ work: 1e6, storageTB: 1000 }));
		run(sim, 3);
		const ja = sim.state.jobs.find((j) => j.id === a);
		const jb = sim.state.jobs.find((j) => j.id === b);
		expect(ja?.status).toBe("running");
		expect(jb?.status).toBe("stalled");
		expect(jb?.rackIds).toHaveLength(0);
		expect(sim.state.storageUtil).toBeCloseTo(0.75, 9);
	});

	it("training that misses its deadline fails with a penalty", () => {
		const sim = newSim(noOffers(), "farm");
		const jobId = acceptSpec(sim, training({ work: 1e6, durationTicks: 50 }));
		const pen0 = sim.state.today.penalties;
		const events = run(sim, 60);
		expect(events.find((e) => e.type === "jobFailed")).toEqual({ type: "jobFailed", jobId, penalty: 30_000 });
		expect(sim.state.today.penalties - pen0).toBe(30_000);
	});

	it("cancelJob frees racks and charges the training penalty", () => {
		const sim = newSim(noOffers(), "farm");
		const jobId = acceptSpec(sim, training({ work: 1e6 }));
		run(sim, 5);
		const ev = exec(sim, { type: "cancelJob", jobId });
		expect(ev.find((e) => e.type === "jobFailed")).toEqual({ type: "jobFailed", jobId, penalty: 30_000 });
		expect(sim.state.facilities.every((f) => f.jobId < 0)).toBe(true);
	});
});

describe("contract offers", () => {
	it("are generated with seeded jitter up to maxOffers and expire", () => {
		const sim = newSim(makeContent([farm]), "farm", 7);
		const events = run(sim, 1440);
		const offered = events.filter((e) => e.type === "contractOffered").length;
		const expired = events.filter((e) => e.type === "contractExpired").length;
		expect(offered).toBeGreaterThan(3);
		expect(expired).toBeGreaterThan(0);
		expect(sim.view().offers.length).toBeLessThanOrEqual(4);
		const offer = sim.view().offers[0];
		expect(offer.expiresAt).toBeGreaterThan(sim.state.tick);
	});
});
