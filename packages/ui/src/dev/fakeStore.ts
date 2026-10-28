/**
 * Dev-only fake GameStore backed by a hand-built SimView fixture. Uses content *types* only and a small
 * local facility list (real content data is written in parallel). Not exported from the package index.
 */
import { type ContentDB, type EventDef, type FacilityDef, retrofitCost, retrofitTarget, type Scenario, type TechNode } from "@aitower/content";
import type { AuditGrade, CommandResult, EndingId, FacilityView, GameOverKind, JobView, LedgerDay, DecisionView, MetricSample, ModifierView, QuarterReport, SimCommand, SimEvent, SimView } from "@aitower/sim";
import { createFakeSaves } from "./fakeSaves";
import { type GameState, type GameStore, type Ghost, DEFAULT_SETTINGS, cellIndex, inBounds, normalizeSettings } from "@aitower/shared";

const fac = (d: Partial<FacilityDef> & Pick<FacilityDef, "id" | "name" | "kind" | "category" | "cost" | "color" | "accent">): FacilityDef => ({
	description: "",
	width: 1,
	upkeepPerDay: Math.round(d.cost / 200),
	unlockTier: 1,
	facilityKw: 0,
	...d,
});

const FAKE_EVENTS: EventDef[] = [
	{
		id: "heatwave",
		category: "environmental",
		advisor: "cass",
		recommended: "credits",
		title: "Notice of Unseasonable Warmth",
		body: "Outside air will run 8 °C warm for fourteen hours. Chilled-water credits cost $12k and hold the rise to 4 °C.",
		weight: 1,
		minTier: 1,
		cooldownDays: 5,
		choices: [
			{ id: "credits", label: "BUY CREDITS", hint: "Pay $12k now. The heatwave is only +4 °C for 14 h.", outcome: "Credits purchased. The Weather Bureau thanks you for your cheque.", effects: [{ type: "cash", amount: -12_000 }] },
			{ id: "endure", label: "FILE IN TRIPLICATE", hint: "Free. Outside air +8 °C for 14 h; failures run higher.", outcome: "Filed. The heat is noted and will not be discussed further.", effects: [] },
		],
	},
	{
		id: "audit",
		category: "ministry",
		advisor: "luci",
		recommended: "comply",
		title: "Form A-9: Surprise Inspection",
		body: "An Inspector will visit tomorrow to count your cables. Complying is free; protesting costs 10 days of goodwill.",
		weight: 1,
		minTier: 1,
		cooldownDays: 5,
		choices: [
			{ id: "bribe", label: "OFFER TEA", hint: "Pay $5k. No inspection.", outcome: "The Inspector enjoyed the tea.", effects: [] },
			{ id: "comply", label: "COMPLY", hint: "Free.", outcome: "The Inspector counted 4,112 cables and left.", effects: [] },
			{ id: "protest", label: "PROTEST", hint: "The Inspector notes your attitude.", outcome: "Your protest was received and shredded.", effects: [] },
		],
	},
];

const BRANCH_LANE = { compute: "comp", cooling: "cool", power: "pow", logistics: "log", administration: "adm", wetware: "wet" } as const;
const tn = (t: Partial<TechNode> & Pick<TechNode, "id" | "name" | "branch" | "cost">): TechNode => ({ description: "Filed in triplicate.", minTier: 1, requires: [], effects: [], lane: BRANCH_LANE[t.branch], ...t });

/** A small tree for the dev harness and tests: two or three nodes per branch, the clerk first. */
export const FAKE_TECH: TechNode[] = [
	tn({ id: "adm_clerk", name: "Form 9: Delegation of Signature", branch: "administration", cost: 30, description: "Hire a Contracts Clerk to stamp offers on your behalf. The clerk keeps a share of each job.", effects: [{ type: "feature", feature: "contractsClerk" }] }),
	tn({ id: "adm_filing", name: "Pneumatic Filing", branch: "administration", cost: 60, minTier: 2, requires: ["adm_clerk"], description: "Research moves faster when the tubes do not jam.", effects: [{ type: "perk", kind: "researchRate", factor: 1.2 }] }),
	tn({ id: "cmp_burnin", name: "Burn-in Protocol", branch: "compute", cost: 20, description: "Racks are tortured before use so they fail less in service.", effects: [{ type: "perk", kind: "failureRate", factor: 0.9 }] }),
	tn({ id: "cmp_binning", name: "Silicon Binning", branch: "compute", cost: 90, minTier: 2, requires: ["cmp_burnin"], description: "Only the best chips reach clients.", effects: [{ type: "perk", kind: "payout", factor: 1.05 }, { type: "perk", kind: "failureRate", factor: 0.95 }] }),
	tn({ id: "cmp_cluster", name: "Cluster Fabric", branch: "compute", cost: 240, minTier: 3, requires: ["cmp_binning"], description: "A cable per rack, in triplicate.", effects: [{ type: "perk", kind: "payout", factor: 1.1 }] }),
	tn({ id: "cool_exchange", name: "Heat Exchange Theory", branch: "cooling", cost: 25, description: "Teaches the Ministry what a chiller is.", effects: [{ type: "perk", kind: "coolingCapacity", factor: 1.1 }] }),
	tn({ id: "cool_loops", name: "Closed Loop Plumbing", branch: "cooling", cost: 120, minTier: 2, requires: ["cool_exchange"], description: "Less water on the floor.", effects: [{ type: "perk", kind: "coolingCapacity", factor: 1.15 }, { type: "perk", kind: "upkeep", factor: 0.95 }] }),
	tn({ id: "pow_tariff", name: "Off-peak Tariff Forms", branch: "power", cost: 35, description: "A form that lowers the electricity bill.", effects: [{ type: "perk", kind: "energyPrice", factor: 0.92 }] }),
	tn({ id: "pow_storage", name: "Battery Lobbying", branch: "power", cost: 150, minTier: 3, requires: ["pow_tariff"], description: "More lobbying, less price.", effects: [{ type: "perk", kind: "energyPrice", factor: 0.9 }] }),
	tn({ id: "log_wrench", name: "Torque Wrench Standard", branch: "logistics", cost: 25, description: "Bots repair faster with the right wrench.", effects: [{ type: "perk", kind: "repairSpeed", factor: 1.25 }] }),
	tn({ id: "log_drone", name: "Rotary Aviation Licence", branch: "logistics", cost: 110, minTier: 2, requires: ["log_wrench"], description: "Bots may now fly between floors, with paperwork.", effects: [{ type: "perk", kind: "botSpeed", factor: 1.2 }] }),
];

