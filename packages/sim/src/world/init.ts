/** Build the initial SimState from a scenario. Scenario content errors throw. */
import type { ContentDB } from "@aitower/content";
import { TICKS_PER_DAY } from "../api";
import { placeScenarioFacility } from "../commands/placement";
import { stockParts } from "../commands/operations";
import { defaultAutomation } from "../automation/policy";
import { nextOfferDelay } from "../compute/offers";
import { nextMemoDelay } from "../ministry/memos";
import { createScratch } from "../core/context";
import { cellCount, cellIdx, inBounds } from "../core/grid";
import { createRng } from "../core/rng";
import type { SimState } from "../core/state";
import { ambientAt, dayOf } from "../core/time";
import { emptyAudit } from "../economy/audit";
import { defaultClerkPolicy } from "../economy/clerk";
import { emptyLedgerDay } from "../economy/ledger";
import { emptyStats } from "../economy/stats";
import { attachToNets } from "../networks/rebuild";
import { labelLayer } from "../networks/unionFind";
import { addBot, addLift, findChargerWithSpace } from "./entities";

export function createState(content: ContentDB, scenarioId: string, seed: number): SimState {
	const sc = content.scenarios[scenarioId];
	if (!sc) throw new Error(`unknown scenario '${scenarioId}'`);
	const dims = { width: sc.width, floorMin: sc.floorMin, floorMax: sc.floorMax };
	const n = cellCount(dims);
	const ambient = ambientAt(content.balance, 0);
	const state: SimState = {
		scenarioId,
		seed,
		tick: 0,
		...dims,
		slab: new Uint8Array(n),
		power: new Uint8Array(n),
		coolant: new Uint8Array(n),
		nutrient: new Uint8Array(n),
		facilityAt: new Int32Array(n).fill(-1),
		liftAt: new Int32Array(n).fill(-1),
		airTemp: new Float32Array(n).fill(ambient),
		powerNetOf: new Int32Array(n).fill(-1),
		coolantNetOf: new Int32Array(n).fill(-1),
		nutrientNetOf: new Int32Array(n).fill(-1),
		contamination: new Float32Array(n),
		powerNetCount: 0,
		coolantNetCount: 0,
		nutrientNetCount: 0,
		netsDirty: true,
		topologyRev: 0,
		facilities: [],
		lifts: [],
		bots: [],
		offers: [],
		jobs: [],
		workOrders: [],
		nextId: { facility: 1, lift: 1, bot: 1, contract: 1, job: 1, workOrder: 1, memo: 1 },
		powerNets: [],
		coolantNets: [],
		nutrientNets: [],
		storageUtil: 0,
		nextOfferTick: 0,
		cash: sc.startingCash ?? content.balance.startingCash,
		tier: Math.min(Math.max(1, Math.floor(sc.startTier ?? 1)), Math.max(1, content.balance.tiers.pflops.length)),
		bankrupt: false,
		negativeCashTicks: 0,
		ledger: [],
		today: emptyLedgerDay(dayOf(0)),
		history: [],
		metrics: {
			ringTotalKwh: new Float64Array(TICKS_PER_DAY),
			ringItKwh: new Float64Array(TICKS_PER_DAY),
			ringShouldRun: new Float64Array(TICKS_PER_DAY),
			ringRunning: new Float64Array(TICKS_PER_DAY),
			ringGreenKwh: new Float64Array(TICKS_PER_DAY),
			ringHeatKwh: new Float64Array(TICKS_PER_DAY),
			greenKw: 0,
			heatExportKw: 0,
			itKw: 0,
			totalKw: 0,
			gridKw: 0,
			gensetKw: 0,
			pflops: 0,
			organoidPflops: 0,
			energyCost: 0,
			pue: 1,
			uptime: 1,
			maxRackC: ambient,
		},
		ambientC: ambient,
		rng: createRng(seed),
		memos: [],
		memoHistory: [],
		modifiers: [],
		nextMemoTick: 0,
		lastIssuedDay: {},
		standing: content.balance.standing.start,
		gameOver: null,
		researchPoints: 0,
		techResearched: [],
		clerkPolicy: defaultClerkPolicy(),
		clerkAccepted: 0,
		loanPrincipal: 0,
		reports: [],
		audit: emptyAudit(),
		stats: emptyStats(),
		scriptedIssued: [],
		contaminatedShare: 0,
		irreversible: false,
		corruption: 0,
		path: null,
		endingDays: { livingTower: 0, cleanTower: 0, greenExemplar: 0, millionMinds: 0 },
		automation: defaultAutomation(),
		wind: 0.6,
		droughtUntil: 0,
		affinity: { biotech: 0, greentech: 0, synthetic: 0 },
		greenScore: 0,
		refinement: 0,
		sandbox: sc.sandbox === true,
		pending: [],
	};

	const fail = (what: string): never => {
		throw new Error(`scenario '${scenarioId}': ${what}`);
	};
	for (const [floor, x0, x1] of sc.slabs) {
		for (let x = x0; x <= x1; x++) {
			if (!inBounds(state, x, floor)) fail(`slab (${x}, ${floor}) out of bounds`);
			state.slab[cellIdx(state, x, floor)] = 1;
		}
	}
	for (const [layer, floor, x0, x1] of sc.conduits) {
		const grid = layer === "power" ? state.power : state.coolant;
		for (let x = x0; x <= x1; x++) {
			if (!inBounds(state, x, floor)) fail(`conduit (${x}, ${floor}) out of bounds`);
			grid[cellIdx(state, x, floor)] = 1;
		}
	}
	for (const l of sc.lifts) {
		for (let fl = l.floorMin; fl <= l.floorMax; fl++) {
			if (!inBounds(state, l.x, fl) || !state.slab[cellIdx(state, l.x, fl)]) fail(`lift at x=${l.x} needs slab on floor ${fl}`);
		}
		addLift(state, l.x, l.floorMin, l.floorMax);
	}
	const ctx = { state, content };
	for (const f of sc.facilities) placeScenarioFacility(ctx, f.defId, f.floor, f.x);
	for (const b of sc.bots) {
		if (!content.bots[b.defId]) fail(`unknown bot '${b.defId}'`);
		addBot(state, b.defId, b.floor, b.x, findChargerWithSpace(state, content));
	}
	stockParts(ctx, sc.spareParts);

	const scratch = createScratch(n);
	state.powerNetCount = labelLayer(state, state.power, state.powerNetOf, scratch.parent, scratch.label);
	state.coolantNetCount = labelLayer(state, state.coolant, state.coolantNetOf, scratch.parent, scratch.label);
	state.nutrientNetCount = labelLayer(state, state.nutrient, state.nutrientNetOf, scratch.parent, scratch.label);
	attachToNets(state);
	state.netsDirty = false;
	state.nextOfferTick = nextOfferDelay(state, content);
	state.nextMemoTick = content.balance.events.graceTicks + nextMemoDelay(state, content);
	return state;
}
