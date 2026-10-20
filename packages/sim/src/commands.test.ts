import { describe, expect, it } from "vitest";
import type { CommandResult, SimCommand } from "./api";
import { simFromSnapshot } from "./sim";
import { exec, makeContent, newSim, rowCells } from "./test/fixture";

const reasonOf = (r: CommandResult): string => (r.ok ? "" : r.reason);

describe("queue-aware validation", () => {
	it("buildSlab then place on that slab, in the same paused tick", () => {
		const sim = newSim(makeContent());
		exec(sim, { type: "buildSlab", floor: 0, x0: 0, x1: 9 });
		exec(sim, { type: "buildConduit", layer: "power", cells: rowCells(0, 0, 9) });
		expect(sim.submit({ type: "buildSlab", floor: 1, x0: 0, x1: 9 }).ok).toBe(true);
		// Not built yet, but the queue contains the slab.
		expect(sim.state.slab[(1 - sim.state.floorMin) * sim.state.width]).toBe(0);
		expect(reasonOf(sim.canPlace("crah_unit", 1, 0))).toBe("needs a power conduit under it"); // slab is queued, conduit is not
		expect(sim.submit({ type: "buildConduit", layer: "power", cells: rowCells(1, 0, 9) }).ok).toBe(true);
		expect(sim.canPlace("crah_unit", 1, 0).ok).toBe(true);
		expect(sim.submit({ type: "place", defId: "rack_air_gpu", floor: 1, x: 2 }).ok).toBe(true);
		const events = sim.step();
		expect(events.filter((e) => e.type === "commandRejected")).toHaveLength(0);
		expect(sim.state.facilities.map((f) => `${f.defId}@${f.floor},${f.x}`)).toEqual(["rack_air_gpu@1,2"]);
	});

	it("rejects overlapping placements and conflicting demolitions within one tick", () => {
		const sim = newSim(makeContent());
		exec(sim, { type: "buildSlab", floor: 0, x0: 0, x1: 9 });
		exec(sim, { type: "buildConduit", layer: "power", cells: rowCells(0, 0, 9) });
		expect(sim.submit({ type: "place", defId: "rack_air_gpu", floor: 0, x: 0 }).ok).toBe(true);
		expect(reasonOf(sim.submit({ type: "place", defId: "rack_air_gpu", floor: 0, x: 1 }))).toBe("overlaps another facility");
		// Demolishing the slab under a queued rack still demolishes the rack first, so a second demolish sees bare slab.
		expect(sim.submit({ type: "demolish", floor: 0, x: 0 }).ok).toBe(true);
		expect(reasonOf(sim.submit({ type: "demolish", floor: 0, x: 0, layer: "power" }))).toBe("");
		expect(sim.submit({ type: "place", defId: "rack_air_gpu", floor: 0, x: 0 }).ok).toBe(true);
	});

	it("two purchases that together exceed cash: the second is refused up front", () => {
		const sim = newSim(makeContent([], { startingCash: 700_000 }));
		exec(sim, { type: "buildSlab", floor: 0, x0: 0, x1: 9 });
		exec(sim, { type: "buildConduit", layer: "power", cells: rowCells(0, 0, 9) });
		const cash = sim.state.cash;
		expect(cash).toBeLessThan(700_000);
		expect(sim.submit({ type: "place", defId: "rack_air_gpu", floor: 0, x: 0 }).ok).toBe(true);
		expect(reasonOf(sim.submit({ type: "buyParts", count: 1 }))).toMatch(/no depot space/);
		expect(reasonOf(sim.submit({ type: "place", defId: "rack_dlc_gpu", floor: 0, x: 4 }))).toMatch(/insufficient funds/);
		expect(sim.submit({ type: "place", defId: "crah_unit", floor: 0, x: 4 }).ok).toBe(true);
	});

	it("refunds from queued demolitions fund later purchases", () => {
		const sim = newSim(makeContent([], { startingCash: 700_000 }));
		exec(sim, { type: "buildSlab", floor: 0, x0: 0, x1: 9 });
		exec(sim, { type: "buildConduit", layer: "power", cells: rowCells(0, 0, 9) });
		exec(sim, { type: "place", defId: "rack_air_gpu", floor: 0, x: 0 }); // 400k → ~275k left
		expect(sim.canBuild({ type: "place", defId: "rack_air_gpu", floor: 0, x: 4 }).ok).toBe(false);
		expect(sim.submit({ type: "demolish", floor: 0, x: 0 }).ok).toBe(true); // +200k refund
		expect(sim.submit({ type: "place", defId: "rack_air_gpu", floor: 0, x: 4 }).ok).toBe(true);
		expect(sim.step().filter((e) => e.type === "commandRejected")).toHaveLength(0);
	});

	it("applied result equals submitting each command in its own tick, in order", () => {
		const script: SimCommand[] = [
			{ type: "buildSlab", floor: 0, x0: 0, x1: 11 },
			{ type: "buildConduit", layer: "power", cells: rowCells(0, 0, 11) },
			{ type: "buildSlab", floor: 1, x0: 0, x1: 11 },
			{ type: "buildConduit", layer: "power", cells: rowCells(1, 0, 11) },
			{ type: "place", defId: "rack_air_gpu", floor: 1, x: 0 },
			{ type: "place", defId: "grid_tie", floor: 0, x: 0 },
			{ type: "place", defId: "parts_depot", floor: 0, x: 5 },
			{ type: "buyParts", count: 3 },
			{ type: "buildLift", x: 11, floorMin: 0, floorMax: 1 },
			{ type: "demolish", floor: 1, x: 0 },
		];
		const batched = newSim(makeContent());
		for (const c of script) expect(batched.submit(c).ok).toBe(true);
		const e1 = batched.step();
		const serial = newSim(makeContent());
		for (const c of script) exec(serial, c);
		// Same world after the batched tick as after the serial ticks (compare ignoring the clock).
		expect(e1.filter((e) => e.type === "commandRejected")).toHaveLength(0);
		const a = batched.state;
		const b = serial.state;
		expect(a.today.construction).toBeCloseTo(b.today.construction, 6);
		expect(Array.from(a.slab)).toEqual(Array.from(b.slab));
		expect(Array.from(a.power)).toEqual(Array.from(b.power));
		expect(a.facilities.map((f) => [f.defId, f.floor, f.x, f.stored])).toEqual(b.facilities.map((f) => [f.defId, f.floor, f.x, f.stored]));
		expect(a.lifts.map((l) => [l.x, l.floorMin, l.floorMax])).toEqual(b.lifts.map((l) => [l.x, l.floorMin, l.floorMax]));
	});

	it("canBuild never queues and never changes later results", () => {
		const sim = newSim(makeContent());
		const before = sim.hash();
		expect(sim.canBuild({ type: "buildSlab", floor: 0, x0: 0, x1: 4 }).ok).toBe(true);
		expect(sim.canBuild({ type: "buildSlab", floor: 0, x0: 0, x1: 4 }).ok).toBe(true);
		expect(sim.state.pending).toHaveLength(0);
		expect(sim.hash()).toBe(before);
		// With a queued slab, canBuild sees it (placing needs slab and power).
		expect(sim.submit({ type: "buildSlab", floor: 0, x0: 0, x1: 4 }).ok).toBe(true);
		expect(reasonOf(sim.canBuild({ type: "place", defId: "rack_air_gpu", floor: 0, x: 0 }))).toBe("needs a power conduit under it");
		expect(sim.canBuild({ type: "buildConduit", layer: "power", cells: rowCells(0, 0, 4) }).ok).toBe(true);
		expect(sim.state.pending).toHaveLength(1);
	});

	it("canPlace agrees with canBuild({type:'place'}) in every situation", () => {
		const sim = newSim(makeContent([], { startingCash: 1_000_000 }));
		const probes = (): [string, number, number][] => [
			["rack_air_gpu", 0, 0],
			["rack_air_gpu", 0, 3],
			["rack_air_gpu", 1, 0],
			["grid_tie", 0, 6],
			["tier2_thing", 0, 8],
			["nope", 0, 0],
			["constructor", 0, 0],
			["rack_air_gpu", 99, 0],
			["rack_air_gpu", Number.NaN, 0],
		];
		const agree = (): void => {
			for (const [d, f, x] of probes()) expect(sim.canPlace(d, f, x)).toEqual(sim.canBuild({ type: "place", defId: d, floor: f, x }));
		};
		agree();
		sim.submit({ type: "buildSlab", floor: 0, x0: 0, x1: 9 });
		agree();
		sim.submit({ type: "buildConduit", layer: "power", cells: rowCells(0, 0, 9) });
		sim.submit({ type: "place", defId: "rack_air_gpu", floor: 0, x: 0 });
		agree();
		sim.step();
		agree();
	});

	it("a projection built after loading a save replays the queued commands", () => {
		const content = makeContent();
		const a = newSim(content);
		a.submit({ type: "buildSlab", floor: 0, x0: 0, x1: 9 });
		const b = simFromSnapshot(content, JSON.parse(JSON.stringify(a.snapshot())));
		expect(b.canBuild({ type: "buildConduit", layer: "power", cells: rowCells(0, 0, 3) }).ok).toBe(true);
		expect(b.submit({ type: "buildConduit", layer: "power", cells: rowCells(0, 0, 3) }).ok).toBe(true);
		expect(b.step().filter((e) => e.type === "commandRejected")).toHaveLength(0);
	});

	it("does not leak the projection across steps", () => {
		const sim = newSim(makeContent());
		sim.submit({ type: "buildSlab", floor: 0, x0: 0, x1: 4 });
		sim.step();
		// Real state now has the slab; re-submitting is "already built", and the stale projection is gone.
		expect(reasonOf(sim.submit({ type: "buildSlab", floor: 0, x0: 0, x1: 4 }))).toBe("already built");
	});
});

