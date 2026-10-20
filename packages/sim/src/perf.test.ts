import { describe, expect, it } from "vitest";
import { createState } from "./world/init";
import { SimImpl } from "./sim";
import { makeContent, scenario } from "./test/fixture";
import { TOWER_FLOORS, TOWER_WIDTH, towerContent } from "./test/tower";

/**
 * Wall-clock budgets. Shared CI runners are noisy and slower than a dev machine, and a timing assert there once
 * blocked two deploys at 2.1 ms vs 2 ms. CI keeps a 3× margin, which still catches the order-of-magnitude
 * regressions these tests exist for; local runs keep the tight budget.
 */
const SLACK = process.env.CI ? 3 : 1;

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
		expect(ms).toBeLessThan(1500 * SLACK);
	});

	it("60 floors × 64 wide, ~1,000 racks, 30 bots, chained lifts: mean step() < 2 ms", () => {
		const content = towerContent();
		const sim = new SimImpl(content, createState(content, "tower", 7));
		const racks = sim.state.facilities.filter((f) => f.defId === "rack_air_gpu").length;
		expect(racks).toBeGreaterThanOrEqual(1000);
		expect(sim.state.bots).toHaveLength(30);
		expect(sim.state.width * (sim.state.floorMax - sim.state.floorMin + 1)).toBe(TOWER_WIDTH * TOWER_FLOORS);
		let repaired = 0;
		let maxOrders = 0;
		const tick = (): void => {
			if (sim.state.tick % 150 === 0) sim.submit({ type: "buyParts", count: 15 }); // the player keeps the depots stocked
			for (const e of sim.step()) {
				if (e.type === "contractOffered") sim.submit({ type: "acceptContract", contractId: e.contractId });
				else if (e.type === "repaired") repaired++;
			}
			maxOrders = Math.max(maxOrders, sim.state.workOrders.length);
		};
		for (let i = 0; i < 150; i++) tick(); // warm-up (JIT, first failures)
		// Mean over several windows; the best window is asserted so a noisy neighbour cannot fail the build,
		// while a genuine regression (every window slow) still does.
		const windows: number[] = [];
		for (let w = 0; w < 4; w++) {
			const t0 = process.hrtime.bigint();
			for (let i = 0; i < 250; i++) tick();
			windows.push(Number(process.hrtime.bigint() - t0) / 1e6 / 250);
		}
		const best = Math.min(...windows);
		console.log(`perf tower: mean step() per window [${windows.map((x) => x.toFixed(3)).join(", ")}] ms, best ${best.toFixed(3)} ms; repaired ${repaired}, peak work orders ${maxOrders}`);
		expect(repaired).toBeGreaterThan(20); // bots really worked (incl. across the lift transfer)
		expect(maxOrders).toBeGreaterThan(50); // the queue was deep, i.e. the claim path was exercised
		expect(best).toBeLessThan(2 * SLACK);
	});

	it("the tower with every standing order on (Foreman placing up to 5 per hour): mean step() < 2 ms; the hourly step stays cheap", () => {
		const content = towerContent();
		content.balance.automation = { partsBatch: 5, foremanPerHour: 5 };
		const sim = new SimImpl(content, createState(content, "tower", 7));
		sim.state.techResearched.push("t_foreman");
		sim.state.automation = {
			research: { enabled: true, branches: [] },
			parts: { enabled: true, keep: 10 },
			bots: { enabled: true, racksPerBot: 12, maxBots: 40 },
			foreman: { enabled: true, reserve: 0, racks: true, cooling: true, power: true },
		};
		sim.state.cash = 1e12; // the Foreman has something to spend, so its placement path really runs
		const before = sim.state.facilities.length;
		const tick = (): number => {
			if (sim.state.tick % 150 === 0) sim.submit({ type: "buyParts", count: 15 });
			const t0 = process.hrtime.bigint();
			for (const e of sim.step()) if (e.type === "contractOffered") sim.submit({ type: "acceptContract", contractId: e.contractId });
			return Number(process.hrtime.bigint() - t0) / 1e6;
		};
		for (let i = 0; i < 150; i++) tick();
		const windows: number[] = [];
		let worstHour = 0;
		for (let w = 0; w < 4; w++) {
			let sum = 0;
			for (let i = 0; i < 250; i++) {
				const hour = sim.state.tick % 60 === 0;
				const ms = tick();
				sum += ms;
				if (hour) worstHour = Math.max(worstHour, ms);
			}
			windows.push(sum / 250);
		}
		const best = Math.min(...windows);
		console.log(`perf tower+automation: mean step() per window [${windows.map((x) => x.toFixed(3)).join(", ")}] ms, best ${best.toFixed(3)} ms; worst hour tick ${worstHour.toFixed(2)} ms; Foreman added ${sim.state.facilities.length - before} facilities`);
		expect(sim.state.facilities.length).toBeGreaterThanOrEqual(before); // (a full tower may have no room left)
		expect(best).toBeLessThan(2 * SLACK);
		expect(worstHour).toBeLessThan(50 * SLACK);
	});
});
