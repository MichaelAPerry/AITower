import type { ModifierView } from "@aitower/sim";
import { describe, expect, it } from "vitest";
import { modifierChip, modifierHurts, modifierValue } from "./status";

const mod = (kind: ModifierView["kind"], value: number, endsAt = 100, label = "Heatwave"): ModifierView => ({ kind, value, endsAt, label });

describe("status widgets", () => {
	it("modifier chips show the value and the time left; hurting ones are flagged", () => {
		expect(modifierValue(mod("ambient", 8))).toBe("+8 °C");
		expect(modifierValue(mod("gridCap", 0.5))).toBe("×0.50");
		expect(modifierChip(mod("ambient", 8, 900), 0)).toMatch(/^HEATWAVE \+8 °C · /);
		expect(modifierHurts(mod("ambient", 8))).toBe(true);
		expect(modifierHurts(mod("payout", 1.25))).toBe(false);
		expect(modifierHurts(mod("gridCap", 0.5))).toBe(true);
	});
});
