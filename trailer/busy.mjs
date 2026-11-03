// Shared helper for the trailer and screenshot capture: boots the game (Free Build, seed 7), then builds a busy
// mid-game tower through the real command path (a few tiers of cash and research are granted by editing the save, nothing else).
// No spoilers: Level 3 research of the plain branches only; no tree techs, no seal, no endings.
import { createRequire } from "node:module";
import { join } from "node:path";

export function loadPlaywright(root) {
	for (const dir of [root, "/opt/node22/lib/node_modules/"]) {
		try { return createRequire(join(dir, "/"))("playwright"); } catch { /* next */ }
	}
	throw new Error("playwright not found");
}

export const RESEARCHED = [
	"contracts_clerk", "reading_room", "works_foreman", "batch_cards", "rear_door_drawings", "tape_silo", "desk_fan_standard", "rear_door_exchanger",
	"chilled_loop", "surge_memo", "offpeak_petition", "substation_licence", "flywheel_patent", "pit_crew", "brass_gearing", "central_stores",
	"logistics_drone", "culture_media", "ledger_audit", "vendor_stamp", "inference_foundry", "neuromorphic_bench",
];

/** Boot a fresh game and hide / skip story scenes. */
export async function boot(page, url) {
	await page.goto(`${url}?new&seed=7`, { waitUntil: "load" });
	await page.waitForFunction(() => !!window.aitower?.store && !document.getElementById("boot") && !!document.querySelector(".aitower-hud"));
	await page.addStyleTag({ content: ".vn-stage{visibility:hidden!important}" });
	await page.evaluate(() => {
		setInterval(() => {
			const el = document.querySelector(".vn-stage");
			if (el) el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
		}, 60);
		window.aitower.store.setSpeed(0);
	});
}

/** Grant cash / Level / research by editing the save, then reload it. */
export async function grant(page, { cash = 90_000_000, tier = 3, rp = 9000, techs = RESEARCHED } = {}) {
	await page.evaluate(({ cash, tier, rp, techs }) => {
		const s = JSON.parse(window.aitower.store.save());
		const st = s.snapshot.state;
		st.cash = cash; st.tier = tier; st.researchPoints = rp; st.techResearched = techs;
		window.aitower.store.load(JSON.stringify(s));
	}, { cash, tier, rp, techs });
	await page.evaluate(() => window.aitower.store.setSpeed(0));
}

/** Build floors 2..top and fill every floor with racks, air handling and power; busy enough to hum. */
export async function buildTower(page, top = 8) {
	return page.evaluate(async (top) => {
		const store = window.aitower.store;
		const out = [];
		const run = (c) => { const r = store.dispatch(c); if (!r.ok) out.push([c.type, c.defId ?? "", c.floor ?? "", c.x ?? "", r.reason]); return r; };
		const flush = () => store.sim().flush();
		// basement power: three more grid intakes
		for (const x of [10, 14, 18]) run({ type: "place", defId: "grid_tie", floor: -1, x });
		for (let f = 2; f <= top; f++) {
			run({ type: "buildSlab", floor: f, x0: 4, x1: 43 });
			run({ type: "buildConduit", layer: "power", cells: Array.from({ length: 40 }, (_, i) => ({ floor: f, x: 4 + i })) });
		}
		// upkeep crew: chargers, a bigger parts stock and a fleet of bots
		for (const x of [32, 35, 38]) run({ type: "place", defId: "bot_charger", floor: 0, x });
		for (const x of [6, 12, 18]) run({ type: "place", defId: "depot_big", floor: 0, x });
		run({ type: "buyParts", count: 120 });
		for (let i = 0; i < 3; i++) run({ type: "buyBot", defId: "rover" });
		run({ type: "buildLift", x: 24, floorMin: -1, floorMax: top });
		const row = (f, defs) => { for (const [id, x] of defs) run({ type: "place", defId: id, floor: f, x }); };
		for (let f = 1; f <= top; f++) {
			const kind = f % 3 === 0 ? "rack_storage" : "rack_air_gpu";
			if (f === top) { row(f, [["crah_unit", 10], ["crah_unit", 16], ["crah_unit", 32], ["crah_unit", 38]]); continue; } // the top floor stays open for the Build beat
			if (f > 1) row(f, [[kind, 6], [kind, 8], ["crah_unit", 10], [kind, 12], [kind, 14], ["crah_unit", 16]]);
			row(f, [[kind, 28], [kind, 30], ["crah_unit", 32], [kind, 34], [kind, 36], ["crah_unit", 38]]);
		}
		flush();
		return out;
	}, top);
}

/** The hidden seal meters read as zero (keeps the Trees gauge clean for the trailer: no closed trees on screen). */
export async function scrubSeal(page) {
	await page.evaluate(() => {
		const s = JSON.parse(window.aitower.store.save());
		const st = s.snapshot.state;
		for (const k of Object.keys(st.sealScar)) { st.sealScar[k] = 0; st.sealResidue[k] = 0; }
		window.aitower.store.load(JSON.stringify(s));
		window.aitower.store.setSpeed(0);
	});
}

/**
 * Run the tower `days` game days the way a player would: take every contract that fits (the clerk is switched on too), answer advisor
 * decisions with their first choice, and let the crew clear the repair queue. Ends with racks busy and few broken.
 */
export async function fastForward(page, days = 8) {
	return page.evaluate((days) => {
		const store = window.aitower.store;
		const v0 = store.sim().view();
		store.dispatch({ type: "setClerk", policy: { ...v0.clerk.policy, enabled: true, kinds: ["training", "finetune", "inference"], minPayPerPflopHour: 0, maxPenalty: 0, allowLiquid: true } });
		store.sim().submit({ type: "decisionGate", open: false });
		const stat = () => {
			const v = store.sim().view();
			const racks = v.facilities.filter((f) => f.defId.startsWith("rack"));
			return { day: v.day, cash: v.cash, tier: v.tier, broken: racks.filter((f) => f.status === "failed").length, busy: racks.filter((f) => f.status === "ok").length, racks: racks.length };
		};
		const turn = () => {
			const v = store.sim().view();
			if (v.decision) store.dispatch({ type: "resolveDecision", decisionId: v.decision.id, choiceId: v.decision.choices[0].id });
			for (const o of v.offers) store.dispatch({ type: "acceptContract", contractId: o.id });
		};
		for (let i = 0; i < days * 48; i++) { store.advance(30); turn(); }
		for (let i = 0; i < 400 && (stat().broken > 1 || stat().busy < 10); i++) { store.advance(30); turn(); }
		return stat();
	}, days);
}
