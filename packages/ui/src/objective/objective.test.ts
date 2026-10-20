import type { ContentDB } from "@aitower/content";
import type { CommandResult, SimView } from "@aitower/sim";
import { describe, expect, it } from "vitest";
import { currentObjective, installedPflops, moneyToday } from "./objective";

const content = {
	facilities: { rack_air_gpu: { id: "rack_air_gpu", name: "Mk.I Cabinet", cost: 400_000, rack: { pflops: 20 } }, crah_unit: { id: "crah_unit", name: "Air Handler" } },
	balance: { tiers: { pflops: [0, 120, 400], uptime: [0, 0.95, 0.97], reward: [0, 1, 2] } },
} as unknown as ContentDB;

const rack = (id: number, status = "ok", enabled = true) => ({ id, defId: "rack_air_gpu", status, enabled });
function view(p: Partial<Record<keyof SimView, unknown>> = {}): SimView {
	return {
		tick: 1000,
		cash: 1_000_000,
		tier: 1,
		memos: [],
		spareParts: 3,
		jobs: [],
		offers: [],
		facilities: [rack(1), rack(2), rack(3), rack(4), { id: 9, defId: "crah_unit", status: "ok", enabled: true }],
		ledger: [{ day: 0, revenue: 50_000, energy: 12_000, upkeep: 3_000, construction: 0, penalties: 0 }],
		...p,
	} as unknown as SimView;
}
const yes = (): CommandResult => ({ ok: true });
const no = (): CommandResult => ({ ok: false, reason: "x" });
const running = [{ id: 1, status: "running" }];

