/** M4-T1: standing orders (research, parts, bots, Foreman) and the setAutomation command. */
import type { Balance, ContentDB, Scenario } from "@aitower/content";
import { describe, expect, it } from "vitest";
import type { AutomationPolicy, SimEvent } from "./api";
import { type SimImpl, simFromSnapshot } from "./sim";
import { addBot } from "./world/entities";
import { exec, facilityOf, makeContent, newSim, run, scenario } from "./test/fixture";
import { giveRp, grant, NO_OFFERS, pushOffer, QUIET_EVENTS, training } from "./test/m2b";

const BAL: Partial<Balance> = { ...QUIET_EVENTS, ...NO_OFFERS };

/** A lot with slab and power on floors 0 and 1, a grid tie, depot (20) and charger (2 docks). */
const lot = scenario("lot", {
	slabs: [
		[0, 0, 47],
		[1, 0, 47],
	],
	conduits: [
		["power", 0, 0, 47],
		["power", 1, 0, 47],
	],
	facilities: [
		{ defId: "grid_tie", floor: 0, x: 0 },
		{ defId: "parts_depot", floor: 0, x: 30 },
		{ defId: "bot_charger", floor: 0, x: 34 },
	],
});

function content(extra: Scenario[] = [], over: Partial<Balance> = {}, tweak?: (c: ContentDB) => void): ContentDB {
	const c = makeContent([lot, ...extra], { ...BAL, ...over });
	for (const id of ["rack_air_gpu", "rack_dlc_gpu", "rack_storage"]) if (c.facilities[id].rack) c.facilities[id].rack.failurePerDay = 0;
	tweak?.(c);
	return c;
}

const policy = (sim: SimImpl): AutomationPolicy => structuredClone(sim.view().automation.policy);
const policy0 = policy;

/** Replace the policy through the command (so the whole path is exercised) and apply it with one tick. */
function setPolicy(sim: SimImpl, edit: (p: AutomationPolicy) => void): SimEvent[] {
	const p = policy(sim);
	edit(p);
	return exec(sim, { type: "setAutomation", policy: p });
}

const types = (events: SimEvent[], type: SimEvent["type"]) => events.filter((e) => e.type === type);
/** Step until the next step() is an hour tick (tick % 60 === 0, since day 0 starts at 06:00). */
const toHourEdge = (sim: SimImpl): void => {
	while (sim.state.tick % 60 !== 0) sim.step();
};

