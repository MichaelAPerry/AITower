/** npx tsx tools/sim-cli/src/soulRun.ts [scenario] [days] [seed]: the --auto run, printing the Soul once per day (SP, seals, bonds, path). */
import { loadContent } from "@aitower/content";
import { runHeadless } from "./run";

const [scenario = "starter", days = "60", seed = "1"] = process.argv.slice(2);
const c = loadContent();
const r = (n: number): string => n.toFixed(1).padStart(7);
console.log("day tier     PF  SPsyn  SPbio  SPgrn sealG sealB  bonds(c/b/m/l)  path");
runHeadless(c, scenario, Number(days), Number(seed), true, (v) => {
	const s = v.soul;
	const b = s.bonds;
	console.log(`${String(v.day).padStart(3)} ${String(v.tier).padStart(4)} ${r(v.pflops)} ${r(s.sp.synthetic)} ${r(s.sp.biotech)} ${r(s.sp.greentech)} ${r(s.seal.greentech).slice(1)} ${r(s.seal.biotech).slice(1)}  ${[b.cass, b.bea, b.mel, b.luci].map((x) => String(Math.round(x)).padStart(3)).join("/")}  ${v.path ?? "-"} ${v.gameOver ? `GAME OVER ${v.gameOver.kind} ${v.gameOver.ending ?? ""}` : ""}`);
});
