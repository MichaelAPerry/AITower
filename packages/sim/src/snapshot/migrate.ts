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
 *  - v10 → v11 (the Soul, docs/SOUL.md): Singularity points `sp`, secret `sealScar` / `sealResidue` (an old tower is scarred by
 *    what it already holds), advisor `bonds`, `objected`, `sealedOut`; `endingDays` goes; old path endings map onto the trees
 *    (livingTower / cleanTower → flesh, greenExemplar → garden, millionMinds → singularity).
 *  - v11 → v12 (reputation removed): `standing`, `standingLog` and each report's `standingDelta` go; a "shutdown" game over
 *    (reputation 0) is kept as a final "bankrupt" one.
 *  - v12 → v13 (the three catalogues, docs/TREES.md): removed facility ids are mapped (`rack_air_gpu3` → `rack_air_gpu2`,
 *    `rack_imm_gpu` → `rack_imm_gpu2`), removed tech nodes are dropped and refunded as research points, the Vault Immersion Tank
 *    (4 → 3 tiles) and the Mind Lattice (2 → 3 tiles) are refitted to their new width (a Mind Lattice with no free tile beside
 *    it is sold back at its old price), `bondGiven` starts empty, and a tower that holds the Wetware Annex is granted the Culture
 *    Bench that now comes first. Scars and residue are left alone: a tower that already owns Bio or Green items keeps them running.
 *  - v13 → v14 (the dating systems, docs/VN_WRITING.md): `route` (null), memory `flags`, After-hours `afterHoursDay` (-1) and
 *    `afterSeen`, `gifted`, the `inbox` with `messageDay` (-1) and `messageSeen`.
 *  - v14 → v15 (the reframe, docs/REFRAME.md): `path` (the commit), `route`, `sealedOut`, `bondGiven`, memory `flags`, After-hours,
 *    gift and inbox state all go. Racks no longer come from the menu: placed OC-0 / IM-2 / IM-3 / Mel's Cortex map to OC-1 / LC-4 / ML-1 /
 *    OC-3 on the same tiles, NT-1 is sold back at the demolish refund, and removed tech nodes are refunded as research points.
 *  - v15 → v16 (achievements, docs/ACHIEVEMENTS.md): `uptimeStreak` starts at 0 (a save loaded mid-streak restarts the count).
 */
import { defaultAutomation } from "../automation/policy";
import { mixSeed } from "../core/rng";

export const SNAPSHOT_VERSION = 16;

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

/** The Soul. Scars are rebuilt from the facilities the tower already holds (the content table is passed in by `load`). */
function migrateV10(state: RawState): RawState {
	if (!isObj(state.sp)) state.sp = { synthetic: 0, biotech: 0, greentech: 0 };
	if (!isObj(state.sealScar)) state.sealScar = { biotech: 0, greentech: 0 };
	if (!isObj(state.sealResidue)) state.sealResidue = { biotech: 0, greentech: 0 };
	if (!isObj(state.bonds)) state.bonds = { cass: 20, bea: 20, mel: 20, luci: 30 };
	else if (typeof state.bonds.luci !== "number") state.bonds.luci = 30;
	if (!Array.isArray(state.objected)) state.objected = [];
	if (!Array.isArray(state.sealedOut)) state.sealedOut = [];
	delete state.endingDays;
	const MAP: Record<string, string> = { livingTower: "flesh", cleanTower: "flesh", greenExemplar: "garden", millionMinds: "singularity" };
	if (isObj(state.gameOver) && typeof state.gameOver.ending === "string" && Object.hasOwn(MAP, state.gameOver.ending)) state.gameOver.ending = MAP[state.gameOver.ending];
	return state;
}

/** Reputation is gone. */
function migrateV11(state: RawState): RawState {
	delete state.standing;
	delete state.standingLog;
	if (Array.isArray(state.reports)) for (const r of state.reports) if (isObj(r)) delete r.standingDelta;
	if (isObj(state.gameOver) && state.gameOver.kind === "shutdown") state.gameOver.kind = "bankrupt";
	return state;
}