describe("setAutomation", () => {
	it("starts with everything off and the documented defaults; the Foreman is locked", () => {
		const v = newSim(content()).view();
		expect(v.automation.foremanUnlocked).toBe(false);
		expect(v.automation.policy).toEqual({
			research: { enabled: false, branches: [] },
			parts: { enabled: false, keep: 4 },
			bots: { enabled: false, racksPerBot: 12, maxBots: 8 },
			foreman: { enabled: false, reserve: 1_000_000, racks: true, cooling: true, power: true },
		});
	});

	it("stores the policy (as a copy), shows it in the view, and the last of two commands in a tick wins", () => {
		const sim = newSim(content());
		const p = policy(sim);
		p.parts = { enabled: true, keep: 7 };
		p.research.branches = ["power", "compute"];
		const q = structuredClone(p);
		expect(sim.submit({ type: "setAutomation", policy: p }).ok).toBe(true);
		p.parts.keep = 99; // mutating the caller's object afterwards changes nothing
		q.parts = { enabled: true, keep: 9 };
		expect(sim.submit({ type: "setAutomation", policy: q }).ok).toBe(true);
		sim.step();
		expect(sim.view().automation.policy.parts).toEqual({ enabled: true, keep: 9 });
		expect(sim.view().automation.policy.research.branches).toEqual(["power", "compute"]);
		const view = sim.view().automation.policy;
		view.parts.keep = 1; // the view is a copy too
		expect(sim.view().automation.policy.parts.keep).toBe(9);
	});

	it("rejects malformed shapes without throwing", () => {
		const sim = newSim(content());
		const good = policy(sim);
		const bad: unknown[] = [
			undefined,
			null,
			5,
			"x",
			[],
			{},
			{ ...good, research: null },
			{ ...good, research: { enabled: "yes", branches: [] } },
			{ ...good, research: { enabled: true, branches: "power" } },
			{ ...good, parts: { enabled: true, keep: Number.NaN } },
			{ ...good, parts: { enabled: true, keep: "4" } },
			{ ...good, bots: { enabled: true, racksPerBot: 12 } },
			{ ...good, bots: { enabled: true, racksPerBot: Number.POSITIVE_INFINITY, maxBots: 3 } },
			{ ...good, foreman: { ...good.foreman, reserve: Number.NaN } },
			{ ...good, foreman: { ...good.foreman, racks: 1 } },
			{ ...good, foreman: { ...good.foreman, power: undefined } },
		];
		for (const policy of bad) {
			const r = sim.submit({ type: "setAutomation", policy } as never);
			expect(r.ok).toBe(false);
			expect(sim.canBuild({ type: "setAutomation", policy } as never).ok).toBe(false);
		}
		expect(sim.submit({ type: "setAutomation" } as never).ok).toBe(false);
		sim.step();
		expect(sim.view().automation.policy).toEqual(good);
	});

	it("never throws on 500 randomly broken policies and agrees between canBuild and submit", () => {
		const sim = newSim(content());
		let seed = 12345;
		const rnd = () => {
			seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
			return seed / 4294967296;
		};
		const junk: unknown[] = [undefined, null, Number.NaN, -1, 0, 1.5, 1e300, "x", true, [], {}, [1], { enabled: true }];
		const mutate = (o: unknown, depth = 0): unknown => {
			if (Array.isArray(o)) return o.map((v) => mutate(v, depth + 1));
			if (typeof o !== "object" || o === null) return rnd() < 0.02 ? junk[Math.floor(rnd() * junk.length)] : o;
			const out: Record<string, unknown> = {};
			for (const [k, v] of Object.entries(o)) {
				if (rnd() < 0.01) continue; // missing key
				out[k] = rnd() < 0.02 ? junk[Math.floor(rnd() * junk.length)] : mutate(v, depth + 1);
			}
			return out;
		};
		let accepted = 0;
		for (let i = 0; i < 500; i++) {
			const policy = mutate(structuredClone(policy0(sim)));
			const a = sim.canBuild({ type: "setAutomation", policy } as never);
			const b = sim.submit({ type: "setAutomation", policy } as never);
			expect(a.ok).toBe(b.ok);
			if (b.ok) accepted++;
		}
		expect(accepted).toBeGreaterThan(30); // many mutations are harmless, so valid ones are exercised too
		expect(accepted).toBeLessThan(500);
		expect(() => run(sim, 5)).not.toThrow();
	});

	it("rejects out-of-range values with a plain reason", () => {
		const sim = newSim(content());
		const reason = (edit: (p: AutomationPolicy) => void): string => {
			const p = policy(sim);
			edit(p);
			const r = sim.canBuild({ type: "setAutomation", policy: p });
			return r.ok ? "" : r.reason;
		};
		expect(reason((p) => (p.research.branches = ["nope" as never]))).toMatch(/unknown research branch/);
		expect(reason((p) => (p.research.branches = ["power", "power"]))).toMatch(/repeat/);
		expect(reason((p) => (p.parts.keep = -1))).toMatch(/parts to keep/);
		expect(reason((p) => (p.parts.keep = 2.5))).toMatch(/parts to keep/);
		expect(reason((p) => (p.bots.racksPerBot = 0))).toMatch(/racks per bot/);
		expect(reason((p) => (p.bots.maxBots = -3))).toMatch(/maximum bots/);
		expect(reason((p) => (p.foreman.reserve = -1))).toMatch(/reserve/);
		expect(reason((p) => (p.parts.keep = 0))).toBe("");
		expect(reason((p) => (p.bots.maxBots = 0))).toBe("");
	});

	it("refuses to enable the Foreman until a researched node grants it; other orders and a disabled Foreman are fine", () => {
		const sim = newSim(content());
		const p = policy(sim);
		p.foreman.enabled = true;
		const r = sim.submit({ type: "setAutomation", policy: p });
		expect(r).toMatchObject({ ok: false });
		expect(r.ok ? "" : r.reason).toMatch(/Foreman is not unlocked/);
		const q = policy(sim);
		q.foreman.reserve = 5; // editing a disabled Foreman is allowed
		q.parts.enabled = true;
		expect(sim.submit({ type: "setAutomation", policy: q }).ok).toBe(true);
		sim.step();
		giveRp(sim, 10);
		exec(sim, { type: "research", techId: "t_foreman" });
		expect(sim.view().automation.foremanUnlocked).toBe(true);
		expect(sim.submit({ type: "setAutomation", policy: p }).ok).toBe(true);
	});

	it("round-trips through a snapshot", () => {
		const c = content();
		const sim = newSim(c);
		setPolicy(sim, (p) => {
			p.research = { enabled: true, branches: ["logistics"] };
			p.bots = { enabled: true, racksPerBot: 3, maxBots: 2 };
		});
		const twin = simFromSnapshot(c, JSON.parse(JSON.stringify(sim.snapshot()))) as SimImpl;
		expect(twin.view().automation.policy).toEqual(sim.view().automation.policy);
		expect(twin.hash()).toBe(sim.hash());
	});
});

