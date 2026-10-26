/**
 * Hand-built fake SimView for the dev harness (and smoke tests). No sim or
 * content data is imported at runtime — only types — so the renderer can be
 * developed in isolation while those packages are written in parallel.
 */
import type { BotDef, ContentDB, FacilityDef } from "@aitower/content";
import type {
	BotView,
	CoolantNetView,
	FacilityStatus,
	FacilityView,
	LiftView,
	PowerNetView,
	SimView,
} from "@aitower/sim";

// ─── Minimal content ────────────────────────────────────────────────────

type DefInit = Pick<FacilityDef, "id" | "kind" | "category" | "width" | "color" | "accent"> & Partial<FacilityDef>;

const def = (d: DefInit): FacilityDef => ({
	name: d.id,
	description: "",
	cost: 0,
	upkeepPerDay: 0,
	unlockTier: 1,
	facilityKw: 0,
	...d,
});

const RACK = { powerKw: 40, liquidFraction: 0, pflops: 20, storageTB: 0, failurePerDay: 0.01 };

export const fixtureFacilities: Record<string, FacilityDef> = {
	rack_air_gpu: def({ id: "rack_air_gpu", kind: "rack", category: "rack", width: 2, color: "#c9bc9c", accent: "#33ff66", rack: { ...RACK, cooling: "air" } }),
	rack_dlc_gpu: def({
		id: "rack_dlc_gpu",
		kind: "rack",
		category: "rack",
		width: 2,
		color: "#a8987a",
		accent: "#c06a3b",
		rack: { ...RACK, cooling: "dlc", powerKw: 120, liquidFraction: 0.8, pflops: 90 },
		placement: { needsCoolant: true },
	}),
	rack_storage: def({ id: "rack_storage", kind: "rack", category: "rack", width: 2, color: "#5d6243", accent: "#ffb000", rack: { ...RACK, cooling: "air", powerKw: 12, pflops: 0, storageTB: 2000 } }),
	crah_unit: def({ id: "crah_unit", kind: "crah", category: "cooling", width: 2, color: "#a8987a", accent: "#4f9a85", cooling: { capacityKw: 150, radius: 8 } }),
	chiller: def({ id: "chiller", kind: "chiller", category: "cooling", width: 4, color: "#6f7473", accent: "#c06a3b", cooling: { capacityKw: 600, cop: 5 }, placement: { needsCoolant: true } }),
	cdu: def({ id: "cdu", kind: "cdu", category: "cooling", width: 2, color: "#7d6227", accent: "#c8a248", cooling: { capacityKw: 400 }, placement: { needsCoolant: true } }),
	grid_tie: def({ id: "grid_tie", kind: "grid_tie", category: "power", width: 4, color: "#5d6243", accent: "#e8dfc6", power: { capacityKw: 1500 } }),
	genset: def({ id: "genset", kind: "genset", category: "power", width: 4, color: "#3f5a3a", accent: "#ffb000", power: { capacityKw: 800, startDelayTicks: 10 } }),
	ups_battery: def({ id: "ups_battery", kind: "ups", category: "power", width: 3, color: "#4a4335", accent: "#33ff66", power: { capacityKw: 500, storageKwh: 250 } }),
	parts_depot: def({ id: "parts_depot", kind: "depot", category: "logistics", width: 3, color: "#6f7473", accent: "#c8a248", logistics: { capacity: 20 } }),
	bot_charger: def({ id: "bot_charger", kind: "charger", category: "logistics", width: 2, color: "#4a4335", accent: "#c8a248", logistics: { capacity: 2 } }),
};

export const fixtureBots: Record<string, BotDef> = {
	rover: { id: "rover", name: "Rover", cost: 50000, speed: 0.25, batteryTicks: 600, repairTicks: 30, color: "#8a8f8c" },
};

/** Only `facilities` and `bots` are read by the renderer; the rest is stubbed. */
export const fixtureContent = {
	facilities: fixtureFacilities,
	bots: fixtureBots,
	clients: [],
	scenarios: {},
	lessons: [],
} as unknown as ContentDB;

// ─── Fixture world ──────────────────────────────────────────────────────

const W = 48;
const FMIN = -2;
const FMAX = 10;