export function createFakeContent(): ContentDB {
	const facilities: FacilityDef[] = [
		fac({ id: "rack_air_gpu", name: "GPU Rack (air)", kind: "rack", category: "rack", cost: 42_000, color: "#2b3442", accent: "#4fd8ff", width: 1, description: "8× air-cooled accelerators. Cheap and simple, but dumps all its heat into the room.", rack: { cooling: "air", powerKw: 18, liquidFraction: 0, pflops: 2.4, storageTB: 0, failurePerDay: 0.01 } }),
		fac({ id: "rack_gpu_dlc", name: "GPU Rack (DLC)", kind: "rack", category: "rack", cost: 95_000, color: "#26303e", accent: "#59a8ff", width: 1, unlockTier: 2, facilityKw: 0.4, description: "Direct-liquid-cooled dense rack. 80% of the heat leaves through the coolant loop.", rack: { cooling: "dlc", powerKw: 45, liquidFraction: 0.8, pflops: 7.2, storageTB: 0, failurePerDay: 0.012 }, placement: { needsCoolant: true } }),
		fac({ id: "rack_storage", name: "Storage Array", kind: "rack", category: "rack", cost: 28_000, color: "#2f2f3a", accent: "#b08cff", description: "Dense NVMe shelves holding training datasets.", rack: { cooling: "air", powerKw: 6, liquidFraction: 0, pflops: 0, storageTB: 400, failurePerDay: 0.006 } }),
		fac({ id: "grid_tie", name: "Grid Tie 1 MW", kind: "grid_tie", category: "power", cost: 60_000, color: "#3a3320", accent: "#ffb547", width: 2, description: "Utility connection. Imports up to 1 MW at the market price.", power: { capacityKw: 1000 } }),
		fac({ id: "genset", name: "Diesel Genset", kind: "genset", category: "power", cost: 85_000, color: "#3b2a1e", accent: "#ff8a4c", width: 3, description: "Backup generator. Starts 2 minutes after a shortfall.", power: { capacityKw: 500, startDelayTicks: 2, costPerKwh: 0.32 } }),
		fac({ id: "ups", name: "UPS Battery", kind: "ups", category: "power", cost: 38_000, color: "#1f3328", accent: "#3ff2a0", width: 2, description: "Bridges the gap until the genset spins up.", power: { capacityKw: 300, storageKwh: 120, efficiency: 0.94 } }),
		fac({ id: "crah", name: "CRAH Unit", kind: "crah", category: "cooling", cost: 24_000, color: "#1d3038", accent: "#7fe3ff", width: 2, facilityKw: 4, description: "Computer-room air handler. Pulls room air toward 20 °C within its reach.", cooling: { capacityKw: 120, radius: 6 } }),
		fac({ id: "chiller", name: "Chiller", kind: "chiller", category: "cooling", cost: 110_000, color: "#1b2c3f", accent: "#59a8ff", width: 3, unlockTier: 2, tech: "cool_exchange", description: "Rejects coolant-loop heat outdoors. COP derates in hot weather.", cooling: { capacityKw: 400, cop: 5 } }),
		fac({ id: "cdu", name: "CDU", kind: "cdu", category: "cooling", cost: 32_000, color: "#1a2836", accent: "#4fd8ff", unlockTier: 2, facilityKw: 2, description: "Coolant distribution unit feeding liquid racks.", cooling: { capacityKw: 300 }, placement: { needsCoolant: true } }),
		fac({ id: "immersion", name: "Immersion Tank", kind: "rack", category: "rack", cost: 240_000, color: "#14303a", accent: "#3ff2a0", width: 2, unlockTier: 3, description: "Two-phase immersion. Absurd density.", rack: { cooling: "immersion", powerKw: 120, liquidFraction: 1, pflops: 20, storageTB: 0, failurePerDay: 0.008 } }),
		fac({ id: "depot", name: "Parts Depot", kind: "depot", category: "logistics", cost: 12_000, color: "#2d2a22", accent: "#ffd34d", width: 2, description: "Shelving for spare parts.", logistics: { capacity: 40 } }),
		fac({ id: "charger", name: "Bot Dock", kind: "charger", category: "logistics", cost: 9_000, color: "#22303a", accent: "#8fffdd", description: "Bots spawn and recharge here.", logistics: { capacity: 2, chargeKw: 3 } }),
		fac({ id: "nutrient_plant", name: "Nutrient Plant", kind: "nutrient", category: "cooling", cost: 180_000, color: "#1d3a2a", accent: "#7cf0b0", width: 2, unlockTier: 3, facilityKw: 20, description: "Feeds a nutrient line. Organoid racks starve without it.", bio: { nutrientCapacity: 20 } }),
		fac({ id: "organoid_incubator", name: "Organoid Incubator", kind: "rack", category: "rack", cost: 320_000, color: "#2a3a33", accent: "#9b8cff", unlockTier: 3, description: "Cultured tissue that computes. Wants 37 °C and a nutrient line.", rack: { cooling: "bio", powerKw: 12, liquidFraction: 0, pflops: 30, storageTB: 0, failurePerDay: 0.01, bio: { targetC: 37, toleranceC: 1, nutrientUse: 3, contamination: 0.002 } }, placement: { needsNutrient: true } }),
		fac({ id: "sterile_bay", name: "Sterile Bay", kind: "sterilizer", category: "cooling", cost: 90_000, color: "#243a40", accent: "#5fd4e6", unlockTier: 3, facilityKw: 6, description: "Removes contamination within reach.", bio: { cleanRate: 0.0012, radius: 6 } }),
		fac({ id: "growth_mass", name: "Growth Mass", kind: "rack", category: "rack", cost: 0, color: "#3a2a33", accent: "#ff5d5d", growth: true, description: "", rack: { cooling: "bio", powerKw: 0, liquidFraction: 0, pflops: 0, storageTB: 0, failurePerDay: 0, bio: { targetC: 37, toleranceC: 8, nutrientUse: 0, contamination: 0 } }, bio: { contamination: 0.002 } }),
	];
	return {
		facilities: Object.fromEntries(facilities.map((f) => [f.id, f])),
		bots: {
			techbot: { id: "techbot", name: "TechBot", cost: 15_000, speed: 0.5, batteryTicks: 600, repairTicks: 30, color: "#8fffdd" },
			drone: { id: "drone", name: "Rotor Drone", cost: 30_000, speed: 0.8, batteryTicks: 400, repairTicks: 30, color: "#ffd34d", tech: "log_drone", flying: true, carry: 2 },
		},
		paths: [
			{ id: "biotech", name: "Biotech", description: "Cultured tissue computes cheaply. Feed the Annex, hold the jars at 37 °C. The Ministry assures you it is under control." },
			{ id: "greentech", name: "Greentech", description: "Coming soon." },
			{ id: "synthetic", name: "Synthetic Mind", description: "Coming soon." },
		],
		endings: [
			{ id: "singularity", title: "The Lattice", body: "The tower stopped asking for permission.\n\nNobody noticed.", backdrop: "synthetic" },
			{ id: "flesh", title: "The Flesh Remembers", body: "The annex grew through the basement first.\n\nThen the city.", backdrop: "biotech" },
			{ id: "garden", title: "The Garden", body: "The tower stopped burning anything at all.\n\nThen it started to grow.", backdrop: "greentech" },
			{ id: "absorbed", title: "Absorbed", body: "The facility and its superintendent have been reclassified as Ministry assets.\n\nNo further correspondence is required." },
		],
		clients: [],
		structure: { slabPerTile: 1_200, basementSlabPerTile: 3_000, powerConduitPerTile: 150, coolantConduitPerTile: 400, liftPerFloor: 6_000, liftBase: 20_000, sparePart: 800 },
		lift: { speed: 0.1, capacity: 2, dwellTicks: 2, facilityKw: 3 },
		balance: {
			startingCash: 1_000_000,
			energyPrice: 0.11,
			energyPriceByHour: Array.from({ length: 24 }, () => 1),
			ambientMeanC: 18,
			ambientSwingC: 6,
			thermal: { airCellHeatCapacity: 50, airConductance: 1, slabConductance: 0.3, envelopeConductance: 0.2, buoyancy: 0.2, rackEase: 0.05, rackDeltaC: 25, okC: 65, throttleC: 80, tripC: 92, tripHysteresisC: 8, minClock: 0.4, tripCooldownTicks: 30, coolantSupplyC: 30, hazardPerDegree: 0.1 },
			economy: { slaPenaltyFactor: 1.5, maxOffers: 4, offerIntervalTicks: 240, offerExpiryTicks: 720 },
			tiers: { techs: [0, 2, 6, 14, 26], pflops: [0, 20, 80, 250, 1000], uptime: [0, 0.99, 0.995, 0.999, 0.9999], reward: [0, 100_000, 300_000, 1_000_000, 3_000_000] },
			events: { intervalTicks: 720, graceTicks: 1440 },
			research: { pointsPerPflopHour: 0.01, pointsPerJob: 5 },
			clerk: { feeShare: 0.05 },
			loans: { maxByTier: [2_000_000, 6_000_000, 15_000_000, 40_000_000], dailyRate: 0.004 },
			tax: { profitShare: 0 },
			bio: { diffusion: 0.05, slabFactor: 0.3, decay: 0.0005, quarantineLeak: 0.05, hazardPerContamination: 2, botSlowPerContamination: 0.5, mutationThreshold: 0.5, mutationExposureTicks: 720, growthThreshold: 0.7, growthChancePerDay: 0.05, irreversibleShare: 0.4, irreversibleCleanFactor: 0.25, nutrientPrice: 2 },
			green: { heatPrice: 3, creditPrice: 40, droughtChancePerDay: 0.08, droughtFactor: 0.1, droughtHours: 18 },
			automation: { partsBatch: 5, foremanPerHour: 1 },
			ascension: { minTier: 5 },
			endings: { absorbed: { corruption: 1 } },
			soul: { spTarget: 1000, spPerPflopHour: 0.0014, spWeights: { synthetic: 2, biotech: 1.5, greentech: 2.5 }, greenFloor: 0.5, sealMax: 100, residuePerDay: 0.03, objectionScar: 10, bondStart: { cass: 20, bea: 20, mel: 20, luci: 30 }, bondEpilogue: 60, bondFollow: 3, bondOverrule: -1 },
			audit: { periodDays: 7, cashShareByGrade: [0.05, 0.02, 0, -0.02, -0.05] },
		},
		scenarios: FAKE_SCENARIOS,
		lessons: [],
		events: FAKE_EVENTS,
		tech: FAKE_TECH,
		generateContract: () => ({ clientId: "x", clientName: "X", kind: "training", work: 100, durationTicks: 1440, payout: 1, penalty: 0, needsLiquid: false, storageTB: 0, checkpointTicks: 60 }),
	};
}

