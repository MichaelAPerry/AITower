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
	// Power is first solved inside a tick; at tick 0 every rack still reads unpowered and acceptance would refuse.
	if (sim.state.tick === 0) sim.step();
	const id = sim.state.nextId.contract++;
	sim.state.offers.push({ id, spec, expiresAt: sim.state.tick + 1000 });
	const ev = exec(sim, { type: "acceptContract", contractId: id });
	const started = ev.find((e) => e.type === "jobStarted");
	if (started?.type !== "jobStarted") throw new Error("job not started");
	return started.jobId;
}

function pushOffer(sim: SimImpl, spec: ContractSpec): number {
	const id = sim.state.nextId.contract++;
	sim.state.offers.push({ id, spec, expiresAt: sim.state.tick + 1000 });
	sim.invalidateProjection();
	return id;
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
		const jobId = acceptSpec(sim, training({ work: 1000 }));
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
		// The accept tick (racks not yet delivering) is not penalised: the service had not started yet.
		expect(sim.state.today.penalties - pen0).toBeCloseTo(0, 9);
		expect(sim.state.today.revenue - rev0).toBeCloseTo(99 * 100, 6);
		const done = events.find((e) => e.type === "jobCompleted");
		expect(done).toMatchObject({ jobId });
		expect(job?.status).toBe("completed");
	});

	it("datasets need storage racks; contracts that don't fit are refused, and running jobs stall if storage goes", () => {
		const sim = newSim(noOffers(), "farm");
		const a = acceptSpec(sim, training({ work: 1000, storageTB: 1500 }));
		run(sim, 3);
		const ja = sim.state.jobs.find((j) => j.id === a);
		expect(ja?.status).toBe("running");
		expect(sim.state.storageUtil).toBeCloseTo(0.75, 9);

		// A second dataset that does not fit is refused up front instead of queueing behind the first.
		const id = sim.state.nextId.contract++;
		sim.state.offers.push({ id, spec: training({ work: 1000, storageTB: 1000 }), expiresAt: sim.state.tick + 1000 });
		const r = sim.submit({ type: "acceptContract", contractId: id });
		expect(r.ok).toBe(false);

		// Losing the storage rack stalls the running job and frees its compute.
		const store = sim.state.facilities.find((f) => f.defId === "rack_storage");
		if (!store) throw new Error("no storage rack");
		exec(sim, { type: "setEnabled", facilityId: store.id, enabled: false });
		run(sim, 2);
		expect(ja?.status).toBe("stalled");
		expect(ja?.rackIds).toHaveLength(0);
	});

	it("refuses contracts the idle racks cannot start, with a reason that names the shortfall", () => {
		const sim = newSim(noOffers(), "farm");
		sim.step();
		const offer = (spec: ContractSpec) => {
			const id = sim.state.nextId.contract++;
			sim.state.offers.push({ id, spec, expiresAt: sim.state.tick + 1000 });
			sim.invalidateProjection(); // the offer was injected straight into state
			return sim.submit({ type: "acceptContract", contractId: id });
		};
		// 4 × 20 PF air racks are idle: 100 PF sustained cannot be served.
		const big = offer({ ...training(), kind: "inference", work: 100, sustainedPflops: 100 });
		expect(big).toEqual({ ok: false, reason: "not enough idle compute: needs 100 PF, 80 PF idle" });
		// Liquid-only work with no liquid racks installed.
		expect(offer(training({ needsLiquid: true }))).toEqual({ ok: false, reason: "needs liquid-cooled racks (none installed)" });
		// Training takes every idle rack (≤ 8); after that, further work is refused rather than queued.
		expect(offer(training({ work: 1000 })).ok).toBe(true);
		run(sim, 1);
		const after = offer({ ...training(), kind: "inference", work: 10, sustainedPflops: 10 });
		expect(after.ok).toBe(false);
		if (!after.ok) expect(after.reason).toMatch(/not enough idle compute: needs 10 PF, 0 PF idle/);
		// canBuild agrees with submit and never queues.
		const id = sim.state.offers.at(-1)?.id ?? -1;
		expect(sim.canBuild({ type: "acceptContract", contractId: id })).toEqual(sim.submit({ type: "acceptContract", contractId: id }));
	});

	it("SLA penalties apply only once an inference service has started and then falls short", () => {
		const sim = newSim(noOffers(), "farm");
		const spec: ContractSpec = { ...training(), kind: "inference", work: 20, sustainedPflops: 20, durationTicks: 500, payout: 50_000 };
		const jobId = acceptSpec(sim, spec);
		run(sim, 5);
		const job = sim.state.jobs.find((j) => j.id === jobId);
		expect(job?.earned).toBeGreaterThan(0);
		const pen0 = sim.state.today.penalties;
		for (const id of [...(job?.rackIds ?? [])]) {
			const f = sim.state.facilities.find((x) => x.id === id);
			if (f) failRack(sim.state, f, []);
		}
		run(sim, 3);
		expect(sim.state.today.penalties - pen0).toBeGreaterThan(0); // the running service broke its SLA
	});

	it("training that misses its deadline fails with a penalty", () => {
		const sim = newSim(noOffers(), "farm");
		const jobId = acceptSpec(sim, training({ work: 30, durationTicks: 30 }));
		// Feasible when accepted; then every compute rack is switched off, so it can never finish.
		for (const f of sim.state.facilities) if (f.defId === "rack_air_gpu") exec(sim, { type: "setEnabled", facilityId: f.id, enabled: false });
		const pen0 = sim.state.today.penalties;
		const events = run(sim, 40);
		expect(events.find((e) => e.type === "jobFailed")).toEqual({ type: "jobFailed", jobId, penalty: 30_000 });
		expect(sim.state.today.penalties - pen0).toBe(30_000);
	});

	it("cancelJob frees racks and charges the training penalty", () => {
		const sim = newSim(noOffers(), "farm");
		const jobId = acceptSpec(sim, training({ work: 1000 }));
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

describe("deadline feasibility on acceptance", () => {
	it("refuses a training offer the idle racks cannot finish in time, and says how long it would take", () => {
		const sim = newSim(noOffers(), "farm");
		sim.step();
		// 4 idle racks × 20 PF = 80 PF; 1440 PF·h needs 18 h but the deadline is 12 h.
		const r = sim.canBuild({ type: "acceptContract", contractId: pushOffer(sim, training({ work: 1440, durationTicks: 720 })) });
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.reason).toMatch(/too slow for the deadline: your idle racks \(80 PF\) need about 18 h, the deadline allows 12 h/);
	});
	it("accepts the same work with a deadline it can meet", () => {
		const sim = newSim(noOffers(), "farm");
		sim.step();
		expect(sim.canBuild({ type: "acceptContract", contractId: pushOffer(sim, training({ work: 1440, durationTicks: 1440 })) }).ok).toBe(true);
	});
	it("only counts racks left over after running jobs take theirs", () => {
		const sim = newSim(noOffers(), "farm");
		acceptSpec(sim, { ...training({ work: 40 }), kind: "inference", sustainedPflops: 60, work: 60 }); // 3 racks
		// 1 rack left (20 PF): 100 PF·h needs 5 h; deadline 4 h is too short.
		const r = sim.canBuild({ type: "acceptContract", contractId: pushOffer(sim, training({ work: 100, durationTicks: 240 })) });
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.reason).toMatch(/20 PF/);
	});
});

describe("training milestone billing", () => {
	it("pays 80% progressively at checkpoints and the balance on completion, never more than the payout", () => {
		const sim = newSim(noOffers(), "farm");
		sim.step();
		const id = sim.state.nextId.contract++;
		// 80 PF × 300 ticks / 60 = 400 PF·h of work; checkpoints every 60 ticks.
		sim.state.offers.push({ id, spec: training({ work: 400, payout: 100_000, durationTicks: 5000 }), expiresAt: sim.state.tick + 1000 });
		sim.invalidateProjection();
		exec(sim, { type: "acceptContract", contractId: id });
		const rev0 = sim.state.today.revenue;
		run(sim, 125); // two checkpoints in, job still running
		const mid = sim.state.today.revenue - rev0;
		expect(mid).toBeGreaterThan(0);
		expect(mid).toBeLessThan(80_000);
		const events = run(sim, 400);
		expect(events.some((e) => e.type === "jobCompleted")).toBe(true);
		expect(sim.state.today.revenue - rev0).toBeCloseTo(100_000, 6);
	});
});
