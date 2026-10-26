/**
 * npx tsx tools/sim-cli/src/soulRun.ts [scenario=starter] [days=60] [seeds=1] [policy=foreman]
 *
 * Prints the Soul once per day (SP, seals, bonds, path). `policy`:
 *   foreman    the old run: every standing order on, the Foreman builds (no tree policy);
 *   synthetic | biotech | greentech   the scripted player of tools/sim-cli/src/player.ts for that tree;
 *   all        the three trees, summarised as days to the SP target (docs/TREES.md section 5 targets: 25 / 38 / 44).
 * `seeds` is one seed or a comma list ("1,2,3"). Bond pace: the scripted policy adds +3 bond a day to the tree's champion (the
 * After-hours visit does not exist in the sim yet).
 */
import { type AscensionPath, type ContentDB, loadContent } from "@aitower/content";
import { createSim, TICKS_PER_DAY, type SimView } from "@aitower/sim";
import { allAutomation, AUTO_ACCEPT_MARGIN, bestMemoChoice, PERMISSIVE_CLERK, runHeadless, shouldAccept } from "./run";
import { Player, type Tree } from "./player";

export const TARGET_DAYS: Record<Tree, number> = { synthetic: 25, biotech: 38, greentech: 44 };

export interface TreeRun {
	tree: Tree;
	seed: number;
	/** Day (1-based) the tree's bar first reached the target, or null. */
	daysTo1000: number | null;
	/** The game over, if any, e.g. "victory singularity" or "bankrupt". */
	over: string | null;
	/** Day of the commit (null for Synthetic or never). */
	commitDay: number | null;
	/** Day Level 2 / 3 / 4 / 5 were reached. */
	levelDays: (number | null)[];
	final: { pf: number; sp: Record<AscensionPath, number>; seal: Record<"biotech" | "greentech", number>; greenScore: number; cash: number };
	rows: string[];
	/** The finished game, for inspection. */
	sim?: ReturnType<typeof createSim>;
}

const r1 = (n: number): string => n.toFixed(1).padStart(7);

export function rowOf(v: SimView): string {
	const s = v.soul;
	const b = s.bonds;
	return `${String(v.day).padStart(3)} ${String(v.tier).padStart(4)} ${r1(v.pflops)} ${r1(s.sp.synthetic)} ${r1(s.sp.biotech)} ${r1(s.sp.greentech)} ${r1(s.seal.greentech).slice(1)} ${r1(s.seal.biotech).slice(1)}  ${[b.cass, b.bea, b.mel, b.luci].map((x) => String(Math.round(x)).padStart(3)).join("/")}  ${v.path ?? "-"} ${v.gameOver ? `GAME OVER ${v.gameOver.kind} ${v.gameOver.ending ?? ""}` : ""}`;
}

export const HEADER = "day tier     PF  SPsyn  SPbio  SPgrn sealG sealB  bonds(c/b/m/l)  path";

/** One scripted game of `tree` for up to `days` days. */
export function scriptedRun(content: ContentDB, scenario: string, tree: Tree, seed: number, days: number, onRow?: (row: string) => void): TreeRun {
	const sim = createSim(content, scenario, seed);
	const player = new Player(sim, content, tree);
	const run: TreeRun = { tree, seed, daysTo1000: null, over: null, commitDay: null, levelDays: [null, null, null, null], final: { pf: 0, sp: { synthetic: 0, biotech: 0, greentech: 0 }, seal: { biotech: 0, greentech: 0 }, greenScore: 0, cash: 0 }, rows: [] };
	// Standing orders: spare parts and bots only. Research, building and the commit are the player's.
	const orders = allAutomation(false);
	orders.research.enabled = false;
	sim.submit({ type: "setAutomation", policy: orders });
	const target = content.balance.soul.spTarget;
	let lastTier = 1;
	let pathSeen = false;
	for (let day = 0; day < days; day++) {
		player.dayStart(day);
		for (let t = 0; t < TICKS_PER_DAY; t++) {
			const events = sim.step();
			for (const e of events) {
				if (e.type === "contractOffered") {
					const v = sim.view();
					const offer = v.offers.find((o) => o.id === e.contractId);
					if (offer && !v.clerk.policy.enabled && shouldAccept(offer, v, content, AUTO_ACCEPT_MARGIN)) sim.submit({ type: "acceptContract", contractId: e.contractId });
				} else if (e.type === "decisionIssued") {
					const def = content.events.find((x) => x.id === e.eventId);
					const choice = def ? player.chooseDecision(def) : bestMemoChoice(content, e.eventId);
					if (choice) sim.submit({ type: "resolveDecision", decisionId: e.decisionId, choiceId: choice });
				}
			}
			if (t % 60 === 30) {
				player.hour();
				const v = sim.view();
				if (v.tier > lastTier) {
					for (let l = lastTier + 1; l <= v.tier; l++) if (l >= 2 && l <= 5) run.levelDays[l - 2] = day + 1;
					lastTier = v.tier;
				}
				if (!pathSeen && v.path !== null) {
					pathSeen = true;
					run.commitDay = day + 1;
				}
				const sp = v.soul.sp[tree];
				if (run.daysTo1000 === null && sp >= target) run.daysTo1000 = day + 1 - (TICKS_PER_DAY - t) / TICKS_PER_DAY;
			}
		}
		const v = sim.view();
		let row = rowOf(v);
		if (process.env.SOULDEBUG) {
			const sat = v.powerNets.map((n) => n.satisfaction.toFixed(2)).join(",");
			const hot = v.facilities.filter((f) => f.status === "throttled" || f.status === "tripped" || f.status === "noCoolant" || f.status === "unpowered").length;
			const inst = v.facilities.reduce((n, f) => n + (content.facilities[f.defId].rack?.pflops ?? 0), 0);
			const busy = v.facilities.filter((f) => f.jobId !== null).reduce((n, f) => n + (content.facilities[f.defId].rack?.pflops ?? 0), 0);
			const st = (sim as unknown as { state: { sealScar: { greentech: number; biotech: number }; sealResidue: { greentech: number; biotech: number } } }).state;
			row += `  scarG=${st.sealScar.greentech.toFixed(0)} resG=${st.sealResidue.greentech.toFixed(0)} inst=${inst} busy=${busy} jobs=${v.jobs.filter((j) => j.status === "running").length} offers=${v.offers.length} $${(v.cash / 1e6).toFixed(2)}M racks=${v.facilities.filter((f) => content.facilities[f.defId].kind === "rack").length} sat=${sat} bad=${hot} rp=${v.researchPoints.toFixed(0)} techs=${v.techResearched.length} | ${player.log.splice(0).join(" ")}`;
		}
		run.rows.push(row);
		onRow?.(row);
		run.final = { pf: v.pflops, sp: { ...v.soul.sp }, seal: { ...v.soul.seal }, greenScore: v.greenScore, cash: v.cash };
		if (v.gameOver) {
			run.over = `${v.gameOver.kind}${v.gameOver.ending ? ` ${v.gameOver.ending}` : ""}`;
			break;
		}
	}
	run.sim = sim;
	return run;
}

