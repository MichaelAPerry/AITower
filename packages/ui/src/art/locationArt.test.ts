import { describe, expect, it } from "vitest";
import { BACKDROP, LOCATION_ART, LOCATION_FILES, sceneBackdrop } from "./index";

describe("sceneBackdrop", () => {
	it("uses the location painting when its file exists", () => {
		expect(LOCATION_ART.st_intro).toBe("bg-loc-f1-lot");
		expect(sceneBackdrop("st_intro")).toBe(LOCATION_FILES["bg-loc-f1-lot"]);
		expect(sceneBackdrop("st_intro", "greentech")).toBe(LOCATION_FILES["bg-loc-f1-lot"]);
	});
	it("falls back to the tree backdrop when the mapped file is missing", () => {
		expect(LOCATION_FILES["bg-loc-stairwell"]).toBeUndefined();
		expect(sceneBackdrop("rung_green_3", "greentech")).toBe(BACKDROP.greentech);
		expect(sceneBackdrop("rung_green_3")).toBeUndefined();
	});
	it("falls back for unmapped scenes", () => {
		expect(sceneBackdrop("not_a_scene", "biotech")).toBe(BACKDROP.biotech);
		expect(sceneBackdrop("not_a_scene")).toBeUndefined();
	});
	it("resolves through an injected file table", () => {
		expect(sceneBackdrop("rung_syn_1", "synthetic", { "bg-loc-control-room": "x.webp" })).toBe("x.webp");
	});
});
