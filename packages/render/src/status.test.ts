import type { FacilityStatus } from "@aitower/sim";
import { describe, expect, it } from "vitest";
import { heatColor, rackTempColor } from "./color";
import { CB } from "./palette";
import { CRT_GLYPHS, FROST, LED, LED_CB, type CrtGlyph, badgeFor, crtGlyph, ledCue, phosphorFor } from "./status";

const ALL: FacilityStatus[] = ["ok", "idle", "throttled", "brownout", "noCoolant", "tripped", "failed", "disabled", "unpowered"];

describe("status cues", () => {
	it("default scheme: green ok, amber warnings, red faults, dim idle", () => {
		expect(ledCue("ok", true).color).toBe(LED.ok);
		expect(ledCue("throttled", true).color).toBe(LED.amber);
		expect(ledCue("tripped", true).color).toBe(LED.red);
		expect(ledCue("idle", true).color).toBe(LED.idle);
	});

	it("colour-blind scheme: blue ok, orange warnings, vermilion faults, dim blue idle", () => {
		expect(ledCue("ok", true, true).color).toBe(LED_CB.ok);
		expect(ledCue("throttled", true, true).color).toBe(LED_CB.amber);
		expect(ledCue("tripped", true, true).color).toBe(LED_CB.red);
		expect(ledCue("idle", true, true).color).toBe(LED_CB.idle);
		// Blue/orange only: no green or red lamp survives in the colour-blind scheme.
		for (const s of ALL) {
			const c = ledCue(s, true, true).color;
			expect([LED.ok, LED.red, LED.idle, LED.amber]).not.toContain(c);
		}
		expect(LED_CB.ok).toBe(CB.blue);
		expect(LED_CB.amber).toBe(CB.orange);
	});

	it("modes do not depend on the colour scheme", () => {
		for (const s of ALL) for (const enabled of [true, false]) expect(ledCue(s, enabled, true).mode).toBe(ledCue(s, enabled).mode);
		expect(ledCue("failed", true, true).mode).toBe("blink");
		expect(ledCue("unpowered", true, true).mode).toBe("off");
		expect(ledCue("ok", false, true).mode).toBe("off");
	});

	it("tones group statuses by health, not colour", () => {
		expect(ledCue("ok", true).tone).toBe("ok");
		expect(ledCue("brownout", true).tone).toBe("warn");
		expect(ledCue("noCoolant", true).tone).toBe("warn");
		expect(ledCue("failed", true).tone).toBe("fault");
		expect(ledCue("idle", true).tone).toBe("idle");
		expect(ledCue("disabled", true).tone).toBe("off");
		expect(ledCue("ok", false).tone).toBe("off");
	});

	it("the activity accent is the warm lamp in either scheme", () => {
		expect(ledCue("ok", true).accent).toBe(LED.amber);
		expect(ledCue("ok", true, true).accent).toBe(LED_CB.amber);
	});

	it("phosphor pairs follow the tone and the scheme", () => {
		expect(phosphorFor("ok")[0]).toBe(LED.ok);
		expect(phosphorFor("fault")[0]).toBe(LED.red);
		expect(phosphorFor("ok", true)[0]).toBe(LED_CB.ok);
		expect(phosphorFor("warn", true)[0]).toBe(LED_CB.amber);
		expect(phosphorFor("fault", true)[0]).toBe(LED_CB.red);
		for (const tone of ["ok", "warn", "fault", "idle", "off"] as const) {
			const [lit, dim] = phosphorFor(tone, true);
			expect(lit).not.toBe(dim);
		}
	});
});

