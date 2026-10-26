import { loadContent } from "@aitower/content";
import { Player } from "./player";
import { scriptedRun } from "./soulRun";

const days = Number(process.argv[2] ?? 13);
const tree = (process.argv[3] ?? "synthetic") as "synthetic" | "biotech" | "greentech";
const c = loadContent();
const run = scriptedRun(c, "starter", tree, 1, days);
const sim = run.sim;
if (!sim) throw new Error("no sim");
const v = sim.view();
console.log("tier", v.tier, "cash", v.cash, "rp", v.researchPoints, "path", v.path, "greenScore", v.greenScore);
const done = new Set(v.techResearched);
console.log("researched", [...done].join(" "));
const p = new Player(sim, c, tree);
for (const d of Object.values(c.facilities)) {
	if (d.kind === "solar" || d.kind === "wind" || d.kind === "heat_export") console.log(d.id, "usable", p.usable(d, v));
}
const spots: string[] = [];
const sd = c.facilities.solar_skin;
for (let f = 0; f <= 6; f++) for (let x = 0; x + sd.width <= v.width; x++) {
	const r = sim.canBuild({ type: "place", defId: "solar_skin", floor: f, x });
	if (r.ok || r.reason.startsWith("insufficient")) spots.push(`${f}:${x}`);
}
console.log("solar_skin spots", spots.join(" "));
const reasons = new Map<string, number>();
for (let f = 1; f <= 5; f++) for (let x = 0; x + sd.width <= v.width; x++) {
	const r = sim.canBuild({ type: "place", defId: "solar_skin", floor: f, x });
	if (!r.ok) reasons.set(r.reason, (reasons.get(r.reason) ?? 0) + 1);
}
console.log([...reasons].sort((a, b) => b[1] - a[1]).slice(0, 5));
