import type { ModifierView } from "@aitower/sim";
import { describe, expect, it } from "vitest";
import { clampStanding, modifierChip, modifierHurts, modifierValue, standingTone } from "./status";

const mod = (kind: ModifierView["kind"], value: number, endsAt = 100, label = "Heatwave"): ModifierView => ({ kind, value, endsAt, label });

describe("status widgets", () => {
	it("reputation tone is red below 25, amber below 50, else green; values clamp", () => {
		expect(standingTone(10)).toBe("red");
		expect(standingTone(40)).toBe("amber");
		expect(standingTone(75)).toBe("green");
		expect(clampStanding(140)).toBe(100);
		expect(clampStanding(Number.NaN)).toBe(0);
	});
	it("modifier chips show the value and the time left; hurting ones are flagged", () => {
		expect(modifierValue(mod("ambient", 8))).toBe("+8 °C");
		expect(modifierValue(mod("gridCap", 0.5))).toBe("×0.50");
		expect(modifierChip(mod("ambient", 8, 900), 0)).toMatch(/^HEATWAVE \+8 °C · /);
		expect(modifierHurts(mod("ambient", 8))).toBe(true);
		expect(modifierHurts(mod("payout", 1.25))).toBe(false);
		expect(modifierHurts(mod("gridCap", 0.5))).toBe(true);
	});
});
