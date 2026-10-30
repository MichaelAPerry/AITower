import { describe, expect, it } from "vitest";
import { loadContent } from "@aitower/content";
import type { EndingDef } from "@aitower/content";
import { type GameOver, endingOf } from "../gameover/gameOver";
import { BACKDROP, ENDING_ART, LOCATION_ART, LOCATION_FILES, endingBackdrop, sceneBackdrop } from "./index";

describe("art registries", () => {
	it("every mapped location file and every ending art name has an image", () => {
		for (const [scene, name] of Object.entries(LOCATION_ART)) expect(LOCATION_FILES[name], `${scene} -> ${name}`).toBeTruthy();
		for (const e of loadContent().endings) expect(e.art && ENDING_ART[e.art], e.id).toBeTruthy();
	});
	it("Bankrupt (a game over with a kind and no ending id) resolves to its own painting", () => {
		const id = endingOf({ kind: "bankrupt" } as GameOver);
		expect(id).toBe("bankrupt");
		const ending = loadContent().endings.find((e) => e.id === id);
		expect(endingBackdrop(ending as EndingDef)).toBe(ENDING_ART["bg-end-bankrupt"]);
	});
});

describe("sceneBackdrop", () => {
	it("uses the location painting when its file exists", () => {
		expect(LOCATION_ART.st_intro).toBe("bg-loc-f1-lot");
		expect(sceneBackdrop("st_intro")).toBe(LOCATION_FILES["bg-loc-f1-lot"]);
		expect(sceneBackdrop("st_intro", "greentech")).toBe(LOCATION_FILES["bg-loc-f1-lot"]);
	});
	it("falls back to the tree backdrop when the mapped file is missing", () => {
		expect(sceneBackdrop("rung_green_3", "greentech", {})).toBe(BACKDROP.greentech);
		expect(sceneBackdrop("rung_green_3", undefined, {})).toBeUndefined();
	});
	it("falls back for unmapped scenes", () => {
		expect(sceneBackdrop("not_a_scene", "biotech")).toBe(BACKDROP.biotech);
		expect(sceneBackdrop("not_a_scene")).toBeUndefined();
	});
	it("resolves through an injected file table", () => {
		expect(sceneBackdrop("rung_syn_1", "synthetic", { "bg-loc-control-room": "x.webp" })).toBe("x.webp");
	});
});
