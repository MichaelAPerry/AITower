import { describe, expect, it } from "vitest";
import { insetsFor } from "./insets";

const box = (left: number, right: number) => ({ left, right, width: right - left, height: 300 });
describe("insetsFor", () => {
	it("takes the widest overlay on each side", () => {
		expect(insetsFor([box(0, 395), box(0, 260), box(900, 1280), box(1200, 1280)], 1280)).toEqual({ left: 395, right: 380 });
	});
	it("ignores empty boxes", () => {
		expect(insetsFor([{ left: 0, right: 0, width: 0, height: 0 }], 1280)).toEqual({ left: 0, right: 0 });
	});
});
