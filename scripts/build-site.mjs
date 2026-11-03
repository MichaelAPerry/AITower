#!/usr/bin/env node
// Assembles the public site into ./site-dist (gitignored): site/ is the root, the game lives at play/
// (the Vite build plus the single-file AItower.html). The Vite base is "./", so the game works from any subpath.
// Usage: npm run build:site            (builds the game and the single file first)
//        npm run build:site -- --assemble-only   (reuse an existing apps/web/dist and AItower.html, as CI does)
import { execSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";

const out = "site-dist";
if (!process.argv.includes("--assemble-only")) {
	execSync("npm run build", { stdio: "inherit" });
	execSync("npm run build:single", { stdio: "inherit" });
}
for (const need of ["apps/web/dist/index.html", "apps/web/dist/AItower.html"]) {
	if (!existsSync(need)) throw new Error(`build-site: ${need} is missing; run without --assemble-only`);
}
rmSync(out, { recursive: true, force: true });
cpSync("site", out, { recursive: true });
cpSync("apps/web/dist", `${out}/play`, { recursive: true });
console.log(`site assembled in ${out}/ (game at ${out}/play/)`);