/** Facility ids removed by the catalogue redesign, with the item that replaces each in a saved tower. */
export const REMOVED_FACILITIES: Readonly<Record<string, string>> = { rack_air_gpu3: "rack_air_gpu2", rack_imm_gpu: "rack_imm_gpu2" };
/** Tech nodes removed by the catalogue redesign, with the research points they cost (refunded when held). */
export const REMOVED_TECH: Readonly<Record<string, number>> = { hot_aisle: 2600, dielectric_handbook: 4200, ministry_liaison: 3400, procurement_committee: 3600 };
/** Old purchase price of the Mind Lattice, refunded when it cannot be widened. */
const OLD_MIND_LATTICE_COST = 8_000_000;

/** The catalogue redesign. Works on the raw decoded state (typed arrays for the grids, plain objects elsewhere). */
function migrateV12(state: RawState): RawState {
	if (!Array.isArray(state.bondGiven)) state.bondGiven = [];
	if (Array.isArray(state.techResearched)) {
		const out: unknown[] = [];
		for (const id of state.techResearched) {
			if (typeof id === "string" && Object.hasOwn(REMOVED_TECH, id)) {
				if (typeof state.researchPoints === "number") state.researchPoints += REMOVED_TECH[id];
				continue;
			}
			if (!out.includes(id)) out.push(id);
		}
		if (out.includes("wetware_annex") && !out.includes("culture_bench")) out.push("culture_bench");
		state.techResearched = out;
	}
	const { width, floorMin } = state;
	const grids = state.facilityAt instanceof Int32Array && state.slab instanceof Uint8Array && state.liftAt instanceof Int32Array;
	if (!Array.isArray(state.facilities) || typeof width !== "number" || typeof floorMin !== "number" || !grids) return state;
	const facilityAt = state.facilityAt as Int32Array;
	const slab = state.slab as Uint8Array;
	const liftAt = state.liftAt as Int32Array;
	const idx = (x: number, floor: number): number => (floor - floorMin) * width + x;
	const keep: unknown[] = [];
	let changed = false;
	for (const f of state.facilities) {
		if (!isObj(f) || typeof f.defId !== "string" || typeof f.x !== "number" || typeof f.floor !== "number" || typeof f.width !== "number") {
			keep.push(f);
			continue;
		}
		if (Object.hasOwn(REMOVED_FACILITIES, f.defId)) {
			f.defId = REMOVED_FACILITIES[f.defId];
			changed = true;
		}
		if (f.defId === "rack_imm_gpu3" && f.width === 4) {
			facilityAt[idx(f.x + 3, f.floor)] = -1;
			f.width = 3;
			changed = true;
		} else if (f.defId === "rack_mind_lattice" && f.width === 2) {
			const x = f.x + 2;
			const i = x < width ? idx(x, f.floor) : -1;
			if (i >= 0 && slab[i] === 1 && facilityAt[i] < 0 && liftAt[i] < 0) {
				facilityAt[i] = f.id as number;
				f.width = 3;
				changed = true;
			} else {
				for (let k = 0; k < 2; k++) facilityAt[idx(f.x + k, f.floor)] = -1;
				if (typeof state.cash === "number") state.cash += OLD_MIND_LATTICE_COST;
				if (Array.isArray(state.workOrders)) state.workOrders = state.workOrders.filter((w) => !(isObj(w) && w.facilityId === f.id));
				changed = true;
				continue; // sold back
			}
		}
		keep.push(f);
	}
	if (changed) {
		state.facilities = keep;
		state.netsDirty = true;
		if (typeof state.topologyRev === "number") state.topologyRev++;
	}
	return state;
}

/** The dating systems. Everything starts empty (a tower already at Level 4 is asked its confession at the next story check). */
function migrateV13(state: RawState): RawState {
	if (state.route === undefined) state.route = null;
	if (!Array.isArray(state.flags)) state.flags = [];
	if (typeof state.afterHoursDay !== "number") state.afterHoursDay = -1;
	if (!Array.isArray(state.afterSeen)) state.afterSeen = [];
	if (!Array.isArray(state.gifted)) state.gifted = [];
	if (!Array.isArray(state.inbox)) state.inbox = [];
	if (typeof state.messageDay !== "number") state.messageDay = -1;
	if (!Array.isArray(state.messageSeen)) state.messageSeen = [];
	return state;
}

