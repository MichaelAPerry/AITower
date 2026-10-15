import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { heatColor } from "./color";
import { HEAT_RAMP, T, dk, lt, mat, mix } from "./palette";

describe("palette", () => {
	it("tokens match docs/STYLE.md §2 exactly", () => {
		const style = readFileSync(new URL("../../../docs/STYLE.md", import.meta.url), "utf8");
		const rows = [...style.matchAll(/\|\s*`--([a-z-]+)`\s*\|\s*`#([0-9a-f]{6})`/gi)];
		expect(rows.length).toBeGreaterThanOrEqual(21);
		const camel = (k: string) => k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
		for (const [, name, hexv] of rows) expect((T as Record<string, number>)[camel(name)], name).toBe(Number.parseInt(hexv, 16));
	});

	it("heat ramp hits the STYLE.md stops", () => {
		[18, 24, 30, 36, 42, 50].forEach((c, i) => expect(heatColor(c)).toBe(HEAT_RAMP[i]));
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
