/** Test world for multi-lift logistics: floors 0..6, no lift spans the whole height unless asked. */
import type { Scenario } from "@aitower/content";
import { makeContent, scenario } from "./fixture";

export interface ChainOptions {
	/** Lifts as [x, floorMin, floorMax]. Default: x=20 floors 0..3 and x=24 floors 3..6 (transfer on floor 3). */
	lifts?: [number, number, number][];
	spareParts?: number;
	/** Racks as [floor, x]. Default: one rack on floor 6 at x=14. */
	racks?: [number, number][];
	/** Floor of the parts depot (default 0). */
	depotFloor?: number;
}

export function chainScenario(o: ChainOptions = {}): Scenario {
	const lifts = o.lifts ?? [
		[20, 0, 3],
		[24, 3, 6],
	];
	const floors = [0, 1, 2, 3, 4, 5, 6];
	const facilities = [
		{ defId: "grid_tie", floor: 0, x: 0 },
		{ defId: "bot_charger", floor: 0, x: 6 },
		{ defId: "parts_depot", floor: o.depotFloor ?? 0, x: 9 },
		...(o.racks ?? [[6, 14]]).map(([floor, x]) => ({ defId: "rack_air_gpu", floor, x })),
	];
	return scenario("chain", {
		width: 40,
		floorMin: 0,
		floorMax: 6,
		slabs: floors.map((f) => [f, 0, 39] as [number, number, number]),
		conduits: floors.map((f) => ["power", f, 0, 39] as ["power", number, number, number]),
		facilities,
		lifts: lifts.map(([x, floorMin, floorMax]) => ({ x, floorMin, floorMax })),
		bots: [{ defId: "rover", floor: 0, x: 7 }],
		spareParts: o.spareParts ?? 4,
	});
}

/** Fixture content (no random failures) containing the chain scenario. */
export function chainContent(o: ChainOptions = {}) {
	const content = makeContent([chainScenario(o)]);
	for (const id of ["rack_air_gpu", "rack_storage"]) {
		const r = content.facilities[id].rack;
		if (r) r.failurePerDay = 0;
	}
	return content;
}
