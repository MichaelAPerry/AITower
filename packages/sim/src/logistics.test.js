import { describe, expect, it } from "vitest";
import { failRack } from "./reliability/reliabilityStep";
import { exec, facilityOf, makeContent, newSim } from "./test/fixture";
/** Starter: bot + charger + depot on floor 0, racks on floor 1, lift at x24 spanning −1..1. */
const starterNoFailures = () => {
    const content = makeContent();
    for (const id of ["rack_air_gpu", "rack_storage"]) {
        const r = content.facilities[id].rack;
        if (r)
            r.failurePerDay = 0;
    }
    return content;
};
describe("logistics", () => {
    it("a bot repairs a failed rack on another floor via the lift, consuming a spare part", () => {
        const sim = newSim(starterNoFailures(), "starter");
        const rack = facilityOf(sim, "rack_air_gpu", 0);
        const depot = facilityOf(sim, "parts_depot");
        expect(depot.stored).toBe(4);
        failRack(sim.state, rack, []);
        const seen = new Set();
        const liftFloors = new Set();
        let repairedAt = -1;
        for (let t = 0; t < 1200 && repairedAt < 0; t++) {
            const ev = sim.step();
            const v = sim.view();
            seen.add(v.bots[0].state);
            liftFloors.add(v.lifts[0].carFloor);
            if (ev.some((e) => e.type === "repaired" && e.facilityId === rack.id && e.botId === 1))
                repairedAt = t;
        }
        expect(repairedAt).toBeGreaterThan(0);
        expect(rack.failed).toBe(false);
        expect(rack.health).toBe(1);
        expect(depot.stored).toBe(3);
        expect(sim.state.workOrders).toHaveLength(0);
        for (const s of ["toDepot", "waitingLift", "riding", "toTarget", "repairing"])
            expect(seen.has(s)).toBe(true);
        // The car moved through fractional positions.
        expect([...liftFloors].some((f) => !Number.isInteger(f))).toBe(true);
        // Bot heads home and ends on its integer charger tile on floor 0.
        for (let t = 0; t < 600; t++)
            sim.step();
        const bot = sim.view().bots[0];
        expect(bot.floor).toBe(0);
        expect(bot.x).toBe(27);
        expect(["idle", "charging"]).toContain(bot.state);
    });
    it("bots wait at an empty depot until parts are bought", () => {
        const sim = newSim(starterNoFailures(), "starter");
        facilityOf(sim, "parts_depot").stored = 0;
        const rack = facilityOf(sim, "rack_air_gpu", 2);
        failRack(sim.state, rack, []);
        for (let t = 0; t < 300; t++)
            sim.step();
        expect(sim.view().bots[0].state).toBe("toDepot");
        expect(rack.failed).toBe(true);
        exec(sim, { type: "buyParts", count: 2 });
        let repaired = false;
        for (let t = 0; t < 1200 && !repaired; t++)
            repaired = sim.step().some((e) => e.type === "repaired");
        expect(repaired).toBe(true);
        expect(facilityOf(sim, "parts_depot").stored).toBe(1);
    });
    it("low battery sends a bot to charge; charging is 5× faster than draining", () => {
        const sim = newSim(starterNoFailures(), "starter");
        const bot = sim.state.bots[0];
        bot.battery = 0.1;
        sim.step();
        expect(bot.task).toBe("charge");
        sim.step();
        expect(bot.battery).toBeCloseTo(0.1 + 5 / 600, 9); // tick 1 docks, tick 2 charges
        expect(facilityOf(sim, "bot_charger").charging).toBe(true);
        // A failure while below the resume level is not claimed yet.
        failRack(sim.state, facilityOf(sim, "rack_air_gpu"), []);
        sim.step();
        expect(sim.state.workOrders[0].botId).toBe(-1);
        for (let t = 0; t < 60; t++)
            sim.step();
        expect(sim.state.workOrders[0].botId).toBe(bot.id);
    });
    it("buyBot spawns at a charger with a free dock", () => {
        const sim = newSim(starterNoFailures(), "starter");
        exec(sim, { type: "buyBot", defId: "rover" });
        expect(sim.state.bots).toHaveLength(2);
        expect(sim.state.bots[1]).toMatchObject({ floor: 0, x: 27, homeId: facilityOf(sim, "bot_charger").id });
        // capacity 2 → full now.
        expect(sim.submit({ type: "buyBot", defId: "rover" })).toEqual({ ok: false, reason: "no charger with a free dock" });
    });
});
