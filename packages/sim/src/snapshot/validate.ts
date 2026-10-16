/**
 * Structural validation of a decoded (and migrated) SimState. Everything the tick pipeline indexes or dereferences
 * is checked here, so a state that passes can be stepped without throwing. Throws `InvalidSaveError`.
 *
 * Deliberately NOT required (the sim tolerates and repairs them): a bot's `goalId` / `liftId` pointing at something
 * that was since removed, and `powerNets` / `coolantNets` having fewer entries than the net count (before the first
 * solve).
 */
import type { ContentDB } from "@aitower/content";
import { TICKS_PER_DAY } from "../api";
import type { BotLeg, BotTask, SimState } from "../core/state";
import type { Bot, Facility, Job, Lift, WorkOrder } from "../core/state";
import { InvalidSaveError, type RawState } from "./migrate";

type Kind = "int" | "num" | "bool" | "str";
type Obj = Record<string, unknown>;

/** Hard cap on grid size so a hostile save cannot make us allocate gigabytes. */
const MAX_CELLS = 2_000_000;

const fail = (reason: string): never => {
	throw new InvalidSaveError(reason);
};

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

function check(kind: Kind, v: unknown): boolean {
	switch (kind) {
		case "int":
			return typeof v === "number" && Number.isInteger(v);
		case "num":
			return typeof v === "number" && Number.isFinite(v);
		case "bool":
			return typeof v === "boolean";
		case "str":
			return typeof v === "string";
	}
}

/** Require every field of `shape` on `o` to have the right primitive type. */
function fields(o: unknown, shape: Record<string, Kind>, where: string): Obj {
	if (!isObj(o)) return fail(`${where} is not an object`);
	for (const [k, kind] of Object.entries(shape)) {
		if (!check(kind, o[k])) fail(`${where}.${k} must be ${kind === "int" ? "an integer" : kind === "num" ? "a finite number" : kind === "bool" ? "a boolean" : "a string"} (got ${String(o[k])})`);
	}
	return o;
}

// Compile-time completeness: adding a field to an entity makes these tables fail to typecheck until it is covered.
const FACILITY: Record<keyof Facility, Kind> = {
	id: "int", defId: "str", floor: "int", x: "int", width: "int", enabled: "bool", powerNet: "int", coolantNet: "int",
	sat: "num", demandKw: "num", powerKw: "num", heatKw: "num", tempC: "num", busy: "bool", thermalClock: "num", clock: "num",
	pflops: "num", health: "num", jobId: "int", failed: "bool", tripped: "bool", cooldown: "num", throttled: "bool",
	noCoolant: "bool", coolantC: "num", gensetMode: "int", gensetTimer: "num", surplusTicks: "num", storedKwh: "num",
	stored: "num", charging: "bool",
};
const LIFT: Record<Exclude<keyof Lift, "riders">, Kind> = {
	id: "int", x: "int", floorMin: "int", floorMax: "int", powerNet: "int", sat: "num", carFloor: "num", dir: "int",
	doorsOpen: "bool", doorTimer: "num",
};
const BOT: Record<keyof Bot, Kind> = {
	id: "int", defId: "str", x: "num", floor: "num", battery: "num", carrying: "bool", task: "str", leg: "str", goalId: "int",
	goalX: "num", goalFloor: "num", liftId: "int", workOrderId: "int", homeId: "int", timer: "num", exitFloor: "num",
	stuck: "num", retryAt: "num", fails: "num", routeRev: "num",
};
const WORK_ORDER: Record<keyof WorkOrder, Kind> = { id: "int", facilityId: "int", botId: "int", createdAt: "num", attempts: "num", retryAt: "num", retryRev: "num" };
const JOB: Record<Exclude<keyof Job, "spec" | "rackIds">, Kind> = {
	id: "int", contractId: "int", status: "str", acceptedAt: "num", deadline: "num", progress: "num", total: "num",
	lastCheckpoint: "num", sinceCheckpoint: "num", pflops: "num", earned: "num", finishedAt: "num",
};
const SPEC: Record<string, Kind> = {
	clientId: "str", clientName: "str", kind: "str", work: "num", durationTicks: "num", payout: "num", penalty: "num",
	needsLiquid: "bool", storageTB: "num", checkpointTicks: "num",
};
const NET: Record<string, Kind> = {
	id: "int", supplyKw: "num", demandKw: "num", satisfaction: "num", storedKwh: "num", storageCapacityKwh: "num",
	gridImportKw: "num", gensetKw: "num",
};
const COOLANT_NET: Record<string, Kind> = { id: "int", capacityKw: "num", loadKw: "num", supplyTempC: "num" };
const LEDGER_DAY: Record<string, Kind> = { day: "int", revenue: "num", energy: "num", upkeep: "num", construction: "num", penalties: "num" };
const SAMPLE: Record<string, Kind> = { tick: "num", pue: "num", itKw: "num", totalKw: "num", pflops: "num", cash: "num", maxRackC: "num" };
const METRIC_NUMS: Record<string, Kind> = {
	itKw: "num", totalKw: "num", gridKw: "num", gensetKw: "num", pflops: "num", energyCost: "num", pue: "num", uptime: "num", maxRackC: "num",
};

