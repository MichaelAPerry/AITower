import { describe, expect, it } from "vitest";
import { createFakeContent, createFakeStore } from "../dev/fakeStore";
import { choiceChips, clearanceProgress, dockPicks, drawerForKey, effectChip, fmtRateHour, isRoutine, isUrgentMemo, nextDrawer, operatingNet, perHour } from "./calm";
const day = (d, p = {}) => ({ day: d, revenue: 0, energy: 0, upkeep: 0, construction: 0, penalties: 0, taxes: 0, interest: 0, fees: 0, ...p });
const rate = (tick, ledger) => perHour({ tick, day: Math.floor(tick / 1440), ledger });
describe("PER HOUR", () => {
    it("leaves construction out of the operating result", () => {
        expect(operatingNet(day(1, { revenue: 1000, energy: 100, upkeep: 50, penalties: 10, taxes: 5, interest: 5, fees: 30, construction: 99_999 }))).toBe(800);
    });
    it("late in the day it is today's average rate", () => {
        // 10 h into day 2 with 5000 net so far: 500 per hour.
        expect(rate(2 * 1440 + 600, [day(1, { revenue: 1 }), day(2, { revenue: 5000 })])).toBeCloseTo(500);
    });
    it("early in the day it blends in yesterday's rate for the rest of the 6 h window", () => {
        // 2 h into day 2 (net 200 -> 100/h); yesterday 2400 net -> 100/h too; make yesterday different: 4800 -> 200/h.
        const v = rate(2 * 1440 + 120, [day(1, { revenue: 4800 }), day(2, { revenue: 200 })]);
        expect(v).toBeCloseTo((100 * 120 + 200 * 240) / 360);
    });
    it("uses what exists: no yesterday, or no ledger at all", () => {
        expect(rate(120, [day(0, { revenue: 240 })])).toBeCloseTo(120);
        expect(rate(100, [])).toBeNull();
    });
    it("goes negative when costs exceed revenue, and formats with a sign", () => {
        expect(rate(1440 + 720, [day(0), day(1, { energy: 1200 })])).toBeCloseTo(-100);
        expect(fmtRateHour(21_400)).toBe("+$21.4k");
        expect(fmtRateHour(-3000)).toMatch(/^−\$3/);
        expect(fmtRateHour(null)).toBe("—");
    });
});
describe("Clearance bar", () => {
    it("is installed over needed PFLOPS, with the uptime state", () => {
        const content = createFakeContent();
        const { view } = createFakeStore(content).get();
        const c = clearanceProgress({ ...view, tier: 1 }, content);
        expect(c.next).toBe(2);
        expect(c.need).toBe(content.balance.tiers.pflops[1]);
        expect(c.frac).toBeGreaterThan(0);
        expect(c.frac).toBeLessThanOrEqual(1);
        expect(clearanceProgress({ ...view, tier: 1, uptime: 0.5 }, content).uptimeOk).toBe(false);
    });
    it("is full at the top Clearance", () => {
        const content = createFakeContent();
        const { view } = createFakeStore(content).get();
        const c = clearanceProgress({ ...view, tier: content.balance.tiers.pflops.length }, content);
        expect(c).toMatchObject({ next: null, frac: 1, uptimeOk: true });
    });
});
describe("drawers", () => {
    it("keys C R F I open their drawers; the same key closes it", () => {
        expect(["c", "R", "f", "I", "x"].map(drawerForKey)).toEqual(["contracts", "research", "finance", "gauges", null]);
        expect(nextDrawer(null, "finance")).toBe("finance");
        expect(nextDrawer("finance", "finance")).toBeNull();
        expect(nextDrawer("finance", "gauges")).toBe("gauges");
    });
});
describe("build dock", () => {
    const setup = () => {
        const content = createFakeContent();
        const store = createFakeStore(content);
        return { content, view: store.get().view };
    };
    const ids = (picks) => picks.map((p) => (p.kind === "place" ? p.defId : "parts"));
    it("offers at most 3 distinct picks and never a growth or something still locked", () => {
        const { content, view } = setup();
        const picks = ids(dockPicks({ ...view, tier: 1 }, content));
        expect(picks.length).toBeLessThanOrEqual(3);
        expect(new Set(picks).size).toBe(picks.length);
        expect(picks).not.toContain("growth_mass");
        expect(picks).not.toContain("organoid_incubator"); // tier 3
        expect(picks).not.toContain("chiller"); // tier 2 and gated by research
    });
    it("puts a CRAH first when racks run hot", () => {
        const { content, view } = setup();
        const hot = { ...view, facilities: view.facilities.map((f) => (content.facilities[f.defId].rack ? { ...f, status: "throttled" } : f)) };
        expect(ids(dockPicks(hot, content))[0]).toBe("crah");
    });
    it("puts parts first when the cage is empty and a rack is broken", () => {
        const { content, view } = setup();
        const broken = { ...view, spareParts: 0, facilities: view.facilities.map((f, i) => (i === 3 ? { ...f, status: "failed" } : { ...f, tempC: 24, status: f.status === "throttled" ? "ok" : f.status })) };
        expect(ids(dockPicks(broken, content))[0]).toBe("parts");
    });
    it("wants a rack when no compute is idle, and a nutrient plant when organoids starve", () => {
        const { content, view } = setup();
        const calm = (fs) => ({ ...view, spareParts: 9, facilities: fs.map((f) => ({ ...f, tempC: 24, status: f.status === "idle" || f.status === "throttled" ? "ok" : f.status })) });
        expect(ids(dockPicks(calm(view.facilities), content))[0]).toBe("rack_air_gpu");
        const starving = calm(view.facilities.map((f) => (f.defId === "rack_air_gpu" ? { ...f, status: "noNutrient" } : f)));
        expect(ids(dockPicks({ ...starving, tier: 3 }, content))[0]).toBe("nutrient_plant");
    });
});
describe("memo chips and urgency", () => {
    it("words each effect as numbers and icons", () => {
        const e = (x) => effectChip(x);
        expect(e({ type: "cash", amount: -160_000 })).toBe("−$160k");
        expect(e({ type: "cash", amount: 5000 })).toBe("+$5k");
        expect(e({ type: "standing", amount: -4 })).toBe("★−4");
        expect(e({ type: "failRacks", count: 2 })).toBe("2 racks fail");
        expect(e({ type: "failRacks", count: 1 })).toBe("1 rack fail");
        expect(e({ type: "ambient", deltaC: 8, durationTicks: 1 })).toBe("+8°C");
        expect(e({ type: "payout", factor: 1.25, durationTicks: 1 })).toBe("pay ×1.25");
        expect(e({ type: "spareParts", count: 5 })).toBe("+5 parts");
        expect(choiceChips([{ type: "cash", amount: -160_000 }, { type: "standing", amount: -4 }])).toBe("−$160k · ★−4");
        expect(choiceChips([])).toBe("no effect");
    });
    const content = createFakeContent();
    const ev = content.events[0];
    const memo = (p = {}) => ({ id: 1, eventId: ev.id, category: ev.category, title: ev.title, body: ev.body, choices: ev.choices.map((c) => ({ id: c.id, label: c.label, hint: c.hint })), defaultChoice: ev.defaultChoice, issuedAt: 0, expiresAt: 5000, ...p });
    it("pops up only memos that expire within 12 h", () => {
        expect(isUrgentMemo(memo({ expiresAt: 600 }), { tick: 0, cash: 1e6 }, content)).toBe(true);
        expect(isUrgentMemo(memo({ expiresAt: 721 }), { tick: 0, cash: 1e6 }, content)).toBe(false);
    });
    it("pops up memos whose default choice fails racks or costs over 10 % of cash", () => {
        const mk = (effects) => ({ ...content, events: [{ ...ev, choices: ev.choices.map((c) => ({ ...c, effects: c.id === ev.defaultChoice ? effects : [] })) }] });
        const view = { tick: 0, cash: 1_000_000 };
        expect(isUrgentMemo(memo(), view, mk([{ type: "failRacks", count: 2 }]))).toBe(true);
        expect(isUrgentMemo(memo(), view, mk([{ type: "cash", amount: -150_000 }]))).toBe(true);
        expect(isUrgentMemo(memo(), view, mk([{ type: "cash", amount: -50_000 }]))).toBe(false);
        expect(isUrgentMemo(memo(), view, mk([{ type: "standing", amount: -9 }]))).toBe(false);
    });
});
describe("ticker filtering", () => {
    const v = { spareParts: 4 };
    const ev = (e) => e;
    it("hides what the game handles itself", () => {
        for (const e of [ev({ type: "repaired", facilityId: 1, botId: 1 }), ev({ type: "jobStarted", jobId: 1 }), ev({ type: "rackRecovered", facilityId: 1 }), ev({ type: "contractOffered", contractId: 1 })])
            expect(isRoutine(e, v)).toBe(true);
    });
    it("a failed component is routine only while parts are in stock", () => {
        expect(isRoutine({ type: "componentFailed", facilityId: 1 }, { spareParts: 2 })).toBe(true);
        expect(isRoutine({ type: "componentFailed", facilityId: 1 }, { spareParts: 0 })).toBe(false);
    });
    it("keeps the real problems", () => {
        for (const e of [ev({ type: "jobFailed", jobId: 1, penalty: 1 }), ev({ type: "powerShortfall", netId: 1, satisfaction: 0.5 }), ev({ type: "bankrupt" }), ev({ type: "rackTripped", facilityId: 1 })])
            expect(isRoutine(e, v)).toBe(false);
        expect(isRoutine({ type: "memoIssued", memoId: 1, eventId: "x" }, v)).toBe(true); // the inbox count and the slip announce memos
    });
});
