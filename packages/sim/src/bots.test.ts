import { describe, expect, it } from "vitest";
import type { BotState } from "./api";
import { BOT_STUCK_TICKS } from "./core/constants";
import { backoffTicks } from "./logistics/bots";
import { failRack } from "./reliability/reliabilityStep";
import type { SimImpl } from "./sim";
import { chainContent, type ChainOptions } from "./test/chain";
import { exec, facilityOf, newSim, run } from "./test/fixture";

const world = (o: ChainOptions = {}): SimImpl => newSim(chainContent(o), "chain", 3);
const rackAt = (sim: SimImpl, floor: number) => sim.state.facilities.find((f) => f.defId === "rack_air_gpu" && f.floor === floor) as NonNullable<ReturnType<SimImpl["state"]["facilities"]["find"]>>;

/** Steps until `done` or `max` ticks; returns ticks used (or -1). */
function until(sim: SimImpl, max: number, done: () => boolean, onTick?: () => void): number {
	for (let t = 0; t < max; t++) {
		sim.step();
		onTick?.();
		if (done()) return t;
	}
	return -1;
}

describe("multi-lift routing", () => {
	it("repairs a rack on floor 6 although no single lift spans floors 0..6 (A → lift 1 → floor 3 → lift 2 → B)", () => {
		const sim = world();
		expect(sim.state.lifts.map((l) => [l.floorMin, l.floorMax])).toEqual([
			[0, 3],
			[3, 6],
		]);
		const rack = rackAt(sim, 6);
		failRack(sim.state, rack, []);
		const ridden = new Set<number>();
		const seen = new Set<BotState>();
		const floorsAtLift: number[] = [];
		const t = until(sim, 2500, () => !rack.failed, () => {
			const bot = sim.state.bots[0];
			seen.add(sim.view().bots[0].state);
			if (bot.leg === "ride") ridden.add(bot.liftId);
			if (bot.leg === "waitLift") floorsAtLift.push(bot.floor);
		});
		expect(t).toBeGreaterThan(0);
		expect(rack.health).toBe(1);
		expect([...ridden].sort()).toEqual([1, 2]); // both lifts carried the bot
		expect(floorsAtLift).toContain(0);
		expect(floorsAtLift).toContain(3); // waited at the transfer floor for lift 2
		for (const s of ["toDepot", "waitingLift", "riding", "toTarget", "repairing"] as BotState[]) expect(seen.has(s)).toBe(true);
		// ...and walks home again (down through both lifts).
		run(sim, 1500);
		const bot = sim.state.bots[0];
		expect(bot.floor).toBe(0);
		expect(["none", "charge"]).toContain(bot.task);
		expect(sim.state.workOrders).toHaveLength(0);
	});

	it("the whole trip costs the same as the walk + wait + ride estimate, not a livelock (bounded time)", () => {
		const sim = world();
		failRack(sim.state, rackAt(sim, 6), []);
		const t = until(sim, 2500, () => sim.state.workOrders.length === 0);
		expect(t).toBeGreaterThan(0);
		expect(t).toBeLessThan(900);
	});

	it("an express lift is not forced: the bot takes the single cheaper lift when one spans both floors", () => {
		const sim = world({
			lifts: [
				[20, 0, 3],
				[24, 3, 6],
				[12, 0, 6],
			],
		});
		const rack = rackAt(sim, 6);
		failRack(sim.state, rack, []);
		const ridden = new Set<number>();
		until(sim, 2500, () => !rack.failed, () => {
			const bot = sim.state.bots[0];
			if (bot.leg === "ride") ridden.add(bot.liftId);
		});
		expect(rack.failed).toBe(false);
		expect([...ridden]).toEqual([3]);
	});

	it("two bots share the chain without deadlock", () => {
		const sim = world({ racks: [[6, 14], [6, 16], [5, 14]] });
		exec(sim, { type: "buyBot", defId: "rover" });
		for (const r of sim.state.facilities.filter((f) => f.defId === "rack_air_gpu")) failRack(sim.state, r, []);
		const t = until(sim, 4000, () => sim.state.workOrders.length === 0);
		expect(t).toBeGreaterThan(0);
		expect(sim.state.facilities.filter((f) => f.failed)).toHaveLength(0);
	});
});

