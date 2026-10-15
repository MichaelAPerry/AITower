import { describe, expect, it } from "vitest";
import { cellIdx } from "./core/grid";
import { makeContent, newSim, run, scenario } from "./test/fixture";

describe("economy & progression", () => {
	it("keeps a daily ledger (30 days + today), charges upkeep, emits newDay", () => {
		const content = makeContent();
		const sim = newSim(content, "starter");
		const events = run(sim, 1440 * 32);
		expect(events.filter((e) => e.type === "newDay").map((e) => (e.type === "newDay" ? e.day : -1)).slice(0, 2)).toEqual([1, 2]);
		const v = sim.view();
		expect(v.day).toBe(32);
		expect(v.ledger).toHaveLength(31);
		expect(v.ledger[30].day).toBe(32);
		expect(v.ledger[0].day).toBe(2);
		// 9 facilities × $100/day upkeep.
		expect(v.ledger[29].upkeep).toBeCloseTo(900, 6);
		expect(v.ledger[29].energy).toBeGreaterThan(0);
		expect(v.history).toHaveLength(1440);
		expect(v.history[1].tick - v.history[0].tick).toBe(10);
		expect(v.pue).toBeGreaterThan(1);
		expect(v.uptime).toBeGreaterThan(0.5);
	});

	it("tier rises at day change when installed PFLOPS and uptime qualify, paying the reward", () => {
		const content = makeContent([], { tiers: { pflops: [0, 60, 1e9], uptime: [0, 0.5, 1], reward: [0, 123, 456] } });
		const sim = newSim(content, "starter"); // 4 × 20 PFLOPS installed
		const before = sim.state.cash;
		const events = run(sim, 1440);
		expect(events.find((e) => e.type === "tierUp")).toEqual({ type: "tierUp", tier: 2, reward: 123 });
		expect(sim.state.tier).toBe(2);
		expect(sim.state.ledger[0].revenue).toBeGreaterThanOrEqual(123);
		expect(sim.state.cash).toBeLessThan(before + 123); // upkeep/energy also applied
	});

	it("bankrupt after a full day of negative cash; the sim keeps running", () => {
		const content = makeContent([], { startingCash: 10, tiers: { pflops: [0, 1e9], uptime: [0, 1], reward: [0, 0] } });
		const sim = newSim(content, "starter");
		const events = run(sim, 3 * 1440);
		expect(events.filter((e) => e.type === "bankrupt")).toHaveLength(1);
		expect(sim.view().bankrupt).toBe(true);
		expect(sim.state.tick).toBe(3 * 1440);
	});

	it("view reuses typed arrays and reports grid layers", () => {
		const sim = newSim(makeContent(), "starter");
		const v1 = sim.view();
		sim.step();
		const v2 = sim.view();
		expect(v2.airTemp).toBe(v1.airTemp);
		expect(v2.slab[cellIdx(v2, 0, 0)]).toBe(1);
		expect(v2.power[cellIdx(v2, 4, 1)]).toBe(1);
		expect(v2.facilities.find((f) => f.defId === "parts_depot")?.stored).toBe(4);
		expect(v2.spareParts).toBe(4);
		expect(v2.minuteOfDay).toBe(361);
	});

	it("an unknown scenario or bad scenario facility throws", () => {
		expect(() => newSim(makeContent(), "nope")).toThrow(/unknown scenario/);
		const bad = scenario("bad", { slabs: [[0, 0, 3]], facilities: [{ defId: "rack_air_gpu", floor: 0, x: 0 }] });
		expect(() => newSim(makeContent([bad]), "bad")).toThrow(/power conduit/);
	});
});
