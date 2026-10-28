#!/usr/bin/env -S npx tsx
/**
 * Sprite preview for the Green tree (docs/TREES.md section 7). Usage (from the repo root):
 *
 *   npx tsx tools/sprites/preview.ts            # both PNGs
 *   npx tsx tools/sprites/preview.ts sheet      # docs/preview/green-sprites.png only
 *   npx tsx tools/sprites/preview.ts ingame     # docs/preview/green-ingame.png only
 *
 * `sheet` serves packages/render/dev (sprites.html) with vite and screenshots it in headless Chromium: every new sprite drawn by the
 * real renderer at 1x and 3x on the game's own walls, pipes and sky, next to the base AC-1 and LC-2 (and the base cooling, power and
 * solar items) for scale. `ingame` boots the real app (apps/web, dev build, so `window.__aitower` exists), retrofits racks down the
 * Green tree through the sim's own commands, places support items and screenshots the floor.
 * Playwright is the pre-installed one (global, or PLAYWRIGHT_DIR); nothing is downloaded.
 */
import { type ChildProcess, execSync, spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadContent } from "@aitower/content";

const root = fileURLToPath(new URL("../..", import.meta.url));
const OUT = join(root, "docs/preview");

function loadPlaywright(): { chromium: { launch(o: object): Promise<Browser> } } {
	const dirs = [process.env.PLAYWRIGHT_DIR, root, "/opt/node22/lib/node_modules/"].filter(Boolean) as string[];
	try {
		dirs.push(execSync("npm root -g", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim());
	} catch {
		// npm not on PATH: the other candidates may still work.
	}
	for (const d of dirs) {
		try {
			return createRequire(join(d, "/"))("playwright");
		} catch {
			// try the next one
		}
	}
	throw new Error(`playwright not found (looked in ${dirs.join(", ")})`);
}

// Just the slice of the Playwright API this script uses.
interface Page {
	goto(url: string, o?: object): Promise<unknown>;
	waitForFunction(fn: string | (() => unknown), arg?: unknown, o?: object): Promise<unknown>;
	waitForTimeout(ms: number): Promise<void>;
	/** Runs a JS expression in the page (a string: tsx would inject helpers into a function and they do not exist there). */
	evaluate<R = unknown>(expr: string): Promise<R>;
	locator(sel: string): { count(): Promise<number>; focus(): Promise<void> };
	keyboard: { press(k: string): Promise<void> };
	screenshot(o: object): Promise<unknown>;
	on(ev: string, cb: (e: { type?: () => string; text?: () => string }) => void): void;
}
interface Browser {
	newPage(o: object): Promise<Page>;
	close(): Promise<void>;
}

let servers: ChildProcess[] = [];
async function serve(dir: string, port: number, path: string): Promise<string> {
	const vite = join(root, "node_modules/.bin/vite");
	const p = spawn(vite, [dir, "--port", String(port), "--strictPort", "--host", "127.0.0.1"], { cwd: root, stdio: "ignore" });
	servers.push(p);
	const url = `http://127.0.0.1:${port}/${path}`;
	for (let i = 0; i < 100; i++) {
		try {
			if ((await fetch(url)).ok) return url;
		} catch {
			// not up yet
		}
		await new Promise((r) => setTimeout(r, 200));
	}
	throw new Error(`vite on ${port} did not come up`);
}
const stopServers = (): void => {
	for (const p of servers) p.kill();
	servers = [];
};

const launchArgs = { args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] };

async function sheet(browser: Browser): Promise<void> {
	const url = await serve("packages/render/dev", 5184, "sprites.html");
	const page = await browser.newPage({ viewport: { width: 1700, height: 900 } });
	const errors: string[] = [];
	page.on("pageerror", (e) => errors.push(String(e)));
	await page.goto(url, { waitUntil: "load" });
	await page.waitForFunction(() => document.title === "sprites-ready", null, { timeout: 60_000 });
	await page.waitForTimeout(1500);
	// Hold the animation on one frame so the PNG is the same every run on the same machine.
	await page.evaluate("window.__freeze(true)");
	await page.waitForTimeout(300);
	await page.screenshot({ path: join(OUT, "green-sprites.png"), fullPage: true });
	if (errors.length) throw new Error(`page errors:\n${errors.join("\n")}`);
	console.log("saved docs/preview/green-sprites.png");
}