describe("topology changes while en route", () => {
	it("demolishing the lift the bot is riding re-plans over another lift", () => {
		const sim = world({
			lifts: [
				[20, 0, 3],
				[24, 3, 6],
				[34, 0, 6],
			],
		});
		const rack = rackAt(sim, 6);
		failRack(sim.state, rack, []);
		const first = sim.state.bots[0];
		// Make the walk-in lift 1 attractive (nearest chain) and wait until the bot is on it.
		const onRide = until(sim, 1500, () => first.leg === "ride" && first.liftId === 1);
		expect(onRide).toBeGreaterThan(0);
		exec(sim, { type: "demolish", floor: 0, x: 20 });
		expect(sim.state.lifts.map((l) => l.id)).toEqual([2, 3]);
		const t = until(sim, 3000, () => !rack.failed);
		expect(t).toBeGreaterThan(0);
		expect(rack.health).toBe(1);
		expect(first.workOrderId).toBe(-1);
	});

	it("demolishing the only route mid-trip releases the order with backoff; rebuilding lets a retry finish it", () => {
		const sim = world();
		const rack = rackAt(sim, 6);
		failRack(sim.state, rack, []);
		const bot = sim.state.bots[0];
		expect(until(sim, 1500, () => bot.leg === "ride" && bot.liftId === 2)).toBeGreaterThan(0);
		exec(sim, { type: "demolish", floor: 3, x: 24 }); // second lift gone while riding it
		run(sim, 5);
		const wo = sim.state.workOrders[0];
		// The bot cannot reach floor 6 any more: it gave the order up (with backoff) and heads home carrying the part.
		expect(wo.botId).toBe(-1);
		expect(wo.attempts).toBeGreaterThanOrEqual(1);
		expect(wo.retryAt).toBeGreaterThan(sim.state.tick);
		expect(bot.workOrderId).toBe(-1);
		expect(bot.carrying).toBe(true);
		run(sim, 400);
		expect(["none", "charge", "charger"]).toContain(bot.task);
		expect(rack.failed).toBe(true);
		// Restore the connection: the order is retried and completes.
		exec(sim, { type: "buildLift", x: 24, floorMin: 3, floorMax: 6 });
		expect(until(sim, 3000, () => !rack.failed)).toBeGreaterThan(0);
		expect(sim.state.workOrders).toHaveLength(0);
	});

	it("demolishing the target rack mid-route drops the task, the bot goes home and serves the next failure", () => {
		const sim = world({ racks: [[6, 14], [2, 14]] });
		const far = rackAt(sim, 6);
		const near = rackAt(sim, 2);
		failRack(sim.state, far, []);
		const bot = sim.state.bots[0];
		expect(until(sim, 1500, () => bot.task === "target")).toBeGreaterThan(0);
		exec(sim, { type: "demolish", floor: 6, x: 14 });
		expect(sim.state.facilities.some((f) => f.id === far.id)).toBe(false);
		expect(sim.state.workOrders).toHaveLength(0);
		run(sim, 5);
		expect(bot.workOrderId).toBe(-1);
		expect(bot.task === "charger" || bot.task === "none" || bot.task === "charge").toBe(true);
		// It is not wedged: a new failure is repaired.
		failRack(sim.state, near, []);
		expect(until(sim, 3000, () => !near.failed)).toBeGreaterThan(0);
	});

	/** One floor, charger/depot on the left, rack at x=30; the corridor can be cut at x=22. */
	const corridor = (): SimImpl => {
		const content = chainContent();
		const sc = content.scenarios.chain;
		sc.floorMax = 0;
		sc.slabs = [[0, 0, 39]];
		sc.conduits = [["power", 0, 0, 39]];
		sc.lifts = [];
		sc.facilities = [
			{ defId: "grid_tie", floor: 0, x: 0 },
			{ defId: "bot_charger", floor: 0, x: 6 },
			{ defId: "parts_depot", floor: 0, x: 9 },
			{ defId: "rack_air_gpu", floor: 0, x: 30 },
		];
		return newSim(content, "chain", 4);
	};
	const cut = (sim: SimImpl): void => {
		exec(sim, { type: "demolish", floor: 0, x: 22, layer: "power" }, { type: "demolish", floor: 0, x: 22 });
		expect(sim.state.slab[22]).toBe(0);
	};

	it("slab cut between the bot and its target: the order backs off and the bot goes home; mending resumes the work", () => {
		const sim = corridor();
		const rack = facilityOf(sim, "rack_air_gpu");
		failRack(sim.state, rack, []);
		const bot = sim.state.bots[0];
		expect(until(sim, 600, () => bot.task === "target" && bot.x > 12 && bot.x < 18)).toBeGreaterThan(0);
		cut(sim);
		run(sim, 3);
		const wo = sim.state.workOrders[0];
		expect(wo.attempts).toBe(1);
		expect(wo.retryAt).toBeGreaterThan(sim.state.tick);
		expect(wo.botId).toBe(-1);
		expect(bot.workOrderId).toBe(-1);
		expect(bot.carrying).toBe(true); // keeps the part it already took
		run(sim, 800);
		expect(bot.x).toBe(7); // back on its charger tile
		expect(["none", "charge"]).toContain(bot.task);
		expect(rack.failed).toBe(true);
		expect(wo.attempts).toBeGreaterThanOrEqual(2);
		expect(wo.attempts).toBeLessThanOrEqual(6); // backoff keeps retries sparse
		// Mend the corridor: building lifts the backoff at once and the same part is delivered.
		exec(sim, { type: "buildSlab", floor: 0, x0: 22, x1: 22 });
		expect(until(sim, 600, () => !rack.failed)).toBeGreaterThan(0);
		expect(facilityOf(sim, "parts_depot").stored).toBe(3); // exactly one part consumed overall
	});

	it("slab cut behind the bot: after the repair it is stranded, backs off, and returns home once mended", () => {
		const sim = corridor();
		const rack = facilityOf(sim, "rack_air_gpu");
		failRack(sim.state, rack, []);
		const bot = sim.state.bots[0];
		expect(until(sim, 600, () => bot.task === "target" && bot.x > 25)).toBeGreaterThan(0);
		cut(sim);
		expect(until(sim, 600, () => !rack.failed)).toBeGreaterThan(0); // the goal is on its side: repair completes
		run(sim, 900);
		expect(bot.x).toBeGreaterThan(22);
		expect(bot.task).toBe("none");
		expect(bot.fails).toBeGreaterThan(0);
		const checkedAt = bot.retryAt;
		run(sim, 30);
		expect(bot.retryAt).toBeGreaterThanOrEqual(checkedAt); // not re-planning every tick
		exec(sim, { type: "buildSlab", floor: 0, x0: 22, x1: 22 });
		expect(until(sim, 600, () => bot.x === 7 && sim.state.bots[0].task !== "none")).toBeGreaterThan(0);
	});

});

