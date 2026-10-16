/** Snapshot → SimState: decode, migrate, validate. Throws `InvalidSaveError` ("Invalid save: …") on any problem. */
import type { ContentDB } from "@aitower/content";
import type { SimSnapshot } from "../api";
import { normalizeCommand } from "../commands/shape";
import type { SimState } from "../core/state";
import { decode } from "./codec";
import { InvalidSaveError, migrateState, type RawState, SNAPSHOT_VERSION } from "./migrate";
import { validateState } from "./validate";

export function loadSnapshot(content: ContentDB, snap: SimSnapshot): SimState {
	if (typeof snap !== "object" || snap === null) throw new InvalidSaveError("not a snapshot object");
	const { version } = snap;
	if (typeof version !== "number" || !Number.isInteger(version)) throw new InvalidSaveError(`bad version ${String(version)}`);
	if (version > SNAPSHOT_VERSION) throw new InvalidSaveError(`version ${version} is newer than this game supports (${SNAPSHOT_VERSION})`);
	if (version < 0) throw new InvalidSaveError(`bad version ${version}`);
	if (typeof snap.scenarioId !== "string" || !Object.hasOwn(content.scenarios, snap.scenarioId))
		throw new InvalidSaveError(`unknown scenario '${String(snap.scenarioId)}'`);
	if (typeof snap.state !== "object" || snap.state === null || Array.isArray(snap.state)) throw new InvalidSaveError("missing state");

	let raw: RawState;
	try {
		raw = decode(snap.state) as RawState;
	} catch (e) {
		throw new InvalidSaveError(e instanceof Error ? e.message : "unreadable state");
	}
	let migrated: RawState;
	try {
		migrated = migrateState(raw, version);
	} catch (e) {
		if (e instanceof InvalidSaveError) throw e;
		throw new InvalidSaveError("migration failed");
	}
	// Queued commands that no longer parse (e.g. saved by an older, laxer version) are dropped, not fatal.
	if (Array.isArray(migrated.pending)) migrated.pending = migrated.pending.flatMap((c) => {
			const n = normalizeCommand(c);
			return n.ok ? [n.cmd] : [];
		});
	if (migrated.scenarioId !== snap.scenarioId) throw new InvalidSaveError("state belongs to a different scenario");
	return validateState(content, migrated);
}
