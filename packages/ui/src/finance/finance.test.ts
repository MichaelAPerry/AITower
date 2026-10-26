import type { LedgerDay, QuarterReport } from "@aitower/sim";
import { describe, expect, it } from "vitest";
import { auditOutcome, cashDeltaText, gradeTone, ledgerCosts, ledgerNet, lifetimeRows, loanInfo, repayPresets, reportRows, signed, takePresets } from "./finance";

const day = (d: Partial<LedgerDay> = {}): LedgerDay => ({ day: 3, revenue: 100_000, energy: 10_000, upkeep: 5_000, construction: 20_000, penalties: 1_000, taxes: 2_000, interest: 500, fees: 250, ...d });

describe("ledger", () => {
	it("costs and net include taxes, interest and fees", () => {
		expect(ledgerCosts(day())).toBe(38_750);
		expect(ledgerNet(day())).toBe(61_250);
	});
	it("tolerates a ledger day from before M2b (no taxes/interest/fees)", () => {
		const old = { day: 1, revenue: 10, energy: 1, upkeep: 1, construction: 0, penalties: 0 } as unknown as LedgerDay;
		expect(ledgerNet(old)).toBe(8);
	});
});

describe("loans", () => {
	const info = loanInfo({ principal: 400_000, max: 2_000_000, dailyRate: 0.004 });
	it("derives headroom and interest per day", () => {
		expect(info).toMatchObject({ principal: 400_000, max: 2_000_000, headroom: 1_600_000 });
		expect(info.interestPerDay).toBeCloseTo(1_600, 6);
	});
	it("take presets are 25 %, 50 % and all of the remaining limit", () => {
		expect(takePresets(info).map((p) => [p.label, p.amount, p.disabled])).toEqual([
			["25 %", 400_000, null],
			["50 %", 800_000, null],
			["ALL", 1_600_000, null],
		]);
	});
	it("take presets are disabled with a reason when there is no headroom", () => {
		const full = takePresets(loanInfo({ principal: 2_000_000, max: 2_000_000, dailyRate: 0.004 }));
		expect(full.every((p) => p.disabled === "Credit limit reached")).toBe(true);
		const none = takePresets(loanInfo({ principal: 0, max: 0, dailyRate: 0 }));
		expect(none[0].disabled).toBe("No credit at this level");
	});
	it("take amounts are whole dollars and never exceed the headroom", () => {
		const odd = loanInfo({ principal: 0, max: 1_000_001, dailyRate: 0.01 });
		const p = takePresets(odd);
		expect(p[0].amount).toBe(250_000);
		expect(p[2].amount).toBe(1_000_001);
		expect(p.every((x) => x.amount <= odd.headroom)).toBe(true);
	});
	it("repay presets are shares of the principal, limited by cash", () => {
		const r = repayPresets(info, 500_000);
		expect(r.map((p) => p.amount)).toEqual([100_000, 200_000, 400_000]);
		expect(r.every((p) => p.disabled === null)).toBe(true);
		const poor = repayPresets(info, 150_000);
		expect(poor.map((p) => p.disabled === null)).toEqual([true, false, false]);
		expect(poor[2].disabled).toMatch(/Treasury/);
	});
	it("nothing to repay disables every repay preset", () => {
		const r = repayPresets(loanInfo({ principal: 0, max: 2e6, dailyRate: 0.004 }), 1e9);
		expect(r.every((p) => p.disabled === "Nothing to repay")).toBe(true);
	});
	it("a missing loan reads as zeros", () => {
		expect(loanInfo(undefined)).toEqual({ principal: 0, max: 0, dailyRate: 0, headroom: 0, interestPerDay: 0 });
	});
});

describe("quarterly report", () => {
	const r: QuarterReport = { quarter: 2, fromDay: 7, toDay: 13, revenue: 900_000, costs: 1_000_000, uptime: 0.9951, pue: 1.43, jobsCompleted: 12, jobsFailed: 2, penalties: 40_000, grade: "D", cashDelta: -20_000, remark: "x" };
	it("lists the figures, marking a loss and failed jobs", () => {
		const rows = reportRows(r);
		expect(rows.find((x) => x.label === "Period")?.value).toBe("Days 7–13");
		expect(rows.find((x) => x.label === "Profit")).toMatchObject({ value: "−$100k", tone: "bad" });
		expect(rows.find((x) => x.label === "Uptime")?.value).toBe("99.51%");
		expect(rows.find((x) => x.label === "PUE")?.value).toBe("1.43");
		expect(rows.find((x) => x.label === "Jobs failed")?.tone).toBe("bad");
	});
	it("grade tone, signed deltas and grant/fine wording", () => {
		expect(["A", "B", "C", "D", "E"].map((g) => gradeTone(g as "A"))).toEqual(["green", "green", "amber", "red", "red"]);
		expect([signed(4), signed(-3), signed(0)]).toEqual(["+4", "−3", "±0"]);
		expect(cashDeltaText(50_000)).toBe("Grant +$50k");
		expect(cashDeltaText(-20_000)).toBe("Fine −$20k");
		expect(cashDeltaText(0)).toBe("No grant or fine");
		expect(auditOutcome(r)).toEqual({ cash: "Fine −$20k" });
	});
});

describe("lifetime stats", () => {
	it("gives ten rows, and none when the view has no stats", () => {
		const s = { revenue: 2_500_000, pflopHours: 12_345.6, jobsCompleted: 30, jobsFailed: 2, peakPflops: 120, facilitiesBuilt: 44, componentFailures: 9, repairs: 8, decisionsMade: 5, researchPointsEarned: 77.9 };
		const rows = lifetimeRows(s);
		expect(rows).toHaveLength(10);
		expect(rows[0]).toEqual({ label: "Lifetime revenue", value: "$2.50M" });
		expect(rows[1].value).toBe("12,346 PF·h");
		expect(rows[9].value).toBe("77");
		expect(lifetimeRows(undefined)).toEqual([]);
	});
});
