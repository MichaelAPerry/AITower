/**
 * Self-contained ContentDB for sim tests (does not depend on @aitower/content data, types only).
 * Numbers mirror the MVP balance targets in tasks/agent-assets.md.
 */
import type { Balance, BotDef, ContentDB, ContractSpec, FacilityDef, PerkKind, Scenario, TechNode } from "@aitower/content";
import type { SimCommand, SimEvent } from "../api";
import { SimImpl } from "../sim";
import { createState } from "../world/init";

const fac = (d: Omit<FacilityDef, "name" | "description" | "color" | "accent" | "upkeepPerDay" | "unlockTier"> & Partial<FacilityDef>): FacilityDef => ({
	name: d.id,
	description: d.id,
	color: "#333333",
	accent: "#00ffff",
	upkeepPerDay: 100,
	unlockTier: 1,
	...d,
});

export const facilities: Record<string, FacilityDef> = Object.fromEntries(
	[
		fac({ id: "rack_air_gpu", kind: "rack", category: "rack", width: 2, cost: 400_000, facilityKw: 0, rack: { cooling: "air", powerKw: 40, liquidFraction: 0, pflops: 20, storageTB: 0, failurePerDay: 0.02 } }),
		fac({ id: "rack_dlc_gpu", kind: "rack", category: "rack", width: 2, cost: 1_000_000, facilityKw: 0, rack: { cooling: "dlc", powerKw: 120, liquidFraction: 0.8, pflops: 90, storageTB: 0, failurePerDay: 0.02 } }),
		fac({ id: "rack_storage", kind: "rack", category: "rack", width: 2, cost: 150_000, facilityKw: 0, rack: { cooling: "air", powerKw: 12, liquidFraction: 0, pflops: 0, storageTB: 2000, failurePerDay: 0.01 } }),
		fac({ id: "crah_unit", kind: "crah", category: "cooling", width: 2, cost: 120_000, facilityKw: 8, cooling: { capacityKw: 150, radius: 8 } }),
		fac({ id: "chiller", kind: "chiller", category: "cooling", width: 4, cost: 900_000, facilityKw: 0, cooling: { capacityKw: 600, cop: 5 }, placement: { needsCoolant: true } }),
		fac({ id: "cdu", kind: "cdu", category: "cooling", width: 2, cost: 300_000, facilityKw: 4, cooling: { capacityKw: 400 }, placement: { needsCoolant: true } }),
		fac({ id: "grid_tie", kind: "grid_tie", category: "power", width: 4, cost: 250_000, facilityKw: 0, power: { capacityKw: 1500 }, placement: { maxFloor: 0 } }),
		fac({ id: "genset", kind: "genset", category: "power", width: 4, cost: 300_000, facilityKw: 0, power: { capacityKw: 800, startDelayTicks: 10, costPerKwh: 0.35 }, placement: { maxFloor: 0 } }),
		fac({ id: "ups_battery", kind: "ups", category: "power", width: 3, cost: 200_000, facilityKw: 0, power: { capacityKw: 500, storageKwh: 250, efficiency: 0.95 } }),
		fac({ id: "parts_depot", kind: "depot", category: "logistics", width: 3, cost: 50_000, facilityKw: 0, logistics: { capacity: 20 } }),
		fac({ id: "bot_charger", kind: "charger", category: "logistics", width: 2, cost: 40_000, facilityKw: 0, logistics: { capacity: 2, chargeKw: 5 } }),
		fac({ id: "rack_gated", kind: "rack", category: "rack", width: 2, cost: 100_000, facilityKw: 0, tech: "t_racks", rack: { cooling: "air", powerKw: 40, liquidFraction: 0, pflops: 20, storageTB: 0, failurePerDay: 0.02 } }),
		fac({ id: "tier2_thing", kind: "depot", category: "logistics", width: 1, cost: 1, facilityKw: 0, unlockTier: 2, logistics: { capacity: 1 } }),
	].map((d) => [d.id, d]),
);

export const bots: Record<string, BotDef> = {
	rover: { id: "rover", name: "Rover", cost: 50_000, speed: 0.25, batteryTicks: 600, repairTicks: 30, color: "#00aaaa" },
	/** Flies straight between floors (no lift). */
	drone: { id: "drone", name: "Drone", cost: 80_000, speed: 0.5, batteryTicks: 600, repairTicks: 30, color: "#aa00aa", flying: true },
	/** Carries three parts per depot trip. */
	hauler: { id: "hauler", name: "Hauler", cost: 90_000, speed: 0.25, batteryTicks: 600, repairTicks: 30, color: "#aaaa00", carry: 3 },
	/** Needs research. */
	gated_bot: { id: "gated_bot", name: "Gated bot", cost: 10_000, speed: 0.25, batteryTicks: 600, repairTicks: 30, color: "#ffffff", tech: "t_bots" },
};

