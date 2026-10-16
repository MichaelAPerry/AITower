/**
 * Bundled content loader. JSON is statically imported (works in Vite, tsx and
 * vitest), so `loadContent()` is synchronous and pure.
 */
import { generateContract } from "./contracts";
import balance from "./data/balance.json";
import bots from "./data/bots.json";
import clients from "./data/clients.json";
import events from "./data/events.json";
import facilities from "./data/facilities.json";
import lift from "./data/lift.json";
import scenarios from "./data/scenarios.json";
import structure from "./data/structure.json";
import type { ContentDB } from "./schema";
import { validateContent } from "./validate";

export { validateContent } from "./validate";

/**
 * Returns the bundled, validated content database. Pure & synchronous.
 * Each call returns a fresh deep copy, so callers may not corrupt each other.
 * Throws an Error listing every problem if the data is invalid.
 */
export function loadContent(): ContentDB {
	// JSON imports widen string unions to `string`; validateContent checks the real shapes.
	const raw = structuredClone({ facilities, bots, clients, structure, lift, balance, scenarios, events }) as unknown as Omit<
		ContentDB,
		"generateContract"
	>;
	const db: ContentDB = { ...raw, generateContract };
	const problems = validateContent(db);
	if (problems.length > 0) {
		throw new Error(`Invalid content (${problems.length} problem${problems.length === 1 ? "" : "s"}):\n- ${problems.join("\n- ")}`);
	}
	return db;
}
