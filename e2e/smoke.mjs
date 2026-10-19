#!/usr/bin/env node
// End-to-end smoke test: boots the built app under `vite preview` in headless Chromium and plays a short path
// (tutorial, contract, build a rack, Esc menu, save, reload, load, assert state survived, no page errors).
//
// Usage: npm run build && npm run e2e
// Env:   E2E_URL        use an already-running server instead of starting `vite preview`
//        E2E_PORT       port for the preview server (default 4173)
//        PLAYWRIGHT_DIR directory containing node_modules/playwright (default: local install, then the global one)
import { spawn, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const PORT = Number(process.env.E2E_PORT ?? 4173);
const SEED = 7;
const STEP_TIMEOUT = 15_000;

// ─── Helpers ────────────────────────────────────────────────────────────
let step = "startup";
const log = (msg) => console.log(`  ${msg}`);
const stage = (name) => {
	step = name;
	console.log(`- ${name}`);
};
function fail(msg) {
	throw new Error(msg);
}
function assert(cond, msg) {
	if (!cond) fail(msg);
}

function loadPlaywright() {
	const tried = [];
	const candidates = [process.env.PLAYWRIGHT_DIR, root, "/opt/node22/lib/node_modules/"].filter(Boolean);
	try {
		candidates.push(execSync("npm root -g", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim());
	} catch {
		// npm not on PATH; the other candidates may still work.
	}
	for (const dir of candidates) {
		try {
			return createRequire(join(dir, "/"))("playwright");
		} catch {
			tried.push(dir);
		}
	}
	fail(`playwright not found (looked in: ${tried.join(", ")}). In CI: npm install --no-save playwright@1.56.1 && npx playwright install --with-deps chromium`);
}

async function waitForHttp(url, ms) {
	const end = Date.now() + ms;
	let last = "no response";
	while (Date.now() < end) {
		try {
			const res = await fetch(url);
			if (res.ok) return;
			last = `HTTP ${res.status}`;
		} catch (e) {
			last = String(e.cause?.code ?? e.message);
		}
		await new Promise((r) => setTimeout(r, 200));
	}
	fail(`server at ${url} did not come up in ${ms} ms (${last})`);
}

// ─── Server ─────────────────────────────────────────────────────────────
let server = null;
let stopping = false;
async function startServer() {
	if (process.env.E2E_URL) return process.env.E2E_URL;
	if (!existsSync(join(root, "apps/web/dist/index.html"))) fail('apps/web/dist is missing; run "npm run build" first');
	const vite = join(root, "node_modules/.bin/vite");
	server = spawn(vite, ["preview", "apps/web", "--port", String(PORT), "--strictPort", "--host", "127.0.0.1"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
	let out = "";
	server.stdout.on("data", (d) => (out += d));
	server.stderr.on("data", (d) => (out += d));
	server.on("exit", (code) => {
		if (code && !stopping) console.error(`vite preview exited with code ${code}:\n${out}`);
	});
	const url = `http://127.0.0.1:${PORT}/`;
	await waitForHttp(url, 20_000);
	return url;
}

// ─── Test ───────────────────────────────────────────────────────────────
async function run(url) {
	const { chromium } = loadPlaywright();
	const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
	const errors = [];
	try {
		const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
		page.setDefaultTimeout(STEP_TIMEOUT);
		page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
		page.on("console", (m) => {
			if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
		});

		const game = (fn, arg) => page.evaluate(fn, arg);
		const racks = () => game(() => window.aitower.store.get().view.facilities.filter((f) => f.defId === "rack_air_gpu").length);
		const ready = () => page.waitForFunction(() => !!window.aitower?.store && !document.getElementById("boot") && !!document.querySelector(".aitower-hud"));

		stage("1. boot with ?new&seed=7 and wait for the HUD");
		await page.goto(`${url}?new&seed=${SEED}`, { waitUntil: "load" });
		await ready();
		await game(() => window.aitower.store.setSpeed(0));
		const start = await game(() => ({ day: window.aitower.store.get().view.day, tick: window.aitower.store.get().view.tick }));
		log(`HUD up, day ${start.day}`);

		stage("2. follow the induction: read the welcome, accept the highlighted contract, watch it start");
		const memo = async () => (await page.locator(".ui-tutorial .tut-count").textContent())?.replace(/\s+/g, "") ?? "";
		const at = (n) => page.waitForFunction((k) => document.querySelector(".ui-tutorial .tut-count")?.textContent?.replace(/\s+/g, "").startsWith(`${k}/`), n, { timeout: 60_000 });
		await page.locator(".ui-tutorial").waitFor();
		assert((await memo()).startsWith("1/"), `expected memo 1, got ${await memo()}`);
		assert((await game(() => window.aitower.store.get().speed)) === 0, "the clock must be stopped while reading the welcome memo");
		await page.getByRole("button", { name: "Continue" }).click();
		await at(2);
		// The induction runs the clock until an offer is posted, then stops it and highlights the ACCEPT stamp.
		await page.locator('[data-tut="dtab-contracts"]').click();
		const stamp = page.locator('[data-tut="accept"]');
		await stamp.waitFor({ timeout: 60_000 });
		assert(await stamp.isEnabled(), "the highlighted offer must fit the idle racks");
		await stamp.click({ force: true }); // hover tilts the stamp, which Playwright reads as "unstable"
		await at(4); // step 3 (compute) ticks itself off once the racks start; step 4 is the NEXT-chip memo
		await page.getByRole("button", { name: "Skip induction" }).click();
		await page.locator(".ui-tutorial").waitFor({ state: "detached" });
		log("welcome read, contract accepted through the induction, induction skipped at step 4");

		stage("3. the accepted contract is running and the NEXT chip is shown");
		const running = await game(() => ({ jobs: window.aitower.store.get().view.jobs.length, pflops: window.aitower.store.get().view.pflops }));
		assert(running.jobs > 0 && running.pflops > 0, `expected a running job, got ${JSON.stringify(running)}`);
		assert((await page.locator(".ui-next").count()) === 1, "NEXT chip missing");
		log(`job running at ${running.pflops} PF`);

		stage("4. place a rack through window.aitower.store.dispatch");
		const before = await racks();
		const cmds = [
			{ type: "buildSlab", floor: 2, x0: 10, x1: 20 },
			{ type: "buildConduit", layer: "power", cells: Array.from({ length: 11 }, (_, i) => ({ x: 10 + i, floor: 2 })) },
			{ type: "place", defId: "rack_air_gpu", floor: 2, x: 12 },
		];
		for (const cmd of cmds) {
			const res = await game((c) => window.aitower.store.dispatch(c), cmd);
			assert(res.ok, `${cmd.type} rejected: ${res.reason}`);
		}
		await game(() => window.aitower.store.setSpeed(1));
		await page.waitForFunction((n) => window.aitower.store.get().view.facilities.filter((f) => f.defId === "rack_air_gpu").length > n, before);
		await game(() => window.aitower.store.setSpeed(0));
		const placed = await racks();
		assert(placed === before + 1, `expected ${before + 1} racks after placing one, found ${placed}`);
		log(`racks ${before} -> ${placed}`);

		stage("5. open the Esc menu");
		await game(() => window.aitower.store.setSelection(null));
		if ((await page.locator("[data-drawer]").count()) > 0) {
			await page.keyboard.press("Escape"); // the Contracts drawer from the induction is still open; Esc closes it first
			await page.locator("[data-drawer]").waitFor({ state: "detached" });
		}
		await page.keyboard.press("Escape");
		await page.locator("[role=dialog]").waitFor();
		assert((await game(() => window.aitower.store.get().speed)) === 0, "Esc menu should pause the game");
		await page.keyboard.press("Escape");
		await page.locator("[role=dialog]").waitFor({ state: "detached" });
		await game(() => window.aitower.store.setSpeed(0));
		log("menu opened and closed");

		stage("5b. open the research drawer with R, then the full Department from it, and close it with Esc");
		await page.keyboard.press("r");
		await page.locator('[data-drawer="research"]').waitFor();
		await page.getByRole("button", { name: "Open the full Department of Research" }).click();
		await page.locator(".ui-research").waitFor();
		const cards = await page.locator(".ui-tech").count();
		assert(cards >= 30, `expected the full tech tree, found ${cards} cards`);
		await page.keyboard.press("Escape");
		await page.locator(".ui-research").waitFor({ state: "detached" });
		await page.keyboard.press("Escape"); // closes the research drawer that is still open
		await page.locator("[data-drawer]").waitFor({ state: "detached" });
		await game(() => window.aitower.store.setSpeed(0));
		log(`${cards} research cards`);

		stage("6. save to slot 1, reload, load slot 1, assert the rack count survived");
		const hashBefore = await game(() => window.aitower.store.sim().hash());
		const saved = await game(() => window.aitower.store.saveTo("slot1", "e2e"));
		assert(saved.ok, `saveTo slot1 failed: ${saved.reason}`);
		const slots = await game(() => window.aitower.store.listSaves());
		assert(
			slots.some((s) => s.id === "slot1"),
			`slot1 missing from listSaves(): ${JSON.stringify(slots.map((s) => s.id))}`,
		);
		await page.goto(url, { waitUntil: "load" }); // no ?new: boots whatever the app boots by default
		await ready();
		await game(() => window.aitower.store.setSpeed(0)); // a reload boots running at 1x
		const loaded = await game(() => window.aitower.store.loadFrom("slot1"));
		assert(loaded.ok, `loadFrom slot1 failed: ${loaded.reason}`);
		await game(() => window.aitower.store.setSpeed(0));
		const after = await racks();
		assert(after === placed, `rack count did not survive save/load: saved ${placed}, loaded ${after}`);
		const hashAfter = await game(() => window.aitower.store.sim().hash());
		assert(hashAfter === hashBefore, `sim hash changed across save/load: ${hashBefore} -> ${hashAfter}`);
		log(`racks ${after}, hash ${hashAfter}`);

		stage("7. assert no page errors");
		assert(errors.length === 0, `${errors.length} page error(s):\n    ${errors.join("\n    ")}`);
		log("none");
	} catch (e) {
		if (errors.length) e.message += `\n  page errors seen:\n    ${errors.join("\n    ")}`;
		throw e;
	} finally {
		await browser.close();
	}
}

try {
	const url = await startServer();
	await run(url);
	console.log("e2e smoke: PASS");
} catch (e) {
	console.error(`\ne2e smoke: FAIL at step "${step}"\n  ${e.message}`);
	process.exitCode = 1;
} finally {
	stopping = true;
	if (server) server.kill("SIGTERM");
}