const node = (id: string, over: Partial<TechNode> = {}): TechNode => ({
	id,
	name: `Node ${id}`,
	description: id,
	branch: "administration",
	minTier: 1,
	cost: 10,
	requires: [],
	effects: [],
	...over,
});
const perkNode = (id: string, kind: PerkKind, factor: number): TechNode => node(id, { cost: 1, effects: [{ type: "perk", kind, factor }] });

/** A small tech tree for tests: the clerk, gating nodes, a prerequisite chain, a tier-gated node and one node per perk. */
export const tech: TechNode[] = [
	node("t_clerk", { name: "Contracts Clerk", cost: 10, effects: [{ type: "feature", feature: "contractsClerk" }] }),
	node("t_racks", { name: "Cheap Racks", cost: 20, branch: "compute" }),
	node("t_bots", { name: "Gated Bots", cost: 15, branch: "logistics" }),
	node("t_chain", { name: "Chained Node", cost: 5, requires: ["t_clerk"] }),
	node("t_tier2", { name: "Clearance Node", cost: 5, minTier: 2 }),
	perkNode("p_fail", "failureRate", 0.5),
	perkNode("p_energy", "energyPrice", 0.5),
	perkNode("p_payout", "payout", 2),
	perkNode("p_cool", "coolingCapacity", 2),
	perkNode("p_repair", "repairSpeed", 2),
	perkNode("p_upkeep", "upkeep", 0.5),
	perkNode("p_rate", "researchRate", 2),
	perkNode("p_speed", "botSpeed", 2),
	perkNode("p_payout2", "payout", 1.5),
];

export const balance: Balance = {
	startingCash: 50_000_000,
	energyPrice: 0.08,
	energyPriceByHour: [0.6, 0.6, 0.6, 0.6, 0.6, 0.7, 0.9, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.1, 1.5, 1.5, 1.5, 1.2, 1, 0.8, 0.7],
	ambientMeanC: 22,
	ambientSwingC: 6,
	thermal: {
		airCellHeatCapacity: 600,
		airConductance: 2,
		slabConductance: 0.5,
		envelopeConductance: 0.05,
		buoyancy: 1,
		rackEase: 0.1,
		rackDeltaC: 40,
		okC: 80,
		throttleC: 90,
		tripC: 95,
		tripHysteresisC: 8,
		minClock: 0.6,
		tripCooldownTicks: 30,
		coolantSupplyC: 30,
		hazardPerDegree: 0.1,
	},
	economy: { slaPenaltyFactor: 1.5, maxOffers: 4, offerIntervalTicks: 180, offerExpiryTicks: 720 },
	tiers: { pflops: [0, 60, 300, 1000], uptime: [0, 0.95, 0.98, 0.995], reward: [0, 500_000, 2_000_000, 5_000_000] },
	standing: { start: 50, dailyGood: 1, dailyBad: -3, jobFailed: -4, jobCompleted: 1 },
	events: { intervalTicks: 720, maxOpen: 3, graceTicks: 1440 },
	research: { pointsPerPflopHour: 0.01, pointsPerJob: 5 },
	clerk: { feeShare: 0.05 },
	loans: { maxByTier: [2_000_000, 6_000_000, 15_000_000, 40_000_000], dailyRate: 0.004 },
	tax: { profitShare: 0 },
	audit: { periodDays: 7, standingByGrade: [4, 2, 0, -3, -6], cashShareByGrade: [0.05, 0.02, 0, -0.02, -0.05] },
};

/** Deterministic, tiny contract generator (rng only). */
export function fixtureGenerator(rng: () => number, ctx: { capacityPflops: number; tier: number; day: number }): ContractSpec {
	const cap = Math.max(20, ctx.capacityPflops);
	if (rng() < 0.5) {
		const sustained = Math.round(cap * (0.2 + 0.3 * rng()));
		return {
			clientId: "c_inf",
			clientName: "Inference Co",
			kind: "inference",
			work: sustained,
			sustainedPflops: sustained,
			durationTicks: 720,
			payout: sustained * 400,
			penalty: 0,
			needsLiquid: false,
			storageTB: 0,
			checkpointTicks: 60,
		};
	}
	const work = Math.round(cap * (2 + 6 * rng()));
	return {
		clientId: "c_train",
		clientName: "Training Lab",
		kind: "training",
		work,
		durationTicks: 2880,
		payout: work * 300,
		penalty: work * 100,
		needsLiquid: false,
		storageTB: 0,
		checkpointTicks: 60,
	};
}

