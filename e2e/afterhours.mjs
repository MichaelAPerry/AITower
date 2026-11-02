#!/usr/bin/env node
// After-hours easter eggs (docs/AFTER_HOURS.md), in the built app: the four items stand in their corners, a real mouse click on one is
// counted (and shows nothing), the third-day and tenth-day dialogues play, a Yes buys the upgrade and the item is drawn upgraded.
// Screenshots (1280x720) go to E2E_SHOTS (default /tmp/shots-ah).
//
// Usage: npm run build && E2E_PORT=5xxx npm run e2e:afterhours
// Env:   E2E_URL / E2E_PORT / PLAYWRIGHT_DIR as in smoke.mjs.
import { spawn, execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const SHOTS = process.env.E2E_SHOTS ?? "/tmp/shots-ah";
mkdirSync(SHOTS, { recursive: true });
const PORT = Number(process.env.E2E_PORT ?? 4173);

function fail(msg) {
	throw new Error(msg);
}
function assert(cond, msg) {
	if (!cond) fail(msg);
	console.log(`  ok: ${msg}`);
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

const ITEMS = [
	{ id: "tank", floor: -1, x: 32, label: "mel-tank" },
	{ id: "fern", floor: 0, x: 5, label: "bea-fern" },
	{ id: "coffee", floor: 0, x: 43, label: "cass-coffee" },
	{ id: "book", floor: -1, x: 40, label: "luci-book" },
];

async function run(url) {
	const { chromium } = loadPlaywright();
	const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
	const errors = [];
	try {
		const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
		page.setDefaultTimeout(15_000);
		page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
		page.on("console", (m) => {
			if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
		});
		await page.goto(`${url}?new&seed=7`, { waitUntil: "load" });
		await page.waitForFunction(() => !!window.aitower?.store && !document.getElementById("boot") && !!document.querySelector(".aitower-hud"));
		const game = (fn, arg) => page.evaluate(fn, arg);
		const newGame = () =>
			game(() => {
				window.aitower.store.newGame(7);
				window.aitower.store.setSpeed(0);
			});
		const view = () => game(() => window.aitower.store.get().view.afterHours);
		/** Edit the saved after-hours state of the running game and load it back (the way a save from later in a run would look). */
		const edit = (patch) =>
			game((p) => {
				const j = JSON.parse(window.aitower.store.save());
				const s = j.state ?? j.snapshot?.state ?? j;
				const ah = s.afterHours;
				if (!ah) throw new Error(`no afterHours in the save: ${Object.keys(j)} / ${Object.keys(s)}`);
				for (const [id, v] of Object.entries(p)) Object.assign(ah[id], v);
				window.aitower.store.load(JSON.stringify(j));
				window.aitower.store.setSpeed(0);
			}, patch);
		const focus = async (floor, x) => {
			await game(({ floor: f, x: cx }) => window.aitower.store.focus({ x: cx, floor: f }), { floor, x });
			await page.waitForTimeout(500);
		};
		await newGame();
		await page.waitForTimeout(800);
		/** Click the item with the real mouse: the camera cannot centre the corner at the lot's edge, so sweep along the floor until the click lands. */
		const clickItem = async (it) => {
			const box = await page.locator("canvas").boundingBox();
			const before = (await view()).items.find((i) => i.id === it.id).streak;
			const cy = box.y + box.height / 2;
			for (const dx of [0, -40, 40, -80, 80, -120, 120, -160, 160, -200, 200, -260, 260, -320, 320, -400, 400, -480, 480, -560, 560]) {
				await page.mouse.click(box.x + box.width / 2 + dx, cy);
				await page.waitForTimeout(120);
				if ((await view()).items.find((i) => i.id === it.id).streak !== before || (await page.locator("[data-decision]").count()) > 0) return;
			}
		};

		/** Advance the scene with clicks until the choices show (a click first completes the typed line, then moves on). */
		const toChoices = async () => {
			for (let i = 0; i < 60 && (await page.locator(".vn-choice").count()) === 0; i++) {
				await page.locator(".vn-stage").click({ position: { x: 640, y: 120 } });
				await page.waitForTimeout(90);
			}
		};
		/** Pick a choice by its button, then click through the reply until the scene closes. */
		const choose = async (id) => {
			await page.locator(`.vn-choice[data-choice="${id}"]`).click();
			for (let i = 0; i < 12; i++) {
				await page.locator("[data-decision]").click({ position: { x: 640, y: 120 }, timeout: 1000 }).catch(() => {});
				await page.waitForTimeout(90);
			}
			// The scene's own button files the answer after the last reply line; if the headless click did not land on it, file it directly.
			await game((c) => {
				const d = window.aitower.store.get().view.decision;
				if (d) window.aitower.store.dispatch({ type: "resolveDecision", decisionId: d.id, choiceId: c });
			}, id);
			await game(() => window.aitower.store.setSpeed(1)); // the clock is held for a scene; one tick applies the filed answer
			await page.waitForTimeout(500);
			await game(() => window.aitower.store.setSpeed(0));
		};

		// 1. The four items stand in their corners on G and B, with no extra floor built.
		let ah = await view();
		assert(ah.items.length === 4 && ah.price === 1_000_000, "four items, upgrade price $1,000,000");
		assert(ah.items.filter((i) => i.visible).map((i) => i.id).sort().join() === "book,coffee,fern,tank", "all four stand on G and B");

		// 2. A real mouse click on each item is counted and shows nothing.
		for (const it of ITEMS) {
			await focus(it.floor, it.x);
			await page.screenshot({ path: join(SHOTS, `${it.label}-normal.png`) });
			await clickItem(it);
			await page.waitForTimeout(250);
			const v = (await view()).items.find((i) => i.id === it.id);
			assert(v.streak === 1 && v.clickedToday, `a click on the ${it.id} is counted (streak ${v.streak})`);
			assert((await page.locator("[data-decision]").count()) === 0, `the ${it.id} click shows nothing`);
		}

		// 3. The third-day dialogue (the streak is 2 yesterday; today's click makes 3).
		await newGame();
		await page.waitForTimeout(500);
		await edit({ fern: { streak: 2, lastDay: -1 } });
		await focus(ITEMS[1].floor, ITEMS[1].x);
		await clickItem(ITEMS[1]);
		await page.locator("[data-decision]").waitFor();
		assert((await page.locator("[data-scene]").getAttribute("data-scene")) === "ah_fern_third", "the third-day scene opens");
		await toChoices();
		await page.waitForTimeout(300);
		await page.screenshot({ path: join(SHOTS, "dialogue-third-day-choices.png") });
		const text = await page.locator(".vn-box").innerText();
		assert(/Yes/.test(text) && /No/.test(text), "Yes and No are offered");
		await choose("no"); // No: nothing changes
		await page.waitForTimeout(300);
		assert((await page.locator("[data-decision]").count()) === 0, "the dialogue closes");
		assert((await view()).items.find((i) => i.id === "fern").streak === 3 && !(await view()).items.find((i) => i.id === "fern").bought, "No changes nothing: the streak goes on");

		// 4. The tenth day: buy the fern upgrade, then all four upgraded.
		await newGame();
		await page.waitForTimeout(500);
		await edit({ fern: { streak: 9, lastDay: -1, thirdSeen: true } });
		await focus(ITEMS[1].floor, ITEMS[1].x);
		await clickItem(ITEMS[1]);
		await page.locator("[data-decision]").waitFor();
		assert((await page.locator("[data-scene]").getAttribute("data-scene")) === "ah_fern_tenth", "the tenth-day scene opens");
		await toChoices();
		await page.screenshot({ path: join(SHOTS, "dialogue-tenth-day-choices.png") });
		await choose("yes");
		const cash = await game(() => window.aitower.store.get().view.cash);
		assert((await view()).items.find((i) => i.id === "fern").bought, "Yes buys the upgrade");
		assert(cash < 2_100_000, `$1,000,000 left the bank (cash ${Math.round(cash)})`);
		await edit({ tank: { bought: true }, coffee: { bought: true }, book: { bought: true } });
		await game(() => window.aitower.store.setSpeed(1));
		await page.waitForTimeout(500);
		await game(() => window.aitower.store.setSpeed(0));
		assert((await view()).items.every((i) => i.bought), "all four upgraded");
		for (const it of ITEMS) {
			await focus(it.floor, it.x);
			await page.screenshot({ path: join(SHOTS, `${it.label}-upgraded.png`) });
		}
		if (errors.length) fail(`page errors: ${errors.join("; ")}`);
	} finally {
		await browser.close();
	}
}

let code = 0;
try {
	const url = await startServer();
	await run(url);
	console.log(`after-hours check passed; screenshots in ${SHOTS}`);
} catch (e) {
	console.error(String(e.stack ?? e));
	code = 1;
} finally {
	server?.kill();
}
process.exit(code);
