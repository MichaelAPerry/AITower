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
	it("installed PFLOPS ignores failed and disabled racks", () => {
		expect(installedPflops(view({ facilities: [rack(1), rack(2, "failed"), rack(3, "ok", false)] }), content)).toBe(20);
	});
	it("money line sums costs and lists only non-zero parts", () => {
		const m = moneyToday(view());
		expect(m).toMatchObject({ income: 50_000, costs: 15_000 });
		expect(m.breakdown).toMatch(/energy/);
		expect(m.breakdown).not.toMatch(/penalties/);
	});
});
