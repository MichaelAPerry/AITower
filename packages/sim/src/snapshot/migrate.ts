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
 *  - v5 → v6 (M4-T1): automation policy, weather (`wind`, `droughtUntil`, the `weather` RNG stream), `greenScore`, `refinement`,
 *    `sandbox`, the greentech / synthetic `endingDays`, the green-energy and exported-heat rings, `job.unreported`.
 *  - v6 → v7 (M4b-T1): path `affinity` points (start at 0).
 *  - v7 → v8 (tree restructure): merged tech nodes are renamed in `techResearched`, and a tower that already runs
 *    liquid-cooling plant keeps building it (it is granted `chilled_loop`, which now gates those facilities).
 *  - v8 → v9 (M6.3 advisors): pending memos become one pending `decision` (no expiry; the first memo is kept, any others are
 *    dropped), `memoHistory` → `decisionHistory`, `nextMemoTick` → `nextDecisionTick`, `nextId.memo` → `nextId.decision`,
 *    `stats.memosAnswered` → `decisionsMade`, standing cause "memo" → "decision"; new `lastDecisionDay`, `decisionGate`, `advisorTips`.
 *  - v9 → v10 (M6.4 lessons): `lesson` (null for every earlier game).
 */
import { defaultAutomation } from "../automation/policy";
import { mixSeed } from "../core/rng";

export const SNAPSHOT_VERSION = 10;

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

/** Defaults for a pre-M4 save: every automation off, calm weather, no scores, the new rings empty. */
function migrateV5(state: RawState): RawState {
	if (!isObj(state.automation)) state.automation = defaultAutomation();
	if (typeof state.wind !== "number") state.wind = 0.6;
	if (typeof state.droughtUntil !== "number") state.droughtUntil = 0;
	if (typeof state.greenScore !== "number") state.greenScore = 0;
	if (typeof state.refinement !== "number") state.refinement = 0;
	if (typeof state.sandbox !== "boolean") state.sandbox = false;
	if (isObj(state.endingDays)) {
		if (typeof state.endingDays.greenExemplar !== "number") state.endingDays.greenExemplar = 0;
		if (typeof state.endingDays.millionMinds !== "number") state.endingDays.millionMinds = 0;
	}
	if (isObj(state.rng) && typeof state.rng.weather !== "number") state.rng.weather = mixSeed(typeof state.seed === "number" ? state.seed : 0, 5);
	if (isObj(state.metrics)) {
		const m = state.metrics;
		if (!(m.ringGreenKwh instanceof Float64Array)) m.ringGreenKwh = new Float64Array(1440);
		if (!(m.ringHeatKwh instanceof Float64Array)) m.ringHeatKwh = new Float64Array(1440);
		if (typeof m.greenKw !== "number") m.greenKw = 0;
		if (typeof m.heatExportKw !== "number") m.heatExportKw = 0;
	}
	if (Array.isArray(state.jobs)) for (const j of state.jobs) if (isObj(j) && typeof j.unreported !== "number") j.unreported = 0;
	return state;
}

/** Path affinity starts at zero on an older save. */
function migrateV6(state: RawState): RawState {
	if (!isObj(state.affinity)) state.affinity = { biotech: 0, greentech: 0, synthetic: 0 };
	return state;
}

/** Tech nodes folded into others by the tree restructure. */
export const RENAMED_TECH: Readonly<Record<string, string>> = { neuromorphic_cards: "inference_foundry", identity_register: "mind_lattice_dossier" };
const LIQUID_PLANT = ["rack_dlc_gpu", "cdu", "chiller"];

/** Merged nodes become their successors; a tower with liquid plant already placed keeps the right to build more of it. */
function migrateV7(state: RawState): RawState {
	if (!Array.isArray(state.techResearched)) return state;
	const out: unknown[] = [];
	for (const id of state.techResearched) {
		const next = typeof id === "string" && Object.hasOwn(RENAMED_TECH, id) ? RENAMED_TECH[id] : id;
		if (!out.includes(next)) out.push(next);
	}
	const hasPlant = Array.isArray(state.facilities) && state.facilities.some((f) => isObj(f) && typeof f.defId === "string" && LIQUID_PLANT.includes(f.defId));
	if (hasPlant && !out.includes("chilled_loop")) out.push("chilled_loop");
	state.techResearched = out;
	return state;
}

/** Memos become advisor decisions: a pending memo is kept as the one pending decision (waiting never expires it). */
function migrateV8(state: RawState): RawState {
	// Idempotent per field: each legacy field is converted only if it is there (a current-format state passes through untouched).
	if (Array.isArray(state.memos)) {
		const first = state.memos.find((m) => isObj(m) && typeof m.id === "number" && typeof m.eventId === "string");
		state.decision = isObj(first) ? { id: first.id, eventId: first.eventId, issuedAt: typeof first.issuedAt === "number" ? first.issuedAt : 0, deferred: false, hiddenUntil: 0 } : null;
	} else if (state.decision === undefined) state.decision = null;
	if (Array.isArray(state.memoHistory)) {
		state.decisionHistory = state.memoHistory.filter(isObj).map((h) => ({ decisionId: h.memoId, eventId: h.eventId, title: h.title, choiceId: h.choiceId, outcome: h.outcome, tick: h.tick }));
	} else if (!Array.isArray(state.decisionHistory)) state.decisionHistory = [];
	if (typeof state.nextMemoTick === "number") state.nextDecisionTick = state.nextMemoTick;
	const tick = typeof state.tick === "number" ? state.tick : 0;
	if (typeof state.lastDecisionDay !== "number") state.lastDecisionDay = state.decision ? Math.floor(tick / 1440) : -1;
	if (typeof state.decisionGate !== "boolean") state.decisionGate = true;
	if (!Array.isArray(state.advisorTips)) state.advisorTips = [];
	if (isObj(state.nextId) && typeof state.nextId.memo === "number") {
		const keepAbove = isObj(state.decision) ? (state.decision.id as number) + 1 : 1;
		state.nextId.decision = Math.max(state.nextId.memo, keepAbove);
	}
	if (isObj(state.stats) && typeof state.stats.memosAnswered === "number") state.stats.decisionsMade = state.stats.memosAnswered;
	if (Array.isArray(state.standingLog)) for (const e of state.standingLog) if (isObj(e) && e.cause === "memo") e.cause = "decision";
	for (const k of ["memos", "memoHistory", "nextMemoTick"]) delete state[k];
	if (isObj(state.nextId)) delete state.nextId.memo;
	if (isObj(state.stats)) delete state.stats.memosAnswered;
	return state;
}

/** Exported (mutable) so tests can register a migration for a fake older version. */
/** Lessons (M6.4): every earlier game is a Free Build. */
function migrateV9(state: RawState): RawState {
	if (state.lesson === undefined) state.lesson = null;
	return state;
}

export const migrations: Record<number, StateMigration> = { 9: migrateV9, 1: migrateV1, 2: migrateV2, 3: migrateV3, 4: migrateV4, 5: migrateV5, 6: migrateV6, 7: migrateV7, 8: migrateV8 };

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
