#!/usr/bin/env node
// Records real gameplay for the trailer and the site screenshots from a busy mid-game tower (Free Build, seed 7).
// Three distinct moments: BUILD (placing racks from the build bar), RESEARCH (buying a node on the research map), UPGRADE (swapping a rack for the next model).
// No spoilers: plain branches only, seal meters kept at zero, no endings, bonds or after-hours.
// Usage: npm run build && node trailer/capture.mjs      (starts `vite preview` itself)
// Output: /tmp/trailer/clips/<name>/0001.jpg ... (30 fps, 1280x720) and /tmp/trailer/shots/<name>.png
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { boot, buildTower, fastForward, grant, loadPlaywright, scrubSeal } from "./busy.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const PORT = Number(process.env.TRAILER_PORT ?? 4791);
const RAW = "/tmp/trailer/raw";
const SHOTS = "/tmp/trailer/shots";
rmSync(RAW, { recursive: true, force: true });
mkdirSync(RAW, { recursive: true });
mkdirSync(SHOTS, { recursive: true });
const playwright = loadPlaywright(root);

const server = spawn(join(root, "node_modules/.bin/vite"), ["preview", "apps/web", "--port", String(PORT), "--strictPort", "--host", "127.0.0.1"], { cwd: root, stdio: "ignore" });
const url = `http://127.0.0.1:${PORT}/`;
for (let i = 0; i < 60; i++) {
	try { if ((await fetch(url)).ok) break; } catch { /* wait */ }
	await new Promise((r) => setTimeout(r, 250));
}

const browser = await playwright.chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: RAW, size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("pageerror:", e.message));
const t0 = Date.now();
const now = () => (Date.now() - t0) / 1000;
const marks = {};
const wait = (ms) => page.waitForTimeout(ms);
const shot = (name) => page.screenshot({ path: join(SHOTS, `${name}.png`) });
const game = (fn, arg) => page.evaluate(fn, arg);
const move = (x, y, steps = 4) => page.mouse.move(x, y, { steps });
const closeModals = async () => {
	for (let i = 0; i < 4; i++) {
		const btn = page.locator(".ui-audit-backdrop button, .ui-modal button").filter({ hasText: /^(Close|OK|Continue)$/i }).first();
		if (await btn.count()) await btn.click({ force: true }); else break;
		await wait(200);
	}
};

// A visible pointer for the recording (Playwright's video has none).
await page.addInitScript(() => {
	window.addEventListener("DOMContentLoaded", () => {
		const c = document.createElement("div");
		c.style.cssText = "position:fixed;left:0;top:0;width:22px;height:30px;z-index:99999;pointer-events:none;transform:translate(-100px,-100px);filter:drop-shadow(2px 2px 0 #000)";
		c.innerHTML = '<svg width="22" height="30" viewBox="0 0 11 15" shape-rendering="crispEdges"><path d="M0 0h2v1h1v1h1v1h1v1h1v1h1v1h1v1H6v1h1v1h1v1H7v1H6v1H5v-1H4v-1H3v1H2v1H1v1H0z" fill="#fff" stroke="#000" stroke-width="1"/></svg>';
		document.body.appendChild(c);
		window.addEventListener("mousemove", (e) => { c.style.transform = `translate(${e.clientX}px,${e.clientY}px)`; }, true);
	});
});

await boot(page, url);
await grant(page);
await buildTower(page, 6);
await scrubSeal(page);
console.log("aged", await fastForward(page, 10));
await game(() => window.aitower.store.setSettings({ advisorTips: false }));
await scrubSeal(page);
await closeModals();
await game(() => window.aitower.store.setSpeed(3));
await page.locator(".ui-goals-head").click();
await move(700, 300, 4);
for (let i = 0; i < 2; i++) { await page.mouse.wheel(0, 120); await wait(300); }
await game(() => window.aitower.store.focus({ floor: 2, x: 24 }));
await move(1180, 520, 4);
await wait(2500);