const lot = (id: string, name: string, extra: Partial<Scenario> = {}): Scenario => ({ id, name, width: 40, floorMin: -1, floorMax: 9, slabs: [], facilities: [], conduits: [], lifts: [], bots: [], spareParts: 0, ...extra });

/** The three lots of the real content, cut down: the standard start (no description of its own), a brownfield and a sandbox. */
const FAKE_SCENARIOS: Record<string, Scenario> = {
	starter: lot("starter", "Garage Cluster"),
	brownfield: lot("brownfield", "Auction Lot", { description: "An old half-built tower, bought at auction with the debts attached. Starts at Clearance 2.", startingCash: 350_000, startTier: 2 }),
	sandbox: lot("sandbox", "Test Lot", { description: "A fully funded test lot with no bankruptcy. Try anything once.", startingCash: 500_000_000, startTier: 5, sandbox: true }),
};

function buildView(content: ContentDB, scenarioId?: string): SimView {
	const sc = scenarioId ? content.scenarios[scenarioId] : undefined;
	const width = 40;
	const floorMin = -1;
	const floorMax = 9;
	const n = width * (floorMax - floorMin + 1);
	const v: SimView = {
		tick: 12 * 1440 + 500,
		day: 12,
		minuteOfDay: (500 + 360) % 1440,
		width,
		floorMin,
		floorMax,
		slab: new Uint8Array(n),
		power: new Uint8Array(n),
		coolant: new Uint8Array(n),
		airTemp: new Float32Array(n).fill(24),
		powerNetOf: new Int32Array(n).fill(-1),
		coolantNetOf: new Int32Array(n).fill(-1),
		ambientC: 21.4,
		facilities: [],
		lifts: [{ id: 1, x: 2, floorMin: -1, floorMax: 4, carFloor: 2.4, dir: 1, doorsOpen: false, riders: 1 }],
		bots: [
			{ id: 1, defId: "techbot", x: 14.3, floor: 2, state: "toTarget", battery: 0.72, carrying: true, workOrderId: 3, trait: null },
			{ id: 2, defId: "techbot", x: 5, floor: 0, state: "charging", battery: 0.31, carrying: false, workOrderId: null, trait: null },
		],
		powerNets: [{ id: 1, supplyKw: 1500, demandKw: 812, satisfaction: 1, storedKwh: 96, storageCapacityKwh: 120, gridImportKw: 812 }],
		coolantNets: [{ id: 1, capacityKw: 300, loadKw: 212, supplyTempC: 30 }],
		offers: [
			{ id: 41, clientId: "frontier", clientName: "Helix Labs", kind: "training", work: 4200, durationTicks: 4320, payout: 680_000, penalty: 120_000, needsLiquid: true, storageTB: 600, checkpointTicks: 120, expiresAt: 12 * 1440 + 640 },
			{ id: 42, clientId: "fin", clientName: "Quantmere Capital", kind: "inference", work: 8, sustainedPflops: 8, durationTicks: 2880, payout: 240_000, penalty: 0, needsLiquid: false, storageTB: 0, checkpointTicks: 0, expiresAt: 12 * 1440 + 1100 },
			{ id: 43, clientId: "bio", clientName: "Genefold Bio", kind: "finetune", work: 380, durationTicks: 1440, payout: 92_000, penalty: 15_000, needsLiquid: false, storageTB: 120, checkpointTicks: 60, expiresAt: 12 * 1440 + 560 },
		],
		jobs: [],
		workOrders: [{ id: 3, facilityId: 6, botId: 1, createdAt: 12 * 1440 + 430, queuePos: null, route: "ok" }],
		maintenance: { parts: 3, partsCapacity: 20, botsTotal: 2, botsBusy: 1, botsIdle: 1, waiting: 0, noRoute: 0 },
		cash: 1_284_560,
		spareParts: 7,
		tier: 2,
		energyPrice: 0.124,
		pue: 1.38,
		uptime: 0.9962,
		itKw: 642,
		totalKw: 886,
		pflops: 54.3,
		ledger: [],
		history: [],
		bankrupt: false,
		decision: null,
		decisionReturnsAt: null,
		decisionGate: true,
		decisionHistory: [],
		advisorTips: [],
		lesson: null,
		modifiers: [],
		uptimeTarget: 0.95,
		tierNeed: { tier: 2, pflops: 20, uptime: 0.99, techs: 2, techsDone: 0 },
		researchPoints: 42,
		techResearched: [],
		clerk: { unlocked: false, policy: { enabled: false, kinds: ["training", "finetune", "inference"], minPayPerPflopHour: 0, maxPenalty: 0, allowLiquid: true }, acceptedTotal: 0 },
		loan: { principal: 400_000, max: 6_000_000, dailyRate: 0.004 },
		reports: [
			{ quarter: 1, fromDay: 0, toDay: 6, revenue: 310_000, costs: 1_420_000, uptime: 0.981, pue: 1.52, jobsCompleted: 3, jobsFailed: 1, penalties: 25_000, grade: "D", cashDelta: -20_000, remark: "The Ministry notes that construction is not, strictly speaking, a revenue stream." },
		],
		stats: { revenue: 2_120_000, pflopHours: 8_450, jobsCompleted: 21, jobsFailed: 2, peakPflops: 61.2, facilitiesBuilt: 47, componentFailures: 6, repairs: 5, decisionsMade: 3, researchPointsEarned: 42 },
		nutrient: new Uint8Array(n),
		nutrientNetOf: new Int32Array(n).fill(-1),
		contamination: new Float32Array(n),
		nutrientNets: [],
		corruption: 0,
		contaminatedShare: 0,
		irreversible: false,
		path: null,
		organoidPflops: 0,
		soul: { sp: { synthetic: 0, biotech: 0, greentech: 0 }, spTarget: 1000, seal: { biotech: 0, greentech: 0 }, sealMax: 100, bonds: { cass: 20, bea: 20, mel: 20, luci: 30 }, bondEpilogue: 60, trees: { synthetic: { tree: "synthetic", sp: 0, spPerDay: 0, daysToWin: null, rung: 0, racks: 0, pflops: 0, installedPflops: 0, factor: 1, seal: null, closed: false, hurting: [] }, biotech: { tree: "biotech", sp: 0, spPerDay: 0, daysToWin: null, rung: 0, racks: 0, pflops: 0, installedPflops: 0, factor: 1, seal: 0, closed: false, hurting: [] }, greentech: { tree: "greentech", sp: 0, spPerDay: 0, daysToWin: null, rung: 0, racks: 0, pflops: 0, installedPflops: 0, factor: 0.5, seal: 0, closed: false, hurting: [] } }, green: { score: 0, cleanPower: 0, heatShare: 0, speed: 0.5 } },
		affinity: { biotech: 0, greentech: 0, synthetic: 0 },
		pathScore: 0,
		greenScore: 0,
		refinement: 0,
		drought: false,
		sandbox: false,
		automation: { policy: { research: { enabled: false, branches: [] }, parts: { enabled: false, keep: 4 }, bots: { enabled: false, racksPerBot: 12, maxBots: 8 }, foreman: { enabled: false, reserve: 1_000_000, racks: true, cooling: true, power: true, rackLine: "auto", rackCap: "auto", coolingCap: "auto", powerCap: "auto" } }, foremanUnlocked: false, foremanStatus: [], foremanPerHour: 1 },
		gameOver: null,
	};
	for (let f = -1; f <= 6; f++) for (let x = f < 0 ? 2 : 0; x < (f < 0 ? 20 : f > 4 ? 24 : 36); x++) v.slab[cellIndex(v, x, f)] = 1;
	for (let f = 0; f <= 4; f++) for (let x = 0; x < 34; x++) v.power[cellIndex(v, x, f)] = 1;
	for (let x = 4; x < 30; x++) v.coolant[cellIndex(v, x, 3)] = 1;

	let id = 1;
	const put = (defId: string, floor: number, x: number, extra: Partial<FacilityView> = {}): void => {
		const d = content.facilities[defId];
		v.facilities.push({ id: id++, defId, floor, x, width: d.width, enabled: true, status: "ok", tempC: 24, clock: 1, health: 1, powerKw: d.rack?.powerKw ?? d.facilityKw, heatKw: d.rack?.powerKw ?? 0, jobId: null, powerNet: 1, coolantNet: null, nutrientNet: null, grown: false, contamination: 0, ...extra });
	};
	put("grid_tie", 0, 6);
	put("genset", 0, 9, { running: false, powerKw: 0 });
	put("ups", 0, 13, { charge: 0.8 });
	for (let i = 0; i < 8; i++) put("rack_air_gpu", 2, 8 + i, { tempC: 58 + i * 2.2, jobId: i < 6 ? 7 : null, status: i < 6 ? "ok" : "idle" });
	v.facilities[5].status = "failed";
	v.facilities[5].health = 0;
	v.facilities[8].status = "throttled";
	v.facilities[8].tempC = 83.5;
	v.facilities[8].clock = 0.72;
	put("crah", 2, 18, { heatKw: 98, powerKw: 4 });
	for (let i = 0; i < 6; i++) put("rack_gpu_dlc", 3, 8 + i, { tempC: 52 + i, jobId: 8, coolantNet: 1 });
	put("cdu", 3, 16, { coolantNet: 1 });
	put("chiller", 3, 20, { coolantNet: 1, heatKw: 212, powerKw: 45 });
	put("rack_storage", 1, 8, { tempC: 31 });
	put("rack_storage", 1, 9, { tempC: 32 });
	put("depot", 0, 16, { stored: 7, powerNet: null });
	put("charger", 0, 5);

	v.jobs = [
		{ id: 7, contractId: 30, clientName: "Northwind AI", kind: "training", status: "running", progress: 1840, total: 3200, deadline: v.tick + 1700, pflops: 13.1, rackIds: [4, 5, 6, 7, 8, 9], payout: 520_000, lastCheckpoint: v.tick - 40 },
		{ id: 8, contractId: 31, clientName: "Lumen Health", kind: "inference", status: "running", progress: 900, total: 2880, deadline: v.tick + 1980, pflops: 41.2, rackIds: [13, 14, 15, 16, 17, 18], payout: 310_000, lastCheckpoint: 0 },
		{ id: 9, contractId: 33, clientName: "Atlas Climate", kind: "finetune", status: "stalled", progress: 40, total: 260, deadline: v.tick + 280, pflops: 0, rackIds: [], payout: 64_000, lastCheckpoint: 0 },
	];
	v.ledger = Array.from({ length: 13 }, (_, d): LedgerDay => ({
		day: d,
		revenue: d < 2 ? 0 : 80_000 + d * 9_000 + ((d * 7919) % 30_000),
		energy: 18_000 + d * 1_400,
		upkeep: 6_200 + d * 300,
		taxes: d >= 5 ? Math.round(d * 420) : 0,
		interest: d >= 8 ? 1_600 : 0,
		fees: d >= 10 ? 900 + d * 40 : 0,
		construction: d === 0 ? 900_000 : d % 4 === 1 ? 160_000 : (d * 3301) % 20_000,
		penalties: d === 9 ? 25_000 : 0,
	}));
	const h: MetricSample[] = [];
	for (let i = 0; i < 400; i++) {
		const t = v.tick - (400 - i) * 10;
		const ph = i / 40;
		h.push({ tick: t, pue: 1.34 + 0.08 * Math.sin(ph) + 0.02 * Math.sin(ph * 3.3), itKw: 520 + i * 0.3 + 40 * Math.sin(ph * 0.7), totalKw: 0, pflops: 40 + i * 0.035 + 4 * Math.sin(ph * 1.3), cash: 900_000 + i * 960 + 30_000 * Math.sin(ph * 0.5), maxRackC: 70 + 8 * Math.sin(ph * 1.1) + (i > 360 ? (i - 360) * 0.2 : 0) });
	}
	for (const s of h) s.totalKw = s.itKw * s.pue;
	v.history = h;
	if (sc) {
		// A chosen lot overrides the money, the Clearance and the sandbox flag (the fake world keeps its own buildings).
		v.cash = sc.startingCash ?? content.balance.startingCash;
		v.tier = sc.startTier ?? 1;
		v.sandbox = !!sc.sandbox;
	}
	return v;
}