const TASKS: readonly BotTask[] = ["none", "depot", "target", "repair", "charger", "charge"];
const LEGS: readonly BotLeg[] = ["walk", "waitLift", "ride"];
const JOB_STATUS = ["queued", "running", "stalled", "completed", "failed"];
const JOB_KINDS = ["training", "finetune", "inference"];

type TypedCtor = Uint8ArrayConstructor | Int32ArrayConstructor | Float32ArrayConstructor | Float64ArrayConstructor;

function typed(o: Obj, key: string, ctor: TypedCtor, length: number): ArrayLike<number> {
	const v = o[key];
	if (!(v instanceof ctor)) return fail(`${key} must be a ${ctor.name}`);
	if (v.length !== length) return fail(`${key} has length ${v.length}, expected ${length}`);
	return v;
}

function array(o: Obj, key: string): unknown[] {
	const v = o[key];
	return Array.isArray(v) ? v : fail(`${key} must be an array`);
}

/** ids strictly ascending and below the allocator's next id. */
function checkIds(list: readonly { id: number }[], next: number, what: string): void {
	let prev = 0;
	for (const e of list) {
		if (e.id <= prev) fail(`${what} ids must be positive and strictly ascending (id ${e.id})`);
		prev = e.id;
	}
	if (prev >= next) fail(`${what} id ${prev} is not below the next id ${next}`);
}

function ownDef<T>(table: Record<string, T>, id: string): T | undefined {
	return Object.hasOwn(table, id) ? table[id] : undefined;
}

function finiteDeep(v: unknown, path: string, depth = 0): void {
	if (depth > 32) fail(`${path} is nested too deeply`);
	if (typeof v === "number") {
		if (!Number.isFinite(v)) fail(`${path} is not a finite number`);
	} else if (v instanceof Float32Array || v instanceof Float64Array) {
		for (let i = 0; i < v.length; i++) if (!Number.isFinite(v[i])) fail(`${path}[${i}] is not a finite number`);
	} else if (Array.isArray(v)) {
		for (let i = 0; i < v.length; i++) finiteDeep(v[i], `${path}[${i}]`, depth + 1);
	} else if (isObj(v)) {
		for (const [k, x] of Object.entries(v)) finiteDeep(x, `${path}.${k}`, depth + 1);
	}
}

