import type { FacilityStatus } from "@aitower/sim";
import { describe, expect, it } from "vitest";
import { DEFAULT_TRIP_C, FIRE_MARGIN_C, NO_FX, facilityFx, hasAnyFx, leakDrips, lightRuns, overloadedCoolantNets } from "./feedback";

const fx = (status: FacilityStatus, tempC = 60, sat: number | null = 1, tripC?: number) => facilityFx({ status, tempC }, sat, tripC);

describe("facilityFx", () => {
	it("tripped: steam and strobe only", () => {
		expect(fx("tripped")).toEqual({ ...NO_FX, steam: true, strobe: true });
	});

	it("failed: wrench and sparks, no fire when cool", () => {
		expect(fx("failed", 60)).toEqual({ ...NO_FX, wrench: true, sparks: true });
	});

	it("failed and hot: fire and smoke join in at tripC minus the margin", () => {
		const t = DEFAULT_TRIP_C;
		expect(fx("failed", t - FIRE_MARGIN_C - 0.1).fire).toBe(false);
		const hot = fx("failed", t - FIRE_MARGIN_C);
		expect(hot).toEqual({ ...NO_FX, wrench: true, sparks: true, fire: true, smoke: true });
		expect(fx("failed", 120).fire).toBe(true);
	});

	it("uses the balance trip temperature when given", () => {
		expect(fx("failed", 88, 1, 90).fire).toBe(true);
		expect(fx("failed", 88, 1, 100).fire).toBe(false);
	});

	it("fire needs a failed facility: a hot tripped or ok rack does not burn", () => {
		expect(fx("tripped", 140).fire).toBe(false);
		expect(fx("ok", 140).fire).toBe(false);
		expect(fx("throttled", 140).wrench).toBe(false);
	});

	it("blackout: net satisfaction 0; brownout: strictly between 0 and 1; nothing at 1 or without a net", () => {
		expect(fx("unpowered", 25, 0)).toEqual({ ...NO_FX, blackout: true });
		expect(fx("brownout", 60, 0.4)).toEqual({ ...NO_FX, brownout: true });
		expect(fx("ok", 60, 1)).toEqual(NO_FX);
		expect(fx("unpowered", 25, null)).toEqual(NO_FX);
		expect(fx("ok", 60, 0.999).brownout).toBe(true);
	});

	it("healthy and idle facilities trigger nothing", () => {
		for (const s of ["ok", "idle", "disabled", "throttled", "noCoolant"] as const) expect(hasAnyFx(fx(s))).toBe(false);
	});

	it("effects stack: a failed rack in a blackout shows both", () => {
		const r = fx("failed", 60, 0);
		expect(r.sparks && r.blackout).toBe(true);
	});
});

const grid = (width: number, floorMin: number, floorMax: number) => {
	const n = width * (floorMax - floorMin + 1);
	return { width, floorMin, floorMax, powerNetOf: new Int32Array(n).fill(-1), coolant: new Uint8Array(n), coolantNetOf: new Int32Array(n).fill(-1) };
};
const net = (id: number, satisfaction: number) => ({ id, supplyKw: 0, demandKw: 0, satisfaction, storedKwh: 0, storageCapacityKwh: 0, gridImportKw: 0 });

describe("lightRuns", () => {
	it("returns nothing when every net is satisfied", () => {
		const g = grid(6, 0, 1);
		g.powerNetOf.fill(0);
		expect(lightRuns({ ...g, powerNets: [net(0, 1)] })).toEqual([]);
	});

	it("finds contiguous runs per floor on nets below 1, with their satisfaction", () => {
		const g = grid(8, 0, 2);
		// floor 0: net 1 (dark) on x 1..3, net 0 elsewhere; floor 1: net 2 (brown) across; floor 2: none.
		for (let x = 0; x < 8; x++) g.powerNetOf[x] = x >= 1 && x <= 3 ? 1 : 0;
		for (let x = 0; x < 8; x++) g.powerNetOf[8 + x] = 2;
		expect(lightRuns({ ...g, powerNets: [net(0, 1), net(1, 0), net(2, 0.5)] })).toEqual([
			{ floor: 0, x0: 1, x1: 4, satisfaction: 0 },
			{ floor: 1, x0: 0, x1: 8, satisfaction: 0.5 },
		]);
	});

	it("splits a run where the net changes and where cells are not on a net", () => {
		const g = grid(6, 0, 0);
		g.powerNetOf.set([1, 1, -1, 1, 2, 2]);
		const runs = lightRuns({ ...g, powerNets: [net(1, 0), net(2, 0.25)] });
		expect(runs).toEqual([
			{ floor: 0, x0: 0, x1: 2, satisfaction: 0 },
			{ floor: 0, x0: 3, x1: 4, satisfaction: 0 },
			{ floor: 0, x0: 4, x1: 6, satisfaction: 0.25 },
		]);
	});

	it("treats unknown net ids as healthy", () => {
		const g = grid(3, 0, 0);
		g.powerNetOf.fill(9);
		expect(lightRuns({ ...g, powerNets: [net(1, 0)] })).toEqual([]);
	});
});

describe("coolant leaks", () => {
	const cn = (id: number, capacityKw: number, loadKw: number) => ({ id, capacityKw, loadKw, supplyTempC: 30 });

	it("only nets with load strictly over capacity leak", () => {
		expect([...overloadedCoolantNets({ coolantNets: [cn(0, 100, 100), cn(1, 100, 101), cn(2, 0, 1), cn(3, 50, 10)] })]).toEqual([1, 2]);
	});

	it("drips from every conduit cell of an overloaded net and nowhere else", () => {
		const g = grid(6, 0, 1);
		for (let x = 0; x < 6; x++) {
			g.coolant[x] = 1;
			g.coolantNetOf[x] = x < 3 ? 0 : 1; // floor 0: net 0 (x<3), net 1 (x>=3)
		}
		g.coolant[6 + 2] = 1; // floor 1 conduit in the overloaded net
		g.coolantNetOf[6 + 2] = 1;
		g.coolantNetOf[6 + 4] = 1; // labelled but no conduit: ignored
		const drips = leakDrips({ ...g, coolantNets: [cn(0, 100, 50), cn(1, 100, 400)] }, () => false, 9);
		expect(drips.map((d) => [Math.floor(d.x / 16), d.floor])).toEqual([
			[3, 0],
			[4, 0],
			[5, 0],
			[2, 1],
		]);
		for (const d of drips) {
			expect(d.x % 16).toBeGreaterThanOrEqual(3);
			expect(d.floorY).toBeGreaterThan(d.y);
		}
	});

	it("drops land on the facility top when one stands under the conduit", () => {
		const g = grid(2, 0, 0);
		g.coolant.fill(1);
		g.coolantNetOf.fill(0);
		const [a, b] = leakDrips({ ...g, coolantNets: [cn(0, 1, 2)] }, (x) => x === 0, 9);
		expect(a.floorY).toBe(9);
		expect(b.floorY).toBeGreaterThan(30);
	});

	it("returns nothing for healthy networks", () => {
		const g = grid(2, 0, 0);
		g.coolant.fill(1);
		g.coolantNetOf.fill(0);
		expect(leakDrips({ ...g, coolantNets: [cn(0, 5, 5)] }, () => false, 9)).toEqual([]);
	});
});