/** Dev stand-in for Sim.canBuild: the same rules and reason wording as the sim's structure planners. */
export function fakeCanBuild(view: SimView, content: ContentDB, cmd: SimCommand): CommandResult {
	const no = (reason: string): CommandResult => ({ ok: false, reason });
	const st = content.structure;
	const funds = (cost: number): CommandResult => (cost > view.cash ? no(`insufficient funds (need $${Math.ceil(cost)})`) : { ok: true });
	switch (cmd.type) {
		case "buildSlab": {
			if (!inBounds(view, cmd.x0, cmd.floor) || !inBounds(view, cmd.x1, cmd.floor) || cmd.x1 < cmd.x0) return no("slab span out of bounds");
			let n = 0;
			for (let x = cmd.x0; x <= cmd.x1; x++) {
				if (view.slab[cellIndex(view, x, cmd.floor)]) continue;
				if (cmd.floor > 0 && !view.slab[cellIndex(view, x, cmd.floor - 1)]) return no(`no slab below at x=${x}`);
				n++;
			}
			if (n === 0) return no("already built");
			return funds(n * (cmd.floor < 0 ? st.basementSlabPerTile : st.slabPerTile));
		}
		case "buildConduit": {
			const grid = cmd.layer === "power" ? view.power : cmd.layer === "coolant" ? view.coolant : view.nutrient;
			if (!cmd.cells.length) return no("no cells");
			let n = 0;
			for (const c of cmd.cells) {
				if (!inBounds(view, c.x, c.floor)) return no("conduit cell out of bounds");
				const i = cellIndex(view, c.x, c.floor);
				if (grid[i]) continue;
				const near = (x: number, f: number): boolean => inBounds(view, x, f) && grid[cellIndex(view, x, f)] === 1;
				if (!view.slab[i] && !near(c.x - 1, c.floor) && !near(c.x + 1, c.floor) && !near(c.x, c.floor - 1) && !near(c.x, c.floor + 1)) return no(`conduit at (${c.x}, ${c.floor}) needs slab or an adjacent conduit`);
				n++;
			}
			if (n === 0) return no("already built");
			return funds(n * (cmd.layer === "power" ? st.powerConduitPerTile : st.coolantConduitPerTile));
		}
		case "buildLift": {
			if (!inBounds(view, cmd.x, cmd.floorMin) || !inBounds(view, cmd.x, cmd.floorMax) || cmd.floorMax <= cmd.floorMin) return no("lift must span at least two floors inside the lot");
			for (let f = cmd.floorMin; f <= cmd.floorMax; f++) {
				if (!view.slab[cellIndex(view, cmd.x, f)]) return no(`no slab at floor ${f}`);
				if (view.facilities.some((fa) => fa.floor === f && cmd.x >= fa.x && cmd.x < fa.x + fa.width)) return no(`facility in the way at floor ${f}`);
				if (view.lifts.some((l) => l.x === cmd.x && f >= l.floorMin && f <= l.floorMax)) return no(`lift already at floor ${f}`);
			}
			return funds(st.liftBase + st.liftPerFloor * (cmd.floorMax - cmd.floorMin + 1));
		}
		case "place":
			return canPlaceFor(view, content, cmd.defId, cmd.floor, cmd.x);
		default:
			return { ok: true };
	}
}

