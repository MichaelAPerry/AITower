#!/usr/bin/env node
// Fails when any JS chunk in apps/web/dist/assets exceeds 450 kB uncompressed, or total JS exceeds 1.45 MB.
// (1.3 MB until M3; the Biotech path added sim, content, render and music data. Total includes Pixi's lazily loaded back ends.)
// Usage: node scripts/bundle-budget.mjs [assetsDir]   (run after `npm run build`)
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const KB = 1000;
const MAX_CHUNK = 450 * KB;
const MAX_TOTAL = 1450 * KB;
const dir = process.argv[2] ?? "apps/web/dist/assets";

if (!existsSync(dir)) {
	console.error(`bundle budget: ${dir} not found; run "npm run build" first`);
	process.exit(2);
}
const chunks = readdirSync(dir)
	.filter((f) => f.endsWith(".js"))
	.map((f) => ({ name: f, size: statSync(join(dir, f)).size }))
	.sort((a, b) => b.size - a.size);
if (chunks.length === 0) {
	console.error(`bundle budget: no .js files in ${dir}`);
	process.exit(2);
}

const kb = (n) => `${(n / KB).toFixed(1)} kB`;
const total = chunks.reduce((n, c) => n + c.size, 0);
const failures = [];
for (const c of chunks) {
	const over = c.size > MAX_CHUNK;
	console.log(`${over ? "FAIL" : "ok  "} ${c.name.padEnd(40)} ${kb(c.size).padStart(10)}`);
	if (over) failures.push(`chunk ${c.name} is ${kb(c.size)} (limit ${kb(MAX_CHUNK)})`);
}
console.log(`total JS ${kb(total)} (limit ${kb(MAX_TOTAL)})`);
if (total > MAX_TOTAL) failures.push(`total JS is ${kb(total)} (limit ${kb(MAX_TOTAL)})`);

if (failures.length) {
	console.error(`\nbundle budget exceeded:\n- ${failures.join("\n- ")}`);
	process.exit(1);
}
console.log("bundle budget ok");
