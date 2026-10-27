/** M4b-T1: path affinity (decisions, research, running facilities), snapshot v7, and the Foreman's reach rule. */
import type { EventDef, TechNode } from "@aitower/content";
import { describe, expect, it } from "vitest";
import { type SimImpl, SNAPSHOT_VERSION, simFromSnapshot } from "./sim";
import { AFFINITY_PER_FACILITY_HOUR, AFFINITY_PER_TECH, facilityPath } from "./progression/affinity";
import { reachableFloors } from "./automation/foreman";
import { addBot } from "./world/entities";
import { exec, makeContent, newSim, run, scenario } from "./test/fixture";
import { giveRp, grant, NO_OFFERS, QUIET_EVENTS } from "./test/m2b";

const lot = scenario("afflot", {
	slabs: [[0, 0, 47]],
	conduits: [["power", 0, 0, 47]],
	facilities: [
		{ defId: "grid_tie", floor: 0, x: 0 },
		{ defId: "nutrient_plant", floor: 0, x: 6 },
		{ defId: "solar_array", floor: 0, x: 10 },
		{ defId: "carbon_facade", floor: 0, x: 16 },
		{ defId: "rack_top", floor: 0, x: 20 },
		{ defId: "rack_air_gpu", floor: 0, x: 24 },
	],
});

const mk = () => {
	const c = makeContent([lot], { ...QUIET_EVENTS, ...NO_OFFERS });
	for (const d of Object.values(c.facilities)) if (d.rack) d.rack.failurePerDay = 0;
	return c;
};
const aff = (sim: SimImpl) => ({ ...sim.state.affinity });

describe("path affinity", () => {
	it("starts at zero and reports zero shares", () => {
		const sim = newSim(mk(), "afflot");
		expect(aff(sim)).toEqual({ biotech: 0, greentech: 0, synthetic: 0 });
		expect(sim.view().affinity).toEqual({ biotech: 0, greentech: 0, synthetic: 0 });
	});

	it("classifies facilities by kind, bio cooling and tier", () => {
		const f = mk().facilities;
		expect(facilityPath(f.nutrient_plant)).toBe("biotech");
		expect(facilityPath(f.organoid_rack)).toBe("biotech");
		expect(facilityPath(f.growth_mass)).toBeNull();
		expect(facilityPath(f.solar_array)).toBe("greentech");
		expect(facilityPath(f.carbon_facade)).toBe("greentech");
		expect(facilityPath(f.rack_top)).toBe("synthetic");
		expect(facilityPath(f.rack_air_gpu)).toBeNull();
		expect(facilityPath(f.crah_unit)).toBeNull();
	});

	it("running facilities add 0.01 each per game-hour; a disabled or failed one adds nothing", () => {
		const sim = newSim(mk(), "afflot");
		run(sim, 600); // ten hour edges
		const a = aff(sim);
		expect(a.biotech).toBeCloseTo(10 * AFFINITY_PER_FACILITY_HOUR, 9);
		expect(a.greentech).toBeCloseTo(20 * AFFINITY_PER_FACILITY_HOUR, 9);
		expect(a.synthetic).toBeCloseTo(10 * AFFINITY_PER_FACILITY_HOUR, 9);
		const v = sim.view().affinity;
		expect(v.biotech + v.greentech + v.synthetic).toBeCloseTo(1, 9);
		expect(v.greentech).toBeCloseTo(0.5, 9);
		for (const f of sim.state.facilities) if (facilityPath(sim.content.facilities[f.defId])) f.enabled = false;
		const before = aff(sim);
		run(sim, 600);
		expect(aff(sim)).toEqual(before);
	});

	it("memo affinity effects add their amount (and never go below zero)", () => {
		const c = mk();
		const def: EventDef = {
			id: "fx", category: "ministry", title: "t", body: "b", weight: 1, minTier: 1, cooldownDays: 0, advisor: "cass", recommended: "a",
			choices: [
				{ id: "a", label: "A", hint: "h", outcome: "o", effects: [{ type: "affinity", path: "synthetic", amount: 4 }] },
				{ id: "b", label: "B", hint: "h", outcome: "o", effects: [{ type: "affinity", path: "synthetic", amount: -9 }] },
			],
		};
		c.events = [def];
		const sim = newSim(c, "empty");
		const memo = (choiceId: string) => {
			const id = sim.state.nextId.decision++;
			sim.state.decision = { id, eventId: "fx", issuedAt: sim.state.tick, deferred: false, hiddenUntil: 0 };
			sim.invalidateProjection();
			exec(sim, { type: "resolveDecision", decisionId: id, choiceId });
		};
		memo("a");
		expect(aff(sim).synthetic).toBe(4);
		expect(sim.view().affinity.synthetic).toBe(1);
		memo("b");
		expect(aff(sim).synthetic).toBe(0);
	});

	it("research adds +3 for a path node, a wetware node, or a node unlocking a path facility", () => {
		const c = mk();
		const base: Omit<TechNode, "id" | "name"> = { description: "d", branch: "compute", minTier: 1, cost: 1, requires: [], effects: [] };
		c.tech = [
			{ ...base, id: "t_path", name: "p", path: "greentech" },
			{ ...base, id: "t_wet", name: "w", branch: "wetware" },
			{ ...base, id: "t_unlock", name: "u" },
			{ ...base, id: "t_plain", name: "n" },
		];
		c.facilities.rack_top.tech = "t_unlock";
		const sim = newSim(c, "empty");
		giveRp(sim, 100);
		exec(sim, { type: "research", techId: "t_path" });
		exec(sim, { type: "research", techId: "t_wet" });
		exec(sim, { type: "research", techId: "t_unlock" });
		exec(sim, { type: "research", techId: "t_plain" });
		expect(aff(sim)).toEqual({ biotech: AFFINITY_PER_TECH, greentech: AFFINITY_PER_TECH, synthetic: AFFINITY_PER_TECH });
	});

	it("is deterministic: same seed, same points and hash", () => {
		const a = newSim(mk(), "afflot", 7);
		const b = newSim(mk(), "afflot", 7);
		run(a, 500);
		run(b, 500);
		expect(aff(a)).toEqual(aff(b));
		expect(a.hash()).toBe(b.hash());
	});
});

