import { describe, expect, it } from "vitest";
import { createState } from "./world/init";
import { SimImpl } from "./sim";
import { makeContent, scenario } from "./test/fixture";

/** 48 × 13 lot (floors −2..10), 60 air racks on floors 1..6, CRAHs, 4 bots, one lift. */
function bigScenario() {
	const facilities: { defId: string; floor: number; x: number }[] = [
		{ defId: "grid_tie", floor: 0, x: 0 },
		{ defId: "grid_tie", floor: 0, x: 4 },
		{ defId: "bot_charger", floor: 0, x: 10 },
		{ defId: "bot_charger", floor: 0, x: 12 },
		{ defId: "parts_depot", floor: 0, x: 14 },
	];
	for (let floor = 1; floor <= 6; floor++) {
		for (let k = 0; k < 10; k++) facilities.push({ defId: "rack_air_gpu", floor, x: 2 + k * 2 });
		facilities.push({ defId: "crah_unit", floor, x: 24 }, { defId: "crah_unit", floor, x: 26 }, { defId: "crah_unit", floor, x: 28 });
	}
	const floors = [0, 1, 2, 3, 4, 5, 6];
	return scenario("big", {
		slabs: floors.map((f) => [f, 0, 47] as [number, number, number]),
		conduits: floors.map((f) => ["power", f, 0, 47] as ["power", number, number, number]),
		facilities,
		lifts: [{ x: 46, floorMin: 0, floorMax: 6 }],
		bots: [0, 1, 2, 3].map(() => ({ defId: "rover", floor: 0, x: 11 })),
		spareParts: 20,
	});
}

describe("perf", () => {
	it("48×13 grid, 60 racks, 4 bots: one day (1440 ticks) runs in < 1.5 s", () => {
		const content = makeContent([bigScenario()]);
		content.facilities.bot_charger.logistics = { capacity: 2, chargeKw: 5 };
		const sim = new SimImpl(content, createState(content, "big", 3));
		expect(sim.state.facilities.filter((f) => f.defId === "rack_air_gpu")).toHaveLength(60);
		expect(sim.state.bots).toHaveLength(4);
		const t0 = process.hrtime.bigint();
		for (let i = 0; i < 1440; i++) {
			const ev = sim.step();
			for (const e of ev) if (e.type === "contractOffered") sim.submit({ type: "acceptContract", contractId: e.contractId });
		}
		const ms = Number(process.hrtime.bigint() - t0) / 1e6;
		console.log(`perf: 1440 ticks in ${ms.toFixed(1)} ms (${((ms / 1440) * 1000).toFixed(1)} µs/tick)`);
		expect(ms).toBeLessThan(1500);
	});
});
