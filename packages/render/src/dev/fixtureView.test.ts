import { describe, expect, it } from "vitest";
import { createFixture, fixtureContent } from "./fixtureView";

describe("fixture", () => {
	it("is consistent and animates", () => {
		const fx = createFixture();
		const v = fx.view;
		const n = v.width * (v.floorMax - v.floorMin + 1);
		for (const a of [v.slab, v.power, v.coolant, v.airTemp, v.powerNetOf, v.coolantNetOf]) expect(a.length).toBe(n);
		for (const f of v.facilities) expect(fixtureContent.facilities[f.defId]).toBeDefined();
		expect(v.facilities.filter((f) => fixtureContent.facilities[f.defId].kind === "rack").length).toBeGreaterThanOrEqual(8);
		const x0 = v.bots[0].x;
		for (let i = 0; i < 20; i++) fx.step();
		expect(v.tick).toBe(20);
		expect(v.bots[0].x).not.toBe(x0);
	});
});
