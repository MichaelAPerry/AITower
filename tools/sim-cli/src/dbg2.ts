import { loadContent } from "@aitower/content";
import { Player } from "./player";
import { scriptedRun } from "./soulRun";

const c = loadContent();
const days = Number(process.argv[2] ?? 24);
const tree = (process.argv[3] ?? "greentech") as "synthetic" | "biotech" | "greentech";
const logs: string[] = [];
const orig = Player.prototype.hour;
Player.prototype.hour = function (this: Player) {
	orig.call(this);
	logs.push(...this.log.splice(0));
};
scriptedRun(c, "starter", tree, 1, days);
const count = new Map<string, number>();
for (const l of logs) {
	const m = /^([a-z0-9_]+)@/.exec(l);
	if (m) count.set(m[1], (count.get(m[1]) ?? 0) + 1);
	const u = /^upgrade [a-z0-9_]+->([a-z0-9_]+)/.exec(l);
	if (u) count.set(`${u[1]} (upg)`, (count.get(`${u[1]} (upg)`) ?? 0) + 1);
}
let total = 0;
for (const [k, n] of [...count].sort((a, b) => b[1] - a[1])) {
	const id = k.replace(" (upg)", "");
	const seal = c.facilities[id]?.seal?.greentech ?? 0;
	if (seal > 0) total += seal * n;
	console.log(k.padEnd(28), String(n).padStart(3), "seal", seal, "=>", seal > 0 ? seal * n : 0);
}
console.log("positive green scar from purchases:", total);
