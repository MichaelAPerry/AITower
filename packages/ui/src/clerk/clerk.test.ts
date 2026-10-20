import type { ContentDB, ContractSpec } from "@aitower/content";
import type { ClerkPolicy } from "@aitower/sim";
import { describe, expect, it } from "vitest";
import { clerkLockedText, clerkRowText, clerkVerdict, feePercent, fmtRate, parseAmount, toggleKind } from "./clerk";

const policy = (p: Partial<ClerkPolicy> = {}): ClerkPolicy => ({ enabled: true, kinds: ["training", "finetune", "inference"], minPayPerPflopHour: 0, maxPenalty: 0, allowLiquid: true, ...p });
const spec = (s: Partial<ContractSpec> = {}): ContractSpec => ({ clientId: "c", clientName: "C", kind: "training", work: 100, durationTicks: 1440, payout: 1000, penalty: 500, needsLiquid: false, storageTB: 0, checkpointTicks: 60, ...s });

describe("clerkVerdict", () => {
	it("takes an offer that passes every rule", () => {
		expect(clerkVerdict(policy(), spec())).toEqual({ takes: true, why: null });
	});
	it("skips a kind that is not on the list", () => {
		const v = clerkVerdict(policy({ kinds: ["training"] }), spec({ kind: "inference", sustainedPflops: 5 }));
		expect(v.takes).toBe(false);
		expect(v.why).toMatch(/inference/);
	});
	it("compares the pay rate with the minimum (training: payout / work)", () => {
		// 1000 / 100 = $10 per PF·h
		expect(clerkVerdict(policy({ minPayPerPflopHour: 10 }), spec()).takes).toBe(true);
		const v = clerkVerdict(policy({ minPayPerPflopHour: 10.5 }), spec());
		expect(v.takes).toBe(false);
		expect(v.why).toMatch(/under your minimum/);
	});
	it("uses the inference formula: payout / (PFLOPS × hours)", () => {
		// 8 PFLOPS for 2 h, payout 160 => $10 per PF·h
		const s = spec({ kind: "inference", work: 8, sustainedPflops: 8, durationTicks: 120, payout: 160 });
		expect(clerkVerdict(policy({ minPayPerPflopHour: 10 }), s).takes).toBe(true);
		expect(clerkVerdict(policy({ minPayPerPflopHour: 11 }), s).takes).toBe(false);
	});
	it("max penalty 0 means any; otherwise a penalty over the cap is skipped", () => {
		expect(clerkVerdict(policy({ maxPenalty: 0 }), spec({ penalty: 9_999_999 })).takes).toBe(true);
		expect(clerkVerdict(policy({ maxPenalty: 500 }), spec({ penalty: 500 })).takes).toBe(true);
		const v = clerkVerdict(policy({ maxPenalty: 499 }), spec({ penalty: 500 }));
		expect(v.takes).toBe(false);
		expect(v.why).toMatch(/penalty/);
	});
	it("liquid offers need allowLiquid", () => {
		expect(clerkVerdict(policy({ allowLiquid: false }), spec({ needsLiquid: true })).takes).toBe(false);
		expect(clerkVerdict(policy({ allowLiquid: true }), spec({ needsLiquid: true })).takes).toBe(true);
	});
	it("an offer that cannot start on the idle racks is skipped, with the sim's reason", () => {
		const v = clerkVerdict(policy(), spec(), { ok: false, reason: "no free rack" });
		expect(v).toEqual({ takes: false, why: "can't start: no free rack" });
		expect(clerkVerdict(policy(), spec(), { ok: true }).takes).toBe(true);
	});
});

describe("clerk copy and edits", () => {
	it("row text depends on the switch", () => {
		expect(clerkRowText(true, { takes: true, why: null })).toBe("Clerk will take it");
		expect(clerkRowText(true, { takes: false, why: "x" })).toBe("Clerk skips: x");
		expect(clerkRowText(false, { takes: true, why: null })).toBe("Clerk is off (would take it)");
		expect(clerkRowText(false, { takes: false, why: "x" })).toBe("Clerk is off");
	});
	it("locked slip names the node and its cost, with a fallback when content has no node", () => {
		const c = { tech: [{ id: "t", name: "Form 9 Delegation", cost: 40, effects: [{ type: "feature", feature: "contractsClerk" }] }] } as unknown as ContentDB;
		expect(clerkLockedText(c)).toBe("Hire a Contract Automation: research Form 9 Delegation (40 RP)");
		expect(clerkLockedText({ tech: [] } as unknown as ContentDB)).toMatch(/^Hire a Contract Automation: research/);
	});
	it("toggleKind never empties the list and keeps canonical order", () => {
		expect(toggleKind(["training", "finetune"], "finetune")).toEqual(["training"]);
		expect(toggleKind(["training"], "training")).toEqual(["training"]);
		expect(toggleKind(["inference"], "training")).toEqual(["training", "inference"]);
		expect(toggleKind(["training", "inference"], "finetune")).toEqual(["training", "finetune", "inference"]);
	});
	it("parseAmount accepts finite numbers ≥ 0 only", () => {
		expect(parseAmount("12.5")).toBe(12.5);
		expect(parseAmount(" $1,500 ")).toBe(1500);
		expect(parseAmount("0")).toBe(0);
		for (const t of ["", "-1", "abc", "1e999", "NaN"]) expect(parseAmount(t)).toBeNull();
	});
	it("pay rate formats with and without the unit", () => {
		expect(fmtRate(12.34)).toBe("$12.3/PF·h");
		expect(fmtRate(3.456, false)).toBe("$3.46");
		expect(fmtRate(250.4)).toBe("$250/PF·h");
		expect(fmtRate(Number.NaN)).toBe("—");
	});
	it("fee percent reads the balance", () => {
		expect(feePercent({ balance: { clerk: { feeShare: 0.05 } } } as unknown as ContentDB)).toBe(5);
		expect(feePercent({ balance: { clerk: { feeShare: 0.075 } } } as unknown as ContentDB)).toBe(7.5);
	});
});
