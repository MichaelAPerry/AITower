import { simFromSnapshot } from "@aitower/sim";
export const SAVE_FORMAT = "aitower-save";
export const SAVE_VERSION = 1;
export function makeEnvelope(snapshot, view, name, savedAt) {
    return { format: SAVE_FORMAT, version: SAVE_VERSION, savedAt, name, meta: { day: view.day, cash: view.cash, tier: view.tier }, snapshot };
}
const isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const looksLikeSnapshot = (v) => isObj(v) && isNum(v.version) && typeof v.scenarioId === "string" && isNum(v.seed) && "state" in v && v.state != null;
/** Cheap structural check of a stored envelope (no sim is built). Null when it is not a usable envelope. */
export function readEnvelope(text) {
    let raw;
    try {
        raw = JSON.parse(text);
    }
    catch {
        return null;
    }
    if (!isObj(raw) || raw.format !== SAVE_FORMAT || raw.version !== SAVE_VERSION)
        return null;
    const meta = raw.meta;
    if (!isNum(raw.savedAt) || typeof raw.name !== "string" || !isObj(meta) || !isNum(meta.day) || !isNum(meta.cash) || !isNum(meta.tier))
        return null;
    if (!looksLikeSnapshot(raw.snapshot))
        return null;
    return raw;
}
const invalid = (why) => new Error(`Invalid save: ${why}`);
/**
 * Turn exported/stored text into a live sim. Accepts an envelope or a raw SimSnapshot (older exports).
 * Throws Error("Invalid save: …") on anything wrong. Never touches the running game.
 */
export function decodeSave(content, text) {
    let raw;
    try {
        raw = JSON.parse(text);
    }
    catch {
        throw invalid("not valid JSON");
    }
    if (!isObj(raw))
        throw invalid("not a save file");
    let snapshot;
    let envelope = null;
    if (raw.format === SAVE_FORMAT) {
        if (raw.version !== SAVE_VERSION)
            throw invalid(`unsupported save version ${String(raw.version)}`);
        envelope = readEnvelope(text);
        if (!envelope)
            throw invalid("damaged save envelope");
        snapshot = envelope.snapshot;
    }
    else if (raw.format === undefined && looksLikeSnapshot(raw)) {
        snapshot = raw;
    }
    else {
        throw invalid("unrecognised file format");
    }
    const build = () => {
        try {
            return simFromSnapshot(content, snapshot);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            throw msg.startsWith("Invalid save") ? err : invalid(msg);
        }
    };
    const sim = build();
    // Defence in depth: a save that loads but cannot tick would crash-loop the game, so prove it on a throwaway copy.
    try {
        build().step();
    }
    catch (err) {
        throw invalid(`simulation fails on first tick (${err instanceof Error ? err.message : String(err)})`);
    }
    return { sim, envelope };
}
