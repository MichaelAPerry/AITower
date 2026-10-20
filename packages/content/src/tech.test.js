import { describe, expect, it } from "vitest";
import { loadContent, validateContent } from "./load";
import { M4_FACILITIES, M4_TECH } from "./m4ids";
const PERKS = ["failureRate", "energyPrice", "payout", "coolingCapacity", "repairSpeed", "upkeep", "researchRate", "botSpeed"];
const BRANCHES = ["compute", "cooling", "power", "logistics", "administration", "wetware"];
const broken = (mutate) => {
    const db = loadContent();
    mutate(db);
    return validateContent(db).join("\n");
};
describe("tech tree (bundled)", () => {
    const db = loadContent();
    const byId = new Map(db.tech.map((n) => [n.id, n]));
    it("loads and validates with about 45 nodes across all six branches and five tiers", () => {
        expect(validateContent(db)).toEqual([]);
        const older = db.tech.filter((n) => !M4_TECH.includes(n.id));
        expect(older.length).toBeGreaterThanOrEqual(43);
        expect(older.length).toBeLessThanOrEqual(47);
        for (const b of BRANCHES)
            expect(db.tech.some((n) => n.branch === b), b).toBe(true);
        for (let t = 1; t <= db.balance.tiers.pflops.length; t++)
            expect(db.tech.some((n) => n.minTier === t), `tier ${t}`).toBe(true);
    });
    it("starts with the cheap tier-1 administration node 'Contract Automation' that switches on the clerk", () => {
        const n = byId.get("contracts_clerk");
        expect(n.name).toBe("Contract Automation");
        expect(n.branch).toBe("administration");
        expect(n.minTier).toBe(1);
        expect(n.requires).toEqual([]);
        expect(n.effects).toEqual([{ type: "feature", feature: "contractsClerk" }]);
        // The Works Foreman (M4) is the only other feature node.
        expect(db.tech.filter((x) => x.effects.some((e) => e.type === "feature")).map((x) => x.id)).toEqual(["contracts_clerk", "works_foreman"]);
        // Affordable after about one game day of full starter utilisation (4 racks x 20 PF x 24 h).
        const fullDay = 4 * 20 * 24 * db.balance.research.pointsPerPflopHour;
        expect(n.cost).toBeLessThanOrEqual(fullDay);
        expect(n.cost).toBeGreaterThan(fullDay / 4);
        expect(db.tech.every((x) => x.id === n.id || x.cost >= n.cost)).toBe(true);
    });
    it("uses every perk kind with modest factors, and no tech node has a free lunch", () => {
        const kinds = new Set();
        for (const n of db.tech) {
            for (const e of n.effects) {
                if (e.type !== "perk")
                    continue;
                kinds.add(e.kind);
                expect(e.factor, n.id).toBeGreaterThanOrEqual(0.8);
                expect(e.factor, n.id).toBeLessThanOrEqual(1.15);
                expect(e.factor, n.id).not.toBe(1);
            }
        }
        expect([...kinds].sort()).toEqual([...PERKS].sort());
        // Improving perks point the right way: reductions < 1, boosts > 1.
        const lower = new Set(["failureRate", "energyPrice", "upkeep"]);
        for (const n of db.tech)
            for (const e of n.effects)
                if (e.type === "perk")
                    expect(e.factor < 1, `${n.id}/${e.kind}`).toBe(lower.has(e.kind));
    });
    it("every node states its real numbers and is in the Ministry voice (no real companies)", () => {
        for (const n of db.tech) {
            expect(n.description.length, n.id).toBeGreaterThan(40);
            for (const e of n.effects) {
                if (e.type === "perk")
                    expect(n.description, n.id).toContain(`${Math.round(Math.abs(e.factor - 1) * 100)}%`);
            }
            expect(n.description, n.id).not.toMatch(/nvidia|google|amazon web|microsoft|openai/i);
        }
        const clerk = byId.get("contracts_clerk");
        expect(clerk.description).toContain(`${Math.round(db.balance.clerk.feeShare * 100)}%`);
    });
    it("requires only earlier-or-equal tiers (no cycles are possible through a tier-ordered DAG)", () => {
        for (const n of db.tech)
            for (const r of n.requires)
                expect(byId.get(r).minTier, `${n.id} <- ${r}`).toBeLessThanOrEqual(n.minTier);
    });
    it("gates every new facility and bot behind a node of the same or a lower tier", () => {
        const ungated = ["rack_air_gpu", "rack_dlc_gpu", "rack_storage", "crah_unit", "chiller", "cdu", "grid_tie", "genset", "ups_battery", "parts_depot", "bot_charger"];
        for (const id of ungated)
            expect(db.facilities[id].tech, id).toBeUndefined();
        const nodeUses = new Map();
        for (const d of Object.values(db.facilities)) {
            if (ungated.includes(d.id))
                continue;
            if (d.growth) {
                expect(d.tech, d.id).toBeUndefined();
                continue;
            }
            expect(d.tech, d.id).toBeDefined();
            const node = byId.get(d.tech);
            expect(node, d.id).toBeDefined();
            expect(node.minTier, d.id).toBeLessThanOrEqual(d.unlockTier);
            nodeUses.set(node.id, (nodeUses.get(node.id) ?? 0) + 1);
            expect(node.description, d.id).toContain(d.name);
        }
        for (const b of Object.values(db.bots)) {
            if (b.id === "rover")
                expect(b.tech).toBeUndefined();
            else
                expect(byId.get(b.tech), b.id).toBeDefined();
        }
    });
    it("each node unlocks something or grants a perk/feature (no dead nodes)", () => {
        const unlockers = new Set();
        for (const d of Object.values(db.facilities))
            if (d.tech)
                unlockers.add(d.tech);
        for (const b of Object.values(db.bots))
            if (b.tech)
                unlockers.add(b.tech);
        for (const n of db.tech)
            expect(n.effects.length > 0 || unlockers.has(n.id), n.id).toBe(true);
    });
    it("research economy: tier-1 nodes take 1-3 days of starter output, the full tree roughly 60-90 days", () => {
        const r = db.balance.research;
        const perDay = (pf, jobs) => pf * 24 * r.pointsPerPflopHour + jobs * r.pointsPerJob;
        const typical = { 1: perDay(80, 6), 2: perDay(240, 6), 3: perDay(800, 6), 4: perDay(1500, 6), 5: perDay(3000, 6) };
        let total = 0;
        let wetware = 0;
        for (const n of db.tech) {
            if (M4_TECH.includes(n.id))
                continue; // M4 content has its own economy test in m4.test.ts
            const days = n.cost / typical[n.minTier];
            if (n.branch === "wetware")
                wetware += days;
            else
                total += days;
            if (n.minTier === 1 && n.id !== "contracts_clerk") {
                expect(days, n.id).toBeGreaterThanOrEqual(1);
                expect(days, n.id).toBeLessThanOrEqual(3);
            }
            if (n.minTier === 4) {
                expect(days, n.id).toBeGreaterThanOrEqual(4.5);
                expect(days, n.id).toBeLessThanOrEqual(10);
            }
        }
        // The trunk keeps its 60-90 days; the optional wetware branch adds 30-50 more.
        expect(total).toBeGreaterThanOrEqual(60);
        expect(total).toBeLessThanOrEqual(90);
        expect(wetware).toBeGreaterThanOrEqual(30);
        expect(wetware).toBeLessThanOrEqual(50);
    });
});
describe("new trunk content", () => {
    const db = loadContent();
    // The trunk (pre-M3) content; the biotech additions have their own tests in biotech.test.ts.
    const trunk = Object.values(db.facilities).filter((d) => d.category !== "bio" && !M4_FACILITIES.includes(d.id));
    const racks = trunk.filter((d) => d.rack);
    const f = db.facilities;
    // Same value measure as events.test.ts: PFLOPS per $ with a share of the baseline cooling plant included.
    const plantValue = (id) => {
        const d = f[id];
        const r = d.rack;
        const crah = f.crah_unit.cost / f.crah_unit.cooling.capacityKw;
        const cdu = f.cdu.cost / f.cdu.cooling.capacityKw;
        const chiller = f.chiller.cost / f.chiller.cooling.capacityKw;
        const liquidKw = r.powerKw * r.liquidFraction;
        return r.pflops / (d.cost + (cdu + chiller) * liquidKw + crah * (r.powerKw - liquidKw));
    };
    it("adds about 20 facilities and 2 bots", () => {
        expect(trunk.length).toBe(31);
        expect(racks.length).toBe(11);
        const kinds = (k) => Object.values(f).filter((d) => d.kind === k).length;
        expect(kinds("grid_tie")).toBeGreaterThanOrEqual(3);
        expect(kinds("ups")).toBeGreaterThanOrEqual(3);
        expect(kinds("crah")).toBeGreaterThanOrEqual(3);
        expect(Object.keys(db.bots).sort()).toEqual(["drone", "lifter", "rover"]);
    });
    it("has at least two air, two DLC and two immersion racks, one inference rack and one bigger storage array", () => {
        const by = (m) => racks.filter((d) => d.rack.cooling === m && d.rack.pflops > 0).length;
        expect(by("air")).toBeGreaterThanOrEqual(3);
        expect(by("dlc")).toBeGreaterThanOrEqual(3);
        expect(by("immersion")).toBeGreaterThanOrEqual(2);
        for (const d of racks.filter((x) => x.rack.cooling === "immersion")) {
            expect(d.rack.liquidFraction).toBeCloseTo(0.95, 5);
            expect(d.placement?.needsCoolant).toBe(true);
        }
        const perKw = (id) => f[id].rack.pflops / f[id].rack.powerKw;
        const best = Math.max(...racks.filter((d) => d.rack.cooling === "air").map((d) => d.id).filter((id) => id !== "rack_infer").map(perKw));
        expect(perKw("rack_infer")).toBeGreaterThan(best * 1.5);
        expect(f.rack_infer.rack.cooling).toBe("air");
        expect(f.rack_storage2.rack.storageTB).toBeGreaterThan(f.rack_storage.rack.storageTB);
    });
    it("keeps unlockTier within 2-4 for new facilities and rack PFLOPS per kW rising with tier", () => {
        for (const d of trunk) {
            if (!d.tech)
                continue;
            expect(d.unlockTier, d.id).toBeGreaterThanOrEqual(2);
            expect(d.unlockTier, d.id).toBeLessThanOrEqual(4);
        }
        expect(f.rack_dlc_gpu3.rack.pflops).toBeGreaterThan(f.rack_dlc_gpu2.rack.pflops);
        expect(f.rack_dlc_gpu2.rack.pflops).toBeGreaterThan(f.rack_dlc_gpu.rack.pflops);
        expect(f.rack_imm_gpu2.rack.pflops).toBeGreaterThan(f.rack_imm_gpu.rack.pflops);
    });
    it("keeps liquid racks about 1.4-1.9x the PFLOPS per $ of the best air rack available at their tier", () => {
        const air = racks.filter((d) => d.rack.cooling === "air" && d.rack.pflops > 0 && d.id !== "rack_infer");
        for (const d of racks.filter((x) => x.rack.cooling !== "air")) {
            const bestAir = Math.max(...air.filter((a) => a.unlockTier <= d.unlockTier).map((a) => plantValue(a.id)));
            const ratio = plantValue(d.id) / bestAir;
            expect(ratio, d.id).toBeGreaterThan(1.4);
            expect(ratio, d.id).toBeLessThan(1.9);
        }
    });
    it("every rack stays below the throttle point at full load with nominal cooling (inlet + rackDeltaC < okC)", () => {
        const t = db.balance.thermal;
        for (const d of racks) {
            const r = d.rack;
            const inlet = (1 - r.liquidFraction) * 20 + r.liquidFraction * t.coolantSupplyC;
            if (r.cooling !== "air")
                expect(inlet + t.rackDeltaC, d.id).toBeLessThan(t.okC);
        }
    });
    it("the drone flies fast on a small battery; the lifter carries 3, is slower and sturdier", () => {
        const { rover, drone, lifter } = db.bots;
        expect(drone.flying).toBe(true);
        expect(drone.speed).toBeGreaterThan(rover.speed);
        expect(drone.batteryTicks).toBeLessThan(rover.batteryTicks);
        expect(lifter.carry).toBe(3);
        expect(lifter.speed).toBeLessThan(rover.speed);
        expect(lifter.batteryTicks).toBeGreaterThan(rover.batteryTicks);
        expect(rover.carry).toBeUndefined();
    });
    it("adds about 10 clients for tiers 2-4, some needing liquid, across all sectors", () => {
        const fresh = db.clients.filter((c) => !c.needsBio && c.minTier >= 2).slice(-10);
        expect(db.clients.filter((c) => !c.needsBio)).toHaveLength(23 + 2); // + the two M4 climate clients
        expect(fresh.every((c) => c.minTier >= 2 && c.minTier <= 4)).toBe(true);
        expect(fresh.some((c) => c.needsLiquid)).toBe(true);
        expect(new Set(db.clients.map((c) => c.sector)).size).toBe(6);
        for (const t of [2, 3, 4])
            expect(db.clients.some((c) => c.minTier === t), `tier ${t}`).toBe(true);
    });
    it("balance sections are in their intended ranges", () => {
        const b = db.balance;
        expect(b.clerk.feeShare).toBeGreaterThanOrEqual(0.05);
        expect(b.clerk.feeShare).toBeLessThanOrEqual(0.08);
        expect(b.loans.maxByTier).toHaveLength(b.tiers.pflops.length);
        expect(b.loans.dailyRate).toBeGreaterThanOrEqual(0.003);
        expect(b.loans.dailyRate).toBeLessThanOrEqual(0.006);
        expect(b.tax.profitShare).toBeGreaterThanOrEqual(0.1);
        expect(b.tax.profitShare).toBeLessThanOrEqual(0.15);
        expect(b.audit.periodDays).toBe(7);
        expect(b.audit.standingByGrade).toHaveLength(5);
        expect(b.audit.cashShareByGrade).toHaveLength(5);
    });
});
describe("validateContent: tech", () => {
    const t0 = (db) => db.tech[0];
    it("flags duplicate ids, bad ids, empty names and unknown branches", () => {
        expect(broken((db) => db.tech.push({ ...t0(db) }))).toMatch(/duplicate id/);
        expect(broken((db) => (t0(db).id = "Bad Id"))).toMatch(/lowercase/);
        expect(broken((db) => (t0(db).name = ""))).toMatch(/name/);
        expect(broken((db) => (t0(db).description = " "))).toMatch(/description/);
        expect(broken((db) => (t0(db).branch = "magic"))).toMatch(/branch/);
    });
    it("flags bad cost and tier", () => {
        expect(broken((db) => (t0(db).cost = 0))).toMatch(/cost/);
        expect(broken((db) => (t0(db).cost = -5))).toMatch(/cost/);
        expect(broken((db) => (t0(db).cost = Number.NaN))).toMatch(/cost/);
        expect(broken((db) => (t0(db).minTier = 0))).toMatch(/minTier/);
        expect(broken((db) => (t0(db).minTier = db.balance.tiers.pflops.length + 1))).toMatch(/minTier/);
        expect(broken((db) => (t0(db).minTier = 1.5))).toMatch(/minTier/);
    });
    it("flags unknown, self and duplicate requires", () => {
        expect(broken((db) => t0(db).requires.push("ghost"))).toMatch(/unknown tech "ghost"/);
        expect(broken((db) => t0(db).requires.push(t0(db).id))).toMatch(/requires itself/);
        expect(broken((db) => db.tech[1].requires.push(...db.tech[1].requires))).toMatch(/listed twice/);
    });
    it("flags dependency cycles", () => {
        const out = broken((db) => {
            const a = db.tech.find((n) => n.id === "contracts_clerk");
            const b = db.tech.find((n) => n.id === "reading_room");
            a.requires.push(b.id); // reading_room already requires contracts_clerk
        });
        expect(out).toMatch(/dependency cycle/);
        expect(out).toMatch(/contracts_clerk/);
        // A three-node cycle is found too.
        expect(broken((db) => {
            const [a, b, c] = ["contracts_clerk", "reading_room", "vendor_stamp"].map((id) => db.tech.find((n) => n.id === id));
            a.requires = [c.id];
            expect(b.requires).toContain(a.id);
            expect(c.requires).toContain(b.id);
        })).toMatch(/dependency cycle/);
    });
    it("flags bad effects", () => {
        expect(broken((db) => t0(db).effects.push({ type: "perk", kind: "luck", factor: 1.1 }))).toMatch(/unknown perk/);
        expect(broken((db) => t0(db).effects.push({ type: "perk", kind: "payout", factor: 0 }))).toMatch(/factor/);
        expect(broken((db) => t0(db).effects.push({ type: "perk", kind: "payout", factor: 5 }))).toMatch(/factor/);
        expect(broken((db) => t0(db).effects.push({ type: "perk", kind: "payout", factor: Number.NaN }))).toMatch(/factor/);
        expect(broken((db) => t0(db).effects.push({ type: "feature", feature: "teleport" }))).toMatch(/unknown feature/);
        expect(broken((db) => t0(db).effects.push({ type: "magic" }))).toMatch(/unknown effect type/);
        expect(broken((db) => (t0(db).effects = null))).toMatch(/effects/);
    });
    it("flags facilities and bots whose tech does not exist", () => {
        expect(broken((db) => (db.facilities.rack_air_gpu2.tech = "ghost"))).toMatch(/facilities\.rack_air_gpu2\.tech: unknown tech "ghost"/);
        expect(broken((db) => (db.bots.drone.tech = "ghost"))).toMatch(/bots\.drone\.tech: unknown tech "ghost"/);
        expect(broken((db) => (db.facilities.crah_unit.tech = "contracts_clerk"))).toBe("");
    });
    it("flags a bad scriptedDay", () => {
        const ev = (db) => db.events[0];
        expect(broken((db) => (ev(db).scriptedDay = -1))).toMatch(/scriptedDay/);
        expect(broken((db) => (ev(db).scriptedDay = 1.5))).toMatch(/scriptedDay/);
        expect(broken((db) => (ev(db).scriptedDay = Number.NaN))).toMatch(/scriptedDay/);
        expect(broken((db) => (ev(db).scriptedDay = 0))).toBe("");
    });
    it("flags a bad bot carry or flying", () => {
        expect(broken((db) => (db.bots.lifter.carry = 0))).toMatch(/carry/);
        expect(broken((db) => (db.bots.lifter.carry = 2.5))).toMatch(/carry/);
        expect(broken((db) => (db.bots.lifter.flying = "yes"))).toMatch(/flying/);
        expect(broken((db) => (db.bots.lifter.carry = 1))).toBe("");
    });
});
describe("validateContent: research balance", () => {
    it("flags research, clerk, loans, tax and audit problems", () => {
        expect(broken((db) => (db.balance.research.pointsPerPflopHour = 0))).toMatch(/pointsPerPflopHour/);
        expect(broken((db) => (db.balance.research.pointsPerJob = -1))).toMatch(/pointsPerJob/);
        expect(broken((db) => (db.balance.clerk.feeShare = 1.5))).toMatch(/feeShare/);
        expect(broken((db) => (db.balance.clerk.feeShare = -0.1))).toMatch(/feeShare/);
        expect(broken((db) => (db.balance.loans.dailyRate = -1))).toMatch(/dailyRate/);
        expect(broken((db) => (db.balance.tax.profitShare = 2))).toMatch(/profitShare/);
        expect(broken((db) => (db.balance.audit.periodDays = 0))).toMatch(/periodDays/);
        expect(broken((db) => (db.balance.audit.periodDays = 3.5))).toMatch(/periodDays/);
    });
    it("requires maxByTier to have one entry per tier (and not shrink)", () => {
        expect(broken((db) => db.balance.loans.maxByTier.pop())).toMatch(/maxByTier: expected 5 entries/);
        expect(broken((db) => db.balance.loans.maxByTier.push(1))).toMatch(/maxByTier: expected 5 entries/);
        expect(broken((db) => (db.balance.loans.maxByTier[0] = -1))).toMatch(/maxByTier\[0\]/);
        expect(broken((db) => (db.balance.loans.maxByTier[4] = 1))).toMatch(/non-decreasing/);
        expect(broken((db) => db.balance.tiers.pflops.push(5000) && db.balance.tiers.uptime.push(0.999) && db.balance.tiers.reward.push(1))).toMatch(/maxByTier: expected 6 entries/);
    });
    it("requires both audit grade arrays to have 5 entries, best grade first", () => {
        expect(broken((db) => db.balance.audit.standingByGrade.pop())).toMatch(/standingByGrade: expected 5/);
        expect(broken((db) => db.balance.audit.cashShareByGrade.push(0))).toMatch(/cashShareByGrade: expected 5/);
        expect(broken((db) => (db.balance.audit.standingByGrade[2] = 99))).toMatch(/must not pay more/);
        expect(broken((db) => (db.balance.audit.cashShareByGrade[0] = 3))).toMatch(/cashShareByGrade\[0\]/);
        expect(broken((db) => (db.balance.audit.standingByGrade[4] = Number.NaN))).toMatch(/standingByGrade\[4\]/);
    });
    it("flags missing sections", () => {
        expect(broken((db) => delete db.balance.research)).toMatch(/balance\.research: missing/);
        expect(broken((db) => delete db.balance.clerk)).toMatch(/balance\.clerk: missing/);
        expect(broken((db) => delete db.balance.loans)).toMatch(/balance\.loans: missing/);
        expect(broken((db) => delete db.balance.tax)).toMatch(/balance\.tax: missing/);
        expect(broken((db) => delete db.balance.audit)).toMatch(/balance\.audit: missing/);
    });
});
