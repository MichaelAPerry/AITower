import { describe, expect, it } from "vitest";
import { failRack } from "./reliability/reliabilityStep";
import { perk } from "./research/research";
import { chainContent } from "./test/chain";
import { exec, facilityOf, makeContent, newSim, run, scenario } from "./test/fixture";
import { acceptSpec, farmContent, giveRp, grant, NO_OFFERS, training } from "./test/m2b";
const reason = (r) => (r.ok ? "" : r.reason);
describe("research command", () => {
    it("rejects with a plain reason: unknown, already researched, missing prerequisite, clearance, not enough RP", () => {
        const sim = newSim(farmContent(), "farm");
        giveRp(sim, 100);
        expect(reason(sim.submit({ type: "research", techId: "nope" }))).toBe("unknown tech 'nope'");
        expect(reason(sim.submit({ type: "research", techId: "constructor" }))).toMatch(/unknown tech/);
        expect(reason(sim.submit({ type: "research", techId: "t_chain" }))).toBe("missing prerequisite: Contracts Clerk");
        expect(reason(sim.submit({ type: "research", techId: "t_tier2" }))).toBe("requires Clearance 2");
        giveRp(sim, 2.5);
        expect(reason(sim.submit({ type: "research", techId: "t_clerk" }))).toBe("needs 10 RP, have 2.5");
        giveRp(sim, 9.99);
        expect(reason(sim.submit({ type: "research", techId: "t_clerk" }))).toBe("needs 10 RP, have 9.9"); // never rounds up to a lie
        giveRp(sim, 10);
        expect(sim.submit({ type: "research", techId: "t_clerk" }).ok).toBe(true);
        exec(sim);
        expect(reason(sim.submit({ type: "research", techId: "t_clerk" }))).toBe("already researched: Contracts Clerk");
        // canBuild agrees and never queues.
        expect(reason(sim.canBuild({ type: "research", techId: "t_chain" }))).toMatch(/needs 5 RP/);
    });
    it("deducts RP, appends in order, emits researched; the view reflects it", () => {
        const sim = newSim(farmContent(), "farm");
        giveRp(sim, 12.5);
        const events = exec(sim, { type: "research", techId: "t_clerk" });
        expect(events).toContainEqual({ type: "researched", techId: "t_clerk" });
        expect(sim.state.researchPoints).toBeCloseTo(2.5, 9);
        exec(sim, { type: "research", techId: "p_fail" });
        const v = sim.view();
        expect(v.techResearched).toEqual(["t_clerk", "p_fail"]);
        expect(v.researchPoints).toBeCloseTo(1.5, 9);
        expect(v.techResearched).not.toBe(sim.state.techResearched); // a copy
    });
    it("is queue-aware: RP is spent and prerequisites are met by commands queued in the same tick", () => {
        const sim = newSim(farmContent(), "farm");
        giveRp(sim, 16);
        expect(sim.submit({ type: "research", techId: "t_clerk" }).ok).toBe(true);
        expect(sim.submit({ type: "research", techId: "t_chain" }).ok).toBe(true); // its prerequisite is queued
        expect(reason(sim.submit({ type: "research", techId: "t_clerk" }))).toMatch(/already researched/);
        expect(sim.submit({ type: "research", techId: "p_fail" }).ok).toBe(true); // 16 − 10 − 5 = 1 left
        expect(reason(sim.submit({ type: "research", techId: "p_energy" }))).toBe("needs 1 RP, have 0");
        const events = sim.step();
        expect(events.filter((e) => e.type === "researched").map((e) => (e.type === "researched" ? e.techId : ""))).toEqual(["t_clerk", "t_chain", "p_fail"]);
        expect(sim.state.researchPoints).toBeCloseTo(0, 9);
    });
    it("applyCommands stays authoritative: a stale queued research is rejected with an event", () => {
        const sim = newSim(farmContent(), "farm");
        giveRp(sim, 10);
        expect(sim.submit({ type: "research", techId: "t_clerk" }).ok).toBe(true);
        sim.state.researchPoints = 0; // the world changed behind the queue
        const events = sim.step();
        expect(events.find((e) => e.type === "commandRejected")).toMatchObject({ reason: "needs 10 RP, have 0" });
        expect(sim.state.techResearched).toEqual([]);
    });
    it("malformed research commands are refused without throwing", () => {
        const sim = newSim(farmContent(), "farm");
        for (const bad of [{ type: "research" }, { type: "research", techId: 5 }, { type: "research", techId: null }, { type: "research", techId: { a: 1 } }]) {
            const r = sim.submit(bad);
            expect(r.ok).toBe(false);
            expect(reason(r)).toMatch(/malformed/);
        }
    });
});
describe("research points", () => {
    it("earns delivered PFLOP-hours × pointsPerPflopHour, plus pointsPerJob per completed job", () => {
        const sim = newSim(farmContent({ research: { pointsPerPflopHour: 0.5, pointsPerJob: 7 } }), "farm");
        const jobId = acceptSpec(sim, training({ work: 40 }));
        let done = false;
        for (let t = 0; t < 200 && !done; t++)
            done = sim.step().some((e) => e.type === "jobCompleted");
        expect(done).toBe(true);
        // Training reaches 40 PFLOP-h exactly (cannot over-deliver beyond the final tick's slice): RP = Σ delivered/60 × 0.5 + 7.
        const job = sim.state.jobs.find((j) => j.id === jobId);
        expect(job?.progress).toBe(40);
        expect(sim.state.researchPoints).toBeGreaterThan(7 + 40 * 0.5 - 0.0001);
        expect(sim.state.researchPoints).toBeLessThan(7 + (40 + 80 / 60) * 0.5 + 0.0001); // the last tick may deliver a little over
        expect(sim.view().stats.researchPointsEarned).toBeCloseTo(sim.state.researchPoints, 9);
        expect(sim.state.stats.pflopHours).toBeGreaterThan(40 - 0.0001);
    });
    it("exact per-tick income: 80 PFLOPS for one tick = 80/60 PF-h", () => {
        const sim = newSim(farmContent({ research: { pointsPerPflopHour: 0.01, pointsPerJob: 5 } }), "farm");
        acceptSpec(sim, training({ work: 1000 }));
        expect(sim.state.researchPoints).toBe(0); // the acceptance tick delivered nothing yet
        run(sim, 1);
        expect(sim.state.researchPoints).toBeCloseTo((80 / 60) * 0.01, 9);
        run(sim, 1);
        expect(sim.state.researchPoints).toBeCloseTo(2 * (80 / 60) * 0.01, 9);
    });
    it("inference jobs earn RP too, and the researchRate perk multiplies the delivered part only", () => {
        const base = newSim(farmContent({ research: { pointsPerPflopHour: 0.01, pointsPerJob: 5 } }), "farm");
        const fast = newSim(farmContent({ research: { pointsPerPflopHour: 0.01, pointsPerJob: 5 } }), "farm");
        grant(fast, "p_rate"); // ×2
        for (const s of [base, fast])
            acceptSpec(s, { ...training({ work: 1000 }), kind: "inference", sustainedPflops: 20, durationTicks: 100, payout: 1000, penalty: 0 });
        run(base, 10);
        run(fast, 10);
        expect(base.state.researchPoints).toBeGreaterThan(0);
        expect(fast.state.researchPoints).toBeCloseTo(2 * base.state.researchPoints, 9);
        run(base, 120);
        run(fast, 120);
        // Both completed one job: bonus of 5 each, not multiplied.
        const gain = (s) => s.state.stats.researchPointsEarned;
        expect(gain(fast) - 5).toBeCloseTo(2 * (gain(base) - 5), 9);
    });
    it("spending RP does not reduce the lifetime earned counter", () => {
        const sim = newSim(farmContent(), "farm");
        giveRp(sim, 50);
        sim.state.stats.researchPointsEarned = 50;
        exec(sim, { type: "research", techId: "t_clerk" });
        expect(sim.state.researchPoints).toBe(40);
        expect(sim.view().stats.researchPointsEarned).toBe(50);
    });
});
describe("tech gating", () => {
    it("a facility with `tech` cannot be placed until the node is researched", () => {
        const content = farmContent();
        const sim = newSim(content, "farm");
        const cmd = { type: "place", defId: "rack_gated", floor: 0, x: 30 };
        expect(reason(sim.canBuild(cmd))).toBe("requires research: Cheap Racks");
        expect(reason(sim.canPlace("rack_gated", 0, 30))).toBe("requires research: Cheap Racks");
        expect(sim.submit(cmd).ok).toBe(false);
        giveRp(sim, 20);
        exec(sim, { type: "research", techId: "t_racks" });
        expect(sim.canBuild(cmd).ok).toBe(true);
        exec(sim, cmd);
        expect(facilityOf(sim, "rack_gated")).toBeDefined();
    });
    it("research and the gated build can be queued in one tick", () => {
        const sim = newSim(farmContent(), "farm");
        giveRp(sim, 20);
        expect(sim.submit({ type: "research", techId: "t_racks" }).ok).toBe(true);
        expect(sim.submit({ type: "place", defId: "rack_gated", floor: 0, x: 30 }).ok).toBe(true);
        const events = sim.step();
        expect(events.some((e) => e.type === "commandRejected")).toBe(false);
        expect(facilityOf(sim, "rack_gated")).toBeDefined();
    });
    it("the tier check still comes first, and scenario setup ignores research", () => {
        const gatedStart = scenario("gated", { slabs: [[0, 0, 20]], conduits: [["power", 0, 0, 20]], facilities: [{ defId: "rack_gated", floor: 0, x: 2 }] });
        const sim = newSim(makeContent([gatedStart]), "gated");
        expect(facilityOf(sim, "rack_gated")).toBeDefined();
        expect(sim.state.stats.facilitiesBuilt).toBe(0); // scenario setup is not "built"
        const c = farmContent();
        c.facilities.rack_gated.unlockTier = 3;
        const s2 = newSim(c, "farm");
        expect(reason(s2.canPlace("rack_gated", 0, 30))).toBe("requires tier 3");
    });
    it("a bot with `tech` cannot be bought until researched", () => {
        const sim = newSim(makeContent([chainContent().scenarios.chain]), "chain");
        expect(reason(sim.canBuild({ type: "buyBot", defId: "gated_bot" }))).toBe("requires research: Gated Bots");
        giveRp(sim, 15);
        exec(sim, { type: "research", techId: "t_bots" });
        expect(sim.canBuild({ type: "buyBot", defId: "gated_bot" }).ok).toBe(true);
        exec(sim, { type: "buyBot", defId: "gated_bot" });
        expect(sim.state.bots).toHaveLength(2);
    });
    it("a facility naming a node that does not exist can never be built (and says so)", () => {
        const c = farmContent();
        c.facilities.rack_gated.tech = "ghost";
        expect(reason(newSim(c, "farm").canPlace("rack_gated", 0, 30))).toBe("requires research: ghost");
    });
});
describe("perks", () => {
    const content = () => farmContent();
    it("perk() is the product of every researched node's factor; no nodes ⇒ 1", () => {
        const sim = newSim(content(), "farm");
        expect(perk(sim.state, sim.content, "payout")).toBe(1);
        grant(sim, "p_payout");
        expect(perk(sim.state, sim.content, "payout")).toBe(2);
        grant(sim, "p_payout2");
        expect(perk(sim.state, sim.content, "payout")).toBe(3); // 2 × 1.5, recomputed after the list grew
        expect(perk(sim.state, sim.content, "upkeep")).toBe(1);
    });
    it("failureRate multiplies the hazard (factor 0 ⇒ no failures at all)", () => {
        const mk = (perkNode) => {
            const c = content();
            c.facilities.rack_air_gpu.rack.failurePerDay = 300; // ~20 % per tick: hopeless without the perk
            c.tech.push({ id: "p_none", name: "No failures", description: "", branch: "power", minTier: 1, cost: 1, requires: [], effects: [{ type: "perk", kind: "failureRate", factor: 0 }] });
            const s = newSim(c, "farm", 4);
            if (perkNode)
                grant(s, "p_none");
            return s;
        };
        const bad = mk(false);
        const good = mk(true);
        expect(run(bad, 300).filter((e) => e.type === "componentFailed").length).toBeGreaterThan(0);
        expect(run(good, 300).filter((e) => e.type === "componentFailed").length).toBe(0);
    });
    it("energyPrice multiplies what you pay, the view's price, and stacks with memo modifiers", () => {
        const a = newSim(content(), "farm");
        const b = newSim(content(), "farm");
        grant(b, "p_energy");
        run(a, 5);
        run(b, 5);
        expect(a.state.metrics.energyCost).toBeGreaterThan(0);
        expect(b.state.metrics.energyCost).toBeCloseTo(a.state.metrics.energyCost * 0.5, 9);
        expect(b.view().energyPrice).toBeCloseTo(a.view().energyPrice * 0.5, 12);
        // Both apply: a ×3 memo modifier on top of the ×0.5 perk.
        b.state.modifiers.push({ kind: "energyPrice", value: 3, endsAt: 1e9, label: "x" });
        expect(b.view().energyPrice).toBeCloseTo(a.view().energyPrice * 1.5, 12);
        run(b, 1);
        run(a, 1);
        expect(b.state.metrics.energyCost).toBeCloseTo(a.state.metrics.energyCost * 1.5, 9);
    });
    it("payout multiplies newly generated offers only", () => {
        const bal = { economy: { slaPenaltyFactor: 1.5, maxOffers: 4, offerIntervalTicks: 50, offerExpiryTicks: 5000 } };
        const mk = (...ids) => {
            const s = newSim(farmContent(bal), "farm", 6);
            grant(s, ...ids);
            return s;
        };
        const plain = mk();
        const rich = mk("p_payout", "p_payout2");
        const old = mk();
        run(plain, 400);
        run(rich, 400);
        run(old, 200);
        const before = old.state.offers.map((o) => o.spec.payout);
        grant(old, "p_payout");
        run(old, 1);
        expect(old.state.offers.map((o) => o.spec.payout).slice(0, before.length)).toEqual(before); // existing offers unchanged
        expect(plain.state.offers.length).toBeGreaterThan(0);
        expect(rich.state.offers.map((o) => o.spec.payout)).toEqual(plain.state.offers.map((o) => o.spec.payout * 3));
    });
    it("coolingCapacity multiplies crah, chiller and cdu capacity", () => {
        const liquid = scenario("liquid", {
            slabs: [[0, 0, 40]],
            conduits: [["power", 0, 0, 40], ["coolant", 0, 0, 40]],
            facilities: [
                { defId: "grid_tie", floor: 0, x: 0 },
                { defId: "chiller", floor: 0, x: 6 },
                { defId: "cdu", floor: 0, x: 11 },
                { defId: "rack_dlc_gpu", floor: 0, x: 14 },
            ],
        });
        const mk = (perkId) => {
            const c = makeContent([liquid]);
            const s = newSim(c, "liquid");
            if (perkId)
                grant(s, perkId);
            run(s, 3);
            return s;
        };
        expect(mk().view().coolantNets[0].capacityKw).toBe(400); // min(chiller 600, cdu 400)
        expect(mk("p_cool").view().coolantNets[0].capacityKw).toBe(800); // min(1200, 800)
    });
    it("coolingCapacity lifts the crah ceiling", () => {
        const hot = scenario("hot", {
            slabs: [[0, 0, 40]],
            conduits: [["power", 0, 0, 40]],
            facilities: [
                { defId: "grid_tie", floor: 0, x: 0 },
                { defId: "rack_air_gpu", floor: 0, x: 8 },
                { defId: "rack_air_gpu", floor: 0, x: 10 },
                { defId: "rack_air_gpu", floor: 0, x: 12 },
                { defId: "rack_air_gpu", floor: 0, x: 14 },
                { defId: "rack_air_gpu", floor: 0, x: 16 },
                { defId: "crah_unit", floor: 0, x: 4 },
            ],
        });
        const peak = (withPerk) => {
            const c = makeContent([hot], NO_OFFERS);
            for (const id of ["rack_air_gpu"])
                c.facilities[id].rack.failurePerDay = 0;
            const s = newSim(c, "hot");
            if (withPerk)
                grant(s, "p_cool");
            // a long job keeps every rack busy (5 × 40 kW = 200 kW of heat)
            acceptSpec(s, training({ work: 1e6, durationTicks: 1e6 }));
            let best = 0;
            for (let t = 0; t < 900; t++) {
                s.step();
                best = Math.max(best, facilityOf(s, "crah_unit").heatKw);
            }
            return best;
        };
        const plain = peak(false);
        expect(plain).toBeLessThanOrEqual(150 + 1e-6);
        expect(plain).toBeGreaterThan(149);
        expect(peak(true)).toBeGreaterThan(150 + 1);
    });
    it("upkeep multiplies the daily upkeep", () => {
        const a = newSim(farmContent(), "farm");
        const b = newSim(farmContent(), "farm");
        grant(b, "p_upkeep");
        run(a, 100);
        run(b, 100);
        expect(a.state.today.upkeep).toBeGreaterThan(0);
        expect(b.state.today.upkeep).toBeCloseTo(a.state.today.upkeep * 0.5, 9);
    });
    it("botSpeed multiplies walk speed; repairSpeed divides repair ticks", () => {
        const trip = (...ids) => {
            const sim = newSim(chainContent({ lifts: [], racks: [[0, 14]] }), "chain", 3);
            grant(sim, ...ids);
            failRack(sim.state, sim.state.facilities.find((f) => f.defId === "rack_air_gpu") ?? sim.state.facilities[0], []);
            const bot = sim.state.bots[0];
            const x0 = bot.x;
            run(sim, 5);
            const moved = bot.x - x0;
            let repairTicks = 0;
            let guard = 0;
            while (sim.state.workOrders.length > 0 && guard++ < 3000) {
                sim.step();
                if (bot.task === "repair")
                    repairTicks++;
            }
            return { moved, repairTicks, done: sim.state.workOrders.length === 0 };
        };
        const plain = trip();
        const quick = trip("p_speed", "p_repair");
        expect(plain.done && quick.done).toBe(true);
        expect(plain.moved).toBeCloseTo(1.0, 9); // 4 moving ticks × 0.25 (the first tick only claims the order)
        expect(quick.moved).toBeCloseTo(2.0, 9);
        expect(plain.repairTicks).toBe(30);
        expect(quick.repairTicks).toBe(15);
    });
});
