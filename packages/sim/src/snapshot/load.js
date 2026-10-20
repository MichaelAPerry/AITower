import { normalizeCommand } from "../commands/shape";
import { decode } from "./codec";
import { InvalidSaveError, migrateState, SNAPSHOT_VERSION } from "./migrate";
import { validateState } from "./validate";
export function loadSnapshot(content, snap) {
    if (typeof snap !== "object" || snap === null)
        throw new InvalidSaveError("not a snapshot object");
    const { version } = snap;
    if (typeof version !== "number" || !Number.isInteger(version))
        throw new InvalidSaveError(`bad version ${String(version)}`);
    if (version > SNAPSHOT_VERSION)
        throw new InvalidSaveError(`version ${version} is newer than this game supports (${SNAPSHOT_VERSION})`);
    if (version < 0)
        throw new InvalidSaveError(`bad version ${version}`);
    if (typeof snap.scenarioId !== "string" || !Object.hasOwn(content.scenarios, snap.scenarioId))
        throw new InvalidSaveError(`unknown scenario '${String(snap.scenarioId)}'`);
    if (typeof snap.state !== "object" || snap.state === null || Array.isArray(snap.state))
        throw new InvalidSaveError("missing state");
    let raw;
    try {
        raw = decode(snap.state);
    }
    catch (e) {
        throw new InvalidSaveError(e instanceof Error ? e.message : "unreadable state");
    }
    let migrated;
    try {
        migrated = migrateState(raw, version);
    }
    catch (e) {
        if (e instanceof InvalidSaveError)
            throw e;
        throw new InvalidSaveError("migration failed");
    }
    // Queued commands that no longer parse (e.g. saved by an older, laxer version) are dropped, not fatal.
    if (Array.isArray(migrated.pending))
        migrated.pending = migrated.pending.flatMap((c) => {
            const n = normalizeCommand(c);
            return n.ok ? [n.cmd] : [];
        });
    if (migrated.scenarioId !== snap.scenarioId)
        throw new InvalidSaveError("state belongs to a different scenario");
    const state = validateState(content, migrated);
    state.sandbox = content.scenarios[state.scenarioId]?.sandbox === true; // follows the scenario, not the save
    return state;
}
