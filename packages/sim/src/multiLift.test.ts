import { loadContent } from "@aitower/content";
import { describe, expect, it } from "vitest";
import type { SimCommand } from "./api";
import { failRack } from "./reliability/reliabilityStep";
import type { SimImpl } from "./sim";
import { SimImpl as Sim } from "./sim";
import { createState } from "./world/init";

const content = loadContent();

/** Player-style build on the real starter lot: every step goes through `submit`. */
function tower(shafts: { x: number; min: number; max: number }[], top: number, bots = 3): SimImpl {
	const state = createState(content, "starter", 5);
	state.offers = [];
	state.cash = 5e9;
	const sim = new Sim(content, state);
	const go = (c: SimCommand): void => {
		const r = sim.submit(c);
		if (!r.ok) throw new Error(`${c.type}: ${r.reason}`);
		sim.step();
	};
	for (let fl = 2; fl <= top; fl++) {
		go({ type: "buildSlab", floor: fl, x0: 4, x1: 43 });
		const cells = [];
		for (let x = 4; x <= 43; x++) cells.push({ x, floor: fl });
		go({ type: "buildConduit", layer: "power", cells });
	}
	go({ type: "buildSlab", floor: -2, x0: 4, x1: 43 });
	// Shaft order matters as in play: the starter lift is extended, others are new.
	for (const s of shafts) go({ type: "buildLift", x: s.x, floorMin: s.min, floorMax: s.max });
	for (const x of [32, 34, 36]) go({ type: "place", defId: "bot_charger", floor: 0, x });
	for (let fl = 1; fl <= top; fl++) for (const x of [6, 8, 10, 12]) if (!sim.state.facilities.some((f) => f.floor === fl && f.x === x)) go({ type: "place", defId: "rack_air_gpu", floor: fl, x });
	for (let i = 0; i < bots; i++) go({ type: "buyBot", defId: "rover" });
	sim.step();
	return sim;
}

const failAll = (sim: SimImpl): number => {
	let n = 0;
	for (const f of [...sim.state.facilities]) if (f.defId.startsWith("rack_") && !f.failed) (failRack(sim.state, f, []), n++);
	return n;
};

/** The player (or foreman) keeps the depots stocked. */
const restock = (sim: SimImpl): void => {
	for (const f of sim.state.facilities) if (f.defId === "parts_depot") f.stored = 20;
};

const settle = (sim: SimImpl, max = 20000): void => {
	for (let i = 0; i < max && broken(sim) > 0; i++) {
		if (i % 50 === 0) restock(sim);
		sim.step();
	}
};

/** A shaft at x whose column and neighbours carry no conduit on any floor. */
const deadShaft = (sim: SimImpl, x: number, top: number) => {
	for (let fl = 0; fl <= top; fl++) {
		for (const dx of [-1, 0, 1]) {
			const r = sim.submit({ type: "demolish", floor: fl, x: x + dx, layer: "power" });
			if (!r.ok) throw new Error(`demolish ${fl},${x + dx}: ${r.reason}`);
			sim.step();
		}
	}
	expect(sim.submit({ type: "buildLift", x, floorMin: 0, floorMax: top }).ok).toBe(true);
	sim.step(); // nets are rebuilt at the start of the next tick
	sim.step();
	return sim.state.lifts.find((l) => l.x === x);
};

const broken = (sim: SimImpl): number => sim.state.facilities.filter((f) => f.failed).length;

