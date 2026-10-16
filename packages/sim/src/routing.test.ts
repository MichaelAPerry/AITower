import { describe, expect, it } from "vitest";
import { beginSearch, createNav, ensureNav, routeTo, WALK_DIRECT } from "./logistics/routing";
import { cellCount } from "./core/grid";
import type { SimImpl } from "./sim";
import { chainContent, type ChainOptions } from "./test/chain";
import { newSim } from "./test/fixture";

function nav(o: ChainOptions) {
	const content = chainContent(o);
	const sim: SimImpl = newSim(content, "chain");
	const n = createNav(cellCount(sim.state));
	ensureNav(n, sim.state, content);
	const plan = (fromFloor: number, fromX: number, toFloor: number, toX: number, speed = 0.25) => {
		beginSearch(n, sim.state, content, speed, fromFloor, fromX);
		return routeTo(n, sim.state, toFloor, toX);
	};
	return { sim, n, plan, content };
}

describe("routing", () => {
	it("walks directly on one floor", () => {
		const { plan } = nav({});
		expect(plan(0, 2, 0, 12)).toMatchObject({ lift: WALK_DIRECT, cost: 40 });
	});

	it("chains two lifts: first hop is lift 1 exiting at the transfer floor 3", () => {
		const { plan, sim } = nav({});
		const r = plan(0, 7, 6, 14);
		expect(r).not.toBeNull();
		expect(r?.lift).toBe(sim.state.lifts[0].id);
		expect(r?.exit).toBe(3);
		// From the transfer floor the next hop is lift 2 straight to the goal floor.
		const next = plan(3, 20, 6, 14);
		expect(next?.lift).toBe(sim.state.lifts[1].id);
		expect(next?.exit).toBe(6);
	});

	it("goes down the chain too", () => {
		const { plan, sim } = nav({});
		const r = plan(6, 14, 0, 7);
		expect(r?.lift).toBe(sim.state.lifts[1].id);
		expect(r?.exit).toBe(3);
	});

	it("chooses by walk distance plus estimated waits: a near chain beats a far express, a near express beats a chain", () => {
		// Express lift far away (x=38) vs the chain at x=20/24.
		const far = nav({ lifts: [[20, 0, 3], [24, 3, 6], [38, 0, 6]] });
		const viaChain = far.plan(0, 7, 6, 14);
		expect(viaChain?.lift).toBe(far.sim.state.lifts[0].id);
		// Express lift right next to the bot.
		const near = nav({ lifts: [[20, 0, 3], [24, 3, 6], [8, 0, 6]] });
		const viaExpress = near.plan(0, 7, 6, 14);
		expect(viaExpress?.lift).toBe(near.sim.state.lifts[2].id);
		expect(viaExpress?.exit).toBe(6);
		// The cheaper route really is cheaper.
		expect(viaExpress?.cost).toBeLessThan(viaChain?.cost ?? 0);
	});

	it("is unreachable when floors are not connected, or the start/goal tile has no slab", () => {
		const gap = nav({ lifts: [[20, 0, 3]] });
		expect(gap.plan(0, 7, 5, 14)).toBeNull();
		expect(gap.plan(0, 7, 3, 14)).not.toBeNull();
		// Fractional start off the slab, goal off the slab.
		expect(gap.plan(0, 41, 0, 7)).toBeNull();
		expect(gap.plan(0, 7, 0, 99)).toBeNull();
		expect(gap.plan(9, 7, 0, 7)).toBeNull();
	});

	it("is deterministic and tie-breaks on the lowest lift", () => {
		const tie = nav({ lifts: [[16, 0, 6], [20, 0, 6]] });
		const a = tie.plan(0, 18, 6, 18);
		const b = tie.plan(0, 18, 6, 18);
		expect(a).toEqual(b);
		expect(a?.lift).toBe(tie.sim.state.lifts[0].id);
	});

	it("rebuilds only when the topology changes", () => {
		const { sim, n, content } = nav({});
		const run = n.run;
		const before = n.rev;
		ensureNav(n, sim.state, content);
		expect(n.rev).toBe(before);
		sim.state.topologyRev++;
		ensureNav(n, sim.state, content);
		expect(n.rev).toBe(before + 1);
		expect(n.run).toBe(run); // buffer reused
	});
});
