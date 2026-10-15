import { describe, expect, it } from "vitest";
import { cellIdx } from "./core/grid";
import type { Facility } from "./core/state";
import type { SimImpl } from "./sim";
import { facilityOf, makeContent, newSim, run, scenario } from "./test/fixture";

/** Pin a rack at full load without the job system (jobId with no job is left alone by the scheduler). */
const forceBusy = (r: Facility): void => {
	r.jobId = 9999;
};

const room = (withCrah: boolean) =>
	scenario("room", {
		slabs: [[0, 4, 20]],
		conduits: [["power", 0, 4, 20]],
		facilities: [
			{ defId: "grid_tie", floor: 0, x: 4 },
			{ defId: "rack_air_gpu", floor: 0, x: 10 },
			...(withCrah ? [{ defId: "crah_unit", floor: 0, x: 13 }] : []),
		],
	});

/** Tiny 6-tile room (x8..13) packed with three racks; power arrives through a conduit bridge. */
const closet = scenario("closet", {
	slabs: [
		[0, 0, 3],
		[0, 8, 13],
	],
	conduits: [["power", 0, 0, 13]],
	facilities: [
		{ defId: "grid_tie", floor: 0, x: 0 },
		{ defId: "rack_air_gpu", floor: 0, x: 8 },
		{ defId: "rack_air_gpu", floor: 0, x: 10 },
		{ defId: "rack_air_gpu", floor: 0, x: 12 },
	],
});

const meanFloor = (sim: SimImpl, floor: number, x0: number, x1: number): number => {
	let s = 0;
	for (let x = x0; x <= x1; x++) s += sim.state.airTemp[cellIdx(sim.state, x, floor)];
	return s / (x1 - x0 + 1);
};

describe("thermal", () => {
	it("a loaded rack with no cooling heats up, throttles and trips; then recovers after cooldown", () => {
		const sim = newSim(makeContent([closet]), "closet");
		for (const r of sim.state.facilities) if (r.defId === "rack_air_gpu") forceBusy(r);
		const rack = facilityOf(sim, "rack_air_gpu", 1);
		const events = run(sim, 2000);
		const types = events.filter((e) => "facilityId" in e && e.facilityId === rack.id).map((e) => e.type);
		expect(types).toContain("rackThrottled");
		expect(types).toContain("rackTripped");
		expect(types.indexOf("rackThrottled")).toBeLessThan(types.indexOf("rackTripped"));
		expect(types).toContain("rackRecovered");
	});

	it("with a CRAH the same rack stays below the throttle point", () => {
		const content = makeContent([room(true)], { ambientMeanC: 25, ambientSwingC: 0 });
		const sim = newSim(content, "room");
		const rack = facilityOf(sim, "rack_air_gpu");
		forceBusy(rack);
		let max = 0;
		for (let t = 0; t < 2880; t++) {
			const ev = sim.step();
			expect(ev.some((e) => e.type === "rackTripped")).toBe(false);
			max = Math.max(max, rack.tempC);
		}
		expect(max).toBeLessThan(content.balance.thermal.throttleC);
		expect(rack.thermalClock).toBe(1);
		const crah = facilityOf(sim, "crah_unit");
		expect(crah.heatKw).toBeGreaterThan(30);
		// Never cooled below 20 °C by the CRAH.
		for (let x = 4; x <= 20; x++) expect(sim.state.airTemp[cellIdx(sim.state, x, 0)]).toBeGreaterThanOrEqual(19.99);
	});

	it("heat rises: with equal load the upper floor ends warmer", () => {
		const sc = scenario("stack", {
			slabs: [
				[0, 0, 47],
				[1, 0, 47],
			],
			conduits: [
				["power", 0, 0, 47],
				["power", 1, 0, 47],
			],
			facilities: [
				{ defId: "grid_tie", floor: 0, x: 4 },
				{ defId: "rack_air_gpu", floor: 0, x: 10 },
				{ defId: "rack_air_gpu", floor: 1, x: 10 },
			],
		});
		// Thresholds out of reach so throttling can't make the loads differ.
		const content = makeContent([sc]);
		content.balance.thermal = { ...content.balance.thermal, okC: 500, throttleC: 510, tripC: 520 };
		const sim = newSim(content, "stack");
		for (const r of sim.state.facilities) if (r.defId === "rack_air_gpu") forceBusy(r);
		run(sim, 600);
		expect(facilityOf(sim, "rack_air_gpu", 0).heatKw).toBe(facilityOf(sim, "rack_air_gpu", 1).heatKw);
		const lower = meanFloor(sim, 0, 0, 47);
		const upper = meanFloor(sim, 1, 0, 47);
		expect(upper).toBeGreaterThan(lower + 0.5);
	});

	it("unbuilt cells follow ambient (sinusoid peaking at 15:00)", () => {
		const sim = newSim(makeContent(), "empty");
		run(sim, 9 * 60); // 06:00 → 15:00
		const v = sim.view();
		expect(v.ambientC).toBeCloseTo(22 + 6, 1);
		expect(v.airTemp[cellIdx(sim.state, 0, 5)]).toBeCloseTo(v.ambientC, 1);
	});
});

