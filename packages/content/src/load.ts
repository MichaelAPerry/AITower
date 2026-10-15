// PLACEHOLDER — replaced by agent-assets. Signatures are part of the contract.
import type { ContentDB } from "./schema";

/** Returns the bundled, validated content database. Pure & synchronous (JSON is statically imported). */
export function loadContent(): ContentDB {
	throw new Error("loadContent: not implemented");
}

/** Returns a list of human-readable problems (empty = valid). */
export function validateContent(_db: ContentDB): string[] {
	return [];
}