/** Facility ids cut by the reframe, with the rack that replaces each in a saved tower (same tiles). */
export const SWAPPED_FACILITIES: Readonly<Record<string, string>> = {
	rack_culture_s: "organoid_incubator",
	rack_imm_gpu2: "rack_dlc_gpu3",
	rack_imm_gpu3: "rack_mind_lattice",
	rack_organoid_3m: "rack_organoid_3",
};
/** Facility ids cut by the reframe with no replacement: sold back at this refund (half the old price). */
export const SOLD_FACILITIES: Readonly<Record<string, number>> = { nutrient_tank_s: 125_000 };
/** Tech nodes folded into their rung's node by the reframe, with the research points they cost (refunded when held). */
export const REMOVED_TECH_V15: Readonly<Record<string, number>> = {
	culture_bench: 2400,
	perfusion_baths: 6000,
	perfusion_manifold: 14000,
	nutrient_works: 12000,
	vascular_plant: 28000,
	economizer: 2200,
	solar_charter: 3400,
	two_phase_immersion: 15000,
};
/** New width of a swapped rack where it narrows (IM-2 was 3 tiles, LC-4 is 2). */
const SWAPPED_WIDTH: Readonly<Record<string, number>> = { rack_dlc_gpu3: 2 };

/** The reframe: no commit, no dating state, and the cut racks become the nearest rung. */
function migrateV14(state: RawState): RawState {
	for (const k of ["path", "route", "sealedOut", "bondGiven", "flags", "afterHoursDay", "afterSeen", "gifted", "inbox", "messageDay", "messageSeen"]) delete state[k];
	if (Array.isArray(state.techResearched)) {
		const out: unknown[] = [];
		for (const id of state.techResearched) {
			if (typeof id === "string" && Object.hasOwn(REMOVED_TECH_V15, id)) {
				if (typeof state.researchPoints === "number") state.researchPoints += REMOVED_TECH_V15[id];
				continue;
			}
			if (!out.includes(id)) out.push(id);
		}
		state.techResearched = out;
	}
	const { width, floorMin } = state;
	const grids = state.facilityAt instanceof Int32Array;
	if (!Array.isArray(state.facilities) || typeof width !== "number" || typeof floorMin !== "number" || !grids) return state;
	const facilityAt = state.facilityAt as Int32Array;
	const idx = (x: number, floor: number): number => (floor - floorMin) * width + x;
	const keep: unknown[] = [];
	let changed = false;
	for (const f of state.facilities) {
		if (!isObj(f) || typeof f.defId !== "string" || typeof f.x !== "number" || typeof f.floor !== "number" || typeof f.width !== "number") {
			keep.push(f);
			continue;
		}
		if (Object.hasOwn(SOLD_FACILITIES, f.defId)) {
			for (let k = 0; k < f.width; k++) facilityAt[idx(f.x + k, f.floor)] = -1;
			if (typeof state.cash === "number") state.cash += SOLD_FACILITIES[f.defId];
			if (Array.isArray(state.workOrders)) state.workOrders = state.workOrders.filter((w) => !(isObj(w) && w.facilityId === f.id));
			changed = true;
			continue;
		}
		if (Object.hasOwn(SWAPPED_FACILITIES, f.defId)) {
			f.defId = SWAPPED_FACILITIES[f.defId as string];
			const w: number | undefined = SWAPPED_WIDTH[f.defId as string];
			if (w !== undefined && f.width > w) {
				for (let k = w; k < f.width; k++) facilityAt[idx(f.x + k, f.floor)] = -1;
				f.width = w;
			}
			changed = true;
		}
		keep.push(f);
	}
	if (changed) {
		state.facilities = keep;
		state.netsDirty = true;
		if (typeof state.topologyRev === "number") state.topologyRev++;
	}
	return state;
}

/** Achievements: the uptime streak counter. */
function migrateV15(state: RawState): RawState {
	if (typeof state.uptimeStreak !== "number" || !Number.isFinite(state.uptimeStreak) || state.uptimeStreak < 0) state.uptimeStreak = 0;
	return state;
}

export const migrations: Record<number, StateMigration> = { 15: migrateV15, 14: migrateV14, 13: migrateV13, 12: migrateV12, 11: migrateV11, 10: migrateV10, 9: migrateV9, 1: migrateV1, 2: migrateV2, 3: migrateV3, 4: migrateV4, 5: migrateV5, 6: migrateV6, 7: migrateV7, 8: migrateV8 };

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
