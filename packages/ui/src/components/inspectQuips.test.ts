import { describe, expect, it } from "vitest";
import { pickQuip, QUIPS, type QuipKind, type QuipState, quipState } from "./inspectQuips";

const kinds = Object.keys(QUIPS) as QuipKind[];
const states: QuipState[] = ["fine", "off", "trouble"];

describe("pickQuip", () => {
	it("has a fine line for every kind and 10 to 20 lines in all", () => {
		let n = 0;
		for (const k of kinds) {
			expect(QUIPS[k].fine.length).toBeGreaterThan(0);
			for (const s of states) n += QUIPS[k][s].length;
		}
		expect(n).toBeGreaterThanOrEqual(10);
		expect(n).toBeLessThanOrEqual(20);
	});
	it("is stable for the same inputs, never empty, and drawn from the pool (or fine when it is empty)", () => {
		for (const k of kinds)
			for (const s of states)
				for (const seed of [0, 1, 7, 42, "rack-ac1"]) {
					const q = pickQuip(k, s, seed);
					expect(q).not.toBe("");
					expect(q).toBe(pickQuip(k, s, seed));
					expect(QUIPS[k][QUIPS[k][s].length > 0 ? s : "fine"]).toContain(q);
				}
	});
	it("varies with the seed when a pool has several lines", () => {
		const seen = new Set([0, 1, 2].map((i) => pickQuip("rack", "fine", i)));
		expect(seen.size).toBe(QUIPS.rack.fine.length);
	});
	it("fits the thing inspected: a trouble rack never gets a fine line", () => {
		for (let i = 0; i < 6; i++) expect(QUIPS.rack.trouble).toContain(pickQuip("rack", "trouble", i));
	});
});

describe("quipState", () => {
	it("maps statuses", () => {
		expect(quipState("ok", false)).toBe("fine");
		expect(quipState("disabled", false)).toBe("off");
		expect(quipState("idle", false)).toBe("off");
		expect(quipState("tripped", false)).toBe("trouble");
		expect(quipState("ok", true)).toBe("trouble");
	});
});
