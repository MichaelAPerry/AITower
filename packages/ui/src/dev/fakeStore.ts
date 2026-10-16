/**
 * Dev-only fake GameStore backed by a hand-built SimView fixture. Uses content *types* only and a small
 * local facility list (real content data is written in parallel). Not exported from the package index.
 */
import type { ContentDB, FacilityDef } from "@aitower/content";
import type { CommandResult, FacilityView, JobView, LedgerDay, MetricSample, SimCommand, SimEvent, SimView } from "@aitower/sim";
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

export function createFakeContent(): ContentDB {
	const facilities: FacilityDef[] = [
		fac({ id: "rack_gpu_air", name: "GPU Rack (air)", kind: "rack", category: "rack", cost: 42_000, color: "#2b3442", accent: "#4fd8ff", width: 1, description: "8× air-cooled accelerators. Cheap and simple, but dumps all its heat into the room.", rack: { cooling: "air", powerKw: 18, liquidFraction: 0, pflops: 2.4, storageTB: 0, failurePerDay: 0.01 } }),
		fac({ id: "rack_gpu_dlc", name: "GPU Rack (DLC)", kind: "rack", category: "rack", cost: 95_000, color: "#26303e", accent: "#59a8ff", width: 1, unlockTier: 2, facilityKw: 0.4, description: "Direct-liquid-cooled dense rack. 80% of the heat leaves through the coolant loop.", rack: { cooling: "dlc", powerKw: 45, liquidFraction: 0.8, pflops: 7.2, storageTB: 0, failurePerDay: 0.012 }, placement: { needsCoolant: true } }),
		fac({ id: "rack_storage", name: "Storage Array", kind: "rack", category: "rack", cost: 28_000, color: "#2f2f3a", accent: "#b08cff", description: "Dense NVMe shelves holding training datasets.", rack: { cooling: "air", powerKw: 6, liquidFraction: 0, pflops: 0, storageTB: 400, failurePerDay: 0.006 } }),
		fac({ id: "grid_tie", name: "Grid Tie 1 MW", kind: "grid_tie", category: "power", cost: 60_000, color: "#3a3320", accent: "#ffb547", width: 2, description: "Utility connection. Imports up to 1 MW at the market price.", power: { capacityKw: 1000 } }),
		fac({ id: "genset", name: "Diesel Genset", kind: "genset", category: "power", cost: 85_000, color: "#3b2a1e", accent: "#ff8a4c", width: 3, description: "Backup generator. Starts 2 minutes after a shortfall.", power: { capacityKw: 500, startDelayTicks: 2, costPerKwh: 0.32 } }),
		fac({ id: "ups", name: "UPS Battery", kind: "ups", category: "power", cost: 38_000, color: "#1f3328", accent: "#3ff2a0", width: 2, description: "Bridges the gap until the genset spins up.", power: { capacityKw: 300, storageKwh: 120, efficiency: 0.94 } }),
		fac({ id: "crah", name: "CRAH Unit", kind: "crah", category: "cooling", cost: 24_000, color: "#1d3038", accent: "#7fe3ff", width: 2, facilityKw: 4, description: "Computer-room air handler. Pulls room air toward 20 °C within its reach.", cooling: { capacityKw: 120, radius: 6 } }),
		fac({ id: "chiller", name: "Chiller", kind: "chiller", category: "cooling", cost: 110_000, color: "#1b2c3f", accent: "#59a8ff", width: 3, unlockTier: 2, description: "Rejects coolant-loop heat outdoors. COP derates in hot weather.", cooling: { capacityKw: 400, cop: 5 } }),
		fac({ id: "cdu", name: "CDU", kind: "cdu", category: "cooling", cost: 32_000, color: "#1a2836", accent: "#4fd8ff", unlockTier: 2, facilityKw: 2, description: "Coolant distribution unit feeding liquid racks.", cooling: { capacityKw: 300 }, placement: { needsCoolant: true } }),
		fac({ id: "immersion", name: "Immersion Tank", kind: "rack", category: "rack", cost: 240_000, color: "#14303a", accent: "#3ff2a0", width: 2, unlockTier: 3, description: "Two-phase immersion. Absurd density.", rack: { cooling: "immersion", powerKw: 120, liquidFraction: 1, pflops: 20, storageTB: 0, failurePerDay: 0.008 } }),
		fac({ id: "depot", name: "Parts Depot", kind: "depot", category: "logistics", cost: 12_000, color: "#2d2a22", accent: "#ffd34d", width: 2, description: "Shelving for spare parts.", logistics: { capacity: 40 } }),
		fac({ id: "charger", name: "Bot Dock", kind: "charger", category: "logistics", cost: 9_000, color: "#22303a", accent: "#8fffdd", description: "Bots spawn and recharge here.", logistics: { capacity: 2, chargeKw: 3 } }),
	];
	return {
		facilities: Object.fromEntries(facilities.map((f) => [f.id, f])),
		bots: { techbot: { id: "techbot", name: "TechBot", cost: 15_000, speed: 0.5, batteryTicks: 600, repairTicks: 30, color: "#8fffdd" } },
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
			tiers: { pflops: [0, 20, 80, 250, 1000], uptime: [0, 0.99, 0.995, 0.999, 0.9999], reward: [0, 100_000, 300_000, 1_000_000, 3_000_000] },
		},
		scenarios: {},
		generateContract: () => ({ clientId: "x", clientName: "X", kind: "training", work: 100, durationTicks: 1440, payout: 1, penalty: 0, needsLiquid: false, storageTB: 0, checkpointTicks: 60 }),
	};
}