describe("coolant", () => {
	const dlc = (withLoop: boolean) =>
		scenario("dlc", {
			slabs: [[0, 0, 40]],
			conduits: [["power", 0, 0, 40], ...(withLoop ? ([["coolant", 0, 8, 30]] as ["coolant", number, number, number][]) : [])],
			facilities: [
				{ defId: "grid_tie", floor: 0, x: 0 },
				{ defId: "rack_dlc_gpu", floor: 0, x: 10 },
				...(withLoop
					? [
							{ defId: "chiller", floor: 0, x: 14 },
							{ defId: "cdu", floor: 0, x: 20 },
						]
					: []),
			],
		});

	it("a liquid rack without a coolant net is noCoolant and dumps all heat to air", () => {
		const sim = newSim(makeContent([dlc(false)]), "dlc");
		const rack = facilityOf(sim, "rack_dlc_gpu");
		forceBusy(rack);
		run(sim, 5);
		expect(rack.noCoolant).toBe(true);
		expect(sim.view().facilities.find((f) => f.id === rack.id)?.status).toBe("noCoolant");
		const events = run(sim, 600);
		expect(events.some((e) => e.type === "rackTripped" && e.facilityId === rack.id)).toBe(true);
	});

	it("with chiller + CDU the rack runs at coolant supply temp and the chiller draws Q/COP", () => {
		const content = makeContent([dlc(true)]);
		const sim = newSim(content, "dlc");
		const rack = facilityOf(sim, "rack_dlc_gpu");
		forceBusy(rack);
		run(sim, 300);
		expect(rack.noCoolant).toBe(false);
		const net = sim.state.coolantNets[0];
		expect(net.capacityKw).toBe(400); // min(600 chiller, 400 cdu)
		expect(net.loadKw).toBeCloseTo(120 * 0.8, 6);
		expect(net.supplyTempC).toBe(30);
		const chiller = facilityOf(sim, "chiller");
		expect(chiller.heatKw).toBeCloseTo(96, 6);
		expect(chiller.powerKw).toBeGreaterThan(96 / 5 - 1e-6); // COP derated above 20 °C ambient
		expect(rack.tempC).toBeLessThan(content.balance.thermal.okC);
	});

	it("overloaded loop raises supply temp by 10 °C per 10 % over capacity", () => {
		const content = makeContent([dlc(true)]);
		content.facilities.cdu.cooling = { capacityKw: 80 };
		const sim = newSim(content, "dlc");
		forceBusy(facilityOf(sim, "rack_dlc_gpu"));
		run(sim, 3);
		const net = sim.state.coolantNets[0];
		// load 96 kW vs 80 kW capacity → 20 % over → +20 °C.
		expect(net.supplyTempC).toBeCloseTo(50, 6);
	});
});