describe("snapshot v7+", () => {
	it("round-trips affinity; a v6 save (no affinity) migrates to zero and keeps running", () => {
		const sim = newSim(mk(), "afflot");
		run(sim, 300);
		const twin = simFromSnapshot(sim.content, JSON.parse(JSON.stringify(sim.snapshot()))) as SimImpl;
		expect(aff(twin)).toEqual(aff(sim));
		expect(twin.hash()).toBe(sim.hash());
		const snap = JSON.parse(JSON.stringify(sim.snapshot())) as { version: number; state: Record<string, unknown> };
		snap.version = 6;
		delete snap.state.affinity;
		const old = simFromSnapshot(sim.content, snap as never) as SimImpl;
		expect(aff(old)).toEqual({ biotech: 0, greentech: 0, synthetic: 0 });
		expect(old.snapshot().version).toBe(SNAPSHOT_VERSION);
		run(old, 120);
		expect(old.state.affinity.greentech).toBeGreaterThan(0);
	});

	it("rejects a negative affinity", () => {
		const sim = newSim(mk(), "afflot");
		const snap = JSON.parse(JSON.stringify(sim.snapshot())) as { state: { affinity: { biotech: number } } };
		snap.state.affinity.biotech = -1;
		expect(() => simFromSnapshot(sim.content, snap as never)).toThrow(/affinity/);
	});
});

