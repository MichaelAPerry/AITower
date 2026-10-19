/**
 * Snapshot schema migrations. `migrations[v]` upgrades a decoded state from schema version `v` to `v + 1`;
 * `migrateState` chains them up to `SNAPSHOT_VERSION`. Migrations receive untrusted data and must tolerate
 * missing or malformed parts (the validator runs afterwards and rejects what is still wrong).
 *
 * History:
 *  - v1 → v2 (M1-T1): `topologyRev`, per-bot routing/backoff fields, per-work-order retry fields.

 *  - v2 → v3 (M2-T1): Ministry memos (`memos`, `memoHistory`, `modifiers`, `nextMemoTick`, `lastIssuedDay`, `nextId.memo`),
 *    `standing`, `gameOver`, and the `events` RNG stream.
 *  - v3 → v4 (M2b-T1): research (`researchPoints`, `techResearched`), Contracts Clerk (`clerkPolicy`, `clerkAccepted`, `job.clerk`),
 *    loans (`loanPrincipal`), quarterly audits (`reports`, `audit`), lifetime `stats`, `scriptedIssued`, `bot.parts`, and the
 *    `taxes` / `interest` / `fees` ledger fields on every stored day.
 *  - v4 → v5 (M3-T1): nutrient layer, contamination field, growths, mutations (`bot.trait`), corruption, ascension `path`,
 *    `endingDays`, the `growth` RNG stream, `gameOver.ending`.
 */
import { mixSeed } from "../core/rng";

export const SNAPSHOT_VERSION = 5;

export type RawState = Record<string, unknown>;
export type StateMigration = (state: RawState) => RawState;