describe("multiple lifts", () => {
	it("12 floors + basement, three separate shafts that chain: every broken rack gets repaired", () => {
		const sim = tower(
			[
				{ x: 24, min: -1, max: 6 }, // extends the starter lift
				{ x: 32, min: 5, max: 9 },
				{ x: 40, min: 8, max: 12 },
				{ x: 20, min: -2, max: 0 },
			],
			12,
			4,
		);
		const n = failAll(sim);
		expect(n).toBeGreaterThan(30);
		settle(sim);
		if (process.env.DBG) console.log(JSON.stringify({ lifts: sim.state.lifts.map((l) => ({ id: l.id, x: l.x, min: l.floorMin, max: l.floorMax, net: l.powerNet, sat: l.sat, car: l.carFloor, riders: l.riders })), bots: sim.state.bots.map((b) => ({ id: b.id, task: b.task, leg: b.leg, f: b.floor, x: b.x, lift: b.liftId, exit: b.exitFloor, gf: b.goalFloor, fails: b.fails, retryAt: b.retryAt, bat: b.battery })), tick: sim.state.tick, wo: sim.state.workOrders.length }));
		expect(broken(sim)).toBe(0);
	});

	it("floors reachable only through a second shaft are served", () => {
		const sim = tower([{ x: 24, min: -1, max: 4 }, { x: 30, min: 4, max: 8 }], 8, 2);
		failAll(sim);
		settle(sim);
		expect(broken(sim)).toBe(0);
	});

	it("extending a lift later keeps routes in sync", () => {
		const sim = tower([{ x: 24, min: -1, max: 3 }], 8, 2);
		failAll(sim);
		settle(sim, 3000);
		expect(broken(sim)).toBeGreaterThan(0); // upper floors unreachable so far
		// ... and the view says so: orders on floors above the shaft are "noRoute", the rest are served.
		const v = sim.view();
		const above = (id: number) => (sim.state.facilities.find((f) => f.id === id)?.floor ?? 0) > 3;
		expect(v.workOrders.length).toBeGreaterThan(0);
		for (const w of v.workOrders) expect(w.route, `order on F${sim.state.facilities.find((f) => f.id === w.facilityId)?.floor}`).toBe(above(w.facilityId) ? "noRoute" : "ok");
		expect(v.maintenance.noRoute).toBe(v.workOrders.filter((w) => above(w.facilityId)).length);
		expect(v.maintenance.noRoute).toBeGreaterThan(0);
		expect(v.workOrders.filter((w) => w.queuePos !== null).map((w) => w.queuePos)).toEqual(v.workOrders.filter((w) => w.queuePos !== null).map((_, i) => i + 1));
		expect(v.lifts.every((l) => l.powered)).toBe(true);
		const r = sim.submit({ type: "buildLift", x: 24, floorMin: 3, floorMax: 8 });
		expect(r.ok).toBe(true);
		settle(sim);
		expect(broken(sim)).toBe(0);
	});

	it("a nearer shaft that has no power is not routed through: bots use the powered one", () => {
		const sim = tower([{ x: 40, min: -1, max: 8 }], 8, 3);
		sim.submit({ type: "demolish", floor: 0, x: 24 }); // the starter lift: only the far shaft at x=40 is alive
		sim.step();
		const dead = deadShaft(sim, 20, 8);
		expect(dead?.powerNet).toBe(-1);
		failAll(sim);
		settle(sim);
		if (process.env.DBG) console.log(JSON.stringify({ lifts: sim.state.lifts.map((l) => ({ id: l.id, x: l.x, min: l.floorMin, max: l.floorMax, net: l.powerNet, sat: l.sat, car: l.carFloor })), bots: sim.state.bots.map((b) => ({ id: b.id, task: b.task, leg: b.leg, f: b.floor, x: b.x, lift: b.liftId, gf: b.goalFloor, fails: b.fails, retryAt: b.retryAt, bat: b.battery })), wo: sim.state.workOrders.map((w) => [w.id, w.botId, w.attempts, w.retryAt]).slice(0, 5), tick: sim.state.tick }));
		expect(broken(sim)).toBe(0);
	});

	it("a shaft next to a conduit run is powered, so its car moves", () => {
		const sim = tower([{ x: 24, min: -1, max: 4 }], 4, 1);
		for (let fl = -1; fl <= 4; fl++) {
			sim.submit({ type: "demolish", floor: fl, x: 22, layer: "power" });
			sim.step();
		}
		expect(sim.submit({ type: "buildLift", x: 22, floorMin: -1, floorMax: 4 }).ok).toBe(true);
		sim.step();
		sim.step();
		expect(sim.state.lifts.find((l) => l.x === 22)?.powerNet).toBeGreaterThanOrEqual(0);
	});
});
