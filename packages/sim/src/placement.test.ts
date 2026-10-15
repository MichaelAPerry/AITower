import { describe, expect, it } from "vitest";
import type { CommandResult } from "./api";
import { exec, facilityOf, makeContent, newSim, rowCells, run } from "./test/fixture";

const reasonOf = (r: CommandResult): string | null => (r.ok ? null : r.reason);

describe("placement & costs", () => {
	it("slab needs support above ground and charges per tile (basements cost more)", () => {
		const sim = newSim(makeContent());
		expect(sim.submit({ type: "buildSlab", floor: 1, x0: 0, x1: 3 }).ok).toBe(false);
		const cash0 = sim.state.cash;
		exec(sim, { type: "buildSlab", floor: 0, x0: 0, x1: 9 });
		expect(cash0 - sim.state.cash).toBe(10 * 2_000);
		exec(sim, { type: "buildSlab", floor: -1, x0: 0, x1: 1 });
		expect(cash0 - sim.state.cash).toBe(10 * 2_000 + 2 * 5_000);
		// Above-ground now supported on x0..9 only; already-built cells are skipped.
		expect(sim.submit({ type: "buildSlab", floor: 1, x0: 0, x1: 10 }).ok).toBe(false);
		exec(sim, { type: "buildSlab", floor: 1, x0: 0, x1: 9 });
		expect(sim.submit({ type: "buildSlab", floor: 0, x0: 0, x1: 9 }).ok).toBe(false);
	});

	it("validates facility placement rules", () => {
		const sim = newSim(makeContent());
		exec(sim, { type: "buildSlab", floor: 0, x0: 0, x1: 30 });
		exec(sim, { type: "buildSlab", floor: 1, x0: 0, x1: 30 });
		expect(sim.canPlace("rack_air_gpu", 2, 0)).toMatchObject({ ok: false }); // no slab
		expect(sim.canPlace("rack_air_gpu", 0, 0)).toEqual({ ok: false, reason: "needs a power conduit under it" });
		expect(sim.canPlace("parts_depot", 0, 0).ok).toBe(true); // no power need
		expect(sim.canPlace("rack_air_gpu", 0, 47).ok).toBe(false); // out of bounds
		expect(sim.canPlace("nope", 0, 0).ok).toBe(false);
		exec(sim, { type: "buildConduit", layer: "power", cells: [...rowCells(0, 0, 20), ...rowCells(1, 0, 20)] });
		const built0 = sim.state.today.construction;
		exec(sim, { type: "place", defId: "rack_air_gpu", floor: 0, x: 2 });
		expect(sim.state.today.construction - built0).toBe(400_000);
		expect(reasonOf(sim.canPlace("rack_air_gpu", 0, 3))).toBe("overlaps another facility");
		expect(sim.canPlace("grid_tie", 1, 6).ok).toBe(false); // maxFloor 0
		expect(sim.canPlace("grid_tie", 0, 6).ok).toBe(true);
		expect(reasonOf(sim.canPlace("tier2_thing", 0, 10))).toBe("requires tier 2");
		expect(reasonOf(sim.canPlace("chiller", 0, 10))).toBe("needs a coolant conduit under it");
		exec(sim, { type: "buildLift", x: 20, floorMin: 0, floorMax: 1 });
		expect(reasonOf(sim.canPlace("crah_unit", 0, 19))).toBe("overlaps a lift shaft");
		expect(sim.submit({ type: "buildLift", x: 3, floorMin: 0, floorMax: 1 }).ok).toBe(false); // rack in the way
	});

	it("rejects when cash is insufficient (pre-validation and at apply time)", () => {
		const content = makeContent([], { startingCash: 450_000 });
		const sim = newSim(content);
		exec(sim, { type: "buildSlab", floor: 0, x0: 0, x1: 9 });
		exec(sim, { type: "buildConduit", layer: "power", cells: rowCells(0, 0, 9) });
		expect(sim.submit({ type: "place", defId: "rack_air_gpu", floor: 0, x: 0 }).ok).toBe(true);
		expect(sim.submit({ type: "place", defId: "rack_air_gpu", floor: 0, x: 4 }).ok).toBe(true);
		const events = sim.step();
		expect(events.filter((e) => e.type === "commandRejected")).toHaveLength(1);
		expect(sim.state.facilities).toHaveLength(1);
		expect(reasonOf(sim.canPlace("rack_air_gpu", 0, 4))).toMatch(/insufficient funds/);
	});

	it("demolish removes the top-most thing and refunds 50%", () => {
		const sim = newSim(makeContent());
		exec(sim, { type: "buildSlab", floor: 0, x0: 0, x1: 9 });
		exec(sim, { type: "buildConduit", layer: "power", cells: rowCells(0, 0, 9) });
		exec(sim, { type: "place", defId: "rack_air_gpu", floor: 0, x: 0 });
		let cash = sim.state.cash;
		exec(sim, { type: "demolish", floor: 0, x: 1 });
		expect(sim.state.cash - cash).toBe(200_000);
		expect(sim.state.facilities).toHaveLength(0);
		cash = sim.state.cash;
		expect(sim.submit({ type: "demolish", floor: 0, x: 1, layer: "coolant" }).ok).toBe(false);
		exec(sim, { type: "demolish", floor: 0, x: 1, layer: "power" });
		expect(sim.state.cash - cash).toBe(250);
		exec(sim, { type: "demolish", floor: 0, x: 1 });
		expect(sim.state.cash - cash).toBe(250 + 1_000);
		expect(sim.submit({ type: "demolish", floor: 0, x: 1 }).ok).toBe(false);
	});

	it("slab under a supported floor cannot be demolished", () => {
		const sim = newSim(makeContent());
		exec(sim, { type: "buildSlab", floor: 0, x0: 0, x1: 3 });
		exec(sim, { type: "buildSlab", floor: 1, x0: 0, x1: 3 });
		expect(sim.submit({ type: "demolish", floor: 0, x: 2 })).toEqual({ ok: false, reason: "slab supports the floor above" });
	});
});

