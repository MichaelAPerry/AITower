import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { heatColor } from "./color";
import { CB, HEAT_RAMP, HEAT_RAMP_CB, T, dk, lt, mat, mix } from "./palette";

describe("palette", () => {
	it("tokens match docs/STYLE_PC98.md (bg, text, accent, accent-2, good, warn, bad)", () => {
		const doc = readFileSync(new URL("../../../docs/STYLE_PC98.md", import.meta.url), "utf8");
		const val = (name: string): number => {
			const m = new RegExp(`--${name}[\u0060][\\s|]*#([0-9a-f]{6})`, "i").exec(doc);
			if (!m) throw new Error(`token ${name} missing`);
			return Number.parseInt(m[1], 16);
		};
		expect(T.ink).toBe(val("bg"));
		expect(T.paper).toBe(val("text"));
		expect(T.brass).toBe(val("accent"));
		expect(T.accent2).toBe(val("accent-2"));
		expect(T.green).toBe(val("good"));
		expect(T.red).toBe(val("bad"));
		expect(T.amber).toBe(val("warn"));
	});

	it("keeps exactly three horror tokens: flesh, bile, blood", () => {
		expect(T.flesh).toBe(0xb5877a);
		expect(T.bile).toBe(0x8a8a3a);
		expect(T.blood).toBe(0x6a2c22);
	});

	it("heat ramp hits the STYLE.md stops", () => {
		[18, 24, 30, 36, 42, 50].forEach((c, i) => {
			expect(heatColor(c)).toBe(HEAT_RAMP[i]);
		});
	});

	it("colour-blind heat ramp is plasma, stop for stop with the default ramp", () => {
		expect(HEAT_RAMP_CB).toEqual([0x0d0887, 0x6a00a8, 0xb12a90, 0xe16462, 0xfca636, 0xf0f921]);
		expect(HEAT_RAMP_CB).toHaveLength(HEAT_RAMP.length);
		[18, 24, 30, 36, 42, 50].forEach((c, i) => {
			expect(heatColor(c, true)).toBe(HEAT_RAMP_CB[i]);
		});
	});

	it("colour-blind tokens are the Okabe-Ito blue and orange plus a vermilion fault", () => {
		expect(CB.blue).toBe(0x56b4e9);
		expect(CB.orange).toBe(0xe69f00);
		expect(CB.vermilion).toBe(0xff6a1a);
	});

	it("shades mix toward ink / paper", () => {
		expect(mix(0x000000, 0xffffff, 0.5)).toBe(0x808080);
		expect(dk(T.brass, 1)).toBe(T.ink);
		expect(lt(T.brass, 1)).toBe(T.paper);
		const m = mat(T.copper);
		expect(m.mid).toBe(T.copper);
		expect(new Set([m.hi, m.mid, m.lo, m.dk, m.line]).size).toBe(5);
	});
});