describe("Foreman reach", () => {
	const tower = (lifts: { x: number; floorMin: number; floorMax: number }[]) =>
		scenario("reach", {
			slabs: [[0, 0, 47], [1, 0, 47], [2, 0, 47], [3, 0, 47]],
			conduits: [["power", 0, 0, 47], ["power", 1, 0, 47], ["power", 2, 0, 47], ["power", 3, 0, 47]],
			facilities: [{ defId: "bot_charger", floor: 0, x: 34 }],
			lifts,
		});
	const reach = (lifts: { x: number; floorMin: number; floorMax: number }[], bots = false) => {
		const sc = tower(lifts);
		sc.facilities.push({ defId: "grid_tie", floor: 0, x: 8 }); // powers the lifts
		const c = makeContent([sc], { ...QUIET_EVENTS, ...NO_OFFERS });
		const sim = newSim(c, "reach");
		if (bots) addBot(sim.state, "drone", 0, 0, -1);
		sim.step(); // the first tick solves power: an unpowered lift is not a way up
		return [...reachableFloors(sim.state, sim.content)].sort((a, b) => a - b);
	};

	it("is the charger floor alone without lifts", () => expect(reach([])).toEqual([0]));
	it("follows a lift from the charger floor", () => expect(reach([{ x: 2, floorMin: 0, floorMax: 2 }])).toEqual([0, 1, 2]));
	it("follows a chain of lifts", () =>
		expect(reach([{ x: 2, floorMin: 0, floorMax: 1 }, { x: 4, floorMin: 1, floorMax: 3 }])).toEqual([0, 1, 2, 3]));
	it("ignores a lift that does not touch a reachable floor", () => expect(reach([{ x: 2, floorMin: 2, floorMax: 3 }])).toEqual([0]));
	it("is every floor when a flying bot exists", () => expect(reach([], true)).toEqual(expect.arrayContaining([0, 1, 2, 3])));

	function foremanRun(lifts: { x: number; floorMin: number; floorMax: number }[], withCharger = true) {
		const sc = tower(lifts);
		if (!withCharger) sc.facilities = [];
		sc.facilities.push({ defId: "grid_tie", floor: 0, x: 0 });
		const c = makeContent([sc], { ...QUIET_EVENTS, ...NO_OFFERS, automation: { partsBatch: 5, foremanPerHour: 6 } });
		const sim = newSim(c, "reach");
		grant(sim, "t_foreman");
		const p = structuredClone(sim.view().automation.policy);
		p.bots.maxBots = 0;
		p.foreman = { ...p.foreman, enabled: true, reserve: 0, cooling: false, power: false };
		exec(sim, { type: "setAutomation", policy: p });
		run(sim, 600);
		return sim;
	}
	const racks = (sim: SimImpl) => sim.state.facilities.filter((f) => f.defId.startsWith("rack_"));

	it("places only on reachable floors", () => {
		const sim = foremanRun([{ x: 40, floorMin: 0, floorMax: 1 }]);
		expect(racks(sim).length).toBeGreaterThan(0);
		for (const f of racks(sim)) expect([0, 1]).toContain(f.floor);
	});

	it("a prepared floor with its own charger but no lift to it is not built on", () => {
		const sc = tower([{ x: 40, floorMin: 0, floorMax: 1 }]);
		sc.facilities.push({ defId: "grid_tie", floor: 0, x: 0 }, { defId: "bot_charger", floor: 2, x: 30 });
		const c = makeContent([sc], { ...QUIET_EVENTS, ...NO_OFFERS, automation: { partsBatch: 5, foremanPerHour: 6 } });
		const sim = newSim(c, "reach");
		addBot(sim.state, "rover", 0, 30, -1);
		grant(sim, "t_foreman");
		const p = structuredClone(sim.view().automation.policy);
		p.bots.maxBots = 0;
		p.foreman = { ...p.foreman, enabled: true, reserve: 0, cooling: false, power: false };
		exec(sim, { type: "setAutomation", policy: p });
		run(sim, 900);
		expect(racks(sim).length).toBeGreaterThan(0);
		for (const f of racks(sim)) expect([0, 1]).toContain(f.floor);
		expect([...reachableFloors(sim.state, sim.content)].sort((a, b) => a - b)).toEqual([0, 1]);
	});

	it("a second shaft on the far side of a slab gap does not extend the reach", () => {
		const sc = tower([{ x: 2, floorMin: 0, floorMax: 1 }, { x: 44, floorMin: 1, floorMax: 3 }]);
		sc.slabs = [[0, 0, 47], [1, 0, 19], [1, 21, 47], [2, 0, 47], [3, 0, 47]];
		sc.facilities.push({ defId: "grid_tie", floor: 0, x: 8 });
		const c = makeContent([sc], { ...QUIET_EVENTS, ...NO_OFFERS });
		const sim = newSim(c, "reach");
		sim.step();
		const f = [...reachableFloors(sim.state, sim.content)].sort((a, b) => a - b);
		expect(f).toEqual([0, 1]); // floor 1 is reached on its left run only; floors 2-3 only hang off the right run
	});

	it("places nothing when no floor is reachable, and does not loop", () => {
		const sim = foremanRun([], false);
		expect(racks(sim)).toHaveLength(0);
		expect(sim.state.facilities.map((f) => f.defId)).toEqual(["grid_tie"]);
	});
});
