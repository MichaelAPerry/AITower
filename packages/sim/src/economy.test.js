import { describe, expect, it } from "vitest";
import { cellIdx } from "./core/grid";
import { makeContent, newSim, run, scenario } from "./test/fixture";
describe("economy & progression", () => {
    it("keeps a daily ledger (30 days + today), charges upkeep, emits newDay", () => {
        const content = makeContent();
        const sim = newSim(content, "starter");
        const events = run(sim, 1440 * 32);
        expect(events.filter((e) => e.type === "newDay").map((e) => (e.type === "newDay" ? e.day : -1)).slice(0, 2)).toEqual([1, 2]);
        const v = sim.view();
        expect(v.day).toBe(32);
        expect(v.ledger).toHaveLength(31);
        expect(v.ledger[30].day).toBe(32);
        expect(v.ledger[0].day).toBe(2);
        // 9 facilities × $100/day upkeep.
        expect(v.ledger[29].upkeep).toBeCloseTo(900, 6);
        expect(v.ledger[29].energy).toBeGreaterThan(0);
        expect(v.history).toHaveLength(1440);
        expect(v.history[1].tick - v.history[0].tick).toBe(10);
        expect(v.pue).toBeGreaterThan(1);
        expect(v.uptime).toBeGreaterThan(0.5);
    });
    it("tier rises at day change when installed PFLOPS and uptime qualify, paying the reward", () => {
        const content = makeContent([], { tiers: { pflops: [0, 60, 1e9], uptime: [0, 0.5, 1], reward: [0, 123, 456] } });
        const sim = newSim(content, "starter"); // 4 × 20 PFLOPS installed
        const before = sim.state.cash;
        const events = run(sim, 1440);
        expect(events.find((e) => e.type === "tierUp")).toEqual({ type: "tierUp", tier: 2, reward: 123 });
        expect(sim.state.tier).toBe(2);
        expect(sim.state.ledger[0].revenue).toBeGreaterThanOrEqual(123);
        expect(sim.state.cash).toBeLessThan(before + 123); // upkeep/energy also applied
    });
    it("bankrupt after a full day of negative cash; the sim keeps running", () => {
        const content = makeContent([], { startingCash: 10, tiers: { pflops: [0, 1e9], uptime: [0, 1], reward: [0, 0] } });
        const sim = newSim(content, "starter");
        const events = run(sim, 3 * 1440);
        expect(events.filter((e) => e.type === "bankrupt")).toHaveLength(1);
        expect(sim.view().bankrupt).toBe(true);
        expect(sim.state.tick).toBe(3 * 1440);
    });
    it("view reuses typed arrays and reports grid layers", () => {
        const sim = newSim(makeContent(), "starter");
        const v1 = sim.view();
        sim.step();
        const v2 = sim.view();
        expect(v2.airTemp).toBe(v1.airTemp);
        expect(v2.slab[cellIdx(v2, 0, 0)]).toBe(1);
        expect(v2.power[cellIdx(v2, 4, 1)]).toBe(1);
        expect(v2.facilities.find((f) => f.defId === "parts_depot")?.stored).toBe(4);
        expect(v2.spareParts).toBe(4);
        expect(v2.minuteOfDay).toBe(361);
    });
    it("an unknown scenario or bad scenario facility throws", () => {
        expect(() => newSim(makeContent(), "nope")).toThrow(/unknown scenario/);
        const bad = scenario("bad", { slabs: [[0, 0, 3]], facilities: [{ defId: "rack_air_gpu", floor: 0, x: 0 }] });
        expect(() => newSim(makeContent([bad]), "bad")).toThrow(/power conduit/);
    });
});
describe("guaranteed offers", () => {
    const slow = () => makeContent([], { economy: { slaPenaltyFactor: 1.5, maxOffers: 4, offerIntervalTicks: 5000, offerExpiryTicks: 400 } });
    /** Ticks (state.tick at step time) of every contractOffered over `ticks` steps. */
    function offerTicks(sim, ticks, react) {
        const out = [];
        for (let i = 0; i < ticks; i++) {
            const t = sim.state.tick;
            for (const e of sim.step())
                if (e.type === "contractOffered") {
                    out.push(t);
                    react?.(e.contractId);
                }
        }
        return out;
    }
    it("with no open offer, one arrives within 6 hours, even if the interval roll said much later", () => {
        const sim = newSim(slow(), "empty", 3);
        expect(sim.state.nextOfferTick).toBeGreaterThan(360);
        const first = offerTicks(sim, 400);
        expect(first).toHaveLength(1);
        expect(first[0]).toBeLessThanOrEqual(360);
    });
    it("after an offer is accepted, declined or expires, the next comes within 6 hours", () => {
        for (const how of ["accept", "decline", "expire"]) {
            // Accepting needs idle racks, so the accept case runs on the fixture's starter site.
            const sim = newSim(slow(), how === "accept" ? "starter" : "empty", 3);
            const log = [];
            const gone = [];
            for (let i = 0; i < 4000; i++) {
                const t = sim.state.tick;
                for (const e of sim.step()) {
                    if (e.type === "contractOffered") {
                        log.push(t);
                        // An offer leaves the board when accepted/declined (next tick) or, if acceptance is refused, on expiry.
                        const r = how === "accept"
                            ? sim.submit({ type: "acceptContract", contractId: e.contractId })
                            : how === "decline"
                                ? sim.submit({ type: "declineContract", contractId: e.contractId })
                                : { ok: false };
                        if (r.ok)
                            gone.push(t + 1);
                    }
                    if (e.type === "contractExpired")
                        gone.push(t);
                }
            }
            expect(log.length, how).toBeGreaterThan(4);
            for (let k = 0; k < log.length - 1; k++) {
                expect(log[k + 1] - gone[k], `${how} #${k}`).toBeLessThanOrEqual(360);
            }
        }
    });
    it("does not speed up generation while offers are still open", () => {
        const sim = newSim(slow(), "empty", 3);
        offerTicks(sim, 400);
        expect(sim.state.offers).toHaveLength(1);
        const next = sim.state.nextOfferTick;
        expect(next).toBeGreaterThan(sim.state.tick + 360);
        run(sim, 10);
        expect(sim.state.nextOfferTick).toBe(next);
    });
});
