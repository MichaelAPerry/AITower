#!/usr/bin/env node
// Enforces the dependency matrix in docs/ARCHITECTURE.md §1.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ALLOWED = {
	sim: ["content"],
	content: [],
	shared: ["sim", "content"],
	render: ["sim", "content", "shared", "pixi.js"],
	ui: ["sim", "content", "shared", "react", "react-dom"],
	audio: ["sim", "content", "shared"],
};
// Packages that must not touch browser/global nondeterminism.
const PURE = { sim: [/\bMath\.random\b/, /\bDate\.now\b/, /\bnew Date\b/, /\bperformance\.now\b/, /\bdocument\./, /\bwindow\./] };

const walk = (dir) =>
	readdirSync(dir).flatMap((f) => {
		const p = join(dir, f);
		return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
	});

let errors = 0;
for (const [pkg, allowed] of Object.entries(ALLOWED)) {
	for (const file of walk(join("packages", pkg, "src"))) {
		const src = readFileSync(file, "utf8");
		for (const m of src.matchAll(/(?:import|export)[^'"]*?from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g)) {
			const spec = m[1] ?? m[2];
			if (spec.startsWith(".") || spec.startsWith("node:") && file.endsWith(".test.ts")) continue;
			const target = spec.startsWith("@aitower/") ? spec.split("/")[1] : spec.split("/")[0];
			if (target === pkg) continue;
			if (!allowed.includes(target)) {
				console.error(`✗ ${file}: '${pkg}' may not import '${spec}'`);
				errors++;
			}
		}
		if (PURE[pkg] && !file.endsWith(".test.ts")) {
			for (const re of PURE[pkg]) {
				if (re.test(src)) {
					console.error(`✗ ${file}: '${pkg}' must stay deterministic/headless (${re})`);
					errors++;
				}
			}
		}
	}
}
if (errors) process.exit(1);
console.log("✓ module boundaries OK");