const emptyScenario: Scenario = {
	id: "empty",
	name: "Empty lot",
	width: 48,
	floorMin: -2,
	floorMax: 10,
	slabs: [],
	facilities: [],
	conduits: [],
	lifts: [],
	bots: [],
	spareParts: 0,
};

/** Mirrors the real starter layout (with a storage rack). */
const starter: Scenario = {
	id: "starter",
	name: "Starter",
	width: 48,
	floorMin: -2,
	floorMax: 10,
	slabs: [
		[-1, 4, 43],
		[0, 0, 47],
		[1, 4, 43],
	],
	facilities: [
		{ defId: "grid_tie", floor: -1, x: 6 },
		{ defId: "bot_charger", floor: 0, x: 26 },
		{ defId: "parts_depot", floor: 0, x: 29 },
		{ defId: "rack_air_gpu", floor: 1, x: 6 },
		{ defId: "rack_air_gpu", floor: 1, x: 8 },
		{ defId: "rack_air_gpu", floor: 1, x: 10 },
		{ defId: "rack_air_gpu", floor: 1, x: 12 },
		{ defId: "crah_unit", floor: 1, x: 14 },
		{ defId: "rack_storage", floor: 1, x: 16 },
	],
	conduits: [
		["power", -1, 4, 43],
		["power", 0, 4, 43],
		["power", 1, 4, 43],
	],
	lifts: [{ x: 24, floorMin: -1, floorMax: 1 }],
	bots: [{ defId: "rover", floor: 0, x: 27 }],
	spareParts: 4,
};

export function makeContent(extraScenarios: Scenario[] = [], balanceOverride: Partial<Balance> = {}): ContentDB {
	const scenarios: Record<string, Scenario> = { empty: emptyScenario, starter };
	for (const s of extraScenarios) scenarios[s.id] = s;
	return {
		facilities: JSON.parse(JSON.stringify(facilities)) as Record<string, FacilityDef>,
		bots: JSON.parse(JSON.stringify(bots)) as Record<string, BotDef>,
		clients: [],
		tech: JSON.parse(JSON.stringify(tech)) as TechNode[],
		structure: {
			slabPerTile: 2_000,
			basementSlabPerTile: 5_000,
			powerConduitPerTile: 500,
			coolantConduitPerTile: 1_500,
			liftPerFloor: 20_000,
			liftBase: 100_000,
			sparePart: 10_000,
		},
		lift: { speed: 0.2, capacity: 2, dwellTicks: 4, facilityKw: 10 },
		balance: { ...balance, ...balanceOverride },
		scenarios,
		events: [],
		generateContract: fixtureGenerator,
	};
}

/** A scenario built from `empty` with overrides. */
export const scenario = (id: string, over: Partial<Scenario>): Scenario => ({ ...emptyScenario, ...over, id });

export function newSim(content: ContentDB, scenarioId = "empty", seed = 1): SimImpl {
	return new SimImpl(content, createState(content, scenarioId, seed));
}

/** Submit (asserting pre-validation passes) and run one tick; returns that tick's events. */
export function exec(sim: SimImpl, ...cmds: SimCommand[]): SimEvent[] {
	for (const c of cmds) {
		const r = sim.submit(c);
		if (!r.ok) throw new Error(`command ${c.type} rejected: ${r.reason}`);
	}
	return sim.step();
}

export function run(sim: SimImpl, ticks: number): SimEvent[] {
	const all: SimEvent[] = [];
	for (let i = 0; i < ticks; i++) all.push(...sim.step());
	return all;
}

export const rowCells = (floor: number, x0: number, x1: number): { x: number; floor: number }[] => {
	const cells = [];
	for (let x = x0; x <= x1; x++) cells.push({ x, floor });
	return cells;
};

/** Lowest-id facility with a def id. */
export const facilityOf = (sim: SimImpl, defId: string, nth = 0) => sim.state.facilities.filter((f) => f.defId === defId)[nth];
