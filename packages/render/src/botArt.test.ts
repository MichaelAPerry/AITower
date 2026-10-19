import type { BotState } from "@aitower/sim";
import { describe, expect, it } from "vitest";
import { MAX_STACK, botDims, botKind, crateCount, hoverOffset, rotorSpeed } from "./botArt";

describe("botKind", () => {
	it("flying defs are drones, carry > 1 lifters, everything else the standard rover", () => {
		expect(botKind(undefined)).toBe("standard");
		expect(botKind({})).toBe("standard");
		expect(botKind({ carry: 1 })).toBe("standard");
		expect(botKind({ carry: 2 })).toBe("lifter");
		expect(botKind({ flying: true })).toBe("drone");
		expect(botKind({ flying: false, carry: 3 })).toBe("lifter");
	});

	it("flying wins over carry", () => {
		expect(botKind({ flying: true, carry: 4 })).toBe("drone");
	});
});

describe("botDims", () => {
	it("lifters are bulkier than the other bots", () => {
		expect(botDims("lifter").w).toBeGreaterThan(botDims("standard").w);
		expect(botDims("drone")).toEqual(botDims("standard"));
	});
});

describe("crateCount", () => {
	it("is zero unless carrying", () => {
		expect(crateCount({ carry: 3 }, false)).toBe(0);
		expect(crateCount(undefined, false)).toBe(0);
	});

	it("one crate for the standard bot, a stack of `carry` for lifters, capped", () => {
		expect(crateCount(undefined, true)).toBe(1);
		expect(crateCount({}, true)).toBe(1);
		expect(crateCount({ carry: 3 }, true)).toBe(3);
		expect(crateCount({ carry: 99 }, true)).toBe(MAX_STACK);
		expect(crateCount({ carry: 0 }, true)).toBe(1);
	});
});

describe("rotors", () => {
	const states: BotState[] = ["idle", "toDepot", "toTarget", "repairing", "toCharger", "charging", "waitingLift", "riding", "flying"];

	it("spin fastest in flight, stop when landed", () => {
		expect(rotorSpeed("flying")).toBe(1);
		expect(rotorSpeed("idle")).toBe(0);
		expect(rotorSpeed("charging")).toBe(0);
		for (const s of states) expect(rotorSpeed(s)).toBeLessThanOrEqual(rotorSpeed("flying"));
	});

	it("hover height is highest in flight and zero when landed", () => {
		expect(hoverOffset("flying")).toBeGreaterThan(hoverOffset("repairing"));
		expect(hoverOffset("idle")).toBe(0);
		for (const s of states) expect(hoverOffset(s) > 0).toBe(rotorSpeed(s) > 0);
	});
});