export interface Fixture {
	view: SimView;
	/** Advance one tick (mutates and returns `view`, like a real sim reusing arrays). */
	step(): SimView;
}

export function createFixture(startMinute = 600, minutesPerTick = 1): Fixture {
	const n = W * (FMAX - FMIN + 1);
	const idx = (x: number, f: number) => (f - FMIN) * W + x;
	const slab = new Uint8Array(n);
	const power = new Uint8Array(n);
	const coolant = new Uint8Array(n);
	const airTemp = new Float32Array(n);
	const powerNetOf = new Int32Array(n).fill(-1);
	const coolantNetOf = new Int32Array(n).fill(-1);
	const run = (arr: Uint8Array, f: number, x0: number, x1: number) => {
		for (let x = x0; x <= x1; x++) arr[idx(x, f)] = 1;
	};

	run(slab, -1, 4, 43);
	run(slab, 0, 0, 47);
	for (const f of [1, 2, 3]) run(slab, f, 4, 43);
	run(slab, 4, 8, 39);

	for (const f of [-1, 0, 1, 2]) run(power, f, 4, 43);
	run(power, 3, 4, 25);
	run(power, 4, 30, 39); // isolated net (brownout)
	run(coolant, -1, 4, 20);
	run(coolant, 0, 4, 4);
	run(coolant, 1, 4, 4);
	run(coolant, 2, 4, 30);

	for (let i = 0; i < n; i++) {
		if (power[i]) powerNetOf[i] = i >= idx(0, 4) ? 1 : 0;
		if (coolant[i]) coolantNetOf[i] = 0;
	}

	let nextId = 1;
	const fac = (defId: string, floor: number, x: number, status: FacilityStatus, extra: Partial<FacilityView> = {}): FacilityView => {
		const d = fixtureFacilities[defId];
		const isRack = d.kind === "rack";
		const p = d.rack?.powerKw ?? 10;
		return {
			id: nextId++,
			defId,
			floor,
			x,
			width: d.width,
			enabled: true,
			status,
			tempC: isRack ? 70 : 24,
			clock: status === "ok" ? 1 : status === "throttled" ? 0.6 : 0,
			health: status === "failed" ? 0.2 : 1,
			powerKw: status === "ok" || status === "throttled" ? p : 0,
			heatKw: isRack ? (status === "ok" ? p : status === "throttled" ? p * 0.7 : status === "idle" ? p * 0.1 : 0) : 0,
			jobId: status === "ok" || status === "throttled" ? 1 : null,
			powerNet: power[idx(x, floor)] ? powerNetOf[idx(x, floor)] : null,
			coolantNet: coolant[idx(x, floor)] ? 0 : null,
			nutrientNet: null,
			grown: false,
			contamination: 0,
			...extra,
		};
	};

	const facilities: FacilityView[] = [
		// Basement plant.
		fac("chiller", -1, 6, "ok", { heatKw: 380 }),
		fac("cdu", -1, 11, "ok", { heatKw: 300 }),
		fac("ups_battery", -1, 30, "ok", { charge: 0.72 }),
		// Ground floor: utilities + logistics.
		fac("grid_tie", 0, 5, "ok", { powerKw: 900 }),
		fac("genset", 0, 10, "ok", { running: true }),
		fac("ups_battery", 0, 15, "ok", { charge: 0.35 }),
		fac("bot_charger", 0, 26, "ok"),
		fac("parts_depot", 0, 29, "ok", { stored: 7 }),
		// Floor 1: air hall.
		fac("rack_air_gpu", 1, 6, "ok", { tempC: 72 }),
		fac("rack_air_gpu", 1, 8, "ok", { tempC: 78 }),
		fac("rack_air_gpu", 1, 10, "throttled", { tempC: 89 }),
		fac("rack_air_gpu", 1, 12, "tripped", { tempC: 96 }),
		fac("crah_unit", 1, 14, "ok", { heatKw: 110 }),
		fac("rack_storage", 1, 17, "ok", { tempC: 55 }),
		fac("rack_air_gpu", 1, 19, "failed", { tempC: 40 }),
		fac("rack_air_gpu", 1, 28, "idle", { tempC: 45 }),
		fac("crah_unit", 1, 31, "ok", { heatKw: 20 }),
		// Floor 2: liquid hall.
		fac("cdu", 2, 6, "ok", { heatKw: 250 }),
		fac("rack_dlc_gpu", 2, 9, "ok", { tempC: 68 }),
		fac("rack_dlc_gpu", 2, 11, "ok", { tempC: 70 }),
		fac("rack_dlc_gpu", 2, 13, "ok", { tempC: 66 }),
		fac("rack_dlc_gpu", 2, 34, "noCoolant", { tempC: 91 }),
		// Floor 3: unpowered rack beyond the conduit + storage.
		fac("rack_air_gpu", 3, 30, "unpowered", { tempC: 25 }),
		fac("rack_storage", 3, 8, "ok", { tempC: 50 }),
		// Floor 4: isolated brownout net.
		fac("rack_air_gpu", 4, 33, "brownout", { tempC: 74, clock: 0.5 }),
		fac("ups_battery", 4, 36, "ok", { charge: 0.12 }),
	];

	const lifts: LiftView[] = [{ id: 1, x: 24, floorMin: -1, floorMax: 3, carFloor: 0, dir: 0, doorsOpen: true, riders: 0 }];
	const bots: BotView[] = [
		{ id: 1, defId: "rover", x: 27, floor: 0, state: "toTarget", battery: 0.8, carrying: true, workOrderId: 1, trait: null },
		{ id: 2, defId: "rover", x: 16, floor: 2, state: "toDepot", battery: 0.35, carrying: false, workOrderId: null, trait: null },
		{ id: 3, defId: "rover", x: 21, floor: 1, state: "repairing", battery: 0.6, carrying: false, workOrderId: 2, trait: null },
	];

	const powerNets: PowerNetView[] = [
		{ id: 0, supplyKw: 2300, demandKw: 1900, satisfaction: 1, storedKwh: 120, storageCapacityKwh: 500, gridImportKw: 1500 },
		{ id: 1, supplyKw: 20, demandKw: 50, satisfaction: 0.4, storedKwh: 30, storageCapacityKwh: 250, gridImportKw: 0 },
	];
	const coolantNets: CoolantNetView[] = [{ id: 0, capacityKw: 600, loadKw: 470, supplyTempC: 30 }];

	const view: SimView = {
		tick: 0,
		day: 0,
		minuteOfDay: startMinute,
		width: W,
		floorMin: FMIN,
		floorMax: FMAX,
		slab,
		power,
		coolant,
		airTemp,
		powerNetOf,
		coolantNetOf,
		ambientC: 22,
		facilities,
		lifts,
		bots,
		powerNets,
		coolantNets,
		offers: [],
		jobs: [],
		workOrders: [],
		maintenance: { parts: 0, partsCapacity: 0, botsTotal: 0, botsBusy: 0, botsIdle: 0, waiting: 0, noRoute: 0 },
		cash: 3_000_000,
		spareParts: 4,
		tier: 1,
		energyPrice: 0.08,
		pue: 1.4,
		uptime: 0.99,
		itKw: 600,
		totalKw: 840,
		pflops: 300,
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
		tierNeed: { tier: 2, pflops: 120, uptime: 0.93, techs: 2, techsDone: 0 },
		researchPoints: 0,
		techResearched: [],
		clerk: { unlocked: false, policy: { enabled: false, kinds: ["training", "finetune", "inference"], minPayPerPflopHour: 0, maxPenalty: 0, allowLiquid: false }, acceptedTotal: 0 },
		loan: { principal: 0, max: 0, dailyRate: 0 },
		reports: [],
		stats: { revenue: 0, pflopHours: 0, jobsCompleted: 0, jobsFailed: 0, peakPflops: 0, facilitiesBuilt: 0, componentFailures: 0, repairs: 0, decisionsMade: 0, researchPointsEarned: 0 },
		nutrient: new Uint8Array(n),
		nutrientNetOf: new Int32Array(n).fill(-1),
		contamination: new Float32Array(n),
		nutrientNets: [],
		corruption: 0,
		contaminatedShare: 0,
		irreversible: false,
		path: null,
		organoidPflops: 0,
		soul: { sp: { synthetic: 0, biotech: 0, greentech: 0 }, spTarget: 1000, seal: { biotech: 0, greentech: 0 }, sealMax: 100, bonds: { cass: 20, bea: 20, mel: 20, luci: 30 }, bondReveal: 40, bondCommit: 50, bondEpilogue: 60, sealedOut: [], commitBlock: { synthetic: null, biotech: null, greentech: null } },
		affinity: { biotech: 0, greentech: 0, synthetic: 0 },
		pathScore: 0,
		greenScore: 0,
		refinement: 0,
		drought: false,
		sandbox: false,
		automation: { policy: { research: { enabled: false, branches: [] }, parts: { enabled: false, keep: 4 }, bots: { enabled: false, racksPerBot: 12, maxBots: 8 }, foreman: { enabled: false, reserve: 1_000_000, racks: true, cooling: true, power: true, rackLine: "auto", rackCap: "auto", coolingCap: "auto", powerCap: "auto" } }, foremanUnlocked: false, foremanStatus: [], foremanPerHour: 1 },
		gameOver: null,
	};

	const computeAir = () => {
		const amb = 20 + 4 * Math.sin(((view.minuteOfDay - 540) / 1440) * Math.PI * 2);
		view.ambientC = amb;
		for (let f = FMIN; f <= FMAX; f++) {
			for (let x = 0; x < W; x++) {
				const i = idx(x, f);
				let t = slab[i] ? 22 : amb;
				if (slab[i]) {
					for (const fv of facilities) {
						if (fv.floor !== f) continue;
						const d = fixtureFacilities[fv.defId];
						const cx = fv.x + d.width / 2;
						const dist = Math.abs(x + 0.5 - cx);
						if (d.kind === "rack") t += (fv.heatKw * (1 - (d.rack?.liquidFraction ?? 0)) * 0.22) / (1 + dist * dist * 0.15);
						if (d.kind === "crah") t -= 7 / (1 + dist * 0.4);
					}
					t += Math.sin(view.tick * 0.05 + x * 0.3) * 0.4;
				}
				airTemp[i] = Math.max(14, t);
			}
		}
	};
	computeAir();

	// Scripted motion.
	const liftStops = [0, 3, 1, -1, 2];
	let stop = 0;
	let dwell = 6;
	const botDir = new Map<number, number>([
		[1, 1],
		[2, 1],
	]);

	const step = (): SimView => {
		view.tick++;
		view.minuteOfDay = (view.minuteOfDay + minutesPerTick) % 1440;
		if (view.minuteOfDay < minutesPerTick) view.day++;

		const lift = lifts[0];
		if (dwell > 0) {
			dwell--;
			lift.doorsOpen = true;
			lift.dir = 0;
			if (dwell === 0) stop = (stop + 1) % liftStops.length;
		} else {
			const d = liftStops[stop] - lift.carFloor;
			lift.doorsOpen = false;
			lift.dir = d > 0 ? 1 : -1;
			if (Math.abs(d) <= 0.2) {
				lift.carFloor = liftStops[stop];
				dwell = 6;
			} else lift.carFloor += Math.sign(d) * 0.2;
		}

		for (const b of bots) {
			const dir = botDir.get(b.id);
			if (dir === undefined) continue;
			const [lo, hi] = b.id === 1 ? [27, 41] : [16, 32];
			b.x += dir * 0.25;
			if (b.x >= hi || b.x <= lo) botDir.set(b.id, -dir);
			b.battery = Math.max(0.05, b.battery - 0.0005);
		}

		for (const fv of facilities) {
			const d = fixtureFacilities[fv.defId];
			if (d.kind === "ups") fv.charge = ((fv.charge ?? 0) + 0.002) % 1;
			if (d.kind === "rack" && (fv.status === "ok" || fv.status === "throttled")) fv.tempC += Math.sin(view.tick * 0.07 + fv.id) * 0.3;
		}
		// Jobs come and go every few seconds so the pneumatic capsules have something to deliver.
		if (view.tick % 25 === 0) {
			const racks = facilities.filter((fv) => fixtureFacilities[fv.defId].kind === "rack" && (fv.status === "ok" || fv.status === "throttled" || fv.status === "idle"));
			const r = racks[(view.tick / 25) % racks.length];
			if (r) r.jobId = r.jobId === null ? (view.tick / 25) | 0 : r.jobId % 3 === 0 ? null : r.jobId + 100;
		}
		if (view.tick % 5 === 0) computeAir();
		return view;
	};

	return { view, step };
}
