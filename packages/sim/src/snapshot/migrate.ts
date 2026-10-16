/**
 * Snapshot schema migrations. `migrations[v]` upgrades a decoded state from schema version `v` to `v + 1`;
 * `migrateState` chains them up to `SNAPSHOT_VERSION`. Migrations receive untrusted data and must tolerate
 * missing or malformed parts (the validator runs afterwards and rejects what is still wrong).
 *
 * History:
 *  - v1 → v2 (M1-T1): `topologyRev`, per-bot routing/backoff fields, per-work-order retry fields.
 */
export const SNAPSHOT_VERSION = 2;

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

/** Exported (mutable) so tests can register a migration for a fake older version. */
export const migrations: Record<number, StateMigration> = { 1: migrateV1 };

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
