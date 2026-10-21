/**
 * Pacing summary for balance work.  tsx tools/sim-cli/src/stats.ts <scenario> <days> <seed> [--auto]
 * Prints one JSON line: day each Level was reached, techs researched by day 30/60/90, bankruptcy day, final cash.
 */
import { loadContent } from "@aitower/content";
import { runHeadless } from "./run";

const argv = process.argv.slice(2);
const auto = argv.includes("--auto");
const [scenario = "starter", daysArg = "150", seedArg = "1"] = argv.filter((a) => a !== "--auto");
const { rows } = runHeadless(loadContent(), scenario, Number(daysArg), Number(seedArg), auto);
const reached = (n: number): number | null => rows.find((r) => r.tier >= n)?.day ?? null;
const techsAt = (d: number): number | null => rows[Math.min(d, rows.length) - 1]?.techs ?? null;
const over = rows.find((r) => r.gameOver);
console.log(
	JSON.stringify({ scenario, seed: Number(seedArg), L2: reached(2), L3: reached(3), L4: reached(4), L5: reached(5), t30: techsAt(30), t60: techsAt(60), t90: techsAt(90), t150: techsAt(150), over: over ? `${over.gameOver}@${over.day}` : null, cash: Math.round(rows[rows.length - 1].cash / 1e6) }),
);