describe("current orders", () => {
	it("red treasury beats everything", () => {
		expect(currentObjective(view({ cash: -5 }), content, yes).tone).toBe("alert");
	});
	it("a memo within two hours of auto-filing is flagged", () => {
		const o = currentObjective(view({ memos: [{ id: 1, title: "Form 27B/6", expiresAt: 1100 }] }), content, yes);
		expect(o.title).toMatch(/memo/);
		expect(o.detail).toMatch(/Form 27B\/6/);
	});
	it("broken racks with no parts tell you to buy parts", () => {
		const o = currentObjective(view({ spareParts: 0, facilities: [rack(1, "failed")] }), content, yes);
		expect(o.detail).toMatch(/spare parts/);
	});
	it("idle racks: accept a fitting offer, by name", () => {
		const o = currentObjective(view({ offers: [{ id: 5, clientName: "Foldwise Bio" }] }), content, yes);
		expect(o.title).toBe("Accept a contract");
		expect(o.detail).toMatch(/Foldwise Bio/);
	});
	it("idle racks but nothing fits says so", () => {
		expect(currentObjective(view({ offers: [{ id: 5, clientName: "X" }] }), content, no).title).toBe("No offer fits your idle racks");
	});
	it("no offers: wait, with the speed hint", () => {
		expect(currentObjective(view(), content, yes).title).toBe("Waiting for contract offers");
	});
	it("a job is running but an offer still fits: take it (idle racks earn nothing)", () => {
		expect(currentObjective(view({ jobs: running, offers: [{ id: 5, clientName: "X" }] }), content, yes).title).toBe("Accept another contract");
	});
	it("working: shows the next clearance with how many cabinets to build", () => {
		const o = currentObjective(view({ jobs: running }), content, yes);
		expect(o.title).toBe("Next: Clearance 2");
		expect(o.detail).toMatch(/now 80/);
		expect(o.detail).toMatch(/build 2 more Mk\.I Cabinets/);
	});
	it("cabinets that can't run (no coolant loop) are flagged with the reason, before offers", () => {
		const c = { ...content, facilities: { ...content.facilities, rack_dlc_gpu: { id: "rack_dlc_gpu", name: "Mk.II Liquid", kind: "rack", rack: { pflops: 130, liquidFraction: 0.8 } } } } as unknown as ContentDB;
		const dlc = { id: 7, defId: "rack_dlc_gpu", status: "noCoolant", enabled: true, floor: 1, x: 30, coolantNet: 0, powerNet: 0 };
		const o = currentObjective(view({ facilities: [rack(1), dlc], offers: [{ id: 5, clientName: "X" }], coolantNets: [] }), c, yes);
		expect(o.tone).toBe("alert");
		expect(o.title).toBe("1 compute cabinet can't run");
		expect(o.detail).toMatch(/Mk\.II Liquid on F1 \(x30\): Its coolant pipe reaches no chiller or CDU/);
	});
	it("once liquid cabinets are unlocked the clearance hint offers them, and idle cabinets are counted", () => {
		const c = { ...content, facilities: { ...content.facilities, rack_dlc_gpu: { id: "rack_dlc_gpu", name: "Mk.II Liquid", cost: 1_400_000, unlockTier: 1, rack: { pflops: 130, liquidFraction: 0.8 } } } } as unknown as ContentDB;
		const o = currentObjective(view({ jobs: running, facilities: [rack(1), rack(2, "idle")] }), c, yes);
		expect(o.detail).toMatch(/or 1 Mk\.II Liquid \(\$1\.40M each\) on a coolant loop with a chiller and a CDU/);
		expect(o.detail).toMatch(/1 cabinet is idle/);
	});
	it("red treasury with loan headroom mentions the Credit Office and the amount", () => {
		const o = currentObjective(view({ cash: -5, loan: { principal: 500_000, max: 2_000_000, dailyRate: 0.004 } }), content, yes);
		expect(o.tone).toBe("alert");
		expect(o.detail).toMatch(/Credit Office/);
		expect(o.detail).toMatch(/\$1\.50M/);
	});
	it("red treasury with the credit line used up (or no loan data) does not mention it", () => {
		expect(currentObjective(view({ cash: -5, loan: { principal: 2_000_000, max: 2_000_000, dailyRate: 0.004 } }), content, yes).detail).not.toMatch(/Credit Office/);
		expect(currentObjective(view({ cash: -5 }), content, yes).detail).not.toMatch(/Credit Office/);
	});
	it("an affordable research node names itself and the R key, once racks are busy", () => {
		const c = { ...content, tech: [{ id: "x", name: "Form 9", cost: 20, branch: "compute", minTier: 1, requires: [], effects: [{ type: "perk", kind: "failureRate", factor: 0.9 }] }, { id: "y", name: "Costly", cost: 90, branch: "power", minTier: 1, requires: [], effects: [] }] } as unknown as ContentDB;
		const o = currentObjective(view({ jobs: running, researchPoints: 25, techResearched: [] }), c, yes);
		expect(o.title).toBe("File a research request");
		expect(o.key).toBe("R");
		expect(o.detail).toMatch(/Form 9/);
		expect(o.detail).toMatch(/−10 % failure rate/);
		expect(o.detail).not.toMatch(/Costly/);
	});
	it("research is not suggested when nothing is affordable, and a fitting offer still comes first", () => {
		const c = { ...content, tech: [{ id: "x", name: "Form 9", cost: 20, branch: "compute", minTier: 1, requires: [], effects: [] }] } as unknown as ContentDB;
		expect(currentObjective(view({ jobs: running, researchPoints: 5 }), c, yes).title).toBe("Next: Clearance 2");
		expect(currentObjective(view({ jobs: running, researchPoints: 50, offers: [{ id: 5, clientName: "X" }] }), c, yes).title).toBe("Accept another contract");
	});
	it("a clerk that is unlocked but off is flagged; on, or locked, it is not", () => {
		const clerk = (unlocked: boolean, enabled: boolean) => ({ unlocked, policy: { enabled }, acceptedTotal: 0 });
		expect(currentObjective(view({ jobs: running, clerk: clerk(true, false) }), content, yes).title).toBe("Switch on your Contracts Clerk");
		expect(currentObjective(view({ jobs: running, clerk: clerk(true, true) }), content, yes).title).toBe("Next: Clearance 2");
		expect(currentObjective(view({ jobs: running, clerk: clerk(false, false) }), content, yes).title).toBe("Next: Clearance 2");
	});
	it("installed PFLOPS ignores failed and disabled racks", () => {
		expect(installedPflops(view({ facilities: [rack(1), rack(2, "failed"), rack(3, "ok", false)] }), content)).toBe(20);
	});
	it("money line includes taxes, interest and fees", () => {
		const m = moneyToday(view({ ledger: [{ day: 0, revenue: 80_000, energy: 10_000, upkeep: 2_000, construction: 0, penalties: 0, taxes: 6_000, interest: 1_500, fees: 800 }] }));
		expect(m.costs).toBe(20_300);
		expect(m.breakdown).toBe("energy $10k · upkeep $2k · taxes $6k · interest $1.5k · fees $800");
	});
	it("money line sums costs and lists only non-zero parts", () => {
		const m = moneyToday(view());
		expect(m).toMatchObject({ income: 50_000, costs: 15_000 });
		expect(m.breakdown).toMatch(/energy/);
		expect(m.breakdown).not.toMatch(/penalties/);
	});
});

describe("lift access hint", () => {
	const c = { ...content, bots: { maint: { id: "maint" } }, facilities: { ...content.facilities } } as unknown as ContentDB;
	const base = { bots: [{ defId: "maint", floor: 1 }], lifts: [{ x: 3, floorMin: 1, floorMax: 2 }], facilities: [{ ...rack(1), floor: 1 }, { ...rack(2), floor: 7 }] };
	it("names a floor with facilities but no lift reach", () => {
		const o = currentObjective(view(base), c, yes);
		expect(o.title).toBe("F7 has no lift access: extend a lift");
	});
	it("is quiet once a lift reaches it", () => {
		const o = currentObjective(view({ ...base, lifts: [{ x: 3, floorMin: 1, floorMax: 7 }] }), c, yes);
		expect(o.title).not.toContain("lift access");
	});
});