describe("research order", () => {
	it("buys one node per game-hour: cheapest, then id; nothing when off or unaffordable", () => {
		const sim = newSim(content(), "lot");
		giveRp(sim, 100);
		run(sim, 5);
		expect(sim.state.techResearched).toEqual([]); // off
		setPolicy(sim, (p) => (p.research.enabled = true));
		expect(sim.state.techResearched).toEqual([]); // 06:05, not the top of an hour
		toHourEdge(sim);
		const ev = sim.step();
		expect(types(ev, "researched")).toHaveLength(1);
		expect(sim.state.techResearched).toEqual(["p_cool"]); // cost 1, smallest id
		run(sim, 59);
		expect(sim.state.techResearched).toEqual(["p_cool"]);
		sim.step();
		expect(sim.state.techResearched).toEqual(["p_cool", "p_energy"]);
		const poor = newSim(content(), "lot");
		giveRp(poor, 0.5);
		setPolicy(poor, (p) => (p.research.enabled = true));
		run(poor, 130);
		expect(poor.state.techResearched).toEqual([]);
	});

	it("follows the branch priority list, which also restricts; falls through to what is affordable", () => {
		const mk = (branches: AutomationPolicy["research"]["branches"], rp: number) => {
			const sim = newSim(content(), "lot");
			giveRp(sim, rp);
			setPolicy(sim, (p) => (p.research = { enabled: true, branches }));
			return sim;
		};
		// t_bots (logistics, 15) and t_racks (compute, 20): the order of the list wins over cost.
		const a = mk(["compute", "logistics"], 100);
		expect(a.state.techResearched).toEqual(["t_racks"]);
		const b = mk(["logistics", "compute"], 100);
		expect(b.state.techResearched).toEqual(["t_bots"]);
		// Not affordable first choice -> the next branch.
		const c = mk(["compute", "logistics"], 16);
		expect(c.state.techResearched).toEqual(["t_bots"]);
		// Branches outside the list are never bought.
		const d = mk(["cooling"], 100);
		run(d, 300);
		expect(d.state.techResearched).toEqual([]);
	});

	it("respects prerequisites, clearance and the path gate (the same plan as the command)", () => {
		const c = content();
		c.tech.push({ id: "t_green", name: "Green", description: "", branch: "power", minTier: 1, cost: 1, requires: [], effects: [], path: "greentech" });
		const sim = newSim(c, "lot");
		giveRp(sim, 1000);
		setPolicy(sim, (p) => (p.research = { enabled: true, branches: ["power"] }));
		run(sim, 200);
		expect(sim.state.techResearched).toEqual([]); // path not chosen
		sim.state.path = "greentech";
		sim.invalidateProjection();
		run(sim, 61);
		expect(sim.state.techResearched).toEqual(["t_green"]);
		const t2 = newSim(content(), "lot");
		giveRp(t2, 1000);
		setPolicy(t2, (p) => (p.research = { enabled: true, branches: ["administration"] }));
		run(t2, 60 * 30);
		expect(t2.state.techResearched).not.toContain("t_tier2"); // Clearance 2 needed
		expect(t2.state.techResearched).toContain("t_chain"); // prerequisite t_clerk came first
		expect(t2.state.techResearched.indexOf("t_clerk")).toBeLessThan(t2.state.techResearched.indexOf("t_chain"));
	});
});

describe("parts order", () => {
	it("buys a batch when stock is below keep, at the top of the hour, through the construction ledger", () => {
		const sim = newSim(content(), "lot");
		setPolicy(sim, (p) => (p.parts.enabled = true));
		expect(sim.view().spareParts).toBe(5); // bought on the hour tick at the first step
		const ev = run(sim, 1);
		expect(types(ev, "autoBought")).toHaveLength(0);
		expect(sim.state.today.construction).toBe(50_000);
		run(sim, 200);
		expect(sim.view().spareParts).toBe(5); // 5 >= keep 4: nothing more
	});

	it("emits autoBought and buys again once stock falls; clips to depot room; needs the cash", () => {
		const sim = newSim(content(), "lot");
		const depot = facilityOf(sim, "parts_depot");
		depot.stored = 3;
		sim.invalidateProjection();
		const ev = setPolicy(sim, (p) => (p.parts = { enabled: true, keep: 4 }));
		expect(ev.filter((e) => e.type === "autoBought")).toEqual([{ type: "autoBought", what: "parts", count: 5 }]);
		expect(depot.stored).toBe(8);
		depot.stored = 0;
		sim.invalidateProjection();
		toHourEdge(sim);
		sim.step();
		expect(depot.stored).toBe(5);
		// Room 2 only.
		depot.stored = 18;
		setPolicy(sim, (p) => (p.parts.keep = 20));
		toHourEdge(sim);
		const e2 = sim.step();
		expect(types(e2, "autoBought")).toEqual([{ type: "autoBought", what: "parts", count: 2 }]);
		expect(depot.stored).toBe(20);
		// Poor: 5 parts cost $50k.
		const poor = newSim(content(), "lot");
		poor.state.cash = 49_000;
		setPolicy(poor, (p) => (p.parts.enabled = true));
		expect(poor.view().spareParts).toBe(0);
		expect(types(run(poor, 120), "autoBought")).toHaveLength(0);
	});
});

