#!/usr/bin/env node
// Builds the whole game as ONE self-contained HTML file (JS, CSS and fonts inlined) that opens straight from disk,
// no server or install needed. Writes apps/web/dist/AItower.html, so the Pages site serves it as a download.
// Usage: node scripts/build-single.mjs   (run after `npm run build`, which creates apps/web/dist)
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

execSync("npx vite build apps/web --mode artifact", { stdio: "inherit" });
const src = "apps/web/dist-artifact";
let html = readFileSync(`${src}/index.html`, "utf8");
const css = readFileSync(`${src}/assets/app.css`, "utf8");
// A literal "</script" inside the bundle would end the inline script early.
const js = readFileSync(`${src}/assets/app.js`, "utf8").replace(/<\/script/gi, "<\\/script");

const scriptTag = /<script type="module"[^>]*src="\.\/assets\/app\.js"><\/script>/;
const cssTag = /<link rel="stylesheet"[^>]*href="\.\/assets\/app\.css">/;
if (!scriptTag.test(html) || !cssTag.test(html)) throw new Error("build-single: unexpected index.html shape");
// Function replacements: the bundle contains "$&"-style sequences that string replacements would interpret.
html = html.replace(cssTag, () => `<style>\n${css}\n</style>`);
html = html.replace(scriptTag, () => "");
html = html.replace("</body>", () => `<script type="module">\n${js}\n</script>\n</body>`);

if (!existsSync("apps/web/dist")) mkdirSync("apps/web/dist", { recursive: true });
writeFileSync("apps/web/dist/AItower.html", html);
console.log(`wrote apps/web/dist/AItower.html (${(html.length / 1e6).toFixed(2)} MB)`);
