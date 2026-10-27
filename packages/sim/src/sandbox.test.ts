import { loadContent } from "@aitower/content";
import { describe, expect, it } from "vitest";
import { createSim } from "./sim";

const content = loadContent();

describe("sandbox scenario", () => {
	it("starts from the same lot as the starter scenario, with the sandbox money and Level", () => {
		const sandbox = createSim(content, "sandbox", 1, {});
		const starter = createSim(content, "starter", 1, {});
		const defs = (s: typeof sandbox) => s.view().facilities.map((f) => `${f.defId}@${f.floor},${f.x}`).sort();
		expect(defs(sandbox)).toEqual(defs(starter));
		expect(sandbox.view().sandbox).toBe(true);
		expect(sandbox.view().tier).toBe(5);
	});

	it("keeps its offers past their expiry: no contract deadline pressure", () => {
		const sim = createSim(content, "sandbox", 1, {});
		sim.step();
		const ids = sim.view().offers.map((o) => o.id);
		expect(ids.length).toBeGreaterThan(0);
		for (let i = 0; i < content.balance.economy.offerExpiryTicks + 10; i++) sim.step();
		const after = sim.view().offers.map((o) => o.id);
		for (const id of ids) expect(after).toContain(id);
	});
});