describe("bots order", () => {
	const racks = (n: number): Scenario =>
		scenario("racky", {
			slabs: [[0, 0, 47]],
			conduits: [["power", 0, 0, 47]],
			facilities: [
				{ defId: "grid_tie", floor: 0, x: 0 },
				{ defId: "bot_charger", floor: 0, x: 40 },
				...Array.from({ length: n }, (_, i) => ({ defId: "rack_air_gpu", floor: 0, x: 6 + 2 * i })),
			],
		});

	it("buys the priciest unlocked type, one per hour, up to min(maxBots, ceil(racks / racksPerBot))", () => {
		const sim = newSim(content([racks(4)]), "racky");
		const ev = setPolicy(sim, (p) => (p.bots = { enabled: true, racksPerBot: 2, maxBots: 8 }));
		expect(types(ev, "autoBought")).toEqual([{ type: "autoBought", what: "bot", count: 1 }]);
		expect(sim.state.bots.map((b) => b.defId)).toEqual(["hauler"]);
		run(sim, 59);
		expect(sim.state.bots).toHaveLength(1);
		run(sim, 1);
		expect(sim.state.bots).toHaveLength(2); // 4 racks / 2 = 2
		run(sim, 300);
		expect(sim.state.bots).toHaveLength(2);
		// The cap wins.
		const capped = newSim(content([racks(4)]), "racky");
		setPolicy(capped, (p) => (p.bots = { enabled: true, racksPerBot: 1, maxBots: 1 }));
		run(capped, 300);
		expect(capped.state.bots).toHaveLength(1);
		// Without racks there is nothing to look after.
		const none = newSim(content([racks(0)]), "racky");
		setPolicy(none, (p) => (p.bots = { enabled: true, racksPerBot: 1, maxBots: 5 }));
		run(none, 200);
		expect(none.state.bots).toHaveLength(0);
	});

	it("skips bot types that still need research, and does not buy without a free dock", () => {
		const c = content([racks(4)], {}, (x) => {
			x.bots.hauler.tech = "t_bots";
		});
		const sim = newSim(c, "racky");
		setPolicy(sim, (p) => (p.bots = { enabled: true, racksPerBot: 4, maxBots: 8 }));
		expect(sim.state.bots.map((b) => b.defId)).toEqual(["drone"]); // 80k beats rover 50k, hauler is gated
		grant(sim, "t_bots");
		setPolicy(sim, (p) => (p.bots.racksPerBot = 2));
		toHourEdge(sim);
		sim.step();
		expect(sim.state.bots.map((b) => b.defId)).toEqual(["drone", "hauler"]);
		// The charger has 2 docks, both used: further purchases are refused by the same plan.
		setPolicy(sim, (p) => (p.bots.racksPerBot = 1));
		run(sim, 400);
		expect(sim.state.bots).toHaveLength(2);
	});
});

