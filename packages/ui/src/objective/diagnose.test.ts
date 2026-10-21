import type { ContentDB } from "@aitower/content";
import type { FacilityView, SimView } from "@aitower/sim";
import { describe, expect, it } from "vitest";
import { coolantLoopProblem, rackProblem, unreachedFloors } from "./diagnose";

const content = {
	facilities: {
		rack_air_gpu: { id: "rack_air_gpu", name: "Air", kind: "rack", rack: { pflops: 20, liquidFraction: 0 } },
		rack_dlc_gpu: { id: "rack_dlc_gpu", name: "DLC", kind: "rack", rack: { pflops: 130, liquidFraction: 0.8 } },
		chiller: { id: "chiller", name: "Chiller", kind: "chiller" },
		cdu: { id: "cdu", name: "CDU", kind: "cdu" },
	},
} as unknown as ContentDB;

const fac = (defId: string, p: Partial<FacilityView> = {}): FacilityView => ({ id: 1, defId, floor: 1, x: 4, enabled: true, status: "ok", powerNet: 0, coolantNet: null, ...p }) as FacilityView;
const view = (facilities: FacilityView[], p: Partial<SimView> = {}): SimView => ({ facilities, coolantNets: [], spareParts: 2, ...p }) as unknown as SimView;

describe("coolant loop diagnosis", () => {
	const dlc = fac("rack_dlc_gpu", { status: "noCoolant", coolantNet: 0 });
	it("no pipe at all", () => {
		expect(coolantLoopProblem(view([]), content, null)).toMatch(/No coolant pipe/);
	});
	it("pipe that reaches neither a chiller nor a CDU", () => {
		expect(coolantLoopProblem(view([dlc]), content, 0)).toMatch(/reaches no chiller or CDU/);
	});
	it("names the missing half of the loop", () => {
		expect(coolantLoopProblem(view([dlc, fac("cdu", { coolantNet: 0 })]), content, 0)).toMatch(/CDU but no chiller/);
		expect(coolantLoopProblem(view([dlc, fac("chiller", { coolantNet: 0 })]), content, 0)).toMatch(/chiller but no CDU/);
	});
	it("a chiller on a different pipe does not count", () => {
		expect(coolantLoopProblem(view([dlc, fac("cdu", { coolantNet: 0 }), fac("chiller", { coolantNet: 1 })]), content, 0)).toMatch(/no chiller/);
	});
	it("an unpowered chiller is called out", () => {
		expect(coolantLoopProblem(view([dlc, fac("cdu", { coolantNet: 0 }), fac("chiller", { coolantNet: 0, status: "unpowered" })]), content, 0)).toMatch(/chiller .* no power/);
	});
	it("a complete, powered loop is fine", () => {
		expect(coolantLoopProblem(view([dlc, fac("cdu", { coolantNet: 0 }), fac("chiller", { coolantNet: 0 })]), content, 0)).toBeNull();
	});
});

describe("rack diagnosis", () => {
	it("idle compute racks say they need a job", () => {
		expect(rackProblem(view([]), content, fac("rack_dlc_gpu", { status: "idle" }))).toMatch(/no job/);
	});
	it("a no-coolant rack explains its loop", () => {
		const r = fac("rack_dlc_gpu", { status: "noCoolant", coolantNet: 0 });
		expect(rackProblem(view([r]), content, r)).toMatch(/reaches no chiller or CDU/);
	});
	it("an unpowered rack with no conduit says to lay one", () => {
		expect(rackProblem(view([]), content, fac("rack_air_gpu", { status: "unpowered", powerNet: null }))).toMatch(/power conduit/);
	});
	it("throttled liquid rack on an overloaded loop names the loop load", () => {
		const r = fac("rack_dlc_gpu", { status: "throttled", coolantNet: 0 });
		const v = view([r], { coolantNets: [{ id: 0, capacityKw: 400, loadKw: 480, supplyTempC: 50 }] });
		expect(rackProblem(v, content, r)).toMatch(/over capacity/);
	});
	it("broken with an empty parts cage says to buy parts", () => {
		expect(rackProblem(view([], { spareParts: 0 }), content, fac("rack_air_gpu", { status: "failed" }))).toMatch(/Buy spare parts/);
	});
	it("healthy racks and non-racks have no problem", () => {
		expect(rackProblem(view([]), content, fac("rack_air_gpu"))).toBeNull();
		expect(rackProblem(view([]), content, fac("chiller", { status: "unpowered" }))).toBeNull();
	});
});

describe("unreached floors follow the real nav (slab runs, powered lifts)", () => {
	// 3 floors 0..2, width 20. Floor 1 has a gap at x=10, so a lift on the left (x=2) and one on the right (x=15) do not join there.
	const width = 20;
	const slab = new Uint8Array(3 * width).fill(1);
	slab[1 * width + 10] = 0;
	const base = { width, floorMin: 0, floorMax: 2, slab, bots: [{ id: 1, defId: "rover", floor: 0, x: 2 }] };
	const c = { ...content, bots: { rover: {} } } as unknown as ContentDB;
	const rackOn = (floor: number, x: number) => fac("rack_air_gpu", { floor, x, width: 2 });
	it("a second shaft across a slab gap does not make its floors reachable", () => {
		const v = view([rackOn(2, 15)], { ...base, lifts: [{ id: 1, x: 2, floorMin: 0, floorMax: 1 }, { id: 2, x: 15, floorMin: 1, floorMax: 2 }] } as unknown as Partial<SimView>);
		expect(unreachedFloors(v, c)).toEqual([2]);
	});
	it("joined by slab it is reachable, and an unpowered shaft is not a way up", () => {
		const joined = new Uint8Array(3 * width).fill(1);
		const lifts = [{ id: 1, x: 2, floorMin: 0, floorMax: 1 }, { id: 2, x: 15, floorMin: 1, floorMax: 2 }];
		expect(unreachedFloors(view([rackOn(2, 15)], { ...base, slab: joined, lifts } as unknown as Partial<SimView>), c)).toEqual([]);
		const dark = [{ ...lifts[0], powered: false }, lifts[1]];
		expect(unreachedFloors(view([rackOn(2, 15)], { ...base, slab: joined, lifts: dark } as unknown as Partial<SimView>), c)).toEqual([1, 2].filter((f) => f === 2));
	});
});