function canPlaceFor(view: SimView, content: ContentDB, defId: string, floor: number, x: number): CommandResult {
	const no = (reason: string): CommandResult => ({ ok: false, reason });
	const d = content.facilities[defId];
	if (!d) return no("Unknown facility");
	if (d.unlockTier > view.tier) return no(`Requires Tier ${d.unlockTier}`);
	if (d.tech && !view.techResearched.includes(d.tech)) return no(`requires research: ${content.tech.find((t) => t.id === d.tech)?.name ?? d.tech}`);
	for (let i = 0; i < d.width; i++) {
		if (!inBounds(view, x + i, floor)) return no("Out of bounds");
		if (!view.slab[cellIndex(view, x + i, floor)]) return no("Needs floor slab");
		if (view.facilities.some((f) => f.floor === floor && x + i >= f.x && x + i < f.x + f.width)) return no("Space occupied");
	}
	if (d.cost > view.cash) return no("Not enough cash");
	return { ok: true };
}

export interface FakeStore extends GameStore {
	/** Advance the fake world by `minutes` and jitter numbers. */
	advance(minutes: number): void;
	/** Last ghost set (for debugging). */
	ghost: Ghost | null;
	/** Put a save into a slot without going through saveTo (harness and tests). */
	seedSlot: ReturnType<typeof createFakeSaves>["seedSlot"];
	/** Open a fake advisor decision from the fixture events (`eventId` default: heatwave). It never expires. */
	issueDecision(eventId?: string): number;
	addModifier(m: ModifierView): void;
	/** End the game as the real sim would. */
	triggerGameOver(kind: GameOverKind, ending?: EndingId): void;
	/** Set the corruption scalar 0..1 (harness and tests). */
	setCorruption(c: number): void;
	/** Put the tower at Clearance `tier` with no path chosen (harness and tests). */
	setTier(tier: number): void;
	/** Add a nutrient net with organoid racks (one starving, one too cold), contamination, a growth and a mutated bot. */
	seedBio(): void;
	/** File a quarterly audit: appends a report and emits `quarterReport` (like the sim at midnight). */
	fileQuarterReport(grade?: AuditGrade): QuarterReport;
	/** Add research points (harness and tests). */
	addResearchPoints(n: number): void;
	/** Research a node as if the player had (no RP or prerequisite checks); unlocks the clerk if the node does. */
	unlockClerk(): void;
	/** Unlock the Works Foreman (harness and tests). */
	unlockForeman(): void;
	/** Merge fields into the view (harness and tests; no rules applied). */
	patchView(patch: Partial<SimView>): void;
}

