import { loadContent } from "@aitower/content";
import { Player } from "./player";
import { scriptedRun } from "./soulRun";

const c = loadContent();
const run = scriptedRun(c, "starter", "greentech", 1, 30);
const sim = run.sim;
if (!sim) throw new Error("no sim");
const v = sim.view();
const p = new Player(sim, c, "greentech") as unknown as Record<string, (...a: unknown[]) => unknown> & { remaining: number; log: string[] };
p.remaining = 5_000_000;
const occ = p.occupancy(v) as Uint8Array;
console.log("itKw", p.installedKw(v), "totalKw", v.totalKw, "greenScore", v.greenScore);
p.greenPower(v, occ, 3_000_000);
console.log("log", p.log);
const skin = c.facilities.solar_skin;
console.log("spots", (p.spots(v, skin, [5, 6], occ, () => 0) as unknown[]).length);
const cmd = { type: "place", defId: "solar_skin", floor: 5, x: 40 } as const;
console.log(sim.canBuild(cmd));
