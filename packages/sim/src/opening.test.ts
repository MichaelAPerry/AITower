import { loadContent } from "@aitower/content";
import { describe, expect, it } from "vitest";
import { SimImpl } from "./sim";
import { createState } from "./world/init";

const content = loadContent();
// Lesson sites are scripted: they hold no random offers.
const ids = Object.values(content.scenarios).filter((s) => !s.lesson).map((s) => s.id);

describe("opening offer", () => {
	it("every scenario starts with at least one offer at tick 0", () => {
		for (const id of ids) expect(createState(content, id, 7).offers.length, id).toBeGreaterThanOrEqual(1);
	});

	it("default scenario: accepting the first offer earns income within 60 ticks", () => {
		for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
			const sim = new SimImpl(content, createState(content, ids[0], seed));
			const offer = sim.state.offers[0];
			expect(offer.spec.needsLiquid, `seed ${seed}`).toBe(false);
			sim.step();
			const r = sim.submit({ type: "acceptContract", contractId: offer.id });
			expect(r, `seed ${seed}`).toMatchObject({ ok: true });
			let running = false;
			for (let i = 0; i < 60; i++) {
				sim.step();
				if (sim.state.jobs.some((j) => j.rackIds.length > 0)) running = true;
			}
			expect(running, `seed ${seed}`).toBe(true);
			expect(sim.state.today.revenue, `seed ${seed}`).toBeGreaterThan(0);
		}
	});

	it("is deterministic", () => {
		const a = createState(content, ids[0], 3).offers;
		const b = createState(content, ids[0], 3).offers;
		expect(a).toEqual(b);
	});
});
