import { makeContent, scenario } from "./fixture";
export function chainScenario(o = {}) {
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
        slabs: floors.map((f) => [f, 0, 39]),
        conduits: floors.map((f) => ["power", f, 0, 39]),
        facilities,
        lifts: lifts.map(([x, floorMin, floorMax]) => ({ x, floorMin, floorMax })),
        bots: [{ defId: "rover", floor: 0, x: 7 }],
        spareParts: o.spareParts ?? 4,
    });
}
/** Fixture content (no random failures) containing the chain scenario. */
export function chainContent(o = {}) {
    const content = makeContent([chainScenario(o)]);
    for (const id of ["rack_air_gpu", "rack_storage"]) {
        const r = content.facilities[id].rack;
        if (r)
            r.failurePerDay = 0;
    }
    return content;
}