describe("unreachable and starved work", () => {
	it("an unreachable rack does not wedge anyone: backoff doubles, and reachable work is still done", () => {
		const sim = world({ lifts: [[20, 0, 3]], racks: [[5, 14], [2, 14]] }); // floor 5 has no lift
		const lost = rackAt(sim, 5);
		const ok = rackAt(sim, 2);
		failRack(sim.state, lost, []);
		failRack(sim.state, ok, []);
		expect(until(sim, 3000, () => !ok.failed)).toBeGreaterThan(0);
		const wo = sim.state.workOrders.find((w) => w.facilityId === lost.id);
		expect(wo).toBeDefined();
		run(sim, 2000);
		expect(wo?.botId).toBe(-1);
		expect(wo?.attempts).toBeGreaterThanOrEqual(3);
		// Backoff is capped and strictly positive.
		expect(wo?.retryAt).toBeGreaterThan(sim.state.tick - 1);
		expect((wo?.retryAt ?? 0) - sim.state.tick).toBeLessThanOrEqual(720);
		// The bot is idle at its charger, not wandering.
		const bot = sim.state.bots[0];
		expect(["none", "charge"]).toContain(bot.task);
		expect(bot.floor).toBe(0);
		// Build the missing lift: the old order is finally served.
		exec(sim, { type: "buildLift", x: 24, floorMin: 3, floorMax: 5 });
		expect(until(sim, 6000, () => !lost.failed)).toBeGreaterThan(0);
	});

	it("backoff schedule: 30, 60, 120, … capped at 720", () => {
		expect([1, 2, 3, 4, 5, 6, 7, 50].map(backoffTicks)).toEqual([30, 60, 120, 240, 480, 720, 720, 720]);
		expect(backoffTicks(0)).toBe(30);
	});

	it("an empty depot: the bot waits, gives up after the stuck limit, backs off, and finishes once parts arrive", () => {
		const sim = world({ spareParts: 0 });
		const rack = rackAt(sim, 2);
		expect(rack).toBeUndefined(); // default rack is on floor 6
		const far = rackAt(sim, 6);
		failRack(sim.state, far, []);
		const bot = sim.state.bots[0];
		expect(until(sim, 1500, () => bot.x === bot.goalX && bot.task === "depot")).toBeGreaterThan(0);
		const arrivedAt = sim.state.tick;
		run(sim, BOT_STUCK_TICKS - 20);
		expect(bot.task).toBe("depot"); // still patiently waiting
		run(sim, 60);
		expect(sim.state.tick - arrivedAt).toBeGreaterThan(BOT_STUCK_TICKS);
		const wo = sim.state.workOrders[0];
		expect(wo.attempts).toBeGreaterThanOrEqual(1);
		expect(bot.workOrderId === -1 || wo.botId === bot.id).toBe(true);
		run(sim, 400);
		expect(far.failed).toBe(true);
		// Parts arrive: the repair completes.
		exec(sim, { type: "buyParts", count: 2 });
		expect(until(sim, 5000, () => !far.failed)).toBeGreaterThan(0);
	});

	it("no reachable depot: the order is not blamed, the bot waits at its charger with growing backoff", () => {
		// Depot on floor 4 (second lift), rack on floor 2 (first lift). Without lift 2 the depot is out of reach.
		const sim = world({ depotFloor: 4, racks: [[2, 14]] });
		exec(sim, { type: "demolish", floor: 3, x: 24 });
		const rack = rackAt(sim, 2);
		failRack(sim.state, rack, []);
		const bot = sim.state.bots[0];
		run(sim, 1200);
		const wo = sim.state.workOrders[0];
		expect(wo.attempts).toBe(0);
		expect(wo.botId).toBe(-1);
		expect(bot.fails).toBeGreaterThanOrEqual(3);
		expect(bot.retryAt).toBeGreaterThan(sim.state.tick - 1);
		expect(bot.retryAt - sim.state.tick).toBeLessThanOrEqual(720);
		expect(bot.floor).toBe(0);
		expect(["none", "charge"]).toContain(bot.task);
		// Rebuilding the lift lifts every backoff immediately.
		exec(sim, { type: "buildLift", x: 24, floorMin: 3, floorMax: 6 });
		expect(until(sim, 3000, () => !rack.failed)).toBeGreaterThan(0);
	});

	it("a frozen (unpowered) lift: the bot times out, releases the order and recovers when power returns", () => {
		const sim = world({ lifts: [[20, 0, 6]] });
		const rack = rackAt(sim, 6);
		const tie = facilityOf(sim, "grid_tie");
		failRack(sim.state, rack, []);
		const bot = sim.state.bots[0];
		expect(until(sim, 1500, () => bot.leg === "waitLift")).toBeGreaterThan(0);
		exec(sim, { type: "setEnabled", facilityId: tie.id, enabled: false });
		const t0 = sim.state.tick;
		const gaveUp = until(sim, BOT_STUCK_TICKS + 200, () => sim.state.workOrders[0].attempts > 0);
		expect(gaveUp).toBeGreaterThan(0);
		expect(sim.state.tick - t0).toBeGreaterThanOrEqual(BOT_STUCK_TICKS - 5);
		expect(sim.state.workOrders[0].botId).toBe(-1);
		exec(sim, { type: "setEnabled", facilityId: tie.id, enabled: true });
		expect(until(sim, 6000, () => !rack.failed)).toBeGreaterThan(0);
	});
});

