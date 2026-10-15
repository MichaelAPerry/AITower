#!/usr/bin/env node
// Builds apps/web in "artifact" mode and writes artifact/index.html (content-only: the Artifact host adds the
// doctype/head/body skeleton) next to the bundled assets in apps/web/dist-artifact/.
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

execSync("npx vite build apps/web --mode artifact", { stdio: "inherit" });
const out = "apps/web/dist-artifact";
const built = readFileSync(`${out}/index.html`, "utf8");
const style = built.match(/<style>[\s\S]*?<\/style>/)?.[0] ?? "";
const body = built.match(/<body>([\s\S]*?)<\/body>/)?.[1] ?? "";
const page = `<title>AItower</title>
<meta name="color-scheme" content="dark">
${style.replace("<style>", "<style>\n\t\t\t:root { color-scheme: dark; }")}
<link rel="stylesheet" href="assets/app.css">
${body.replace(/<script type="module"[^>]*><\/script>/, "").trim()}
<script type="module" src="assets/app.js"></script>
`;
writeFileSync(`${out}/artifact.html`, page);
console.log(`wrote ${out}/artifact.html`);