describe("CRT glyphs", () => {
	it("selects ✓ ok, ▲ throttled, ✕ tripped/failed, ○ idle for the matching statuses", () => {
		expect(crtGlyph("ok")).toBe("ok");
		expect(crtGlyph("throttled")).toBe("throttled");
		expect(crtGlyph("brownout")).toBe("throttled");
		expect(crtGlyph("noCoolant")).toBe("throttled");
		expect(crtGlyph("tripped")).toBe("fault");
		expect(crtGlyph("failed")).toBe("fault");
		expect(crtGlyph("idle")).toBe("idle");
	});

	it("shows no glyph for unpowered or disabled racks", () => {
		expect(crtGlyph("unpowered")).toBeNull();
		expect(crtGlyph("disabled")).toBeNull();
	});

	it("every glyph is a 3×3 bitmap with distinct shapes", () => {
		const names = Object.keys(CRT_GLYPHS) as CrtGlyph[];
		const shapes = names.map((n) => CRT_GLYPHS[n].join("/"));
		expect(new Set(shapes).size).toBe(names.length);
		for (const n of names) {
			expect(CRT_GLYPHS[n]).toHaveLength(3);
			for (const row of CRT_GLYPHS[n]) expect(row).toMatch(/^[.X]{3}$/);
		}
	});

	it("glyph choice agrees with the lamp tone for every status", () => {
		const tones: Record<string, CrtGlyph | null> = { ok: "ok", warn: "throttled", fault: "fault", idle: "idle", off: null };
		for (const s of ALL) {
			const cue = ledCue(s, true);
			expect(crtGlyph(s)).toBe(tones[cue.tone]);
		}
	});
});

describe("colour-blind ramps are wired through status and temperature", () => {
	it("rack temperature and heat use the plasma endpoints in colour-blind mode", () => {
		expect(rackTempColor(40, true)).toBe(0x0d0887);
		expect(rackTempColor(100, true)).toBe(0xf0f921);
		expect(heatColor(18, true)).toBe(0x0d0887);
		expect(heatColor(50, true)).toBe(0xf0f921);
	});
});

describe("wetware statuses (M3)", () => {
	it("noNutrient: slow bile blink; tooCold: steady frost-blue lamp", () => {
		expect(ledCue("noNutrient", true)).toMatchObject({ color: LED.starved, mode: "blink", tone: "starved" });
		expect(ledCue("tooCold", true)).toMatchObject({ color: FROST, mode: "steady", tone: "cold" });
		expect(LED.cold).toBe(FROST);
		// Frost is pale blue: blue channel dominates and it is light.
		expect(FROST & 0xff).toBeGreaterThan((FROST >> 16) & 0xff);
		expect(FROST & 0xff).toBeGreaterThan(0xa0);
	});
	it("colour-blind scheme avoids the default greens and reds for the new statuses", () => {
		for (const s of ["noNutrient", "tooCold"] as const) expect([LED.ok, LED.red, LED.idle, LED.amber, LED.starved, LED.cold]).not.toContain(ledCue(s, true, true).color);
		expect(ledCue("noNutrient", true, true).color).toBe(LED_CB.starved);
		expect(ledCue("tooCold", true, true).color).toBe(LED_CB.cold);
	});
	it("each gets its own CRT glyph and phosphor, plus a badge", () => {
		expect(crtGlyph("noNutrient")).toBe("starved");
		expect(crtGlyph("tooCold")).toBe("frost");
		expect(phosphorFor("starved")[0]).toBe(LED.starved);
		expect(phosphorFor("cold", true)[0]).toBe(LED_CB.cold);
		for (const tone of ["starved", "cold"] as const) for (const cb of [false, true]) expect(phosphorFor(tone, cb)[0]).not.toBe(phosphorFor(tone, cb)[1]);
		expect(badgeFor("noNutrient")).toBe("noNutrient");
		expect(badgeFor("tooCold")).toBe("tooCold");
		expect(badgeFor("ok")).toBeNull();
	});
	it("glyph choice still agrees with the tone", () => {
		const tones: Record<string, CrtGlyph | null> = { starved: "starved", cold: "frost" };
		for (const s of ["noNutrient", "tooCold"] as const) expect(crtGlyph(s)).toBe(tones[ledCue(s, true).tone]);
	});
});
