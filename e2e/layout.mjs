#!/usr/bin/env node
// HUD layout check: at 1280x720 and 1920x1080 (UI scale 100%), plus 1920x1080 at 150% and 2560x1440 at Auto, every main HUD region
// must sit inside the viewport and must not intersect another region (strip, build bar, drawer tabs, lesson panel, goals, advisor strip, ticker,
// and an open drawer). Text must not be clipped inside tabs, the strip or the lesson goal bar. No screenshots; it takes a few seconds.
//
// Usage: npm run build && npm run e2e:layout
// Env:   E2E_URL / E2E_PORT / PLAYWRIGHT_DIR as in smoke.mjs.
import { spawn, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const PORT = Number(process.env.E2E_PORT ?? 4173);
const SIZES = [
	// `full` sizes also run the catalog, a second drawer and the lesson with its steps toggled and a wide drawer over it.
	{ name: "1280x720@100%", w: 1280, h: 720, scale: 1, full: true },
	{ name: "1920x1080@100%", w: 1920, h: 1080, scale: 1, full: true },
	{ name: "1920x1080@150%", w: 1920, h: 1080, scale: 1.5, full: false },
	{ name: "2560x1440@auto", w: 2560, h: 1440, scale: "auto", full: false },
];
// Region name -> selector. Several matches of one selector are separate regions (tabs, for instance).
const REGIONS = {
	strip: ".ui-strip",
	build: ".bld-bar",
	catalog: ".bld-catalog",
	tab: ".ui-dtab",
	lesson: ".les-goal",
	steps: ".les-steps",
	goals: ".ui-goals",
	advisors: ".adv-strip .adv-bar",
	ticker: ".ui-ticker",
	drawer: ".ui-edge",
	trees: ".trees-panel, .trees-overlay > *",
};

function fail(msg) {
	throw new Error(msg);
}
function assert(cond, msg) {
	if (!cond) fail(msg);
}
function loadPlaywright() {
	const candidates = [process.env.PLAYWRIGHT_DIR, root, "/opt/node22/lib/node_modules/"].filter(Boolean);
	try {
		candidates.push(execSync("npm root -g", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim());
	} catch {
		// npm not on PATH
	}
	for (const dir of candidates) {
		try {
			return createRequire(join(dir, "/"))("playwright");
		} catch {
			// try the next one
		}
	}
	fail("playwright not found");
}
async function waitForHttp(url, ms) {
	const end = Date.now() + ms;
	while (Date.now() < end) {
		try {
			if ((await fetch(url)).ok) return;
		} catch {
			// not up yet
		}
		await new Promise((r) => setTimeout(r, 200));
	}
	fail(`server at ${url} did not come up`);
}
let server = null;
async function startServer() {
	if (process.env.E2E_URL) return process.env.E2E_URL;
	if (!existsSync(join(root, "apps/web/dist/index.html"))) fail('apps/web/dist is missing; run "npm run build" first');
	server = spawn(join(root, "node_modules/.bin/vite"), ["preview", "apps/web", "--port", String(PORT), "--strictPort", "--host", "127.0.0.1"], { cwd: root, stdio: "ignore" });
	const url = `http://127.0.0.1:${PORT}/`;
	await waitForHttp(url, 20_000);
	return url;
}

/** Runs in the page: boxes of every region, plus clipped-text findings. */
function measure(regions) {
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	const out = [];
	for (const [name, sel] of Object.entries(regions)) {
		document.querySelectorAll(sel).forEach((el, i) => {
			const r = el.getBoundingClientRect();
			const cs = getComputedStyle(el);
			if (r.width === 0 || r.height === 0 || cs.visibility === "hidden" || cs.display === "none") return;
			out.push({ name: `${name}${i ? `#${i}` : ""}`, kind: name, x: r.left, y: r.top, r: r.right, b: r.bottom });
		});
	}
	// Text clipped by its own box (ellipsis or hidden overflow) in the places the player reads.
	const clipped = [];
	for (const el of document.querySelectorAll(".ui-strip *, .ui-dtab, .ui-dtab *, .les-goal *, .les-steps *, .ui-goals *, .adv-strip .adv-bar *")) {
		if (el.closest(".ui-hint, .ui-tooltip")) continue;
		const cs = getComputedStyle(el);
		if (cs.display === "none" || cs.visibility === "hidden") continue;
		if (el.children.length === 0 && el.textContent.trim() && el.scrollWidth > el.clientWidth + 1 && (cs.overflow !== "visible" || cs.textOverflow === "ellipsis")) {
			clipped.push(`${el.className || el.tagName}: "${el.textContent.trim().slice(0, 40)}"`);
		}
	}
	// A box whose content runs out of it (a tab label and its key, a strip chip, a goal bar).
	for (const el of document.querySelectorAll(".ui-dtab, .ui-strip > *:not(.ui-perhour), .les-goal, .les-steps, .ui-goals, .bld-bar, .adv-strip .adv-bar")) {
		if (getComputedStyle(el).display === "none") continue;
		if (el.scrollWidth > el.clientWidth + 1) clipped.push(`${el.className}: content ${el.scrollWidth}px wide in a ${el.clientWidth}px box`);
	}
	return { vw, vh, boxes: out, clipped };
}

function problems(m, label) {
	const bad = [];
	const eps = 0.5;
	for (const b of m.boxes) {
		if (b.x < -eps || b.y < -eps || b.r > m.vw + eps || b.b > m.vh + eps) bad.push(`${label}: ${b.name} leaves the viewport (${[b.x, b.y, b.r, b.b].map(Math.round)} in ${m.vw}x${m.vh})`);
	}
	for (let i = 0; i < m.boxes.length; i++) {
		for (let j = i + 1; j < m.boxes.length; j++) {
			const a = m.boxes[i];
			const c = m.boxes[j];
			if (a.kind === c.kind && a.kind === "tab") continue;
			if (a.x < c.r - eps && c.x < a.r - eps && a.y < c.b - eps && c.y < a.b - eps) bad.push(`${label}: ${a.name} overlaps ${c.name} (${[a.x, a.y, a.r, a.b].map(Math.round)} vs ${[c.x, c.y, c.r, c.b].map(Math.round)})`);
		}
	}
	for (const c of m.clipped) bad.push(`${label}: clipped text in ${c}`);
	return bad;
}

async function run(url) {
	const { chromium } = loadPlaywright();
	const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
	const all = [];
	try {
		const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
		page.setDefaultTimeout(15_000);
		// Only the HUD is measured: the world canvas redraws at 4 fps, which makes software-GL runs much faster.
		await page.addInitScript(() => {
			window.requestAnimationFrame = (cb) => window.setTimeout(() => cb(performance.now()), 250);
		});
		const errors = [];
		page.on("pageerror", (e) => errors.push(String(e)));
		const ready = () => page.waitForFunction(() => !!window.aitower?.store && !document.getElementById("boot") && !!document.querySelector(".aitower-hud"));
		const t0 = Date.now();
		const check = async (label) => {
			if (process.env.E2E_TIMING) console.log(`${Date.now() - t0} ms  ${label}`);
			await page.waitForTimeout(350); // transitions
			all.push(...problems(await page.evaluate(measure, REGIONS), label));
		};
		const setScale = (s) => page.evaluate((v) => window.aitower.store.setSettings({ uiScale: v }), s);
		// One page load: the sizes change under the running HUD, and the game is swapped through the store (a new Free Build, Lesson 1).
		await page.goto(`${url}?new&seed=7`, { waitUntil: "load" });
		await ready();
		for (const sz of SIZES) {
			await page.setViewportSize({ width: sz.w, height: sz.h });
			await setScale(sz.scale);
			await page.evaluate(() => {
				window.aitower.store.newGame(7);
				window.aitower.store.setSpeed(0);
			});
			// Free Build: the Goals card is up.
			await page.locator(".ui-goals").waitFor();
			await check(`${sz.name} hud`);
			for (const key of sz.full ? ["r", "c"] : ["r"]) {
				await page.keyboard.press(key);
				await page.locator("[data-drawer]").waitFor();
				await check(`${sz.name} drawer ${key}`);
				await page.keyboard.press("Escape");
				await page.locator("[data-drawer]").waitFor({ state: "detached" });
			}
			if (sz.full) {
				await page.locator('[data-tut="cat-rack"]').click();
				await page.locator(".bld-catalog").waitFor();
				await check(`${sz.name} catalog`);
				await page.keyboard.press("Escape");
				await page.locator(".bld-catalog").waitFor({ state: "detached" });
				assert((await page.locator("[role=dialog]").count()) === 0, "Esc closed the catalog without opening the menu");
			}
			// Lesson 1: goal bar, steps (folded or open, then toggled) and a wide drawer opened over it.
			await page.evaluate(() => {
				window.aitower.store.newGame(undefined, "lesson_first_watt");
				window.aitower.store.setSpeed(0);
			});
			await page.locator("[data-lesson-goal]").waitFor();
			await check(`${sz.name} lesson`);
			if (sz.full) {
				await page.locator("[data-lesson-steps-toggle]").click();
				await check(`${sz.name} lesson, steps toggled`);
				await page.keyboard.press("r");
				await page.locator("[data-drawer]").waitFor();
				await check(`${sz.name} lesson + research`);
				await page.keyboard.press("Escape");
				await page.locator("[data-drawer]").waitFor({ state: "detached" });
			}
		}
		if (errors.length) all.push(`page errors: ${errors.join("; ")}`);
	} finally {
		await browser.close();
	}
	return all;
}

let code = 0;
try {
	const url = await startServer();
	const bad = await run(url);
	if (bad.length) {
		console.error(`layout check FAILED (${bad.length}):\n  ${bad.join("\n  ")}`);
		code = 1;
	} else {
		console.log("layout check passed");
	}
} catch (e) {
	console.error(String(e.stack ?? e));
	code = 1;
} finally {
	server?.kill();
}
process.exit(code);