/** Thrown for any unusable save; `message` starts with "Invalid save:". */
export class InvalidSaveError extends Error {
	constructor(reason: string) {
		super(`Invalid save: ${reason}`);
		this.name = "InvalidSaveError";
	}
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function migrateV1(state: RawState): RawState {
	if (typeof state.topologyRev !== "number") state.topologyRev = 0;
	const rev = state.topologyRev as number;
	if (Array.isArray(state.bots)) {
		for (const b of state.bots) {
			if (!isObj(b)) continue;
			if (typeof b.exitFloor !== "number") b.exitFloor = b.leg === "ride" || b.leg === "waitLift" ? b.goalFloor : b.floor;
			if (typeof b.stuck !== "number") b.stuck = 0;
			if (typeof b.retryAt !== "number") b.retryAt = 0;
			if (typeof b.fails !== "number") b.fails = 0;
			if (typeof b.routeRev !== "number") b.routeRev = rev;
		}
	}
	if (Array.isArray(state.workOrders)) {
		for (const w of state.workOrders) {
			if (!isObj(w)) continue;
			if (typeof w.attempts !== "number") w.attempts = 0;
			if (typeof w.retryAt !== "number") w.retryAt = 0;
			if (typeof w.retryRev !== "number") w.retryRev = rev;
		}
	}
	return state;
}

/** Defaults for a pre-memo save: neutral standing, no memos for one game day, bankrupt saves keep their game over. */
function migrateV2(state: RawState): RawState {
	const tick = typeof state.tick === "number" ? state.tick : 0;
	if (!Array.isArray(state.memos)) state.memos = [];
	if (!Array.isArray(state.memoHistory)) state.memoHistory = [];
	if (!Array.isArray(state.modifiers)) state.modifiers = [];
	if (typeof state.nextMemoTick !== "number") state.nextMemoTick = tick + 1440;
	if (!isObj(state.lastIssuedDay)) state.lastIssuedDay = {};
	if (typeof state.standing !== "number") state.standing = 50;
	if (state.gameOver === undefined) state.gameOver = state.bankrupt === true ? { kind: "bankrupt", tick } : null;
	if (isObj(state.nextId) && typeof state.nextId.memo !== "number") state.nextId.memo = 1;
	if (isObj(state.rng) && typeof state.rng.events !== "number") state.rng.events = mixSeed(typeof state.seed === "number" ? state.seed : 0, 3);
	return state;
}

const NEW_LEDGER_FIELDS = ["taxes", "interest", "fees"] as const;

const addLedgerFields = (d: unknown): void => {
	if (!isObj(d)) return;
	for (const k of NEW_LEDGER_FIELDS) if (typeof d[k] !== "number") d[k] = 0;
};

/**
 * Defaults for a pre-research save: nothing researched, clerk locked and off, no loan, no reports, zeroed lifetime stats,
 * an empty audit period (the first audit after loading covers only the days seen since), and zero for the new ledger fields.
 */
function migrateV3(state: RawState): RawState {
	if (typeof state.researchPoints !== "number") state.researchPoints = 0;
	if (!Array.isArray(state.techResearched)) state.techResearched = [];
	if (!isObj(state.clerkPolicy)) state.clerkPolicy = { enabled: false, kinds: ["training", "finetune", "inference"], minPayPerPflopHour: 0, maxPenalty: 0, allowLiquid: true };
	if (typeof state.clerkAccepted !== "number") state.clerkAccepted = 0;
	if (typeof state.loanPrincipal !== "number") state.loanPrincipal = 0;
	if (!Array.isArray(state.reports)) state.reports = [];
	if (!isObj(state.audit)) state.audit = { samples: 0, uptimeSum: 0, pueSum: 0, days: [], jobsCompleted: 0, jobsFailed: 0 };
	if (!isObj(state.stats)) {
		state.stats = { revenue: 0, pflopHours: 0, jobsCompleted: 0, jobsFailed: 0, peakPflops: 0, facilitiesBuilt: 0, componentFailures: 0, repairs: 0, memosAnswered: 0, researchPointsEarned: 0 };
	}
	if (!Array.isArray(state.scriptedIssued)) state.scriptedIssued = [];
	if (Array.isArray(state.ledger)) for (const d of state.ledger) addLedgerFields(d);
	addLedgerFields(state.today);
	if (Array.isArray(state.jobs)) for (const j of state.jobs) if (isObj(j) && typeof j.clerk !== "boolean") j.clerk = false;
	if (Array.isArray(state.bots)) for (const b of state.bots) if (isObj(b) && typeof b.parts !== "number") b.parts = b.carrying === true ? 1 : 0;
	return state;
}

/**
 * Defaults for a pre-biotech save: no nutrient layer, a clean field, no path, zero corruption, the `growth` RNG stream,
 * and the new per-facility / per-bot fields.
 */
function migrateV4(state: RawState): RawState {
	const { width, floorMin, floorMax } = state;
	if (typeof width === "number" && typeof floorMin === "number" && typeof floorMax === "number" && Number.isInteger(width) && Number.isInteger(floorMin) && Number.isInteger(floorMax)) {
		const n = width * (floorMax - floorMin + 1);
		if (Number.isSafeInteger(n) && n >= 0 && n <= 2_000_000) {
			if (!(state.nutrient instanceof Uint8Array)) state.nutrient = new Uint8Array(n);
			if (!(state.nutrientNetOf instanceof Int32Array)) state.nutrientNetOf = new Int32Array(n).fill(-1);
			if (!(state.contamination instanceof Float32Array)) state.contamination = new Float32Array(n);
		}
	}
	if (typeof state.nutrientNetCount !== "number") state.nutrientNetCount = 0;
	if (!Array.isArray(state.nutrientNets)) state.nutrientNets = [];
	if (typeof state.contaminatedShare !== "number") state.contaminatedShare = 0;
	if (typeof state.irreversible !== "boolean") state.irreversible = false;
	if (typeof state.corruption !== "number") state.corruption = 0;
	if (state.path === undefined) state.path = null;
	if (!isObj(state.endingDays)) state.endingDays = { livingTower: 0, cleanTower: 0 };
	if (isObj(state.rng) && typeof state.rng.growth !== "number") state.rng.growth = mixSeed(typeof state.seed === "number" ? state.seed : 0, 4);
	if (isObj(state.metrics) && typeof state.metrics.organoidPflops !== "number") state.metrics.organoidPflops = 0;
	if (Array.isArray(state.facilities)) {
		for (const f of state.facilities) {
			if (!isObj(f)) continue;
			if (typeof f.nutrientNet !== "number") f.nutrientNet = -1;
			if (typeof f.nutrientSat !== "number") f.nutrientSat = 1;
			if (typeof f.noNutrient !== "boolean") f.noNutrient = false;
			if (typeof f.tooCold !== "boolean") f.tooCold = false;
			if (typeof f.grown !== "boolean") f.grown = false;
			if (typeof f.recoverAt !== "number") f.recoverAt = -1;
		}
	}
	if (Array.isArray(state.bots)) {
		for (const b of state.bots) {
			if (!isObj(b)) continue;
			if (b.trait === undefined) b.trait = null;
			if (typeof b.exposure !== "number") b.exposure = 0;
		}
	}
	return state;
}

/** Exported (mutable) so tests can register a migration for a fake older version. */
export const migrations: Record<number, StateMigration> = { 1: migrateV1, 2: migrateV2, 3: migrateV3, 4: migrateV4 };

export function migrateState(state: RawState, from: number): RawState {
	let s = state;
	for (let v = from; v < SNAPSHOT_VERSION; v++) {
		const step = Object.hasOwn(migrations, v) ? migrations[v] : undefined;
		if (!step) throw new InvalidSaveError(`no migration from version ${v}`);
		s = step(s);
		if (!isObj(s)) throw new InvalidSaveError(`migration from version ${v} failed`);
	}
	return s;
}
