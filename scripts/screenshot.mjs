#!/usr/bin/env node
// Usage: node scripts/screenshot.mjs <url> <out.png> [width] [height] [waitMs]
// Uses the globally installed Playwright + pre-installed Chromium. Prints browser console errors.
import { createRequire } from "node:module";
const require = createRequire("/opt/node22/lib/node_modules/");
const { chromium } = require("playwright");

const [url, out, w = "1280", h = "800", wait = "1500"] = process.argv.slice(2);
if (!url || !out) {
	console.error("usage: screenshot.mjs <url> <out.png> [width] [height] [waitMs]");
	process.exit(2);
}
const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(url, { waitUntil: "load" });
await page.waitForTimeout(+wait);
await page.screenshot({ path: out });
await browser.close();
if (errors.length) {
	console.error(`console errors:\n${errors.join("\n")}`);
	process.exitCode = 1;
}
console.log(`saved ${out}`);
