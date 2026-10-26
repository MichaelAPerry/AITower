import type { EventEffect } from "@aitower/content";
import type { LedgerDay, SimEvent, SimView } from "@aitower/sim";
import { describe, expect, it } from "vitest";
import { createFakeContent, createFakeStore } from "../dev/fakeStore";
import { choiceChips, clearanceProgress, dockPicks, drawerForKey, effectChip, fmtRateHour, isRoutine, maintenanceReadout, nextDrawer, operatingNet, perHour } from "./calm";

const day = (d: number, p: Partial<LedgerDay> = {}): LedgerDay => ({ day: d, revenue: 0, energy: 0, upkeep: 0, construction: 0, penalties: 0, taxes: 0, interest: 0, fees: 0, ...p });
const rate = (tick: number, ledger: LedgerDay[]) => perHour({ tick, day: Math.floor(tick / 1440), ledger });

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
	it("also asks for researched nodes, from the view's tierNeed", () => {
		const content = createFakeContent();
		const { view } = createFakeStore(content).get();
		const c = clearanceProgress({ ...view, tier: 1, tierNeed: { tier: 2, pflops: 20, uptime: 0.99, techs: 2, techsDone: 1 } }, content);
		expect(c).toMatchObject({ techs: 2, techsDone: 1, techsOk: false });
		expect(clearanceProgress({ ...view, tier: 1, tierNeed: { tier: 2, pflops: 20, uptime: 0.99, techs: 2, techsDone: 2 } }, content).techsOk).toBe(true);
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
		// F (was Finance) and I (was Gauges) both open Insights.
		expect(["c", "R", "f", "I", "x"].map(drawerForKey)).toEqual(["contracts", "research", "insights", "insights", null]);
		expect(nextDrawer(null, "insights")).toBe("insights");
		expect(nextDrawer("insights", "insights")).toBeNull();
		expect(nextDrawer("insights", "contracts")).toBe("contracts");
	});
});

describe("build dock", () => {
	const setup = () => {
		const content = createFakeContent();
		const store = createFakeStore(content);
		return { content, view: store.get().view };
	};
	const ids = (picks: ReturnType<typeof dockPicks>) => picks.map((p) => (p.kind === "place" ? p.defId : "parts"));
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
		const hot = { ...view, facilities: view.facilities.map((f) => (content.facilities[f.defId].rack ? { ...f, status: "throttled" as const } : f)) };
		expect(ids(dockPicks(hot, content))[0]).toBe("crah");
	});
	it("puts parts first when the cage is empty and a rack is broken", () => {
		const { content, view } = setup();
		const broken = { ...view, spareParts: 0, facilities: view.facilities.map((f, i) => (i === 3 ? { ...f, status: "failed" as const } : { ...f, tempC: 24, status: f.status === "throttled" ? ("ok" as const) : f.status })) };
		expect(ids(dockPicks(broken, content))[0]).toBe("parts");
	});
	it("wants a rack when no compute is idle, and a nutrient plant when organoids starve", () => {
		const { content, view } = setup();
		const calm = (fs: typeof view.facilities) => ({ ...view, spareParts: 9, facilities: fs.map((f) => ({ ...f, tempC: 24, status: f.status === "idle" || f.status === "throttled" ? ("ok" as const) : f.status })) });
		expect(ids(dockPicks(calm(view.facilities), content))[0]).toBe("rack_air_gpu");
		const starving = calm(view.facilities.map((f) => (f.defId === "rack_air_gpu" ? { ...f, status: "noNutrient" as const } : f)));
		expect(ids(dockPicks({ ...starving, tier: 3 }, content))[0]).toBe("nutrient_plant");
	});
});

describe("memo chips and urgency", () => {
	it("words each effect as numbers and icons", () => {
		const e = (x: EventEffect) => effectChip(x);
		expect(e({ type: "cash", amount: -160_000 })).toBe("−$160k");
		expect(e({ type: "cash", amount: 5000 })).toBe("+$5k");
		expect(e({ type: "bond", advisor: "mel", amount: -4 })).toBe("");
		expect(e({ type: "failRacks", count: 2 })).toBe("2 racks fail");
		expect(e({ type: "failRacks", count: 1 })).toBe("1 rack fail");
		expect(e({ type: "ambient", deltaC: 8, durationTicks: 1 })).toBe("+8°C");
		expect(e({ type: "payout", factor: 1.25, durationTicks: 1 })).toBe("pay ×1.25");
		expect(e({ type: "spareParts", count: 5 })).toBe("+5 parts");
		expect(choiceChips([{ type: "cash", amount: -160_000 }, { type: "seal", path: "greentech", amount: 4 }])).toBe("−$160k");
		expect(choiceChips([])).toBe("no effect");
	});
});

describe("ticker filtering", () => {
	const v = { spareParts: 4 };
	const ev = (e: SimEvent) => e;
	it("hides what the game handles itself", () => {
		for (const e of [ev({ type: "repaired", facilityId: 1, botId: 1 }), ev({ type: "jobStarted", jobId: 1 }), ev({ type: "rackRecovered", facilityId: 1 }), ev({ type: "contractOffered", contractId: 1 })]) expect(isRoutine(e, v)).toBe(true);
	});
	it("a failed component is routine only while parts are in stock", () => {
		expect(isRoutine({ type: "componentFailed", facilityId: 1 }, { spareParts: 2 })).toBe(true);
		expect(isRoutine({ type: "componentFailed", facilityId: 1 }, { spareParts: 0 })).toBe(false);
	});
	it("keeps the real problems", () => {
		for (const e of [ev({ type: "jobFailed", jobId: 1, penalty: 1 }), ev({ type: "powerShortfall", netId: 1, satisfaction: 0.5 }), ev({ type: "bankrupt" }), ev({ type: "rackTripped", facilityId: 1 })]) expect(isRoutine(e, v)).toBe(false);
		expect(isRoutine({ type: "decisionIssued", decisionId: 1, eventId: "x" }, v)).toBe(true); // the decision card announces itself
	});
});

describe("maintenance readout", () => {
	const v = (m: Partial<SimView["maintenance"]>, workOrders: unknown[] = []): SimView =>
		({ maintenance: { parts: 4, partsCapacity: 20, botsTotal: 3, botsBusy: 1, botsIdle: 2, waiting: 0, noRoute: 0, ...m }, workOrders }) as unknown as SimView;
	it("is calm when stocked with nothing broken, amber when parts are out or repairs wait, red when a rack is out of reach", () => {
		expect(maintenanceReadout(v({}))).toMatchObject({ tone: "ok", parts: "4", bots: "1/3", repairs: "0" });
		expect(maintenanceReadout(v({ parts: 0 }))?.tone).toBe("amber");
		expect(maintenanceReadout(v({ waiting: 2 }, [{}, {}]))?.tone).toBe("amber");
		expect(maintenanceReadout(v({ parts: 0 }, [{}]))?.tone).toBe("red");
		const nr = maintenanceReadout(v({ noRoute: 2, waiting: 2 }, [{}, {}]));
		expect(nr?.tone).toBe("red");
		expect(nr?.title).toMatch(/out of reach of every bot/);
	});
	it("shows nothing before maintenance is part of the game", () => {
		expect(maintenanceReadout(v({ parts: 0, partsCapacity: 0, botsTotal: 0, botsBusy: 0, botsIdle: 0 }))).toBeNull();
	});
});
