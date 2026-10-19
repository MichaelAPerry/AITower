import { loadContent } from "@aitower/content";
import { describe, expect, it } from "vitest";
import { createSim } from "./sim";
import type { SimImpl } from "./sim";
import type { SimCommand } from "./api";

describe("nutrient piping is gated by the research that unlocks the nutrient plant", () => {
	it("rejects nutrient conduit before that research and accepts it after", () => {
		const content = loadContent();
		const plant = Object.values(content.facilities).find((d) => d.kind === "nutrient" && d.tech);
		expect(plant?.tech).toBeTruthy();
		const sim = createSim(content, "starter", 1) as SimImpl;
		sim.step();
		const cmd: SimCommand = { type: "buildConduit", layer: "nutrient", cells: [{ x: 10, floor: 0 }] };
		const before = sim.canBuild(cmd);
		expect(before.ok).toBe(false);
		if (!before.ok) expect(before.reason).toMatch(/^requires research: /);
		sim.state.techResearched.push(plant?.tech as string);
		sim.invalidateProjection();
		expect(sim.canBuild(cmd).ok).toBe(true);
		// Power and coolant piping are never gated.
		expect(sim.canBuild({ type: "buildConduit", layer: "coolant", cells: [{ x: 11, floor: 0 }] }).ok).toBe(true);
	});
});