export function createFakeStore(content: ContentDB = createFakeContent(), opts: { saveDelayMs?: number } = {}): FakeStore {
	let view = buildView(content);
	const initialLog: { tick: number; event: SimEvent }[] = [
		{ tick: view.tick - 300, event: { type: "newDay", day: 12 } },
		{ tick: view.tick - 220, event: { type: "jobStarted", jobId: 8 } },
		{ tick: view.tick - 120, event: { type: "gensetStarted", facilityId: 2 } },
		{ tick: view.tick - 110, event: { type: "powerShortfall", netId: 1, satisfaction: 0.82 } },
		{ tick: view.tick - 104, event: { type: "gensetStopped", facilityId: 2 } },
		{ tick: view.tick - 70, event: { type: "componentFailed", facilityId: 6 } },
		{ tick: view.tick - 40, event: { type: "rackThrottled", facilityId: 9 } },
		{ tick: view.tick - 10, event: { type: "contractOffered", contractId: 42 } },
	];
	let state: GameState = { view, speed: 3, overlay: "normal", tool: { kind: "select" }, selection: { kind: "facility", id: 9 }, log: initialLog, muted: false, settings: { ...DEFAULT_SETTINGS }, saveStatus: { lastSavedAt: null, error: null, busy: false } };
	const subs = new Set<() => void>();
	const set = (patch: Partial<GameState>): void => {
		state = { ...state, ...patch };
		for (const s of subs) s();
	};
	const pushEvents = (events: SimEvent[]): void => set({ log: [...state.log, ...events.map((event) => ({ tick: view.tick, event }))].slice(-200) });
	const newView = (patch: Partial<SimView>): void => {
		view = { ...view, ...patch };
		set({ view });
	};
	const saves = createFakeSaves({
		getState: () => state,
		patchState: (patch) => set(patch),
		setView: (v) => newView(v),
		freshView: (id) => buildView(content, id),
		delayMs: opts.saveDelayMs ?? 150,
	});
	const ok: CommandResult = { ok: true };
	const no = (reason: string): CommandResult => ({ ok: false, reason });

	const canPlace = (defId: string, floor: number, x: number): CommandResult => canPlaceFor(view, content, defId, floor, x);

	// Decisions, mimicking the sim: resolveDecision is queued and applied on the next advance().
	let nextDecision = 1;
	const queued: { decisionId: number; choiceId: string }[] = [];
	const eventById = (eventId: string): EventDef => content.events.find((e) => e.id === eventId) ?? content.events[0];
	const fileDecision = (decisionId: number, choiceId: string): void => {
		const m = view.decision;
		if (!m || m.id !== decisionId) return;
		const def = eventById(m.eventId);
		const outcome = def.choices.find((c) => c.id === choiceId)?.outcome ?? "Filed.";
		newView({
			decision: null,
			decisionHistory: [...view.decisionHistory, { decisionId, eventId: m.eventId, title: m.title, choiceId, outcome, tick: view.tick }].slice(-20),
		});
		pushEvents([{ type: "decisionResolved", decisionId, eventId: m.eventId, choiceId }]);
	};

	const store: FakeStore = {
		ghost: null,
		issueDecision(eventId = "heatwave") {
			const def = eventById(eventId);
			const decision: DecisionView = {
				id: nextDecision++,
				eventId: def.id,
				advisor: def.advisor,
				category: def.category,
				title: def.title,
				body: def.body,
				choices: def.choices.map((c) => ({ id: c.id, label: c.label, hint: c.hint })),
				recommended: def.recommended,
				votes: def.votes,
				issuedAt: view.tick,
				canDefer: true,
			};
			newView({ decision });
			pushEvents([{ type: "decisionIssued", decisionId: decision.id, eventId: def.id }]);
			return decision.id;
		},
		addModifier: (m) => newView({ modifiers: [...view.modifiers, m] }),
		triggerGameOver(kind, ending) {
			if (view.gameOver) return;
			newView({ gameOver: { kind, tick: view.tick, ...(ending ? { ending } : {}) }, bankrupt: kind === "bankrupt" || view.bankrupt });
			pushEvents([{ type: "gameOver", kind, ...(ending ? { ending } : {}) }]);
		},
		setCorruption: (c) => newView({ corruption: c, contaminatedShare: c / 2 }),
		setTier: (tier) => newView({ tier }),
		seedBio() {
			const nutrient = new Uint8Array(view.nutrient);
			const netOf = new Int32Array(view.nutrientNetOf);
			for (let x = 10; x < 26; x++) {
				nutrient[cellIndex(view, x, 4)] = 1;
				netOf[cellIndex(view, x, 4)] = 1;
			}
			const contamination = new Float32Array(view.contamination);
			for (let x = 12; x < 20; x++) contamination[cellIndex(view, x, 4)] = 0.3 + (x - 12) * 0.08;
			let id = Math.max(0, ...view.facilities.map((f) => f.id)) + 1;
			const mk = (defId: string, x: number, extra: Partial<FacilityView>): FacilityView => {
				const d = content.facilities[defId];
				return { id: id++, defId, floor: 4, x, width: d.width, enabled: true, status: "ok", tempC: 37, clock: 1, health: 1, powerKw: d.rack?.powerKw ?? d.facilityKw, heatKw: 0, jobId: null, powerNet: 1, coolantNet: null, nutrientNet: 1, grown: false, contamination: 0, ...extra };
			};
			newView({
				nutrient,
				nutrientNetOf: netOf,
				contamination,
				nutrientNets: [{ id: 1, supply: 20, demand: 26, satisfaction: 0.77 }],
				facilities: [
					...view.facilities,
					mk("nutrient_plant", 10, {}),
					mk("organoid_incubator", 13, { contamination: 0.45 }),
					mk("organoid_incubator", 14, { status: "noNutrient", nutrientNet: null }),
					mk("organoid_incubator", 15, { status: "tooCold", tempC: 33.4 }),
					mk("growth_mass", 18, { grown: true, contamination: 0.8, powerNet: null }),
				],
				bots: view.bots.map((b, i) => (i === 0 ? { ...b, trait: "fleshed" as const } : b)),
				corruption: 0.45,
				contaminatedShare: 0.2,
				tier: Math.max(view.tier, 3),
			});
		},
		fileQuarterReport(grade = "B") {
			const last = view.reports.at(-1);
			const quarter = (last?.quarter ?? 0) + 1;
			const good = grade <= "B";
			const rep: QuarterReport = {
				quarter,
				fromDay: last ? last.toDay + 1 : 0,
				toDay: (last ? last.toDay : -1) + 7,
				revenue: 1_240_000,
				costs: good ? 780_000 : 1_460_000,
				uptime: good ? 0.9984 : 0.972,
				pue: good ? 1.41 : 1.63,
				jobsCompleted: good ? 14 : 6,
				jobsFailed: good ? 0 : 3,
				penalties: good ? 0 : 90_000,
				grade,
				cashDelta: grade === "A" ? 62_000 : grade === "B" ? 24_800 : grade === "C" ? 0 : grade === "D" ? -29_000 : -73_000,
				remark: good ? "The Ministry is, on balance, not displeased." : "The Ministry has filed your results under 'regrettable'.",
			};
			newView({ reports: [...view.reports, rep].slice(-8) });
			pushEvents([{ type: "quarterReport", quarter, grade }]);
			return rep;
		},
		addResearchPoints: (n) => newView({ researchPoints: view.researchPoints + n }),
		unlockClerk() {
			newView({ clerk: { ...view.clerk, unlocked: true }, techResearched: view.techResearched.includes("adm_clerk") ? view.techResearched : [...view.techResearched, "adm_clerk"] });
		},
		patchView: (patch) => newView(patch),
		unlockForeman() {
			newView({ automation: { ...view.automation, foremanUnlocked: true } });
		},
		get: () => state,
		subscribe(cb) {
			subs.add(cb);
			return () => {
				subs.delete(cb);
			};
		},
		dispatch(cmd: SimCommand): CommandResult {
			switch (cmd.type) {
				case "place": {
					const r = canPlace(cmd.defId, cmd.floor, cmd.x);
					if (!r.ok) return r;
					const d = content.facilities[cmd.defId];
					const id = Math.max(0, ...view.facilities.map((f) => f.id)) + 1;
					newView({ cash: view.cash - d.cost, facilities: [...view.facilities, { id, defId: d.id, floor: cmd.floor, x: cmd.x, width: d.width, enabled: true, status: d.rack ? "idle" : "ok", tempC: 24, clock: 1, health: 1, powerKw: 0, heatKw: 0, jobId: null, powerNet: 1, coolantNet: null, nutrientNet: null, grown: false, contamination: 0 }] });
					pushEvents([{ type: "built", what: "facility", floor: cmd.floor, x: cmd.x }]);
					return ok;
				}
				case "setEnabled":
					newView({ facilities: view.facilities.map((f) => (f.id === cmd.facilityId ? { ...f, enabled: cmd.enabled, status: cmd.enabled ? "ok" : "disabled" } : f)) });
					return ok;
				case "acceptContract": {
					const o = view.offers.find((o) => o.id === cmd.contractId);
					if (!o) return no("Offer no longer available");
					if (o.needsLiquid && view.tier < 3) return no("No free liquid-cooled racks");
					const job: JobView = { id: 100 + o.id, contractId: o.id, clientName: o.clientName, kind: o.kind, status: "queued", progress: 0, total: o.kind === "inference" ? o.durationTicks : o.work, deadline: view.tick + o.durationTicks, pflops: 0, rackIds: [], payout: o.payout, lastCheckpoint: 0 };
					newView({ offers: view.offers.filter((x) => x !== o), jobs: [...view.jobs, job] });
					return ok;
				}
				case "declineContract":
					newView({ offers: view.offers.filter((x) => x.id !== cmd.contractId) });
					return ok;
				case "cancelJob":
					newView({ jobs: view.jobs.map((j) => (j.id === cmd.jobId ? { ...j, status: "failed" } : j)) });
					return ok;
				case "buyParts":
					if (view.cash < content.structure.sparePart * cmd.count) return no("Not enough cash");
					newView({ cash: view.cash - content.structure.sparePart * cmd.count, spareParts: view.spareParts + cmd.count });
					return ok;
				case "buyBot": {
					const b = content.bots[cmd.defId];
					if (b?.tech && !view.techResearched.includes(b.tech)) return no(`requires research: ${content.tech.find((t) => t.id === b.tech)?.name ?? b.tech}`);
					return no("All bot docks are full");
				}
				case "demolish":
					newView({ facilities: view.facilities.filter((f) => !(f.floor === cmd.floor && cmd.x >= f.x && cmd.x < f.x + f.width)) });
					return ok;
				case "resolveDecision": {
					const m = view.decision;
					if (!m || m.id !== cmd.decisionId || queued.some((q) => q.decisionId === cmd.decisionId)) return no("That decision is no longer open");
					if (!m.choices.some((c) => c.id === cmd.choiceId)) return no("Unknown choice");
					queued.push({ decisionId: cmd.decisionId, choiceId: cmd.choiceId });
					return ok;
				}
				case "deferDecision": {
					const m = view.decision;
					if (!m || m.id !== cmd.decisionId || !m.canDefer) return no("Cannot defer");
					newView({ decision: null, decisionReturnsAt: view.tick + 1440 });
					return ok;
				}
				case "markTip":
					newView({ advisorTips: view.advisorTips.includes(cmd.tipId) ? view.advisorTips : [...view.advisorTips, cmd.tipId] });
					return ok;
				case "decisionGate":
					newView({ decisionGate: cmd.open });
					return ok;
				case "research": {
					const n = content.tech.find((t) => t.id === cmd.techId);
					if (!n) return no(`Unknown research: ${cmd.techId}`);
					if (view.techResearched.includes(n.id)) return no(`${n.name} is already filed`);
					const missing = n.requires.find((r) => !view.techResearched.includes(r));
					if (missing) return no(`Requires ${content.tech.find((t) => t.id === missing)?.name ?? missing} first`);
					if (view.tier < n.minTier) return no(`Requires Level ${n.minTier}`);
					if (view.researchPoints < n.cost) return no(`Needs ${n.cost} RP, have ${Math.floor(view.researchPoints)}`);
					const clerk = n.effects.some((e) => e.type === "feature" && e.feature === "contractsClerk") ? { ...view.clerk, unlocked: true } : view.clerk;
					const automation = n.effects.some((e) => e.type === "feature" && e.feature === "foreman") ? { ...view.automation, foremanUnlocked: true } : view.automation;
					newView({ researchPoints: view.researchPoints - n.cost, techResearched: [...view.techResearched, n.id], clerk, automation });
					pushEvents([{ type: "researched", techId: n.id }]);
					return ok;
				}
				case "retrofit": {
					const f = view.facilities.find((x) => x.id === cmd.facilityId);
					if (!f) return no("No such facility");
					const from = content.facilities[f.defId];
					const t = from ? retrofitTarget(content, from, cmd.tree) : null;
					if (!from || !t) return no("Nothing to retrofit it to");
					if (view.tier < t.to.unlockTier) return no(`Requires tier ${t.to.unlockTier}`);
					const price = retrofitCost(content, from, t.to);
					if (view.cash < price) return no(`Insufficient funds: need ${price}`);
					newView({ cash: view.cash - price, facilities: view.facilities.map((x) => (x.id === f.id ? { ...x, defId: t.to.id } : x)) });
					pushEvents([{ type: "retrofitted", facilityId: f.id, tree: cmd.tree, rung: t.to.rung ?? 1 }]);
					return ok;
				}
				case "setAutomation": {
					const p = cmd.policy;
					const nums = [p?.parts?.keep, p?.bots?.racksPerBot, p?.bots?.maxBots, p?.foreman?.reserve];
					if (!p || !nums.every((x) => typeof x === "number" && Number.isFinite(x) && x >= 0)) return no("Automation orders are malformed");
					if (p.foreman.enabled && !view.automation.foremanUnlocked) return no("The Works Foreman has not been hired");
					newView({ automation: { ...view.automation, policy: { research: { ...p.research, branches: [...p.research.branches] }, parts: { ...p.parts }, bots: { ...p.bots }, foreman: { ...p.foreman } } } });
					return ok;
				}
				case "setClerk": {
					if (!view.clerk.unlocked) return no("The Contracts Clerk has not been hired");
					const p = cmd.policy;
					if (!p.kinds.length) return no("The clerk needs at least one job kind");
					if (![p.minPayPerPflopHour, p.maxPenalty].every((x) => Number.isFinite(x) && x >= 0)) return no("Clerk limits must be zero or more");
					newView({ clerk: { ...view.clerk, policy: { ...p, kinds: [...p.kinds] } } });
					return ok;
				}
				case "takeLoan": {
					if (!(cmd.amount > 0)) return no("Loan amount must be positive");
					if (view.loan.principal + cmd.amount > view.loan.max + 1e-9) return no("That is over your credit limit");
					newView({ cash: view.cash + cmd.amount, loan: { ...view.loan, principal: view.loan.principal + cmd.amount } });
					pushEvents([{ type: "loanTaken", amount: cmd.amount }]);
					return ok;
				}
				case "repayLoan": {
					const pay = Math.min(cmd.amount, view.loan.principal);
					if (!(pay > 0)) return no("Nothing to repay");
					if (view.cash < pay) return no("Not enough cash to repay that much");
					newView({ cash: view.cash - pay, loan: { ...view.loan, principal: view.loan.principal - pay } });
					pushEvents([{ type: "loanRepaid", amount: pay }]);
					return ok;
				}
				default:
					return ok;
			}
		},
		canPlace,
		canBuild: (cmd) => fakeCanBuild(view, content, cmd),
		setSettings: (patch) => {
			const settings = normalizeSettings({ ...state.settings, ...patch });
			set({ settings, muted: settings.muted });
		},
		save: saves.save,
		load: saves.load,
		newGame: saves.newGame,
		listSaves: saves.listSaves,
		saveTo: saves.saveTo,
		loadFrom: saves.loadFrom,
		deleteSave: saves.deleteSave,
		seedSlot: saves.seedSlot,
		setSpeed: (speed) => set({ speed }),
		setOverlay: (overlay) => set({ overlay }),
		setTool: (tool) => set({ tool }),
		setSelection: (selection) => set({ selection }),
		setGhost(g) {
			store.ghost = g;
		},
		focus: () => {},
		setMuted: (muted) => store.setSettings({ muted }),
		advance(minutes) {
			const tick = view.tick + minutes;
			// Like the sim, queued commands apply only when the clock actually advances.
			if (minutes > 0) {
				for (const q of queued.splice(0)) fileDecision(q.decisionId, q.choiceId);
			}
			const ph = tick / 97;
			const facilities = view.facilities.map((f) => {
				const d = content.facilities[f.defId];
				if (!d.rack || f.status === "failed") return f;
				return { ...f, tempC: f.tempC + Math.sin(ph + f.id) * 0.6 };
			});
			const jobs = view.jobs.map((j) => (j.status === "running" ? { ...j, progress: Math.min(j.total, j.progress + j.pflops * (minutes / 60)) } : j));
			const pue = 1.36 + 0.05 * Math.sin(ph);
			const itKw = 642 + 18 * Math.sin(ph * 1.7);
			const history = [...view.history, { tick, pue, itKw, totalKw: itKw * pue, pflops: 54 + 2 * Math.sin(ph), cash: view.cash, maxRackC: Math.max(...facilities.filter((f) => content.facilities[f.defId].rack).map((f) => f.tempC)) }].slice(-1440);
			newView({ tick, day: Math.floor(tick / 1440), minuteOfDay: (tick + 360) % 1440, facilities, jobs, pue, itKw, totalKw: itKw * pue, pflops: 54.3 + 2 * Math.sin(ph), cash: view.cash + minutes * 37, history, ambientC: 21 + 3 * Math.sin(ph / 5) });
		},
	};
	// Expose a way for the harness to inject events (toasts).
	(store as FakeStore & { emit: (e: SimEvent[]) => void }).emit = pushEvents;
	return store;
}

export type FakeStoreWithEmit = FakeStore & { emit: (e: SimEvent[]) => void };
