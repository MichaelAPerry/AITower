/** Shared helpers for the M2b tests (research, clerk, credit, audits, bots). */
import type { Balance, ContractSpec, EventDef } from "@aitower/content";
import type { ClerkPolicy, SimCommand, SimEvent } from "../api";
import type { SimImpl } from "../sim";
import { exec, makeContent, scenario } from "./fixture";

export const farm = scenario("farm", {
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

export const QUIET_EVENTS: Partial<Balance> = { events: { intervalTicks: 1_000_000_000, graceTicks: 1_000_000_000 } };
export const NO_OFFERS: Partial<Balance> = { economy: { slaPenaltyFactor: 1.5, maxOffers: 0, offerIntervalTicks: 100, offerExpiryTicks: 100 } };

/** Farm content with no random offers, no random memos and no random failures. */
export function farmContent(over: Partial<Balance> = {}, events: EventDef[] = []) {
	const c = makeContent([farm], { ...QUIET_EVENTS, ...NO_OFFERS, tiers: { pflops: [0, 1e9], uptime: [0, 1], reward: [0, 0] }, ...over });
	c.events = events;
	for (const id of ["rack_air_gpu", "rack_storage"]) {
		const r = c.facilities[id].rack;
		if (r) r.failurePerDay = 0;
	}
	return c;
}

export const training = (over: Partial<ContractSpec> = {}): ContractSpec => ({
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

export const inference = (over: Partial<ContractSpec> = {}): ContractSpec => ({
	clientId: "i",
	clientName: "Inference Co",
	kind: "inference",
	work: 20,
	sustainedPflops: 20,
	durationTicks: 720,
	payout: 720_000,
	penalty: 0,
	needsLiquid: false,
	storageTB: 0,
	checkpointTicks: 60,
	...over,
});

/** Inject an offer (not accepted); returns its id. */
export function pushOffer(sim: SimImpl, spec: ContractSpec, expiresIn = 100_000): number {
	const id = sim.state.nextId.contract++;
	sim.state.offers.push({ id, spec, expiresAt: sim.state.tick + expiresIn });
	sim.invalidateProjection();
	return id;
}

/** Inject an offer and accept it by command; returns the job id. */
export function acceptSpec(sim: SimImpl, spec: ContractSpec): number {
	if (sim.state.tick === 0) sim.step(); // power is first solved inside a tick
	const id = pushOffer(sim, spec);
	const started = exec(sim, { type: "acceptContract", contractId: id }).find((e) => e.type === "jobStarted");
	if (started?.type !== "jobStarted") throw new Error("job not started");
	return started.jobId;
}

/** Grant research points directly. */
export function giveRp(sim: SimImpl, points: number): void {
	sim.state.researchPoints = points;
	sim.invalidateProjection();
}

/** Mark nodes researched without paying. */
export function grant(sim: SimImpl, ...ids: string[]): void {
	for (const id of ids) if (!sim.state.techResearched.includes(id)) sim.state.techResearched.push(id);
	sim.invalidateProjection();
}

export const policy = (over: Partial<ClerkPolicy> = {}): ClerkPolicy => ({ enabled: true, kinds: ["training", "finetune", "inference"], minPayPerPflopHour: 0, maxPenalty: 0, allowLiquid: true, ...over });

export const cmdSetClerk = (over: Partial<ClerkPolicy> = {}): SimCommand => ({ type: "setClerk", policy: policy(over) });

export const count = (events: SimEvent[], type: SimEvent["type"]): number => events.filter((e) => e.type === type).length;

export function runCollect(sim: SimImpl, ticks: number): SimEvent[] {
	const out: SimEvent[] = [];
	for (let i = 0; i < ticks; i++) out.push(...sim.step());
	return out;
}

/** Step until `pred` matches an event (or throw). */
export function until(sim: SimImpl, pred: (e: SimEvent) => boolean, max = 20_000): SimEvent {
	for (let i = 0; i < max; i++) for (const e of sim.step()) if (pred(e)) return e;
	throw new Error("event never happened");
}
