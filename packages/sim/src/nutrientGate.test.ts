import { conduitTech, loadContent } from "@aitower/content";
import { describe, expect, it } from "vitest";
import { createSim } from "./sim";
import type { SimImpl } from "./sim";
import type { SimCommand } from "./api";

describe("nutrient piping is gated by the research that unlocks the nutrient plant", () => {
	it("rejects nutrient conduit before that research and accepts it after", () => {
		const content = loadContent();
		// The earliest, cheapest nutrient research: the Starter's Culture Bench, which needs no commit.
		const tech = conduitTech(content, "nutrient");
		expect(tech).toBe("culture_bench");
		const sim = createSim(content, "starter", 1) as SimImpl;
		sim.step();
		const cmd: SimCommand = { type: "buildConduit", layer: "nutrient", cells: [{ x: 10, floor: 0 }] };
		const before = sim.canBuild(cmd);
		expect(before.ok).toBe(false);
		if (!before.ok) expect(before.reason).toMatch(/^requires research: /);
		sim.state.techResearched.push(tech as string);
		sim.invalidateProjection();
		expect(sim.canBuild(cmd).ok).toBe(true);
		// Power piping is never gated.
		expect(sim.canBuild({ type: "buildConduit", layer: "power", cells: [{ x: 2, floor: 0 }] }).ok).toBe(true);
	});

	it("coolant piping needs the research that unlocks liquid cooling, and placed pipe stays", () => {
		const content = loadContent();
		const tech = Object.values(content.facilities).find((d) => d.kind === "chiller" && d.tech)?.tech as string;
		expect(tech).toBe("chilled_loop");
		const sim = createSim(content, "starter", 1) as SimImpl;
		sim.step();
		const cmd: SimCommand = { type: "buildConduit", layer: "coolant", cells: [{ x: 11, floor: 0 }] };
		const before = sim.canBuild(cmd);
		expect(before.ok).toBe(false);
		if (!before.ok) expect(before.reason).toMatch(/^requires research: /);
		// Pipe already in the ground is untouched by the gate (older saves).
		sim.state.coolant[11] = 1;
		expect(sim.state.coolant[11]).toBe(1);
		sim.state.techResearched.push(tech);
		sim.invalidateProjection();
		expect(sim.canBuild(cmd).ok).toBe(true);
	});
});
