import { describe, expect, it } from "vitest";
import { droughtSky, skyColors } from "./color";
import { MOSS_DENSITY, ROOF_DENSITY, RotorPhases, TANK_DENSITY, VINE_DENSITY, carbonVariant, cellHas, daylight, heatVariant, mastCount, rotorOmega, solarGlow, solarVariant, windLevel } from "./green";
describe("daylight and solar", () => {
    it("is dark from 20:00 to 06:00 and peaks at 13:00", () => {
        expect([0, 300, 360, 1200, 1300].map(daylight)).toEqual([0, 0, 0, 0, 0]);
        expect(daylight(780)).toBeCloseTo(1, 6);
        expect(daylight(600)).toBeGreaterThan(0);
        expect(daylight(780 + 1440)).toBeCloseTo(1, 6);
        expect(daylight(Number.NaN)).toBe(0);
    });
    it("panels are dark at night, dimmed in a drought and dark when not producing", () => {
        expect(solarGlow(0, false, true)).toBe(0);
        expect(solarGlow(780, false, true)).toBeCloseTo(1, 6);
        expect(solarGlow(780, true, true)).toBeLessThan(0.2);
        expect(solarGlow(780, false, false)).toBe(0);
    });
});
describe("wind", () => {
    it("stays in 0.2..1 and varies; a drought or an unusable mast stops the rotors", () => {
        const levels = Array.from({ length: 48 }, (_, i) => windLevel(i * 60, false, true));
        expect(Math.min(...levels)).toBeGreaterThanOrEqual(0.2);
        expect(Math.max(...levels)).toBeLessThanOrEqual(1);
        expect(new Set(levels.map((l) => l.toFixed(3))).size).toBeGreaterThan(10);
        expect(windLevel(500, true, true)).toBe(0);
        expect(windLevel(500, false, false)).toBe(0);
        expect(windLevel(Number.NaN, false, true)).toBe(0);
    });
    it("is smooth: neighbouring ticks barely differ", () => {
        for (let t = 0; t < 600; t += 7)
            expect(Math.abs(windLevel(t + 1, false, true) - windLevel(t, false, true))).toBeLessThan(0.05);
    });
    it("rotor speed follows output; zero stops", () => {
        expect(rotorOmega(0)).toBe(0);
        expect(rotorOmega(1)).toBeGreaterThan(rotorOmega(0.4));
        expect(rotorOmega(9)).toBe(rotorOmega(1));
    });
    it("rotor phase integrates: no jump when the speed changes, frozen at 0", () => {
        const r = new RotorPhases();
        const p0 = r.at(1, 10, 2);
        const p1 = r.at(1, 10.2, 2);
        expect(p1 - p0).toBeCloseTo(0.4, 6);
        expect(r.at(1, 20, 2) - p1).toBeCloseTo(0.5, 6); // a long gap (hidden tab) is clamped, not a jump
        const p2 = r.at(1, 11, 0);
        const p3 = r.at(1, 12, 0);
        expect(p3).toBe(p2);
        expect(r.at(2, 0, 1)).not.toBe(r.at(1, 12, 0));
    });
});
describe("decals and variants", () => {
    it("a higher stage only adds cells (decals never move)", () => {
        for (const table of [MOSS_DENSITY, VINE_DENSITY, TANK_DENSITY, ROOF_DENSITY]) {
            for (let x = 0; x < 30; x++) {
                for (let s = 1; s <= 4; s++) {
                    if (cellHas(table, (s - 1), x, 2, 1))
                        expect(cellHas(table, s, x, 2, 1)).toBe(true);
                }
            }
        }
    });
    it("each decal starts at its stage: moss 25 %, vines 50 %, tanks 75 %, roof garden 100 %", () => {
        const first = (table) => table.findIndex((d) => d > 0);
        expect([MOSS_DENSITY, VINE_DENSITY, TANK_DENSITY, ROOF_DENSITY].map(first)).toEqual([1, 2, 3, 4]);
        let any = 0;
        for (let x = 0; x < 200; x++)
            if (cellHas(MOSS_DENSITY, 4, x, 0, 1))
                any++;
        expect(any).toBeGreaterThan(100);
        expect(cellHas(MOSS_DENSITY, 0, 3, 0, 1)).toBe(false);
    });
    it("variants follow the width", () => {
        expect([solarVariant(4), solarVariant(8)]).toEqual(["facade", "canopy"]);
        expect([heatVariant(3), heatVariant(6)]).toEqual(["exchanger", "pipeline"]);
        expect([carbonVariant(4), carbonVariant(6)]).toEqual(["algae", "plant"]);
        expect([mastCount(1), mastCount(2), mastCount(4), mastCount(5)]).toEqual([1, 1, 2, 2]);
    });
});
describe("drought sky", () => {
    it("is the same sky at 0, and dimmer and flatter at 1", () => {
        const s = skyColors(780);
        expect(droughtSky(s, 0)).toBe(s);
        const d = droughtSky(s, 1);
        const lum = (c) => ((c >> 16) & 255) + ((c >> 8) & 255) + (c & 255);
        const spread = (a) => Math.abs(lum(a.top) - lum(a.horizon));
        expect(spread(d)).toBeLessThan(spread(s) + 1);
        expect(d.night).toBe(s.night);
        expect(lum(d.top)).not.toBe(lum(s.top));
    });
});