describe("the Foreman", () => {
	/** Unlock and switch on; `over` edits the foreman policy. */
	function foreman(sim: SimImpl, over: Partial<AutomationPolicy["foreman"]> = {}, logistics = false): SimEvent[] {
		grant(sim, "t_foreman");
		if (sim.state.bots.length === 0) addBot(sim.state, "rover", 0, 0, -1); // the Foreman builds only where a bot can reach
		toHourEdge(sim); // the order acts on the tick it is set when that tick is a top of the hour
		return setPolicy(sim, (p) => {
			if (!logistics) p.bots.maxBots = 0; // the older tests are about power, cooling and racks only
			p.foreman = { ...p.foreman, enabled: true, reserve: 0, ...over };
		});
	}
	const built = (events: SimEvent[]) => events.filter((e) => e.type === "autoBuilt");
	const placed = (sim: SimImpl, defId: string) => sim.state.facilities.filter((f) => f.defId === defId);
	const perHour = (n: number): Partial<Balance> => ({ automation: { partsBatch: 5, foremanPerHour: n } });

	it("does nothing while locked, even if the policy is forced on", () => {
		const sim = newSim(content(), "lot");
		const p = policy(sim);
		p.foreman.enabled = true;
		sim.state.automation = p;
		const before = sim.state.facilities.length;
		run(sim, 400);
		expect(sim.state.facilities.length).toBe(before);
	});

	describe("power", () => {
		/** Two power islands, each with a rack and no source (satisfaction 0). */
		const islands = scenario("islands", {
			slabs: [[0, 0, 47]],
			conduits: [
				["power", 0, 0, 19],
				["power", 0, 26, 47],
			],
			facilities: [
				{ defId: "rack_air_gpu", floor: 0, x: 4 },
				{ defId: "rack_air_gpu", floor: 0, x: 30 },
			],
		});

		it("adds the best source (largest capacity) to a short net, leftmost on that net's own conduit", () => {
			const sim = newSim(content([islands], perHour(1)), "islands");
			const ev = foreman(sim, { racks: false, cooling: false });
			expect(built(ev)).toHaveLength(1);
			expect(placed(sim, "grid_tie")).toHaveLength(1); // 1,500 kW beats the 800 kW genset
			expect(placed(sim, "genset")).toHaveLength(0);
			const f = placed(sim, "grid_tie")[0];
			expect({ floor: f.floor, x: f.x }).toEqual({ floor: 0, x: 0 }); // net 0, leftmost; the racks sit at 4..5, the tie needs 4 free cells... 
		});

		it("serves at most foremanPerHour nets per hour and never the same net twice in a run", () => {
			const one = newSim(content([islands], perHour(1)), "islands");
			foreman(one, { racks: false, cooling: false });
			expect(placed(one, "grid_tie")).toHaveLength(1);
			run(one, 59);
			expect(placed(one, "grid_tie")).toHaveLength(1);
			run(one, 1); // next hour: the first island is powered now (a solve has run), so the other one is next
			expect(placed(one, "grid_tie")).toHaveLength(2);
			const two = newSim(content([islands], perHour(2)), "islands");
			const ev = foreman(two, { racks: false, cooling: false });
			expect(built(ev)).toHaveLength(2);
			const xs = placed(two, "grid_tie").map((f) => f.x);
			expect(xs[0]).toBeLessThan(20);
			expect(xs[1]).toBeGreaterThanOrEqual(26);
			const three = newSim(content([islands], perHour(5)), "islands");
			expect(built(foreman(three, { racks: false, cooling: false }))).toHaveLength(2); // nothing else to do
		});

		it("falls back to the next source the spot and the budget allow; honours the power toggle", () => {
			const c = content([islands], perHour(1), (x) => {
				x.facilities.grid_tie.placement = { minFloor: 3 }; // no grid tie can go on floor 0
			});
			const sim = newSim(c, "islands");
			foreman(sim, { racks: false, cooling: false });
			expect(placed(sim, "grid_tie")).toHaveLength(0);
			expect(placed(sim, "genset")).toHaveLength(1);
			const off = newSim(content([islands], perHour(1)), "islands");
			foreman(off, { power: false, racks: false, cooling: false });
			expect(off.state.facilities).toHaveLength(2);
		});

		it("never spends below the reserve (exact: cash - cost >= reserve)", () => {
			const sim = newSim(content([islands], perHour(1)), "islands");
			sim.state.cash = 10_000_000;
			// grid tie $250k: reserve leaves exactly enough for the genset ($300k)? no — the tie is tried first.
			const ev = foreman(sim, { racks: false, cooling: false, reserve: 10_000_000 - 249_000 });
			expect(built(ev)).toHaveLength(0); // would leave $9,750,000... below the reserve by $1k
			expect(sim.state.facilities).toHaveLength(2);
			const ok = newSim(content([islands], perHour(1)), "islands");
			ok.state.cash = 10_000_000;
			expect(built(foreman(ok, { racks: false, cooling: false, reserve: 9_000_000 }))).toHaveLength(1);
			expect(ok.state.cash).toBeGreaterThanOrEqual(9_000_000);
		});
	});

	describe("cooling", () => {
		const hot = scenario("hot", {
			slabs: [[0, 0, 47]],
			conduits: [["power", 0, 0, 47]],
			facilities: [
				{ defId: "grid_tie", floor: 0, x: 0 },
				{ defId: "rack_air_gpu", floor: 0, x: 30 },
				{ defId: "rack_air_gpu", floor: 0, x: 32 },
			],
		});
		const withBig = (x: ContentDB): void => {
			x.facilities.crah_big = { ...x.facilities.crah_unit, id: "crah_big", cost: 200_000, cooling: { capacityKw: 300, radius: 8 } };
			x.balance.thermal = { ...x.balance.thermal, okC: 0 }; // every rack counts as running hot
		};

		it("puts the best CRAH within reach of the hot rack, leftmost; one unit per run is enough for one rack", () => {
			const one = scenario("hot1", { ...hot, facilities: hot.facilities.slice(0, 2) });
			const sim = newSim(content([one], perHour(3), withBig), "hot1");
			const ev = foreman(sim, { racks: false, power: false });
			expect(built(ev)).toHaveLength(1);
			const f = placed(sim, "crah_big")[0];
			expect(f.floor).toBe(0);
			const rack = placed(sim, "rack_air_gpu")[0];
			const gap = (x: number) => Math.max(0, rack.x - (x + f.width - 1), x - (rack.x + rack.width - 1));
			expect(gap(f.x)).toBeLessThanOrEqual(8); // radius 8
			expect(gap(f.x - 1)).toBeGreaterThan(8); // leftmost: one tile further left is out of reach
			expect(f.x).toBe(21);
		});

		it("with two hot racks every one ends up in reach of a unit placed by the order", () => {
			const sim = newSim(content([hot], perHour(3), withBig), "hot");
			foreman(sim, { racks: false, power: false });
			const crahs = placed(sim, "crah_big");
			expect(crahs.length).toBeGreaterThanOrEqual(1);
			expect(crahs.length).toBeLessThanOrEqual(2);
			for (const r of placed(sim, "rack_air_gpu")) {
				expect(crahs.some((c) => Math.max(0, r.x - (c.x + c.width - 1), c.x - (r.x + r.width - 1)) <= 8)).toBe(true);
			}
		});

		it("is skipped when the racks are cool, and when the cooling toggle is off", () => {
			const cool = newSim(content([hot], perHour(3), (x) => withBig(x)), "hot");
			cool.content.balance.thermal = { ...cool.content.balance.thermal, okC: 1000 };
			expect(built(foreman(cool, { racks: false, power: false }))).toHaveLength(0);
			const off = newSim(content([hot], perHour(3), withBig), "hot");
			expect(built(foreman(off, { cooling: false, racks: false, power: false }))).toHaveLength(0);
		});
	});

	describe("racks", () => {
		const bare = scenario("bare", {
			slabs: [[0, 0, 47]],
			conduits: [["power", 0, 0, 5]],
			facilities: [{ defId: "grid_tie", floor: 0, x: 0 }],
		});
		const withBigRack = (x: ContentDB): void => {
			x.facilities.rack_air_big = { ...x.facilities.rack_air_gpu, id: "rack_air_big", cost: 600_000, rack: { ...(x.facilities.rack_air_gpu.rack as NonNullable<typeof x.facilities.rack_air_gpu.rack>), pflops: 40 } };
		};

		it("builds the best air rack when there is no compute, on powered slab only (never slab or conduit)", () => {
			const sim = newSim(content([bare], perHour(1), withBigRack), "bare");
			const slab = sim.state.slab.slice();
			const power = sim.state.power.slice();
			const ev = foreman(sim, { power: false, cooling: false });
			expect(built(ev)).toHaveLength(1);
			const r = placed(sim, "rack_air_big")[0];
			expect({ floor: r.floor, x: r.x }).toEqual({ floor: 0, x: 4 }); // conduit stops at 5: x=4 is the only spot, the tie holds 0..3
			expect(Array.from(sim.state.slab)).toEqual(Array.from(slab));
			expect(Array.from(sim.state.power)).toEqual(Array.from(power));
			// A full lot: nothing more is possible, nothing happens, nothing throws.
			run(sim, 600);
			expect(sim.state.facilities).toHaveLength(2);
		});

		const farm = scenario("farm4", {
			slabs: [[0, 0, 47]],
			conduits: [["power", 0, 0, 47]],
			facilities: [
				{ defId: "grid_tie", floor: 0, x: 0 },
				...[8, 10, 12, 14].map((x) => ({ defId: "rack_air_gpu", floor: 0, x })),
			],
		});

		it("builds when idle compute is below 20 %, not when plenty is idle and nothing is on offer", () => {
			const idle = newSim(content([farm], perHour(1), withBigRack), "farm4");
			expect(built(foreman(idle, { power: false, cooling: false }))).toHaveLength(0); // all 4 racks idle, no offers
			const busy = newSim(content([farm], perHour(1), withBigRack), "farm4");
			busy.step();
			const id = pushOffer(busy, training({ work: 2000, durationTicks: 100_000, payout: 1_000_000, penalty: 0 }));
			exec(busy, { type: "acceptContract", contractId: id });
			run(busy, 2);
			expect(busy.state.facilities.filter((f) => f.jobId >= 0)).toHaveLength(4);
			expect(built(foreman(busy, { power: false, cooling: false }))).toHaveLength(1);
			// New rack is placed leftmost, to the right of the tie (x 4..7 are free on the powered slab).
			expect(placed(busy, "rack_air_big")[0].x).toBe(4);
		});

		it("builds when no offer fits the idle compute, but not when one does", () => {
			const make = (sustained: number) => {
				const sim = newSim(content([farm], perHour(2), withBigRack), "farm4");
				sim.step();
				pushOffer(sim, { ...training(), kind: "inference", work: sustained, sustainedPflops: sustained, durationTicks: 720, payout: 1000, penalty: 0 });
				return sim;
			};
			const big = make(500); // 4 idle racks = 80 PF
			expect(built(foreman(big, { power: false, cooling: false }))).toHaveLength(1);
			expect(placed(big, "rack_air_big")).toHaveLength(1); // one per run even with a budget of 2: the offer is the only reason
			const small = make(20);
			expect(built(foreman(small, { power: false, cooling: false }))).toHaveLength(0);
		});

		it("prefers a DLC rack when a coolant loop with spare capacity is reachable, and honours the racks toggle", () => {
			const wet = scenario("wet", {
				slabs: [[0, 0, 47]],
				conduits: [
					["power", 0, 0, 47],
					["coolant", 0, 20, 40],
				],
				facilities: [
					{ defId: "grid_tie", floor: 0, x: 0 },
					{ defId: "cdu", floor: 0, x: 22 },
					{ defId: "chiller", floor: 0, x: 30 },
				],
			});
			const sim = newSim(content([wet], perHour(1)), "wet");
			foreman(sim, { power: false, cooling: false });
			const r = placed(sim, "rack_dlc_gpu")[0];
			expect(r).toBeDefined();
			expect(r.x).toBe(19); // leftmost that touches the loop (coolant starts at 20; a rack needs it under one of its cells)
			expect(placed(sim, "rack_air_gpu")).toHaveLength(0);
			const off = newSim(content([wet], perHour(1)), "wet");
			foreman(off, { racks: false, power: false, cooling: false });
			expect(off.state.facilities).toHaveLength(3);
			// A loop too small for the rack's liquid heat is not "spare capacity": air rack instead.
			const tiny = newSim(content([wet], perHour(1), (x) => (x.facilities.cdu.cooling = { capacityKw: 50 })), "wet");
			foreman(tiny, { power: false, cooling: false });
			expect(placed(tiny, "rack_dlc_gpu")).toHaveLength(0);
			expect(placed(tiny, "rack_air_gpu")).toHaveLength(1);
		});

		it("picks the floor nearest the existing racks", () => {
			const two = scenario("twofloors", {
				slabs: [
					[0, 0, 47],
					[1, 0, 47],
					[2, 0, 47],
				],
				conduits: [
					["power", 0, 0, 47],
					["power", 1, 0, 47],
					["power", 2, 0, 47],
				],
				facilities: [
					{ defId: "grid_tie", floor: 0, x: 0 },
					{ defId: "rack_air_gpu", floor: 2, x: 20 },
				],
				lifts: [{ x: 46, floorMin: 0, floorMax: 2 }],
			});
			const sim = newSim(content([two], perHour(1)), "twofloors");
			sim.step();
			// Make the only rack busy so the idle share is 0.
			pushOffer(sim, training({ work: 2000, durationTicks: 100_000, payout: 1, penalty: 0 }));
			exec(sim, { type: "acceptContract", contractId: sim.state.offers[0].id });
			run(sim, 2);
			foreman(sim, { power: false, cooling: false });
			const r = sim.state.facilities.filter((f) => f.defId === "rack_air_gpu" && f.id !== 2).find((f) => f.floor !== undefined && f.x !== 20);
			expect(r?.floor).toBe(2); // same floor as the existing rack, leftmost free cells
			expect(r?.x).toBe(0);
		});
	});

	describe("maintenance first", () => {
		const farm4 = scenario("maint", {
			slabs: [[0, 0, 47]],
			conduits: [["power", 0, 0, 47]],
			facilities: [
				{ defId: "grid_tie", floor: 0, x: 0 },
				{ defId: "bot_charger", floor: 0, x: 40 },
				{ defId: "parts_depot", floor: 0, x: 43 },
				...[8, 10, 12, 14].map((x) => ({ defId: "rack_air_gpu", floor: 0, x })),
			],
		});
		/** Every rack busy, so the idle share is 0 and the Foreman wants racks. */
		const busy = (): SimImpl => {
			const sim = newSim(content([farm4], perHour(1)), "maint");
			sim.step();
			const id = pushOffer(sim, training({ work: 5000, durationTicks: 100_000, payout: 1, penalty: 0 }));
			exec(sim, { type: "acceptContract", contractId: id });
			run(sim, 2);
			return sim;
		};
		const racksNow = (sim: SimImpl) => sim.state.facilities.filter((f) => f.defId === "rack_air_gpu").length;

		it("no racks while open work orders outnumber the bots; racks again once they do not", () => {
			const sim = busy();
			for (const id of [98, 99]) sim.state.workOrders.push({ id, facilityId: 3, botId: -1, createdAt: 0, attempts: 0, retryAt: 0, retryRev: 0 });
			sim.invalidateProjection();
			foreman(sim, { power: false, cooling: false });
			expect(racksNow(sim)).toBe(4); // 2 orders, 1 bot (the helper adds one so the Foreman has a floor to build on)
			sim.state.workOrders.length = 0;
			toHourEdge(sim);
			sim.step();
			expect(racksNow(sim)).toBe(5);
		});

		it("no racks while the rolling uptime is under the tier's target", () => {
			const sim = busy();
			sim.content.balance.tiers = { ...sim.content.balance.tiers, uptime: [0.9, 0.95, 0.98, 0.995] };
			sim.state.metrics.ringRunning.fill(0.5);
			sim.state.metrics.ringShouldRun.fill(1);
			foreman(sim, { power: false, cooling: false });
			expect(sim.view().uptime).toBeLessThan(0.9);
			expect(racksNow(sim)).toBe(4);
			sim.content.balance.tiers = { ...sim.content.balance.tiers, uptime: [0.2, 0.95, 0.98, 0.995] }; // target met
			toHourEdge(sim);
			sim.step();
			expect(racksNow(sim)).toBe(5);
		});

		it("no racks while standing is low, after a day in the red, or while a rack runs hot / a net is short", () => {
			const blocked = (edit: (sim: SimImpl) => void, over: Partial<AutomationPolicy["foreman"]> = { power: false, cooling: false }): number => {
				const sim = busy();
				edit(sim);
				foreman(sim, over);
				return racksNow(sim);
			};
			const on = { power: true, cooling: true };
			expect(blocked(() => {})).toBe(5); // control
			expect(blocked((s) => (s.state.standing = 10))).toBe(4);
			expect(blocked((s) => s.state.ledger.push({ ...s.state.today, revenue: 0, penalties: 1_000 }))).toBe(4);
			const okC = (s: SimImpl, v: number) => (s.content.balance.thermal = { ...s.content.balance.thermal, okC: v });
			expect(blocked((s) => okC(s, 0), on)).toBe(4); // hot racks wait for a CRAH
			expect(blocked((s) => okC(s, 0))).toBe(5); // ...unless the cooling order is off
		});

		it("leaves a free run for air handling: a solid wall of racks is never built", () => {
			const wide = scenario("wide", {
				slabs: [[0, 0, 47]],
				conduits: [["power", 0, 0, 47]],
				facilities: [{ defId: "grid_tie", floor: 0, x: 0 }],
			});
			const sim = newSim(content([wide], perHour(1)), "wide");
			grant(sim, "t_foreman");
			addBot(sim.state, "rover", 0, 0, -1);
			setPolicy(sim, (p) => {
				p.bots.maxBots = 0;
				p.foreman = { ...p.foreman, enabled: true, reserve: 0, cooling: false, power: false };
			});
			// Every rack the Foreman adds finds the run of 2 tiles (one CRAH) within 8 tiles to its left, so the row has gaps.
			for (let h = 0; h < 40; h++) {
				for (const f of sim.state.facilities) f.jobId = f.defId === "rack_air_gpu" ? 1 : -1; // pretend all racks are busy so more are wanted
				sim.state.jobs.length = 0;
				run(sim, 60);
			}
			const xs = sim.state.facilities.filter((f) => f.defId === "rack_air_gpu").map((f) => f.x).sort((a, b) => a - b);
			expect(xs.length).toBeGreaterThan(5);
			for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1] <= 2 || xs[i] - xs[i - 1] >= 4).toBe(true);
			const gaps = xs.slice(1).filter((x, i) => x - xs[i] >= 4).length;
			expect(gaps).toBeGreaterThan(0);
		});

		it("places the best charger when the bots order wants more bots than the docks hold (bots order on or off)", () => {
			for (const botsOn of [true, false]) {
				const sim = newSim(content([farm4], perHour(1), (c) => {
					c.facilities.bot_charger_big = { ...c.facilities.bot_charger, id: "bot_charger_big", cost: 60_000, logistics: { capacity: 4, chargeKw: 5 } };
				}), "maint");
				// Two docks, both taken.
				for (let i = 0; i < 2; i++) addBot(sim.state, "rover", 0, 41, facilityOf(sim, "bot_charger").id);
				sim.invalidateProjection();
				grant(sim, "t_foreman");
				toHourEdge(sim);
				setPolicy(sim, (p) => {
					p.bots = { enabled: botsOn, racksPerBot: 1, maxBots: 8 };
					p.foreman = { ...p.foreman, enabled: true, reserve: 0 };
				});
				expect(placed(sim, "bot_charger_big")).toHaveLength(1);
				expect(placed(sim, "bot_charger")).toHaveLength(1);
			}
		});

		it("no charger while a dock is free or no more bots are wanted; the reserve and the power conduit still apply", () => {
			const sim = newSim(content([farm4], perHour(1)), "maint");
			foreman(sim, {}, true);
			expect(placed(sim, "bot_charger")).toHaveLength(1); // 4 racks / 12 per bot = 1 wanted, 0 bots, docks free: nothing to add
			const full = newSim(content([farm4], perHour(1)), "maint");
			for (let i = 0; i < 2; i++) addBot(full.state, "rover", 0, 41, facilityOf(full, "bot_charger").id);
			full.invalidateProjection();
			full.state.cash = 10_000_000;
			setPolicy(full, (p) => (p.bots.racksPerBot = 1));
			foreman(full, { reserve: 10_000_000 - 30_000 }, true); // a $40k charger would dip below the reserve
			expect(placed(full, "bot_charger")).toHaveLength(1);
		});

		it("places a depot when parts are short and every depot is full; not when there is room or the parts order is off", () => {
			const mk = (stored: number, partsOn: boolean) => {
				const sim = newSim(content([farm4], perHour(1)), "maint");
				facilityOf(sim, "parts_depot").stored = stored;
				sim.invalidateProjection();
				setPolicy(sim, (p) => (p.parts = { enabled: partsOn, keep: 30 })); // keep above the 20 a depot holds
				foreman(sim, {}, true);
				return sim;
			};
			expect(placed(mk(20, true), "parts_depot")).toHaveLength(2);
			expect(placed(mk(5, true), "parts_depot")).toHaveLength(1); // room left
			expect(placed(mk(20, false), "parts_depot")).toHaveLength(1);
		});
	});

	it("is deterministic and survives a save in the middle of a run", () => {
		const make = () => {
			const sim = newSim(content([], { ...perHour(2), ...{ economy: { slaPenaltyFactor: 1.5, maxOffers: 4, offerIntervalTicks: 60, offerExpiryTicks: 720 } } }), "lot", 5);
			grant(sim, "t_foreman");
			setPolicy(sim, (p) => {
				p.research.enabled = true;
				p.parts.enabled = true;
				p.bots.enabled = true;
				p.foreman = { ...p.foreman, enabled: true, reserve: 0 };
			});
			return sim;
		};
		const a = make();
		const b = make();
		run(a, 3000);
		run(b, 3000);
		expect(a.hash()).toBe(b.hash());
		expect(a.state.facilities.length).toBeGreaterThan(3);
		const twin = simFromSnapshot(a.content, JSON.parse(JSON.stringify(a.snapshot()))) as SimImpl;
		run(a, 1500);
		run(twin, 1500);
		expect(twin.hash()).toBe(a.hash());
	});
});