describe("networks", () => {
	it("union-find joins conduit runs through risers; facilities take the lowest net under them", () => {
		const sim = newSim(makeContent());
		for (const floor of [0, 1, 2]) exec(sim, { type: "buildSlab", floor, x0: 0, x1: 20 });
		exec(sim, { type: "buildConduit", layer: "power", cells: [...rowCells(0, 0, 5), ...rowCells(2, 0, 5)] });
		expect(sim.state.powerNetCount).toBe(2);
		const v = sim.view();
		expect(v.powerNetOf[(0 - v.floorMin) * v.width + 3]).toBe(0);
		expect(v.powerNetOf[(2 - v.floorMin) * v.width + 3]).toBe(1);
		// Riser through floor 1 joins them.
		exec(sim, { type: "buildConduit", layer: "power", cells: [{ x: 5, floor: 1 }] });
		expect(sim.state.powerNetCount).toBe(1);
		// Separate net to the right; a rack straddling both picks the lowest id.
		exec(sim, { type: "buildConduit", layer: "power", cells: rowCells(0, 7, 10) });
		expect(sim.state.powerNetCount).toBe(2);
		exec(sim, { type: "place", defId: "rack_air_gpu", floor: 0, x: 6 });
		expect(facilityOf(sim, "rack_air_gpu").powerNet).toBe(1);
		exec(sim, { type: "buildConduit", layer: "power", cells: [{ x: 6, floor: 0 }] });
		expect(sim.state.powerNetCount).toBe(1);
		expect(facilityOf(sim, "rack_air_gpu").powerNet).toBe(0);
		// Coolant layer is independent.
		expect(sim.state.coolantNetCount).toBe(0);
		run(sim, 1);
	});

	it("conduit needs slab or an adjacent conduit", () => {
		const sim = newSim(makeContent());
		exec(sim, { type: "buildSlab", floor: 0, x0: 0, x1: 5 });
		expect(sim.submit({ type: "buildConduit", layer: "power", cells: [{ x: 0, floor: 1 }] }).ok).toBe(false);
		exec(sim, { type: "buildConduit", layer: "power", cells: [{ x: 0, floor: 0 }, { x: 0, floor: 1 }, { x: 0, floor: 2 }] });
		expect(sim.state.powerNetCount).toBe(1);
	});
});
