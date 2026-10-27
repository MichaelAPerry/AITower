import { describe, expect, it } from "vitest";
import { loadContent } from "./load";
import { AIR_TOPS_OUT, facilityTier, outputShare, rackLine, tierNote, tierRank } from "./tier";

const content = loadContent();
const all = Object.values(content.facilities);
const tier = (id: string) => facilityTier(content.facilities[id], content);

describe("facility tier", () => {
	it("gives every facility exactly one tier", () => {
		for (const d of all) {
			const t = facilityTier(d, content);
			expect(["standard", "advanced", "frontier", "path"]).toContain(t.tier);
			expect(t.path !== undefined).toBe(t.tier === "path");
		}
	});
	it("matches the ladder in the design doc", () => {
		expect(tier("rack_air_gpu").tier).toBe("standard");
		expect(tier("rack_air_gpu2").tier).toBe("standard");
		expect(tier("rack_dlc_gpu").tier).toBe("standard");
		expect(tier("crah_unit").tier).toBe("standard");
		expect(tier("grid_tie_2").tier).toBe("standard");
		expect(tier("rack_infer").tier).toBe("advanced");
		expect(tier("rack_dlc_gpu2").tier).toBe("advanced");
		expect(tier("chiller_tower").tier).toBe("advanced");
		expect(tier("genset_gas").tier).toBe("advanced");
		expect(tier("rack_dlc_gpu3").tier).toBe("frontier");
		expect(tier("grid_tie_4").tier).toBe("frontier");
	});
	it("puts path-gated items on their path at any Level", () => {
		expect(tier("organoid_incubator")).toEqual({ tier: "path", path: "biotech" });
		expect(tier("neural_pit")).toEqual({ tier: "path", path: "biotech" });
		expect(tier("solar_skin")).toEqual({ tier: "path", path: "greentech" });
		expect(tier("rack_photonic").tier).toBe("path");
		expect(tier("rack_mind_lattice")).toEqual({ tier: "path", path: "synthetic" });
		expect(tier("chiller_free")).toEqual({ tier: "path", path: "greentech" });
	});
	it("ranks the ladder and leaves Path off it", () => {
		expect(tierRank("standard")).toBeLessThan(tierRank("advanced"));
		expect(tierRank("advanced")).toBeLessThan(tierRank("frontier"));
		expect(tierRank("path")).toBe(-1);
	});
	it("computes the output bar against the best of its kind", () => {
		expect(outputShare(content.facilities.rack_mind_lattice, content)).toBe(1);
		expect(outputShare(content.facilities.rack_dlc_gpu3, content)).toBeCloseTo(420 / 1400, 5);
		const ac1 = outputShare(content.facilities.rack_air_gpu, content) as number;
		expect(ac1).toBeGreaterThan(0);
		expect(ac1).toBeLessThan(0.05);
		expect(outputShare(content.facilities.rack_storage, content)).toBeNull();
	});
	it("labels where air stops improving and names the racks' lines", () => {
		expect(tierNote(content.facilities.rack_infer)).toBe(AIR_TOPS_OUT);
		expect(tierNote(content.facilities.rack_dlc_gpu2)).toBeUndefined();
		expect(rackLine(content.facilities.rack_air_gpu)).toBe("air");
		expect(rackLine(content.facilities.rack_dlc_gpu)).toBe("liquid");
		expect(rackLine(content.facilities.rack_storage)).toBeNull();
	});
});
