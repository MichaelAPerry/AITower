/**
 * Snapshot schema migrations. `migrations[v]` upgrades a decoded state from schema version `v` to `v + 1`;
 * `migrateState` chains them up to `SNAPSHOT_VERSION`. Migrations receive untrusted data and must tolerate
 * missing or malformed parts (the validator runs afterwards and rejects what is still wrong).
 *
 * History:
 *  - v1 → v2 (M1-T1): `topologyRev`, per-bot routing/backoff fields, per-work-order retry fields.

 *  - v2 → v3 (M2-T1): Ministry memos (`memos`, `memoHistory`, `modifiers`, `nextMemoTick`, `lastIssuedDay`, `nextId.memo`),
 *    `standing`, `gameOver`, and the `events` RNG stream.
 */
import { mixSeed } from "../core/rng";

export const SNAPSHOT_VERSION = 3;

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

/** Exported (mutable) so tests can register a migration for a fake older version. */
export const migrations: Record<number, StateMigration> = { 1: migrateV1, 2: migrateV2 };

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