describe("lift dispatch", () => {
	it("a full car does not reopen its doors at a crowded floor forever: it delivers its rider, then takes the next", () => {
		const content = chainContent({ lifts: [[20, 0, 6]], racks: [[6, 14], [5, 14]] });
		content.lift.capacity = 1;
		const sim = newSim(content, "chain", 3);
		exec(sim, { type: "buyBot", defId: "rover" });
		const racks = sim.state.facilities.filter((f) => f.defId === "rack_air_gpu");
		for (const r of racks) failRack(sim.state, r, []);
		let maxParked = 0;
		let parked = 0;
		let lastCar = Number.NaN;
		const t = until(sim, 2500, () => racks.every((r) => !r.failed), () => {
			const lift = sim.state.lifts[0];
			// Ticks the car sits still with a passenger aboard (while somebody else waits for it).
			parked = lift.riders.length > 0 && lift.carFloor === lastCar ? parked + 1 : 0;
			lastCar = lift.carFloor;
			maxParked = Math.max(maxParked, parked);
		});
		expect(t).toBeGreaterThan(0);
		expect(maxParked).toBeLessThanOrEqual(2 * content.lift.dwellTicks + 2);
	});

	it("riders whose exit floor is outside the shaft cannot strand the car", () => {
		const sim = world({ lifts: [[20, 0, 3]] });
		const bot = sim.state.bots[0];
		const lift = sim.state.lifts[0];
		lift.riders.push(bot.id);
		bot.leg = "ride";
		bot.liftId = lift.id;
		bot.exitFloor = 99;
		bot.floor = 0;
		bot.x = lift.x;
		run(sim, 200);
		expect(bot.leg).not.toBe("ride");
		expect(lift.riders).toHaveLength(0);
	});
});

describe("determinism and persistence with the new logistics", () => {
	it("snapshot mid-route (riding, backing off) restores identically", async () => {
		const { simFromSnapshot } = await import("./sim");
		const content = chainContent();
		const sim = newSim(content, "chain", 3);
		failRack(sim.state, rackAt(sim, 6), []);
		const bot = sim.state.bots[0];
		until(sim, 1500, () => bot.leg === "ride");
		const twin = simFromSnapshot(content, JSON.parse(JSON.stringify(sim.snapshot()))) as SimImpl;
		expect(twin.hash()).toBe(sim.hash());
		run(sim, 800);
		run(twin, 800);
		expect(twin.hash()).toBe(sim.hash());
	});
});