function buildView(content: ContentDB): SimView {
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
			{ id: 1, defId: "techbot", x: 14.3, floor: 2, state: "toTarget", battery: 0.72, carrying: true, workOrderId: 3 },
			{ id: 2, defId: "techbot", x: 5, floor: 0, state: "charging", battery: 0.31, carrying: false, workOrderId: null },
		],
		powerNets: [{ id: 1, supplyKw: 1500, demandKw: 812, satisfaction: 1, storedKwh: 96, storageCapacityKwh: 120, gridImportKw: 812 }],
		coolantNets: [{ id: 1, capacityKw: 300, loadKw: 212, supplyTempC: 30 }],
		offers: [
			{ id: 41, clientId: "frontier", clientName: "Helix Labs", kind: "training", work: 4200, durationTicks: 4320, payout: 680_000, penalty: 120_000, needsLiquid: true, storageTB: 600, checkpointTicks: 120, expiresAt: 12 * 1440 + 640 },
			{ id: 42, clientId: "fin", clientName: "Quantmere Capital", kind: "inference", work: 8, sustainedPflops: 8, durationTicks: 2880, payout: 240_000, penalty: 0, needsLiquid: false, storageTB: 0, checkpointTicks: 0, expiresAt: 12 * 1440 + 1100 },
			{ id: 43, clientId: "bio", clientName: "Genefold Bio", kind: "finetune", work: 380, durationTicks: 1440, payout: 92_000, penalty: 15_000, needsLiquid: false, storageTB: 120, checkpointTicks: 60, expiresAt: 12 * 1440 + 560 },
		],
		jobs: [],
		workOrders: [{ id: 3, facilityId: 6, botId: 1, createdAt: 12 * 1440 + 430 }],
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
	};
	for (let f = -1; f <= 6; f++) for (let x = f < 0 ? 2 : 0; x < (f < 0 ? 20 : f > 4 ? 24 : 36); x++) v.slab[cellIndex(v, x, f)] = 1;
	for (let f = 0; f <= 4; f++) for (let x = 0; x < 34; x++) v.power[cellIndex(v, x, f)] = 1;
	for (let x = 4; x < 30; x++) v.coolant[cellIndex(v, x, 3)] = 1;

	let id = 1;
	const put = (defId: string, floor: number, x: number, extra: Partial<FacilityView> = {}): void => {
		const d = content.facilities[defId];
		v.facilities.push({ id: id++, defId, floor, x, width: d.width, enabled: true, status: "ok", tempC: 24, clock: 1, health: 1, powerKw: d.rack?.powerKw ?? d.facilityKw, heatKw: d.rack?.powerKw ?? 0, jobId: null, powerNet: 1, coolantNet: null, ...extra });
	};
	put("grid_tie", 0, 6);
	put("genset", 0, 9, { running: false, powerKw: 0 });
	put("ups", 0, 13, { charge: 0.8 });
	for (let i = 0; i < 8; i++) put("rack_gpu_air", 2, 8 + i, { tempC: 58 + i * 2.2, jobId: i < 6 ? 7 : null, status: i < 6 ? "ok" : "idle" });
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
			const grid = cmd.layer === "power" ? view.power : view.coolant;
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
		freshView: () => buildView(content),
		delayMs: opts.saveDelayMs ?? 150,
	});
	const ok: CommandResult = { ok: true };
	const no = (reason: string): CommandResult => ({ ok: false, reason });

	const canPlace = (defId: string, floor: number, x: number): CommandResult => canPlaceFor(view, content, defId, floor, x);

	const store: FakeStore = {
		ghost: null,
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
					newView({ cash: view.cash - d.cost, facilities: [...view.facilities, { id, defId: d.id, floor: cmd.floor, x: cmd.x, width: d.width, enabled: true, status: d.rack ? "idle" : "ok", tempC: 24, clock: 1, health: 1, powerKw: 0, heatKw: 0, jobId: null, powerNet: 1, coolantNet: null }] });
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
				case "buyBot":
					return no("All bot docks are full");
				case "demolish":
					newView({ facilities: view.facilities.filter((f) => !(f.floor === cmd.floor && cmd.x >= f.x && cmd.x < f.x + f.width)) });
					return ok;
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
