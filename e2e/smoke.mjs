#!/usr/bin/env node
// End-to-end smoke test: boots the built app under `vite preview` in headless Chromium and plays a short path
// (new player: Lesson 1 start to result; Free Build: contract, build a rack, Esc menu, save, reload, load, assert state survived, no page errors).
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

		stage("0. a new player lands on the title screen, starts Lesson 1, and plays it through to the result screen");
		await page.goto(url, { waitUntil: "load" });
		await ready();
		await page.getByRole("button", { name: /START LESSON 1/ }).waitFor();
		assert((await page.getByRole("button", { name: /FREE BUILD/ }).count()) === 1, "the title offers Free Build next to the lesson");
		assert((await page.getByText("Restart tutorial").count()) === 0 && (await page.locator(".ui-coach").count()) === 0, "the old tutorial is gone");
		await page.getByRole("button", { name: /START LESSON 1/ }).click();
		await page.locator("[data-lesson-goal]").waitFor();
		const lessonState = () => game(() => { const g = window.aitower.store.get(); const l = g.view.lesson; return l && { status: l.status, done: l.stepsDone, load: l.loadKw, cap: l.capacityKw, speed: g.speed, allowed: l.allowed.map((a) => a.defId), beats: l.beatsFired }; });
		const ls = await lessonState();
		assert(ls && ls.status === "active" && ls.speed === 0, `the lesson starts paused: ${JSON.stringify(ls)}`);
		assert(ls.cap === 120 && ls.load === 53, `the goal bar reads load 53 of capacity 120 kW: ${JSON.stringify(ls)}`);
		assert((await page.locator("[data-lesson-steps] li").count()) === 4, "four checklist steps");
		assert((await page.locator(".ui-goals, .ui-next-btn").count()) === 0, "no Goals card or NEXT chip during a lesson (calm)");
		assert((await page.locator(".ui-dtab").count()) === 1, "only the Handbook tab is shown during the lesson");
		const talk = async () => { // Bea's lines: press Next / Got it until she has nothing left to say
			for (let i = 0; i < 6 && (await page.locator("[data-lesson-continue]").count()) > 0; i++) {
				await page.locator("[data-lesson-continue]").click();
				await page.waitForTimeout(150);
			}
		};
		await talk();
		assert((await lessonState()).speed === 3, "the clock starts when Bea has finished her first lines");
		// Nothing else is selectable: one category, one card, and the sim refuses the rest.
		assert((await page.locator(".bld-bar .bld-cat").count()) === 1, "only the Racks category is shown at first");
		await page.locator('[data-tut="cat-rack"]').click();
		assert((await page.locator(".bld-catalog .bld-card, .bld-catalog [data-tut^=card-]").count()) === 1, "one rack card in the catalog");
		const refused = await game(() => window.aitower.store.dispatch({ type: "place", defId: "genset", floor: -1, x: 12 }));
		assert(!refused.ok, "the generator is refused before its step");
		await page.keyboard.press("Escape");
		const place = (defId, floor, x) => game((c) => window.aitower.store.dispatch(c), { type: "place", defId, floor, x });
		const waitStep = (id) => page.waitForFunction((i) => window.aitower.store.get().view.lesson.stepsDone.includes(i), id, { timeout: 30_000 });
		assert((await place("rack_air_gpu", 1, 11)).ok, "first rack on the glowing slot");
		await waitStep("rack1");
		await page.locator("[data-lesson-continue]").waitFor();
		assert((await lessonState()).speed === 0, "the clock stops while Bea explains kW");
		await talk();
		assert((await place("rack_air_gpu", 1, 15)).ok, "second rack");
		await waitStep("rack2");
		await page.waitForFunction(() => window.aitower.store.get().view.lesson.beatsFired.includes("trip"), null, { timeout: 30_000 });
		await page.locator("[data-lesson-continue]").waitFor();
		await talk();
		await page.waitForFunction(() => window.aitower.store.get().overlay === "power"); // the power overlay lights up for the generator step
		assert((await place("genset", -1, 12)).ok, "the generator, now allowed");
		await waitStep("genset");
		await talk();
		await game(() => window.aitower.store.setSpeed(30));
		await page.locator("[data-lesson-result]").waitFor({ timeout: 90_000 });
		const won = await lessonState();
		assert(won.status === "won", `the lesson is won: ${JSON.stringify(won)}`);
		const stars = await game(() => window.aitower.store.get().view.lesson.stars);
		assert(stars >= 1 && (await page.locator(".les-stars b.is-on").count()) === stars, "the result screen shows the stars the sim awarded");
		assert(/learned/i.test(await page.locator("[data-lesson-result]").innerText()), "the result has a one-line 'what you learned'");
		const progress = await game(() => JSON.parse(localStorage.getItem("aitower.lessons.v1") ?? "{}"));
		assert(progress.done?.first_watt >= 1, `completion is persisted: ${JSON.stringify(progress)}`);
		await page.locator("[data-lesson-result] .adv-link").first().click();
		await page.locator('[data-drawer="handbook"]').waitFor();
		await page.locator('[data-chapter-view="ch:power"]').waitFor();
		await page.keyboard.press("Escape");
		await page.locator("[data-drawer]").waitFor({ state: "detached" });
		log(`lesson 1 won with ${stars} stars; Handbook opened on the Power chapter from the result; progress saved`);
		await page.locator("[data-lesson-freebuild]").click();
		await page.waitForFunction(() => window.aitower.store.get().view.lesson === null);
		const bonus = await game(() => window.aitower.store.get().view.cash);
		assert(bonus > 3_040_000 && bonus <= 3_050_000, `Free Build starts with the lesson bonus (+$50k): $${bonus}`);
		log("Free Build after the lesson starts with $3.05M");

		stage("1. boot with ?new&seed=7 and wait for the HUD");
		await page.goto(`${url}?new&seed=${SEED}`, { waitUntil: "load" });
		await ready();
		await game(() => window.aitower.store.setSpeed(0));
		const start = await game(() => ({ day: window.aitower.store.get().view.day, tick: window.aitower.store.get().view.tick }));
		log(`HUD up, day ${start.day}`);

		stage("2. Free Build: the Goals card is there, take the waiting offer through the Contracts drawer");
		await page.waitForSelector('[data-goal="earn-first"]');
		assert((await page.locator("[data-lesson-goal]").count()) === 0, "no lesson UI in Free Build");
		await page.keyboard.press("c");
		const acceptBtn = page.locator('[data-tut="take"]');
		await acceptBtn.waitFor({ timeout: 5_000 });
		assert(await acceptBtn.isEnabled(), "the opening offer must fit the idle racks");
		await acceptBtn.click({ force: true }); // hover tilts the button, which Playwright reads as "unstable"
		await page.keyboard.press("Escape");
		await game(() => window.aitower.store.setSpeed(1));
		await page.waitForFunction(() => window.aitower.store.get().view.pflops > 0, null, { timeout: 30_000 });
		await game(() => window.aitower.store.setSpeed(0));
		log("offer accepted in the Contracts drawer, job running");

		stage("3. the accepted contract is running and the Goals card is shown");
		const running = await game(() => ({ jobs: window.aitower.store.get().view.jobs.length, pflops: window.aitower.store.get().view.pflops }));
		assert(running.jobs > 0 && running.pflops > 0, `expected a running job, got ${JSON.stringify(running)}`);
		assert((await page.locator(".ui-goals").count()) === 1, "Goals card missing");
		assert((await page.locator(".ui-next-btn").count()) === 0, "NEXT is for problems only; none expected here");
		log(`job running at ${running.pflops} PF`);

		stage("3b. build catalog: Racks category, hover fills the Inspector, click picks, Esc drops the tool before the catalog closes");
		assert((await page.locator(".bld-bar .bld-cat").count()) >= 6, "category bar must always be visible");
		await page.locator('[data-tut="cat-rack"]').click();
		await page.locator(".bld-catalog").waitFor();
		const card = page.locator('[data-tut="card-rack_air_gpu"]');
		await card.hover();
		assert(((await page.locator(".bld-insp .bld-h").textContent()) ?? "").length > 3, "hovering a card must fill the Inspector");
		assert((await page.locator(".ui-tooltip").count()) === 0, "no floating tooltip on cards");
		await card.click();
		assert((await game(() => window.aitower.store.get().tool.kind)) === "place", "one click on the card arms the tool");
		await page.mouse.move(5, 400); // off the card: the Inspector keeps showing the picked item
		assert(/Picked/.test((await page.locator(".bld-insp .bld-kicker").textContent()) ?? ""), "picked item stays in the Inspector while placing");
		await page.keyboard.press("Escape");
		assert((await game(() => window.aitower.store.get().tool.kind)) === "select", "first Esc drops the tool");
		assert((await page.locator(".bld-catalog").count()) === 1, "first Esc leaves the catalog open");
		await page.keyboard.press("Escape");
		await page.locator(".bld-catalog").waitFor({ state: "detached" });
		log("catalog opened in one click, tool dropped before the panel closed");

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
			await page.keyboard.press("Escape"); // the Contracts drawer from the tutorial is still open; Esc closes it first
			await page.locator("[data-drawer]").waitFor({ state: "detached" });
		}
		await page.keyboard.press("Escape");
		await page.locator("[role=dialog]").waitFor();
		assert((await game(() => window.aitower.store.get().speed)) === 0, "Esc menu should pause the game");
		await page.keyboard.press("Escape");
		await page.locator("[role=dialog]").waitFor({ state: "detached" });
		await game(() => window.aitower.store.setSpeed(0));
		log("menu opened and closed");

		stage("5b. open Research with R, see the plain Inspector, start a research in three clicks (R, node, Start), close with Esc");
		await page.keyboard.press("r");
		await page.locator('[data-drawer="research"]').waitFor();
		const nodesShown = await page.locator('[data-drawer="research"] [data-tech]').count();
		assert(nodesShown >= 2, `expected a few research nodes in the list, found ${nodesShown}`);
		for (const w of ["What you get", "Why it helps", "Start research"]) assert((await page.locator('[data-drawer="research"]').getByText(w).count()) > 0, `research panel is missing "${w}"`);
		assert((await page.getByText("Nothing within reach").count()) === 0, "the dead-end text is back");
		await page.keyboard.press("Escape");
		await page.locator("[data-drawer]").waitFor({ state: "detached" });
		await game(() => window.aitower.store.setSpeed(0));
		log(`${nodesShown} research nodes listed`);

		stage("5c. open the Automation drawer with T, switch the spare-parts order on, see the AUTO lamp, close it with Esc");
		assert((await page.locator(".ui-autolamp").count()) === 0, "no AUTO lamp before any order is on");
		await page.keyboard.press("t");
		await page.locator('[data-drawer="automation"]').waitFor();
		for (const order of ["research", "parts", "bots", "foreman", "clerk"]) assert((await page.locator(`[data-order="${order}"]`).count()) === 1, `automation row missing: ${order}`);
		await page.locator('[data-order="parts"] [role="switch"]').click();
		await page.waitForFunction(() => window.aitower.store.get().view.automation.policy.parts.enabled === true);
		await page.waitForFunction(() => document.querySelector(".ui-autolamp") !== null);
		await page.keyboard.press("Escape");
		await page.locator("[data-drawer]").waitFor({ state: "detached" });
		await game(() => window.aitower.store.setSpeed(0));
		log("parts order on, AUTO lamp lit");

		stage("5c2. Contracts and Insights: C shows the job board and Inspector, F opens Insights (one panel at a time), the reputation list is there, Esc closes");
		await page.keyboard.press("c");
		await page.locator('[data-drawer="contracts"] .pnl-insp').waitFor();
		await page.keyboard.press("f");
		await page.locator('[data-drawer="insights"]').waitFor();
		assert((await page.locator("[data-drawer]").count()) === 1, "only one panel may be open at a time");
		await page.locator("summary", { hasText: "Why did it change?" }).waitFor();
		await page.keyboard.press("i"); // I toggles the same panel closed
		await page.locator("[data-drawer]").waitFor({ state: "detached" });
		log("Contracts (C), Insights (F and I), one panel at a time");

		stage("5d. help mode: ? shows a tooltip with More..., which opens the Handbook on a chapter; H (and K), a chapter, / and search work");
		await page.keyboard.press("?");
		await page.waitForSelector(".aitower-hud.is-help");
		assert((await page.locator("[data-help]").count()) >= 10, "help regions missing");
		await page.locator('[data-help="treasury"]').hover();
		await page.locator(".ui-helpcard").waitFor();
		await page.getByRole("button", { name: "More…" }).click();
		await page.locator('[data-drawer="handbook"]').waitFor();
		await page.locator('[data-chapter-view="ch:money"] svg').waitFor();
		await page.keyboard.press("Escape"); // closes the drawer and leaves help mode in one go
		await page.locator("[data-drawer]").waitFor({ state: "detached" });
		await page.waitForFunction(() => !document.querySelector(".aitower-hud.is-help"));
		await page.keyboard.press("h");
		await page.locator('[data-drawer="handbook"]').waitFor();
		assert((await page.locator(".pr-new, [data-primer-new]").count()) === 0, "no floating new-chapter pill: unread chapters show a dot on the tab only");
		assert((await page.locator(".ui-dtab .pr-dot").count()) === 1, "unread chapters show a quiet dot on the Handbook tab");
		await page.keyboard.press("h");
		await page.locator("[data-drawer]").waitFor({ state: "detached" });
		await page.keyboard.press("k"); // the old key still opens it
		await page.locator('[data-drawer="handbook"]').waitFor();
		await page.keyboard.press("Escape");
		await page.locator("[data-drawer]").waitFor({ state: "detached" });
		await page.keyboard.press("/");
		await page.locator('[data-drawer="handbook"]').waitFor();
		assert(await page.getByRole("searchbox", { name: "Search the Handbook" }).evaluate((el) => el === document.activeElement), "/ focuses the Handbook search");
		await page.getByRole("searchbox").fill("");
		await page.evaluate(() => document.activeElement?.blur());
		await page.locator('[data-chapter="ch:heat"]').click();
		await page.locator('[data-chapter-view="ch:heat"] svg').waitFor();
		await page.getByRole("searchbox", { name: "Search the Handbook" }).fill("chiller");
		await page.locator('[data-entry="fac:chiller"]').waitFor();
		await page.getByRole("searchbox").fill("uptime");
		await page.locator('[data-chapter="ch:uptime"]').waitFor();
		await page.getByRole("searchbox").fill("pue");
		await page.locator('[data-entry="glossary:pue"]').waitFor();
		await page.getByRole("searchbox").fill("");
		await page.evaluate(() => document.activeElement?.blur());
		await page.keyboard.press("Escape");
		await page.locator("[data-drawer]").waitFor({ state: "detached" });
		await game(() => window.aitower.store.setSpeed(0));
		log("help mode, More... link, Handbook (H, K, /) and search");

		stage("5e. advisors: four portraits are docked, a click asks (ranked live numbers), Settings turns tips off and on");
		await page.locator(".adv-strip .adv-face").first().waitFor();
		assert((await page.locator(".adv-strip .adv-face").count()) === 4, "the advisor strip must hold four portrait buttons");
		assert((await page.locator(".ast, .ui-inbox, .ui-memo-pop").count()) === 0, "UNIT-7 and the memo inbox are gone");
		await page.getByRole("button", { name: /Ask Cass Parr/ }).click({ force: true });
		await page.locator(".adv-ask").waitFor();
		assert(/\d/.test(await page.locator(".adv-ask .adv-ranked").innerText()), "an Ask answer must quote live numbers");
		await page.keyboard.press("Escape");
		await page.locator(".adv-ask").waitFor({ state: "detached" });
		await game(() => window.aitower.store.setSettings({ advisorTips: false }));
		assert((await game(() => window.aitower.store.get().settings.advisorTips)) === false, "turning advisor tips off must persist in settings");
		await game(() => window.aitower.store.setSettings({ advisorTips: true }));
		log("four advisors, Ask answer, tips off and on");

		stage("5f. a decision pauses the game at 30x, waiting costs nothing, and answering it is a click");
		const rep0 = await game(() => window.aitower.store.get().view.standing);
		await page.keyboard.press("i"); // a drawer is open when the decision arrives: it must close (calm)
		await page.locator('[data-drawer="insights"]').waitFor();
		await game(() => window.aitower.store.setSpeed(30));
		await page.locator(".adv-card").waitFor({ timeout: 120_000 });
		assert((await page.locator("[data-drawer]").count()) === 0, "a decision closes any open drawer");
		const held = await game(() => ({ speed: window.aitower.store.get().speed, tick: window.aitower.store.get().view.tick }));
		assert(held.speed === 0, "a decision must stop the clock even at 30x");
		await page.waitForTimeout(1200);
		assert((await game(() => window.aitower.store.get().view.tick)) === held.tick, "the clock must not run while a decision is open");
		assert((await page.locator(".adv-opt.is-rec").count()) === 1, "exactly one option is marked as recommended");
		assert(/defer one day/i.test(await page.locator(".adv-card").innerText()), "the card offers Defer one day");
		await page.locator(".adv-opt.is-rec").click();
		await page.locator(".adv-card").waitFor({ state: "detached" });
		await game(() => window.aitower.store.setSpeed(0));
		assert((await game(() => window.aitower.store.get().view.decision)) === null, "answering must clear the decision");
		log(`decision answered; reputation ${rep0} -> ${await game(() => window.aitower.store.get().view.standing)} (daily uptime moves it, waiting does not)`);

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
		assert(await game(() => window.aitower.store.get().view.automation.policy.parts.enabled), "the parts order did not survive save/load");
		log(`racks ${after}, hash ${hashAfter}, parts order still on`);

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
