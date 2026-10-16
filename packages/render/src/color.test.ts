import { describe, expect, it } from "vitest";
import { alertColor, heatColor, hex, lerpColor, loadColor, netColor, rackTempColor, ramp, rgb, satisfactionColor, skyColors } from "./color";
import { CB, HEAT_RAMP, HEAT_RAMP_CB, T } from "./palette";

const r = (c: number) => (c >> 16) & 0xff;
const b = (c: number) => c & 0xff;

describe("colour", () => {
	it("parses hex", () => {
		expect(hex("#ff8000")).toBe(0xff8000);
		expect(hex("00ff00")).toBe(0x00ff00);
		expect(hex("bad")).toBe(0xff00ff);
	});

	it("lerps channels and clamps t", () => {
		expect(lerpColor(0x000000, 0xffffff, 0.5)).toBe(rgb(128, 128, 128));
		expect(lerpColor(0x102030, 0xffffff, -1)).toBe(0x102030);
		expect(lerpColor(0x102030, 0xffffff, 2)).toBe(0xffffff);
	});

	it("ramp clamps to end stops", () => {
		const s = [
			[0, 0x000000],
			[10, 0xffffff],
		] as const;
		expect(ramp(s, -5)).toBe(0);
		expect(ramp(s, 50)).toBe(0xffffff);
	});

	it("heat ramp follows the STYLE.md stops: cold blue, amber 30, red 42, cream-hot", () => {
		expect(b(heatColor(10))).toBeGreaterThan(r(heatColor(10)));
		expect(heatColor(30)).toBe(0xffb000);
		const hot = heatColor(42);
		expect(r(hot)).toBe(255);
		expect(b(hot)).toBeLessThan(80);
		expect(heatColor(50)).toBe(0xfff2c4);
		expect(heatColor(60)).toBe(0xfff2c4);
	});

	it("rack temperature ramp hits its stops and clamps at the ends", () => {
		[40, 60, 75, 85, 92, 100].forEach((c, i) => {
			expect(rackTempColor(c)).toBe(HEAT_RAMP[i]);
		});
		expect(rackTempColor(10)).toBe(HEAT_RAMP[0]);
		expect(rackTempColor(200)).toBe(HEAT_RAMP[5]);
	});

	it("colour-blind mapping swaps only the palette: same °C stops, plasma colours", () => {
		[18, 24, 30, 36, 42, 50].forEach((c, i) => {
			expect(heatColor(c, true)).toBe(HEAT_RAMP_CB[i]);
		});
		expect(rackTempColor(40, true)).toBe(HEAT_RAMP_CB[0]);
		expect(rackTempColor(100, true)).toBe(HEAT_RAMP_CB[5]);
		expect(rackTempColor(85, true)).toBe(HEAT_RAMP_CB[3]);
		expect(rackTempColor(-50, true)).toBe(HEAT_RAMP_CB[0]);
		expect(rackTempColor(500, true)).toBe(HEAT_RAMP_CB[5]);
		expect(heatColor(30, false)).toBe(0xffb000);
	});

	it("colour-blind satisfaction: vermilion at 0, paper at 0.5, blue at 1 (no red or green)", () => {
		expect(satisfactionColor(0, true)).toBe(CB.vermilion);
		expect(satisfactionColor(0.5, true)).toBe(T.paper);
		expect(satisfactionColor(1, true)).toBe(CB.blue);
		for (let s = 0; s <= 1; s += 0.05) expect([T.red, T.green, T.amber]).not.toContain(satisfactionColor(s, true));
		expect(satisfactionColor(0)).toBe(T.red);
	});

	it("colour-blind load: blue when light, orange at 0.8, vermilion at full", () => {
		expect(loadColor(0, true)).toBe(CB.blue);
		expect(loadColor(0.8, true)).toBe(CB.orange);
		expect(loadColor(1, true)).toBe(CB.vermilion);
		expect(loadColor(2, true)).toBe(CB.vermilion);
		expect(loadColor(0)).toBe(T.green);
		expect(loadColor(1)).toBe(T.red);
	});

	it("alert colour follows the scheme", () => {
		expect(alertColor(false)).toBe(T.red);
		expect(alertColor(true)).toBe(CB.vermilion);
	});

	it("satisfaction: red at 0, green at 1", () => {
		expect(r(satisfactionColor(0))).toBe(255);
		expect((satisfactionColor(1) >> 8) & 0xff).toBeGreaterThan(200);
	});

	it("net colours are stable and distinct for small ids", () => {
		expect(netColor(3)).toBe(netColor(3));
		expect(new Set([0, 1, 2, 3, 4].map(netColor)).size).toBe(5);
		expect(netColor(-1)).toBeTypeOf("number");
	});

	it("sky is dark at midnight and bright at noon", () => {
		expect(skyColors(0).night).toBe(1);
		expect(skyColors(720).night).toBe(0);
		expect(b(skyColors(720).top)).toBeGreaterThan(b(skyColors(0).top));
		expect(skyColors(1440 + 720)).toEqual(skyColors(720));
	});
});