/** Story scenes (the first Green retrofit opens one) are played through with Enter until none shows for a second. */
async function dismissScenes(page: Page): Promise<void> {
	for (let quiet = 0; quiet < 5; ) {
		if ((await page.locator(".vn-stage").count()) === 0) {
			quiet++;
			await page.waitForTimeout(200);
			continue;
		}
		quiet = 0;
		await page.locator(".vn-stage").focus();
		await page.keyboard.press("Enter");
		await page.waitForTimeout(60);
	}
}

async function ingame(browser: Browser): Promise<void> {
	const url = await serve("apps/web", 5186, "?new&seed=7");
	const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
	const errors: string[] = [];
	page.on("console", (m) => m.type?.() === "error" && errors.push(m.text?.() ?? ""));
	page.on("pageerror", (e) => errors.push(String(e)));
	await page.goto(url, { waitUntil: "load" });
	await page.waitForFunction(() => (window as unknown as { __aitower?: unknown }).__aitower, null, { timeout: 60_000 });
	await page.waitForTimeout(800);
	const content = loadContent();
	const allTech = content.tech.map((t) => t.id);
	// Dev hook: the sim behind the store. Level 5 and the whole tech tree, then real commands: place, retrofit down the Green tree.
	const SETUP = `((tech) => {
		const store = window.__aitower;
		const s = store.sim();
		const st = s.state;
		st.cash = 1e9;
		st.tier = 5;
		for (const t of tech) if (!st.techResearched.includes(t)) st.techResearched.push(t);
		if (s.invalidateProjection) s.invalidateProjection();
		const out = [];
		const run = (cmd) => {
			const r = store.dispatch(cmd);
			if (!r.ok) out.push(cmd.type + " " + (cmd.defId || cmd.facilityId) + ": " + r.reason);
		};
		const fac = () => s.view().facilities;
		store.setSpeed(0);
		run({ type: "decisionGate", open: false });
		const retro = (x, n) => {
			for (let k = 0; k < n; k++) {
				const f = fac().find((q) => q.floor === 1 && q.x === x);
				if (f) run({ type: "retrofit", facilityId: f.id, tree: "greentech" });
			}
		};
		run({ type: "place", defId: "rack_air_gpu", floor: 1, x: 18 });
		// The four starter racks and one more become NM-1, NM-2, PH-1, NM-1 and PH-2 (three tiles wide, hence the free tile at 20).
		retro(6, 1);
		retro(8, 2);
		retro(10, 3);
		retro(12, 1);
		retro(18, 4);
		run({ type: "place", defId: "crah_adiabatic", floor: 1, x: 26 });
		run({ type: "place", defId: "crah_econ", floor: 1, x: 30 });
		run({ type: "place", defId: "fuel_cell", floor: 0, x: 36 });
		return out;
	})(${JSON.stringify(allTech)})`;
	const log = await page.evaluate<string[]>(SETUP);
	if (log.length) console.log(`ingame setup notes:\n  ${log.join("\n  ")}`);
	await page.evaluate("(() => { const store = window.__aitower; store.setSpeed(4); const c = document.querySelector('#world canvas'); c.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, clientX: 640, clientY: 400, cancelable: true, bubbles: true })); store.focus({ x: 15, floor: 1 }); })()");
	await dismissScenes(page);
	await page.waitForTimeout(2500);
	// Put idle racks to work so the cabinets show a running status: accept whatever offers fit.
	await page.evaluate("(() => { const store = window.__aitower; for (const o of store.sim().view().offers.slice(0, 4)) store.dispatch({ type: \"acceptContract\", contractId: o.id }); })()");
	await page.waitForTimeout(4000);
	await dismissScenes(page);
	await page.screenshot({ path: join(OUT, "green-ingame.png") });
	if (errors.length) console.warn(`console errors:\n${errors.join("\n")}`);
	console.log("saved docs/preview/green-ingame.png");
}

const which = process.argv[2] ?? "all";
mkdirSync(OUT, { recursive: true });
const browser = await loadPlaywright().chromium.launch(launchArgs);
try {
	if (which === "all" || which === "sheet") await sheet(browser);
	if (which === "all" || which === "ingame") await ingame(browser);
} finally {
	await browser.close();
	stopServers();
}