// 0. the tower at work
marks.busy = now();
await wait(6000);
marks.busyEnd = now();
await wait(500);
await shot("tower");

// 1. BUILD: pick racks in the build bar and place five on the open top floor
const F6 = 166, X = (tile) => 369 + (tile - 4) * 16 + 8;
marks.build = now();
await move(54, 340);
await page.locator('[data-tut="cat-rack"]').click();
await wait(450);
await move(330, 330);
await page.locator('[data-tut="card-rack_air_gpu"]').hover();
await wait(500);
await page.locator('[data-tut="card-rack_air_gpu"]').click();
await wait(250);
const tiles = [12, 14, 18, 20, 22];
const f6Racks = () => game(() => window.aitower.store.sim().view().facilities.filter((f) => f.floor === 6 && f.defId.startsWith("rack")).length);
for (const [i, t] of tiles.entries()) {
	await move(X(t), F6, i === 0 ? 6 : 3);
	await wait(i === 2 ? 450 : 260);
	if (i === 2) await shot("build");
	await page.mouse.click(X(t), F6);
	await wait(240);
}
console.log("floor 6 racks:", await f6Racks());
await page.keyboard.press("Escape");
await wait(500);
marks.buildEnd = now();
await closeModals();

// 2. RESEARCH: open the map, pick a node, buy it
await wait(400);
marks.research = now();
await page.keyboard.press("r");
await wait(900);
await wait(700);
// click a ready node that is on screen (a plain-branch one) so the map reacts, then buy it
const pickNode = async () => {
	const boxes = await page.locator(".orb-leaf.is-ready").evaluateAll((els) => els.map((e, i) => { const r = e.getBoundingClientRect(); return { i, x: r.x + r.width / 2, y: r.y + r.height / 2, label: e.getAttribute("aria-label") ?? "" }; }));
	return boxes.find((b) => b.x > 190 && b.x < 690 && b.y > 260 && b.y < 540 && !/Culture|Algae|Event|Wetware|Neuromorphic/i.test(b.label));
};
const node = await pickNode();
if (node) { await move(node.x, node.y, 6); await wait(250); await page.mouse.click(node.x, node.y); console.log("picked", node.label); }
await wait(600);
await shot("research");
const go = page.locator('[data-tut="research-go"]');
await go.hover();
await wait(400);
await go.click();
await wait(1200);
await shot("research-bought");
await page.keyboard.press("Escape");
await wait(600);
marks.researchEnd = now();
await game(() => window.aitower.store.setSpeed(3));

// 3. UPGRADE: select air handlers and swap them for the next model, in place
await wait(400);
marks.upgrade = now();
for (const [i, y] of [255, 351].entries()) {
	await move(481, y, i === 0 ? 6 : 5);
	await page.mouse.click(481, y);
	await wait(600);
	const up = page.locator('[data-tut="upgrade"] button').first();
	await up.scrollIntoViewIfNeeded();
	await up.hover();
	await wait(500);
	if (i === 0) await shot("upgrade");
	await up.click();
	await wait(800);
}
await shot("upgrade-done");
await page.keyboard.press("Escape");
marks.upgradeEnd = now();
await wait(600);

// stills for the site
await page.keyboard.press("i");
await wait(1200);
await page.getByRole("tab", { name: /Money details/i }).click();
await wait(900);
await shot("insights");
await page.keyboard.press("Escape");
await wait(400);
marks.end = now();

await ctx.close();
await browser.close();
server.kill();
const vid = readdirSync(RAW).filter((f) => f.endsWith(".webm"))[0];
renameSync(join(RAW, vid), join(RAW, "game.webm"));
writeFileSync(join(RAW, "marks.json"), JSON.stringify(marks, null, 1));
console.log(marks);

// Time-lapse each beat into a 100-frame clip (the game itself only renders ~5 fps in software GL).
execFileSync("node", [join(root, "trailer/cut.mjs")], { stdio: "inherit" });
