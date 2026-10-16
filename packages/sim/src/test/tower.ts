/**
 * Large synthetic tower for scale tests: 60 floors × 64 wide, ~1,000 air racks, 30 bots, four lifts in two
 * stacked pairs (floors 0..30 and 30..59, so reaching the top needs a transfer), a parts depot on floors 0, 30
 * and 59. Shared by perf.test.ts and tooling.
 */
import type { ContentDB, Scenario } from "@aitower/content";
import { makeContent, scenario } from "./fixture";

export const TOWER_FLOORS = 60;
export const TOWER_WIDTH = 64;

export function towerScenario(): Scenario {
	const facilities: { defId: string; floor: number; x: number }[] = [];
	for (let k = 0; k < 7; k++) facilities.push({ defId: "grid_tie", floor: 0, x: k * 4 });
	for (let k = 0; k < 15; k++) facilities.push({ defId: "bot_charger", floor: 0, x: 28 + k * 2 });
	for (const floor of [0, 30, TOWER_FLOORS - 1]) facilities.push({ defId: "parts_depot", floor, x: 58 });
	for (let floor = 1; floor < TOWER_FLOORS; floor++) {
		for (let k = 0; k < 17; k++) facilities.push({ defId: "rack_air_gpu", floor, x: 2 + k * 2 });
		facilities.push({ defId: "crah_unit", floor, x: 38 }, { defId: "crah_unit", floor, x: 40 });
	}
	const floors = Array.from({ length: TOWER_FLOORS }, (_, i) => i);
	return scenario("tower", {
		width: TOWER_WIDTH,
		floorMin: 0,
		floorMax: TOWER_FLOORS - 1,
		slabs: floors.map((f) => [f, 0, TOWER_WIDTH - 1] as [number, number, number]),
		conduits: floors.map((f) => ["power", f, 0, TOWER_WIDTH - 1] as ["power", number, number, number]),
		facilities,
		lifts: [
			{ x: 61, floorMin: 0, floorMax: 30 },
			{ x: 62, floorMin: 0, floorMax: 30 },
			{ x: 63, floorMin: 30, floorMax: TOWER_FLOORS - 1 },
			{ x: 44, floorMin: 30, floorMax: TOWER_FLOORS - 1 },
		],
		bots: Array.from({ length: 30 }, () => ({ defId: "rover", floor: 0, x: 30 })),
		spareParts: 20,
	});
}

/** Fixture content with the tower scenario; racks fail every few days so bots and work orders stay busy. */
export function towerContent(): ContentDB {
	const content = makeContent([towerScenario()]);
	content.facilities.rack_air_gpu.rack = { ...(content.facilities.rack_air_gpu.rack as NonNullable<typeof content.facilities.rack_air_gpu.rack>), failurePerDay: 0.3 };
	content.lift = { ...content.lift, capacity: 6 };
	// 7 ties × 8 MW: the net never browns out (a browned-out net freezes the lifts, which is a different test).
	content.facilities.grid_tie.power = { ...(content.facilities.grid_tie.power as NonNullable<typeof content.facilities.grid_tie.power>), capacityKw: 8000 };
	return content;
}