describe("conduit support", () => {
	it("is independent of cell order", () => {
		const content = makeContent();
		const cells = [...rowCells(0, 0, 5)];
		const orders = [cells, [...cells].reverse(), [cells[3], cells[1], cells[5], cells[0], cells[4], cells[2]]];
		const grids = orders.map((order) => {
			const sim = newSim(content);
			exec(sim, { type: "buildSlab", floor: 0, x0: 0, x1: 0 }); // only x=0 has slab
			const res = sim.submit({ type: "buildConduit", layer: "power", cells: order });
			expect(res.ok).toBe(true);
			sim.step();
			return Array.from(sim.state.power).join("");
		});
		expect(new Set(grids).size).toBe(1);
	});

	it("still rejects an island with no slab and no neighbour", () => {
		const sim = newSim(makeContent());
		exec(sim, { type: "buildSlab", floor: 0, x0: 0, x1: 0 });
		expect(reasonOf(sim.submit({ type: "buildConduit", layer: "power", cells: [{ x: 0, floor: 0 }, { x: 5, floor: 0 }] }))).toMatch(/needs slab or an adjacent conduit/);
	});
});

describe("malformed input is rejected, never thrown", () => {
	const sim = newSim(makeContent());
	const bad: unknown[] = [
		null,
		undefined,
		42,
		"buildSlab",
		[],
		{},
		{ type: 7 },
		{ type: "nope" },
		{ type: "constructor" },
		{ type: "__proto__" },
		{ type: "buildConduit", layer: "power", cells: [null] },
		{ type: "buildConduit", layer: "power", cells: [{ x: 1 }] },
		{ type: "buildConduit", layer: "steam", cells: [] },
		{ type: "buildConduit", layer: "power", cells: "abc" },
		{ type: "buildSlab", floor: Number.NaN, x0: 0, x1: 1 },
		{ type: "buildSlab", floor: 0, x0: Number.POSITIVE_INFINITY, x1: 1 },
		{ type: "buildSlab", floor: "0", x0: 0, x1: 1 },
		{ type: "place", defId: 5, floor: 0, x: 0 },
		{ type: "place", defId: "constructor", floor: 0, x: 0 },
		{ type: "place", defId: "__proto__", floor: 0, x: 0 },
		{ type: "setEnabled", facilityId: 1, enabled: "yes" },
		{ type: "buyParts", count: Number.NaN },
		{ type: "buyBot", defId: "__proto__" },
		{ type: "demolish", floor: 0, x: 0, layer: "gas" },
	];
	it("submit and canBuild", () => {
		for (const c of bad) {
			expect(() => sim.canBuild(c as SimCommand)).not.toThrow();
			expect(sim.canBuild(c as SimCommand).ok).toBe(false);
			expect(() => sim.submit(c as SimCommand)).not.toThrow();
			expect(sim.submit(c as SimCommand).ok).toBe(false);
		}
		expect(sim.state.pending).toHaveLength(0);
		expect(() => sim.step()).not.toThrow();
	});

	it("cyclic and hostile objects", () => {
		const cyclic: Record<string, unknown> = { type: "buildSlab", floor: 0, x0: 0, x1: 1 };
		cyclic.self = cyclic;
		const thrower = {
			get type(): string {
				throw new Error("boom");
			},
		};
		expect(sim.submit(cyclic as unknown as SimCommand).ok).toBe(true); // extra props ignored
		expect(sim.submit(thrower as unknown as SimCommand).ok).toBe(false);
		expect(sim.canBuild(thrower as unknown as SimCommand).ok).toBe(false);
	});

	it("huge cell arrays are refused", () => {
		const cells = new Array(1_000_001).fill({ x: 0, floor: 0 });
		expect(reasonOf(sim.submit({ type: "buildConduit", layer: "power", cells }))).toMatch(/too many cells/);
	});

	it("canPlace tolerates garbage", () => {
		expect(sim.canPlace(null as unknown as string, Number.NaN, undefined as unknown as number).ok).toBe(false);
	});
});

