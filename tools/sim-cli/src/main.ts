/**
 * Headless sim runner.  npm run sim -- [scenario=starter] [days=10] [seed=1]
 * Loads the real content, auto-accepts every offer (and restocks spare parts when empty), prints a per-day table and the final state hash.
 */
import type { ContentDB } from "@aitower/content";
import { loadContent } from "@aitower/content";
import { formatTable, runHeadless } from "./run";

function main(argv: string[]): number {
	const [scenario = "starter", daysArg = "10", seedArg = "1"] = argv;
	const days = Number(daysArg);
	const seed = Number(seedArg);
	if (!Number.isInteger(days) || days <= 0 || !Number.isInteger(seed)) {
		console.error("usage: npm run sim -- [scenario] [days>0] [seed:int]");
		return 2;
	}
	let content: ContentDB;
	try {
		content = loadContent();
	} catch (err) {
		console.error(`sim-cli: could not load content via @aitower/content loadContent(): ${(err as Error).message}`);
		return 1;
	}
	if (!content.scenarios[scenario]) {
		console.error(`sim-cli: unknown scenario '${scenario}'. Available: ${Object.keys(content.scenarios).join(", ")}`);
		return 2;
	}
	const t0 = process.hrtime.bigint();
	const { rows, hash } = runHeadless(content, scenario, days, seed);
	const ms = Number(process.hrtime.bigint() - t0) / 1e6;
	console.log(`scenario=${scenario} days=${days} seed=${seed}  (policy: accept fitting offers, restock parts when empty, memos: best cash choice, research: clerk first then cheapest, clerk on, never borrows)\n`);
	console.log(formatTable(rows));
	console.log(`\nfinal hash: ${hash}   (${ms.toFixed(0)} ms)`);
	return 0;
}

process.exitCode = main(process.argv.slice(2));
