import { describe, expect, it } from "vitest";
import { exec, facilityOf, makeContent, newSim, run, scenario } from "./test/fixture";

const powerScenario = (withBackup: boolean) =>
	scenario("power", {
		slabs: [[0, 0, 47]],
		conduits: [["power", 0, 0, 47]],
		facilities: [
			{ defId: "grid_tie", floor: 0, x: 0 },
			...(withBackup
				? [
						{ defId: "genset", floor: 0, x: 4 },
						{ defId: "ups_battery", floor: 0, x: 8 },
					]
				: []),
			{ defId: "rack_air_gpu", floor: 0, x: 12 },
			{ defId: "rack_air_gpu", floor: 0, x: 14 },
			{ defId: "rack_air_gpu", floor: 0, x: 16 },
			{ defId: "rack_air_gpu", floor: 0, x: 18 },
		],
	});

/** 4 idle air racks draw 4 × 40 × 15 % = 24 kW. */
const IDLE_DEMAND = 24;

describe("power", () => {
	it("satisfaction = supply / demand; racks brown out ≥ 0.5 and go unpowered below", () => {
		const content = makeContent([powerScenario(false)]);
		content.facilities.grid_tie.power = { capacityKw: 12 };
		const sim = newSim(content, "power");
		const events = run(sim, 1);
		const net = sim.state.powerNets[0];
		expect(net.demandKw).toBeCloseTo(IDLE_DEMAND, 9);
		expect(net.satisfaction).toBeCloseTo(0.5, 9);
		expect(events.some((e) => e.type === "powerShortfall")).toBe(true);
		const rack = facilityOf(sim, "rack_air_gpu");
		expect(rack.powerKw).toBeCloseTo(6 * 0.5, 9);
		expect(sim.view().facilities.find((f) => f.id === rack.id)?.status).toBe("brownout");
		expect(sim.state.metrics.gridKw).toBeCloseTo(12, 9);

		const content2 = makeContent([powerScenario(false)]);
		content2.facilities.grid_tie.power = { capacityKw: 10 };
		const sim2 = newSim(content2, "power");
		run(sim2, 1);
		expect(sim2.state.powerNets[0].satisfaction).toBeCloseTo(10 / 24, 9);
		expect(facilityOf(sim2, "rack_air_gpu").powerKw).toBe(0);
		expect(sim2.view().facilities.find((f) => f.defId === "rack_air_gpu")?.status).toBe("unpowered");
		expect(sim2.state.metrics.gridKw).toBe(0);
	});

	it("shortfall starts the genset after its delay while the UPS bridges; genset stops after 60 surplus ticks", () => {
		const content = makeContent([powerScenario(true)]);
		content.facilities.grid_tie.power = { capacityKw: 10 };
		const sim = newSim(content, "power");
		const ups = facilityOf(sim, "ups_battery");
		ups.storedKwh = 250;
		const genset = facilityOf(sim, "genset");

		let startedAt = -1;
		for (let t = 0; t < 30; t++) {
			const ev = sim.step();
			if (ev.some((e) => e.type === "gensetStarted")) startedAt = t;
			expect(sim.state.powerNets[0].satisfaction).toBe(1);
		}
		expect(startedAt).toBe(10); // requested at tick 0, startDelayTicks = 10
		expect(genset.gensetMode).toBe(2);
		// UPS discharged (24 − 10) kW for 10 ticks, then recharged from genset surplus.
		expect(ups.storedKwh).toBeGreaterThan(250 - (14 * 10) / 60 - 1e-9);
		// Fix the grid: genset stops after 60 ticks of grid surplus.
		content.facilities.grid_tie.power = { capacityKw: 1500 };
		let stoppedAfter = -1;
		for (let t = 1; t <= 80 && stoppedAfter < 0; t++) if (sim.step().some((e) => e.type === "gensetStopped")) stoppedAfter = t;
		expect(stoppedAfter).toBe(60);
	});

	it("UPS discharge rate is the net shortfall and depletes with an event", () => {
		const content = makeContent([powerScenario(true)]);
		content.facilities.grid_tie.power = { capacityKw: 10 };
		content.facilities.genset.power = { capacityKw: 800, startDelayTicks: 1000, costPerKwh: 0.35 };
		const sim = newSim(content, "power");
		const ups = facilityOf(sim, "ups_battery");
		ups.storedKwh = 1; // 1 kWh at 14 kW → ~4.3 ticks
		const events = run(sim, 6);
		expect(events.some((e) => e.type === "upsDepleted")).toBe(true);
		expect(ups.storedKwh).toBe(0);
		expect(sim.state.powerNets[0].satisfaction).toBeCloseTo(10 / 24, 9);
	});

	it("energy cost uses time-of-day price; PUE counts facility overhead", () => {
		const content = makeContent([powerScenario(false)]);
		const sim = newSim(content, "power");
		exec(sim, { type: "place", defId: "crah_unit", floor: 0, x: 30 });
		const before = sim.state.today.energy;
		sim.step();
		// tick 1 → 06:01, hour 6 multiplier 0.9; demand 24 kW racks + 8 kW CRAH.
		expect(sim.state.today.energy - before).toBeCloseTo((32 / 60) * 0.08 * 0.9, 9);
		expect(sim.state.metrics.pue).toBeCloseTo(32 / 24, 9);
	});
});