describe("flush (apply queued commands while paused)", () => {
	it("is identical to letting the next step apply them", async () => {
		const { loadContent } = await import("@aitower/content");
		const { createSim } = await import("./sim");
		const content = loadContent();
		const a = createSim(content, "starter", 9);
		const b = createSim(content, "starter", 9);
		for (const s of [a, b]) s.step();
		const cmd = { type: "place", defId: "rack_air_gpu", floor: 1, x: 18 } as const;
		expect(a.submit(cmd).ok).toBe(true);
		expect(b.submit(cmd).ok).toBe(true);
		const ev = a.flush();
		expect(ev.some((e) => e.type === "built")).toBe(true);
		expect(a.view().facilities.length).toBe(b.view().facilities.length + 1); // visible at once
		expect(a.flush()).toEqual([]); // nothing left queued
		a.step();
		b.step();
		expect(a.hash()).toBe(b.hash());
	});
});

describe("lift extension", () => {
	/** Slab on floors 0..4 over x 0..20, a lift at x=10 spanning 0..1. */
	const setup = () => {
		const sim = newSim(makeContent());
		for (let f = 0; f <= 4; f++) exec(sim, { type: "buildSlab", floor: f, x0: 0, x1: 20 });
		exec(sim, { type: "buildLift", x: 10, floorMin: 0, floorMax: 1 });
		return sim;
	};

	it("a drag touching the top extends the same lift, charging only the new floors", () => {
		const sim = setup();
		const id = sim.state.lifts[0].id;
		const cash0 = sim.state.cash;
		exec(sim, { type: "buildLift", x: 10, floorMin: 2, floorMax: 4 });
		expect(sim.state.lifts).toHaveLength(1);
		expect(sim.state.lifts[0]).toMatchObject({ id, floorMin: 0, floorMax: 4 });
		expect(cash0 - sim.state.cash).toBe(3 * sim.content.structure.liftPerFloor);
		const v = sim.view();
		expect(v.lifts[0]).toMatchObject({ floorMin: 0, floorMax: 4 });
	});

	it("one floor is enough when extending; overlapping drags work; a lift with nothing new is refused", () => {
		const sim = setup();
		exec(sim, { type: "buildLift", x: 10, floorMin: 2, floorMax: 2 });
		expect(sim.state.lifts[0]).toMatchObject({ floorMin: 0, floorMax: 2 });
		exec(sim, { type: "buildLift", x: 10, floorMin: 1, floorMax: 3 });
		expect(sim.state.lifts[0]).toMatchObject({ floorMin: 0, floorMax: 3 });
		const r = sim.submit({ type: "buildLift", x: 10, floorMin: 0, floorMax: 3 });
		expect(r).toEqual({ ok: false, reason: "already built" });
		// A new single-floor lift elsewhere is still refused.
		expect(sim.submit({ type: "buildLift", x: 15, floorMin: 2, floorMax: 2 }).ok).toBe(false);
	});

	it("needs slab on the new floors and stops at facilities in the way", () => {
		const sim = newSim(makeContent());
		for (let f = 0; f <= 2; f++) exec(sim, { type: "buildSlab", floor: f, x0: 0, x1: 20 });
		exec(sim, { type: "buildLift", x: 10, floorMin: 0, floorMax: 1 });
		const r = sim.submit({ type: "buildLift", x: 10, floorMin: 2, floorMax: 3 });
		expect(r).toEqual({ ok: false, reason: "no slab at floor 3" });
	});

	it("bots can ride the extended shaft to the new floors (routing sees the change)", () => {
		const sim = setup();
		const before = sim.state.topologyRev;
		exec(sim, { type: "buildLift", x: 10, floorMin: 2, floorMax: 4 });
		expect(sim.state.topologyRev).toBeGreaterThan(before);
		for (let f = 0; f <= 4; f++) expect(sim.state.liftAt[(f - sim.state.floorMin) * sim.state.width + 10]).toBe(sim.state.lifts[0].id);
	});
});
