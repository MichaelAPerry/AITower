import { describe, expect, it } from "vitest";
import { failRack } from "./reliability/reliabilityStep";
import { chainContent } from "./test/chain";
import { facilityOf, newSim, run } from "./test/fixture";
const world = (defId, o = {}, bots = 1) => {
    const sim = newSim(chainContent(o), "chain", 3);
    for (let i = 1; i < bots; i++)
        sim.state.bots.push({ ...sim.state.bots[0], id: sim.state.nextId.bot++, x: sim.state.bots[0].x });
    for (const b of sim.state.bots)
        b.defId = defId;
    sim.state.bots.forEach((b, i) => {
        b.homeId = sim.state.facilities.find((f) => f.defId === "bot_charger")?.id ?? -1;
        b.x = 7 + (i % 2);
    });
    return sim;
};
const racks = (sim) => sim.state.facilities.filter((f) => f.defId === "rack_air_gpu");
describe("flying bots", () => {
    it("repair a rack six floors up with no lift at all, flying a straight line with a fractional floor", () => {
        const sim = world("drone", { lifts: [] });
        const rack = racks(sim)[0];
        failRack(sim.state, rack, []);
        const states = new Set();
        const flight = [];
        let guard = 0;
        while (rack.failed && guard++ < 600) {
            sim.step();
            const b = sim.state.bots[0];
            const v = sim.view().bots[0];
            states.add(v.state);
            expect(b.leg === "ride" || b.leg === "waitLift").toBe(false);
            expect(b.liftId).toBe(-1);
            if (v.state === "flying" && b.task === "target")
                flight.push({ x: b.x, floor: b.floor });
        }
        expect(rack.failed).toBe(false);
        expect(states.has("flying")).toBe(true);
        expect(states.has("repairing")).toBe(true);
        expect(flight.some((p) => !Number.isInteger(p.floor))).toBe(true);
        // Straight line: floor and x advance at constant rates.
        const dx = flight.slice(1).map((p, i) => p.x - flight[i].x);
        const df = flight.slice(1).map((p, i) => p.floor - flight[i].floor);
        for (const d of dx.slice(0, -1))
            expect(d).toBeCloseTo(dx[0], 9);
        for (const d of df.slice(0, -1))
            expect(d).toBeCloseTo(df[0], 9);
        expect(Math.max(...df)).toBeLessThanOrEqual(0.5 + 1e-9); // speed in floors per tick
        for (const l of sim.state.lifts)
            expect(l.riders).toHaveLength(0);
    });
    it("flies home and parks exactly on its charger tile", () => {
        const sim = world("drone", { lifts: [] });
        failRack(sim.state, racks(sim)[0], []);
        run(sim, 400);
        const b = sim.state.bots[0];
        expect(b.floor).toBe(0);
        expect(Number.isInteger(b.x)).toBe(true);
        expect(["none", "charge"]).toContain(b.task);
        expect(sim.state.workOrders).toHaveLength(0);
    });
    it("a rover cannot do the same without a lift (control)", () => {
        const sim = world("rover", { lifts: [] });
        const rack = racks(sim)[0];
        failRack(sim.state, rack, []);
        run(sim, 600);
        expect(rack.failed).toBe(true);
    });
    it("the botSpeed perk speeds up flight", () => {
        const t = (perk) => {
            const sim = world("drone", { lifts: [] });
            if (perk)
                sim.state.techResearched.push("p_speed");
            const rack = racks(sim)[0];
            failRack(sim.state, rack, []);
            let n = 0;
            while (rack.failed && n < 1000) {
                sim.step();
                n++;
            }
            return n;
        };
        expect(t(true)).toBeLessThan(t(false));
    });
});
describe("carrying bots", () => {
    const rackSpots = [[0, 14], [0, 16], [0, 18]];
    it("takes up to `carry` parts in one depot trip and repairs the orders one after another before going home", () => {
        const sim = world("hauler", { racks: rackSpots, spareParts: 4 });
        const depot = facilityOf(sim, "parts_depot");
        for (const r of racks(sim))
            failRack(sim.state, r, []);
        const bot = sim.state.bots[0];
        const repaired = [];
        let tookAt = -1;
        const tasks = new Set();
        for (let t = 0; t < 1500 && repaired.length < 3; t++) {
            const events = sim.step();
            if (tookAt < 0 && bot.carrying) {
                tookAt = t;
                expect(bot.parts).toBe(3);
                expect(depot.stored).toBe(1); // 4 − 3 in a single trip
            }
            for (const e of events)
                if (e.type === "repaired")
                    repaired.push(e.facilityId);
            if (repaired.length > 0 && repaired.length < 3)
                tasks.add(bot.task);
        }
        expect(repaired).toHaveLength(3);
        expect(new Set(repaired).size).toBe(3);
        expect(tasks.has("charger")).toBe(false); // never went home between repairs
        expect(depot.stored).toBe(1);
        expect(bot.parts).toBe(0);
        expect(bot.carrying).toBe(false);
        run(sim, 300);
        expect(["none", "charge"]).toContain(bot.task);
        expect(sim.state.workOrders).toHaveLength(0);
    });
    it("a rover (carry 1) makes one depot trip per part (control)", () => {
        const sim = world("rover", { racks: rackSpots, spareParts: 4 });
        const depot = facilityOf(sim, "parts_depot");
        for (const r of racks(sim))
            failRack(sim.state, r, []);
        const bot = sim.state.bots[0];
        let max = 0;
        for (let t = 0; t < 3000 && sim.state.workOrders.length > 0; t++) {
            sim.step();
            max = Math.max(max, bot.parts);
        }
        expect(max).toBe(1);
        expect(depot.stored).toBe(1);
    });
    it("takes only as many parts as there are queued orders, and no more than the depot holds", () => {
        const one = world("hauler", { racks: rackSpots, spareParts: 4 });
        failRack(one.state, racks(one)[0], []);
        run(one, 200);
        expect(facilityOf(one, "parts_depot").stored).toBe(3);
        const few = world("hauler", { racks: rackSpots, spareParts: 2 });
        for (const r of racks(few))
            failRack(few.state, r, []);
        let peak = 0;
        for (let t = 0; t < 1500; t++) {
            few.step();
            peak = Math.max(peak, few.state.bots[0].parts);
        }
        expect(peak).toBe(2);
        expect(facilityOf(few, "parts_depot").stored).toBe(0);
        expect(few.state.workOrders).toHaveLength(1); // the third waits for stock
        few.submit({ type: "buyParts", count: 2 });
        run(few, 800);
        expect(few.state.workOrders).toHaveLength(0);
    });
    it("several haulers never share an order, and assignment is deterministic", () => {
        const go = () => {
            const sim = world("hauler", { racks: [[0, 14], [0, 16], [0, 18], [0, 27]], spareParts: 8 }, 2);
            for (const r of racks(sim))
                failRack(sim.state, r, []);
            for (let t = 0; t < 2000; t++) {
                sim.step();
                const held = sim.state.bots.map((b) => b.workOrderId).filter((id) => id >= 0);
                expect(new Set(held).size).toBe(held.length);
            }
            expect(sim.state.workOrders).toHaveLength(0);
            return sim.hash();
        };
        expect(go()).toBe(go());
    });
    it("counts failures and repairs in the lifetime stats", () => {
        const sim = world("rover", { racks: rackSpots });
        for (const r of racks(sim))
            failRack(sim.state, r, []);
        run(sim, 3000);
        expect(sim.view().stats).toMatchObject({ componentFailures: 3, repairs: 3 });
    });
});