function summary(runs: TreeRun[]): string {
	const lines = ["tree       seed  days>=1000  target  vs target   commit  L2 L3 L4 L5   PF@end  SPsyn SPbio SPgrn  greenScore  over"];
	for (const r of runs) {
		const days = r.daysTo1000;
		const t = TARGET_DAYS[r.tree];
		const pct = days === null ? "never" : `${days <= t * 1.2 && days >= t * 0.8 ? "OK" : "OUT"} ${(((days - t) / t) * 100).toFixed(0).padStart(4)}%`;
		lines.push(
			`${r.tree.padEnd(10)} ${String(r.seed).padStart(4)}  ${days === null ? "   -   " : days.toFixed(1).padStart(7)}     ${String(t).padStart(4)}  ${pct.padEnd(10)} ${(r.commitDay === null ? "-" : String(r.commitDay)).padStart(6)}  ${r.levelDays.map((d) => (d === null ? "-" : String(d)).padStart(2)).join(" ")}  ${r.final.pf.toFixed(0).padStart(7)} ${r.final.sp.synthetic.toFixed(0).padStart(6)} ${r.final.sp.biotech.toFixed(0).padStart(5)} ${r.final.sp.greentech.toFixed(0).padStart(5)}  ${r.final.greenScore.toFixed(2).padStart(9)}   ${r.over ?? "-"}`,
		);
	}
	for (const tree of ["synthetic", "biotech", "greentech"] as Tree[]) {
		const ds = runs.filter((r) => r.tree === tree && r.daysTo1000 !== null).map((r) => r.daysTo1000 as number);
		if (ds.length) lines.push(`mean ${tree}: ${(ds.reduce((a, b) => a + b, 0) / ds.length).toFixed(1)} days over ${ds.length} seed(s), target ${TARGET_DAYS[tree]} (+-20%: ${(TARGET_DAYS[tree] * 0.8).toFixed(0)}-${(TARGET_DAYS[tree] * 1.2).toFixed(0)})`);
	}
	return lines.join("\n");
}

function main(argv: string[]): void {
	const [scenario = "starter", days = "60", seedArg = "1", policy = "foreman"] = argv;
	const seeds = seedArg.split(",").map(Number);
	const c = loadContent();
	if (policy === "foreman") {
		console.log(HEADER);
		runHeadless(c, scenario, Number(days), seeds[0], true, (v) => console.log(rowOf(v)));
		return;
	}
	const trees: Tree[] = policy === "all" ? ["synthetic", "biotech", "greentech"] : [policy as Tree];
	const runs: TreeRun[] = [];
	for (const tree of trees) {
		for (const seed of seeds) {
			const verbose = policy !== "all" && seeds.length === 1;
			if (verbose) console.log(HEADER);
			const r = scriptedRun(c, scenario, tree, seed, Number(days), verbose ? (row) => console.log(row) : undefined);
			runs.push(r);
			if (policy === "all") console.error(`${tree} seed ${seed}: ${r.daysTo1000?.toFixed(1) ?? "never"} days`);
		}
	}
	console.log(summary(runs));
}

if (process.argv[1]?.endsWith("soulRun.ts")) main(process.argv.slice(2));

export { PERMISSIVE_CLERK };
