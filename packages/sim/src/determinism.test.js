import { describe, expect, it } from "vitest";
import { simFromSnapshot } from "./sim";
import { makeContent, newSim, rowCells } from "./test/fixture";
/** Failure-prone starter so reliability, bots and lifts all get exercised. */
const content = () => {
    const c = makeContent();
    for (const id of ["rack_air_gpu", "rack_storage"]) {
        const r = c.facilities[id].rack;
        if (r)
            r.failurePerDay = 3;
    }
    return c;
};
/** Scripted player: builds at fixed ticks and accepts every offer. */
function drive(sim, events) {
    const t = sim.state.tick;
    const script = {
        5: [{ type: "buildSlab", floor: 2, x0: 4, x1: 30 }],
        6: [{ type: "buildConduit", layer: "power", cells: rowCells(2, 4, 30) }],
        7: [
            { type: "place", defId: "rack_air_gpu", floor: 2, x: 6 },
            { type: "place", defId: "crah_unit", floor: 2, x: 9 },
            { type: "buyParts", count: 5 },
        ],
        900: [{ type: "demolish", floor: 2, x: 9 }],
        1000: [{ type: "setEnabled", facilityId: 4, enabled: false }],
        1300: [{ type: "setEnabled", facilityId: 4, enabled: true }],
    };
    for (const c of script[t] ?? [])
        sim.submit(c);
    for (const e of events)
        if (e.type === "contractOffered")
            sim.submit({ type: "acceptContract", contractId: e.contractId });
}
function runDriven(sim, ticks, onTick) {
    let last = [];
    for (let i = 0; i < ticks; i++) {
        drive(sim, last);
        last = sim.step();
        onTick?.(sim.state.tick);
    }
}
describe("determinism", () => {
    it("two sims with the same seed and commands hash equal every 100 ticks for 3 days", () => {
        const a = newSim(content(), "starter", 42);
        const b = newSim(content(), "starter", 42);
        const hashes = [];
        let lastA = [];
        let lastB = [];
        let failures = 0;
        for (let i = 0; i < 3 * 1440; i++) {
            drive(a, lastA);
            drive(b, lastB);
            lastA = a.step();
            lastB = b.step();
            failures += lastA.filter((e) => e.type === "componentFailed").length;
            if (a.state.tick % 100 === 0) {
                const h = a.hash();
                expect(b.hash()).toBe(h);
                hashes.push(h);
            }
        }
        expect(new Set(hashes).size).toBe(hashes.length); // state actually evolves
        expect(failures).toBeGreaterThan(0);
        expect(a.state.jobs.length + a.state.offers.length).toBeGreaterThan(0);
        // A different seed diverges.
        const c = newSim(content(), "starter", 43);
        runDriven(c, 3 * 1440);
        expect(c.hash()).not.toBe(a.hash());
    });
    it("snapshot round-trip mid-run (through JSON) gives identical hashes 1000 ticks later", () => {
        const db = content();
        const a = newSim(db, "starter", 9);
        runDriven(a, 1500);
        a.submit({ type: "buyParts", count: 1 }); // pending command must survive the snapshot
        const snap = JSON.parse(JSON.stringify(a.snapshot()));
        const b = simFromSnapshot(db, snap);
        expect(b.hash()).toBe(a.hash());
        runDriven(a, 1000);
        runDriven(b, 1000);
        expect(b.hash()).toBe(a.hash());
        expect(b.view().tick).toBe(2500);
    });
    it("snapshot does not alias live state", () => {
        const a = newSim(content(), "starter", 1);
        const snap = a.snapshot();
        const h = JSON.stringify(snap);
        runDriven(a, 50);
        expect(JSON.stringify(snap)).toBe(h);
    });
});
