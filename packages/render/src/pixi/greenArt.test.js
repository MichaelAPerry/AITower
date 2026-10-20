import { describe, expect, it } from "vitest";
import { NATIVE_WIDTH, artSpec, bodyArt } from "../art";
import { FAC_BOTTOM, FAC_TOP, TILE } from "../constants";
import { fixtureContent } from "../dev/fixtureView";
import { VARIETY_ROWS, varietyContent, varietyId } from "../dev/varietyScene";
import { NO_FX } from "../horror";
import { skinEffects } from "../skin";
import { drawBody, drawLive } from "./facilityArt";
import { solarCells, tankRect, tubeLayout, windOmega } from "./greenArt";
/** Records every rect a drawing routine paints. */
function recorder() {
    const rects = [];
    const g = {
        clear() { },
        rect(x, y, w, h) {
            rects.push({ x, y, w, h });
            return g;
        },
        fill() {
            return g;
        },
    };
    return { g: g, rects };
}
const content = varietyContent(fixtureContent);
const TOP = 100;
const BODY_Y = TOP + FAC_TOP;
const KINDS = ["solar", "wind", "heat_export", "carbon"];
const defOf = (kind, width) => {
    const row = VARIETY_ROWS.find((r) => r.kind === kind);
    if (!row)
        throw new Error(kind);
    const base = content.facilities[varietyId(row, 2, row.widths[0])];
    return { ...base, width };
};
/** Collected, not asserted per rect: thousands of expect() calls made a test time out on CI. */
const outside = (rects, W, yMin) => rects.filter((q) => !(Number.isFinite(q.x + q.y + q.w + q.h) && q.x >= 0 && q.x + q.w <= W && q.y >= yMin && q.y + q.h <= TOP + FAC_BOTTOM)).map((q) => `${q.x},${q.y} ${q.w}x${q.h}`);
const view = (id, def, status = "ok", extra = {}) => ({ id, defId: def.id, floor: 0, x: 0, width: def.width, enabled: true, status, tempC: 24, clock: 1, health: 1, powerKw: 0, heatKw: 200, jobId: null, powerNet: 0, coolantNet: null, nutrientNet: null, grown: false, contamination: 0, ...extra });
const OPT = { reducedMotion: false, crtEffects: false, colorBlind: false, horrorIntensity: "full" };
describe("green kinds: art selection", () => {
    it("each kind picks its own body, and variants follow the width", () => {
        for (const kind of KINDS)
            expect(bodyArt(defOf(kind, 4))).toBe(kind);
        expect(artSpec(defOf("solar", 4)).kind).toBe("solar");
    });
    it("the variety scene has every green kind at two widths and every tier", () => {
        for (const kind of KINDS) {
            const row = VARIETY_ROWS.find((r) => r.kind === kind);
            expect(row?.widths.length).toBe(2);
            for (const tier of [1, 2, 3, 4])
                for (const w of row?.widths ?? [])
                    expect(content.facilities[varietyId(row, tier, w)]).toMatchObject({ kind, width: w, unlockTier: tier });
        }
    });
    it("layout helpers stay inside the body and are cached", () => {
        for (const w of [1, 2, 4, 6, 8]) {
            const cells = solarCells(w * TILE);
            expect(solarCells(w * TILE)).toBe(cells);
            expect(cells.length).toBeGreaterThan(0);
            expect(cells.every((c) => c.x >= 0 && c.x + c.w <= w * TILE && c.y >= 0 && c.y + c.h <= FAC_BOTTOM - FAC_TOP)).toBe(true);
            const t = tubeLayout(w * TILE);
            expect(t.x0).toBeGreaterThanOrEqual(0);
            expect(t.x0 + (t.n - 1) * t.step + 4).toBeLessThanOrEqual(w * TILE);
        }
        expect(tankRect(8)).toBeNull();
        const tk = tankRect(3 * TILE);
        expect(tk && tk.x + tk.w <= 3 * TILE && tk.y + tk.h <= FAC_BOTTOM - FAC_TOP).toBe(true);
    });
});
describe("green kinds: bodies and live art stay inside their tiles", () => {
    it("bodies at widths 2..8", () => {
        const bad = [];
        for (const kind of KINDS)
            for (let w = 2; w <= 8; w++) {
                const r = recorder();
                drawBody(r.g, defOf(kind, w), 0, TOP);
                if (r.rects.length < 12)
                    bad.push(`${kind} w${w}: only ${r.rects.length} rects`);
                for (const q of outside(r.rects, w * TILE, TOP + 1))
                    bad.push(`${kind} w${w}: ${q}`);
            }
        expect(bad).toEqual([]);
    });
    it("live details (night and day, drought, still and moving, every status)", () => {
        const bad = [];
        for (const kind of KINDS)
            for (let w = 2; w <= 8; w += 2)
                for (const status of ["ok", "failed", "unpowered", "tripped"])
                    for (const minute of [0, 780]) {
                        for (const rm of [false, true]) {
                            const def = defOf(kind, w);
                            const r = recorder();
                            drawLive(r.g, def, view(4, def, status), 0, TOP, 3.3, { ...OPT, reducedMotion: rm }, undefined, { ...NO_FX, minute, tick: 1234, drought: minute === 0 });
                            // The status badge sits at the top of the floor cell (TOP + 1), above the body.
                            for (const q of outside(r.rects, w * TILE, TOP - 1))
                                bad.push(`${kind} w${w} ${status} m${minute}: ${q}`);
                        }
                    }
        expect(bad).toEqual([]);
    });
});
describe("green kinds: live behaviour", () => {
    const count = (kind, w, lf, status = "ok", t = 2, rm = false, extra = {}) => {
        const def = defOf(kind, w);
        const r = recorder();
        drawLive(r.g, def, view(4, def, status, extra), 0, TOP, t, { ...OPT, reducedMotion: rm }, undefined, { ...NO_FX, ...lf });
        return r.rects.length;
    };
    it("solar panels are dark at night and light up by day, dimmer in a drought", () => {
        expect(count("solar", 4, { minute: 0 })).toBe(0);
        expect(count("solar", 4, { minute: 780 })).toBeGreaterThan(count("solar", 4, { minute: 0 }));
        const day = recorder();
        const def = defOf("solar", 4);
        const alphas = [];
        const g = { clear() { }, rect() { return g; }, fill(o) { alphas.push(o.alpha ?? 1); return g; } };
        drawLive(g, def, view(4, def), 0, TOP, 2, OPT, undefined, { ...NO_FX, minute: 780, drought: true });
        const dry = Math.max(...alphas);
        alphas.length = 0;
        drawLive(g, def, view(4, def), 0, TOP, 2, OPT, undefined, { ...NO_FX, minute: 780, drought: false });
        expect(Math.max(...alphas)).toBeGreaterThan(dry);
        expect(day.rects.length).toBe(0);
        expect(count("solar", 4, { minute: 780 }, "failed")).toBe(count("solar", 4, { minute: 0 }, "failed")); // only the badge
    });
    it("wind rotors turn with the wind, and stop in a drought or when the mast is down", () => {
        const blades = (lf, status = "ok", t = 2) => {
            const def = defOf("wind", 2);
            const r = recorder();
            drawLive(r.g, def, view(4, def, status), 0, TOP, t, OPT, undefined, { ...NO_FX, ...lf });
            return JSON.stringify(r.rects.filter((q) => q.h === 9).map((q) => q.x));
        };
        expect(windOmega(100, false, true)).toBeGreaterThan(0);
        expect(windOmega(100, true, true)).toBe(0);
        expect(windOmega(100, false, false)).toBe(0);
        expect(count("wind", 2, { tick: 100 })).toBeGreaterThan(5);
        // Drought: the blades hold the same positions however long we wait; in wind they move.
        const frozen = [blades({ tick: 100, drought: true }, "ok", 2), blades({ tick: 100, drought: true }, "ok", 2.2), blades({ tick: 100, drought: true }, "ok", 2.4)];
        expect(new Set(frozen.slice(1)).size).toBe(1);
        const wind = new Set([blades({ tick: 200 }, "ok", 3), blades({ tick: 200 }, "ok", 3.2), blades({ tick: 200 }, "ok", 3.4), blades({ tick: 200 }, "ok", 3.6)]);
        expect(wind.size).toBeGreaterThan(1);
    });
    it("heat export glows and carries heat only while it runs, brighter with load", () => {
        expect(count("heat_export", 3, {}, "ok")).toBeGreaterThan(0);
        expect(count("heat_export", 3, {}, "ok")).toBeGreaterThan(count("heat_export", 3, {}, "failed"));
        expect(count("heat_export", 3, {}, "ok")).toBeGreaterThan(count("heat_export", 3, {}, "unpowered"));
        // More heat removed = a stronger glow (alpha), same shapes.
        const peak = (heatKw) => {
            const def = defOf("heat_export", 3);
            const a = [];
            const g = { clear() { }, rect() { return g; }, fill(o) { a.push(o.alpha ?? 1); return g; } };
            drawLive(g, def, view(4, def, "ok", { heatKw }), 0, TOP, 2, OPT, undefined, NO_FX);
            return a.reduce((x, y) => x + y, 0);
        };
        expect(peak(400)).toBeGreaterThan(peak(10));
    });
    it("the algae façade bubbles only while powered; reduced motion keeps them still", () => {
        expect(count("carbon", 4, {}, "ok")).toBeGreaterThan(0);
        expect(count("carbon", 4, {}, "ok")).toBeGreaterThan(count("carbon", 4, {}, "unpowered"));
        const pos = (t) => {
            const def = defOf("carbon", 4);
            const r = recorder();
            drawLive(r.g, def, view(4, def), 0, TOP, t, { ...OPT, reducedMotion: true }, undefined, NO_FX);
            return JSON.stringify(r.rects);
        };
        expect(pos(1)).toBe(pos(5));
    });
});
describe("path skins: greentech and synthetic", () => {
    const kinds = ["rack", "crah", "chiller", "cdu", "grid_tie", "genset", "ups", "depot", "charger", "solar", "wind", "heat_export", "carbon"];
    const defFor = (kind, w) => {
        const row = VARIETY_ROWS.find((r) => r.kind === kind && (kind !== "rack" || r.flavour === "air"));
        if (!row)
            throw new Error(kind);
        return { ...content.facilities[varietyId(row, 3, row.widths[0])], width: w };
    };
    const paint = (def, path, stage, horror = 1) => {
        const r = recorder();
        drawBody(r.g, def, 0, TOP, { skin: { effects: skinEffects({ path, stage }, def.kind), alpha: 1, seed: 5, path, horror } });
        return r.rects;
    };
    it("every skin stays inside the tiles (plants may rise 3 px above the body) at widths 2..6", () => {
        const bad = [];
        for (const path of ["greentech", "synthetic"])
            for (const kind of kinds)
                for (const w of [2, 3, 4, 6]) {
                    // Bodies are drawn for their native width or wider (narrower is unsupported, see art.ts).
                    const def = defFor(kind, Math.max(w, NATIVE_WIDTH[kind] ?? 2));
                    // Only what the skin adds is checked: some base bodies (chiller stacks, grid-tie masts) rise above the body on purpose.
                    const base = new Set(paint(def, path, 0).map((q) => JSON.stringify(q)));
                    for (const stage of [1, 2, 3, 4]) {
                        const added = paint(def, path, stage).filter((q) => !base.has(JSON.stringify(q)));
                        for (const q of outside(added, def.width * TILE, BODY_Y - 3))
                            bad.push(`${path} ${kind} w${w} s${stage}: ${q}`);
                    }
                }
        expect(bad).toEqual([]);
    });
    it("a device adds detail at the stages it responds to, and stays the same at the others", () => {
        const def = defFor("rack", 3);
        const n = (s) => paint(def, "greentech", s).length;
        expect(n(1)).toBeGreaterThan(n(0));
        expect(n(2)).toBeGreaterThan(n(1));
        expect(n(3)).toBeGreaterThan(n(2));
        expect(n(4)).toBeGreaterThan(n(3));
        const wind = defFor("wind", 2);
        const w = (s) => paint(wind, "greentech", s).length;
        expect(w(3)).toBe(w(2));
        expect(w(4)).toBe(w(2));
        const s = (st) => paint(def, "synthetic", st).length;
        expect([s(1), s(2), s(3), s(4)].every((v, i, a) => v > (i ? a[i - 1] : s(0)))).toBe(true);
    });
    it("fungus respects intensity: gone when off, same shapes at half alpha when mild", () => {
        const def = defFor("rack", 3);
        const alphas = (horror) => {
            const out = [];
            const g = { clear() { }, rect() { return g; }, fill(o) { out.push(o.alpha ?? 1); return g; } };
            const skin = horror === undefined ? undefined : { effects: new Set(["fungus"]), alpha: 1, seed: 5, path: "greentech", horror };
            drawBody(g, def, 0, TOP, { skin });
            return out;
        };
        const n = alphas().length;
        const full = alphas(1).slice(n);
        expect(full.length).toBeGreaterThan(0);
        const mild = alphas(0.5).slice(n);
        expect(mild.length).toBe(full.length);
        expect(Math.max(...mild)).toBeLessThan(Math.max(...full));
        expect(alphas(0)).toHaveLength(n);
    });
    it("live extras: fish swim and spores drift (moving), still under reduced motion; nothing at stage 0", () => {
        const def = defFor("chiller", 4);
        const live = (t, rm, stage) => {
            const r = recorder();
            drawLive(r.g, def, view(8, def), 0, TOP, t, { ...OPT, reducedMotion: rm }, undefined, { ...NO_FX, pskin: { path: "greentech", stage, horror: 1 } });
            return JSON.stringify(r.rects);
        };
        expect(live(1, false, 3)).not.toBe(live(3, false, 3));
        expect(live(1, true, 3)).toBe(live(3, true, 3));
        expect(live(1, false, 0)).toBe(live(3, false, 0));
        expect(live(1, false, 3).length).toBeGreaterThan(live(1, false, 0).length);
    });
    it("a growth is already tissue: no green skin at any stage", () => {
        expect(skinEffects({ path: "greentech", stage: 4 }, "growth").size).toBe(0);
    });
});