export function validateState(content: ContentDB, raw: RawState): SimState {
	const s = fields(raw, {
		scenarioId: "str", seed: "num", tick: "int", width: "int", floorMin: "int", floorMax: "int", powerNetCount: "int",
		coolantNetCount: "int", netsDirty: "bool", topologyRev: "int", storageUtil: "num", nextOfferTick: "num", cash: "num",
		tier: "int", bankrupt: "bool", negativeCashTicks: "num", ambientC: "num",
	}, "state");
	if (!Object.hasOwn(content.scenarios, s.scenarioId as string)) fail(`unknown scenario '${String(s.scenarioId)}'`);
	if ((s.tick as number) < 0) fail("tick is negative");
	if ((s.tier as number) < 1) fail("tier must be at least 1");

	const width = s.width as number;
	const floorMin = s.floorMin as number;
	const floorMax = s.floorMax as number;
	if (width < 1 || floorMax < floorMin) fail("grid dimensions are invalid");
	const cells = width * (floorMax - floorMin + 1);
	if (!Number.isSafeInteger(cells) || cells > MAX_CELLS) fail(`grid of ${cells} cells is too large`);
	const floors = floorMax - floorMin + 1;
	const idx = (x: number, floor: number): number => (floor - floorMin) * width + x;
	const inGrid = (x: number, floor: number): boolean => Number.isInteger(x) && Number.isInteger(floor) && x >= 0 && x < width && floor >= floorMin && floor <= floorMax;

	// ── grid layers ──
	const slab = typed(s, "slab", Uint8Array, cells);
	typed(s, "power", Uint8Array, cells);
	typed(s, "coolant", Uint8Array, cells);
	const facilityAt = typed(s, "facilityAt", Int32Array, cells);
	const liftAt = typed(s, "liftAt", Int32Array, cells);
	typed(s, "airTemp", Float32Array, cells);
	const powerNetOf = typed(s, "powerNetOf", Int32Array, cells);
	const coolantNetOf = typed(s, "coolantNetOf", Int32Array, cells);
	void slab;
	const pCount = s.powerNetCount as number;
	const cCount = s.coolantNetCount as number;
	if (pCount < 0 || cCount < 0 || pCount > cells || cCount > cells) fail("net counts are out of range");
	for (let i = 0; i < cells; i++) {
		if (powerNetOf[i] < -1 || powerNetOf[i] >= pCount) fail(`powerNetOf[${i}] is out of range`);
		if (coolantNetOf[i] < -1 || coolantNetOf[i] >= cCount) fail(`coolantNetOf[${i}] is out of range`);
	}

	// ── id allocator ──
	const nextId = fields(s.nextId, { facility: "int", lift: "int", bot: "int", contract: "int", job: "int", workOrder: "int" }, "nextId") as Record<string, number>;
	for (const [k, v] of Object.entries(nextId)) if (v < 1) fail(`nextId.${k} must be at least 1`);

	// ── facilities ──
	const facilities = array(s, "facilities") as Facility[];
	const facilityById = new Map<number, Facility>();
	let facilityCells = 0;
	for (let n = 0; n < facilities.length; n++) {
		const f = fields(facilities[n], FACILITY, `facilities[${n}]`) as unknown as Facility;
		const def = ownDef(content.facilities, f.defId);
		if (!def) fail(`facilities[${n}] uses unknown def '${f.defId}'`);
		if (def && f.width !== def.width) fail(`facilities[${n}] width ${f.width} does not match def '${f.defId}' (${def.width})`);
		if (f.width < 1 || !inGrid(f.x, f.floor) || !inGrid(f.x + f.width - 1, f.floor)) fail(`facilities[${n}] is out of bounds`);
		for (let k = 0; k < f.width; k++) if (facilityAt[idx(f.x + k, f.floor)] !== f.id) fail(`facilityAt does not match facilities[${n}]`);
		facilityCells += f.width;
		if (f.powerNet < -1 || f.powerNet >= pCount) fail(`facilities[${n}].powerNet is out of range`);
		if (f.coolantNet < -1 || f.coolantNet >= cCount) fail(`facilities[${n}].coolantNet is out of range`);
		if (f.gensetMode < 0 || f.gensetMode > 2) fail(`facilities[${n}].gensetMode is invalid`);
		facilityById.set(f.id, f);
	}
	checkIds(facilities, nextId.facility, "facility");
	let occupied = 0;
	for (let i = 0; i < cells; i++) if (facilityAt[i] >= 0) occupied++;
	if (occupied !== facilityCells) fail("facilityAt has cells that no facility covers");

	// ── lifts ──
	const lifts = array(s, "lifts") as Lift[];
	let liftCells = 0;
	const liftIds = new Set<number>();
	for (let n = 0; n < lifts.length; n++) {
		const l = fields(lifts[n], LIFT, `lifts[${n}]`) as unknown as Lift;
		if (!inGrid(l.x, l.floorMin) || !inGrid(l.x, l.floorMax) || l.floorMax < l.floorMin) fail(`lifts[${n}] is out of bounds`);
		for (let fl = l.floorMin; fl <= l.floorMax; fl++) if (liftAt[idx(l.x, fl)] !== l.id) fail(`liftAt does not match lifts[${n}]`);
		liftCells += l.floorMax - l.floorMin + 1;
		if (l.carFloor < l.floorMin || l.carFloor > l.floorMax) fail(`lifts[${n}].carFloor is outside its shaft`);
		if (l.dir !== -1 && l.dir !== 0 && l.dir !== 1) fail(`lifts[${n}].dir is invalid`);
		if (l.powerNet < -1 || l.powerNet >= pCount) fail(`lifts[${n}].powerNet is out of range`);
		if (!Array.isArray(l.riders) || l.riders.some((r) => !Number.isInteger(r))) fail(`lifts[${n}].riders must be an array of bot ids`);
		liftIds.add(l.id);
	}
	checkIds(lifts, nextId.lift, "lift");
	let shaft = 0;
	for (let i = 0; i < cells; i++) if (liftAt[i] >= 0) shaft++;
	if (shaft !== liftCells) fail("liftAt has cells that no lift covers");

	// ── bots ──
	const bots = array(s, "bots") as Bot[];
	const botIds = new Set<number>();
	for (let n = 0; n < bots.length; n++) {
		const b = fields(bots[n], BOT, `bots[${n}]`) as unknown as Bot;
		if (!ownDef(content.bots, b.defId)) fail(`bots[${n}] uses unknown bot def '${b.defId}'`);
		if (b.x < 0 || b.x > width - 1 || b.floor < floorMin || b.floor > floorMax) fail(`bots[${n}] is out of bounds`);
		if (!TASKS.includes(b.task)) fail(`bots[${n}].task '${String(b.task)}' is invalid`);
		if (!LEGS.includes(b.leg)) fail(`bots[${n}].leg '${String(b.leg)}' is invalid`);
		if (b.homeId !== -1 && !facilityById.has(b.homeId)) fail(`bots[${n}].homeId ${b.homeId} does not exist`);
		if (typeof b.carrying !== "boolean") fail(`bots[${n}].carrying must be a boolean`);
		botIds.add(b.id);
	}
	checkIds(bots, nextId.bot, "bot");
	for (const l of lifts) for (const r of l.riders) if (!botIds.has(r)) fail(`lift ${l.id} carries unknown bot ${r}`);

	// ── work orders ──
	const workOrders = array(s, "workOrders") as WorkOrder[];
	const workOrderIds = new Set<number>();
	for (let n = 0; n < workOrders.length; n++) {
		const w = fields(workOrders[n], WORK_ORDER, `workOrders[${n}]`) as unknown as WorkOrder;
		if (!facilityById.has(w.facilityId)) fail(`workOrders[${n}] targets unknown facility ${w.facilityId}`);
		if (w.botId !== -1 && !botIds.has(w.botId)) fail(`workOrders[${n}] is assigned to unknown bot ${w.botId}`);
		workOrderIds.add(w.id);
	}
	checkIds(workOrders, nextId.workOrder, "work order");
	for (const b of bots) if (b.workOrderId !== -1 && !workOrderIds.has(b.workOrderId)) fail(`bot ${b.id} references unknown work order ${b.workOrderId}`);

	// ── jobs & offers ──
	const jobs = array(s, "jobs") as Job[];
	const jobIds = new Set<number>();
	for (let n = 0; n < jobs.length; n++) {
		const j = fields(jobs[n], JOB, `jobs[${n}]`) as unknown as Job;
		if (!JOB_STATUS.includes(j.status)) fail(`jobs[${n}].status is invalid`);
		checkSpec(j.spec, `jobs[${n}].spec`);
		if (!Array.isArray(j.rackIds)) fail(`jobs[${n}].rackIds must be an array`);
		for (const id of j.rackIds) if (!facilityById.has(id)) fail(`jobs[${n}] uses unknown rack ${id}`);
		jobIds.add(j.id);
	}
	checkIds(jobs, nextId.job, "job");
	for (const f of facilities) if (f.jobId !== -1 && !jobIds.has(f.jobId)) fail(`facility ${f.id} references unknown job ${f.jobId}`);
	const offers = array(s, "offers") as { id: number; spec: unknown; expiresAt: number }[];
	for (let n = 0; n < offers.length; n++) {
		fields(offers[n], { id: "int", expiresAt: "num" }, `offers[${n}]`);
		checkSpec(offers[n].spec, `offers[${n}].spec`);
	}
	checkIds(offers, nextId.contract, "offer");

	// ── nets, economy, history ──
	const powerNets = array(s, "powerNets");
	powerNets.forEach((n, i) => fields(n, NET, `powerNets[${i}]`));
	const coolantNets = array(s, "coolantNets");
	coolantNets.forEach((n, i) => fields(n, COOLANT_NET, `coolantNets[${i}]`));
	const ledger = array(s, "ledger");
	ledger.forEach((d, i) => fields(d, LEDGER_DAY, `ledger[${i}]`));
	fields(s.today, LEDGER_DAY, "today");
	const history = array(s, "history");
	history.forEach((d, i) => fields(d, SAMPLE, `history[${i}]`));
	const m = fields(s.metrics, METRIC_NUMS, "metrics");
	for (const ring of ["ringTotalKwh", "ringItKwh", "ringShouldRun", "ringRunning"]) typed(m, ring, Float64Array, TICKS_PER_DAY);
	const rng = fields(s.rng, { contracts: "num", reliability: "num" }, "rng");
	void rng;
	array(s, "pending");

	// Catch-all: any non-finite number anywhere (including float arrays) is corruption.
	finiteDeep(s, "state");
	void floors;
	return s as unknown as SimState;
}

function checkSpec(spec: unknown, where: string): void {
	const o = fields(spec, SPEC, where);
	if (!JOB_KINDS.includes(o.kind as string)) fail(`${where}.kind is invalid`);
	if (o.sustainedPflops !== undefined && !check("num", o.sustainedPflops)) fail(`${where}.sustainedPflops must be a finite number`);
}
