import { describe, expect, it } from "vitest";
import { nextFocusIndex } from "./focus";
describe("focus trap", () => {
    it("wraps forwards and backwards", () => {
        expect(nextFocusIndex(5, 4, false)).toBe(0);
        expect(nextFocusIndex(5, 0, true)).toBe(4);
        expect(nextFocusIndex(5, 2, false)).toBe(3);
        expect(nextFocusIndex(5, 2, true)).toBe(1);
    });
    it("pulls focus in from outside and survives an empty menu", () => {
        expect(nextFocusIndex(5, -1, false)).toBe(0);
        expect(nextFocusIndex(5, -1, true)).toBe(4);
        expect(nextFocusIndex(0, -1, false)).toBe(-1);
        expect(nextFocusIndex(1, 0, false)).toBe(0);
    });
});
