#!/usr/bin/env node
// Records real gameplay moments for the trailer (no spoilers: Free Build opening only).
// Usage: npm run build && node trailer/capture.mjs      (starts `vite preview` itself)
// Output: /tmp/trailer/raw/game.webm + /tmp/trailer/raw/marks.json (seconds into the video for each moment)
import { spawn } from "node:child_process";
import { mkdirSync, renameSync, writeFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const PORT = Number(process.env.TRAILER_PORT ?? 4791);
const RAW = "/tmp/trailer/raw";
mkdirSync(RAW, { recursive: true });
const require = createRequire(join(root, "/"));
let playwright;
for (const dir of [root, "/opt/node22/lib/node_modules/"]) {
	try { playwright = createRequire(join(dir, "/"))("playwright"); break; } catch { /* try next */ }
}
if (!playwright) throw new Error("playwright not found");
void require;

const server = spawn(join(root, "node_modules/.bin/vite"), ["preview", "apps/web", "--port", String(PORT), "--strictPort", "--host", "127.0.0.1"], { cwd: root, stdio: "ignore" });
const url = `http://127.0.0.1:${PORT}/`;
for (let i = 0; i < 60; i++) {
	try { if ((await fetch(url)).ok) break; } catch { /* wait */ }
	await new Promise((r) => setTimeout(r, 250));
}

const browser = await playwright.chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: RAW, size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
const t0 = Date.now();
const now = () => (Date.now() - t0) / 1000;
const marks = {};
const wait = (ms) => page.waitForTimeout(ms);
const game = (fn, arg) => page.evaluate(fn, arg);
const place = (defId, floor, x) => game((c) => window.aitower.store.dispatch(c), { type: "place", defId, floor, x });
const send = (cmd) => game((c) => window.aitower.store.dispatch(c), cmd);

await page.goto(`${url}?new&seed=7`, { waitUntil: "load" });
await page.waitForFunction(() => !!window.aitower?.store && !document.getElementById("boot") && !!document.querySelector(".aitower-hud"));
// Story scenes interrupt fast play (and some names are spoilers): hide them and press Enter through them.
await page.addStyleTag({ content: ".vn-stage{visibility:hidden!important}" });
await page.evaluate(() => {
	setInterval(() => {
		const el = document.querySelector(".vn-stage");
		if (el) el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
	}, 60);
});
await game(() => window.aitower.store.setSpeed(0));
await wait(800);
marks.start = now();

// 1. placing racks from the Build catalog
marks.build = now();
await page.locator('[data-tut="cat-rack"]').click();
await wait(600);
await page.locator('[data-tut="card-rack_air_gpu"]').hover();
await wait(900);
await place("rack_air_gpu", 1, 18);
await wait(500);
await place("rack_air_gpu", 1, 20);
await wait(500);
console.log("grid", (await place("grid_tie", -1, 10)).ok);
await wait(900);
await page.keyboard.press("Escape");
marks.buildEnd = now();

// 2. a contract, then the tower running at speed
await page.keyboard.press("c");
await wait(700);
const take = page.locator('[data-tut="take"]');
if (await take.count()) await take.click({ force: true });
await wait(500);
await page.keyboard.press("Escape");
await wait(300);
marks.run = now();
await game(() => window.aitower.store.setSpeed(30));
await wait(7000);
marks.runEnd = now();

// 3. a new floor and more racks
marks.floor = now();
await send({ type: "buildSlab", floor: 2, x0: 6, x1: 26 });
await wait(900);
for (const x of [6, 8, 10]) {
	await place("rack_air_gpu", 2, x);
	await wait(350);
}
await place("crah_unit", 2, 18);
await wait(1500);
marks.floorEnd = now();
await game(() => window.aitower.store.setSpeed(60));
await wait(5000);
marks.busy = now();
await wait(1000);
marks.end = now();

await ctx.close();
await browser.close();
server.kill();
const vid = readdirSync(RAW).filter((f) => f.endsWith(".webm") && f !== "game.webm")[0];
renameSync(join(RAW, vid), join(RAW, "game.webm"));
writeFileSync(join(RAW, "marks.json"), JSON.stringify(marks, null, 1));
console.log(marks);

// Cut the recording into 30 fps JPEG sequences: /tmp/trailer/clips/<name>/0001.jpg ...
import { execFileSync } from "node:child_process";
const cuts = { a: [marks.build + 1.2, 4], b: [marks.run + 1, 3.2], c: [marks.floor + 0.3, 3.2], d: [marks.floorEnd + 1, 3.2] };
for (const [name, [ss, len]] of Object.entries(cuts)) {
	const dir = `/tmp/trailer/clips/${name}`;
	mkdirSync(dir, { recursive: true });
	execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(ss), "-i", join(RAW, "game.webm"), "-t", String(len), "-vf", "fps=30", "-q:v", "3", join(dir, "%04d.jpg")]);
	console.log(name, readdirSync(dir).length, "frames");
}
