import { describe, expect, it } from "vitest";
import { alertArrowColor, alertSeverity, arrowPixels, computeArrows, edgePoint, hitArrow, isOffscreen, } from "./alerts";
import { CB, T } from "./palette";
// zoom 1, centred on world (400, 300), 800×600 viewport → world x 0..800, y 0..600 maps 1:1 to the screen.
const cam = { cx: 400, cy: 300, zoom: 1, vw: 800, vh: 600 };
const target = (id, x, y, severity = 3) => ({ id, severity, rect: { x, y, w: 32, h: 31 } });
describe("alert severity", () => {
    it("only failed, tripped, unpowered and noCoolant raise alerts", () => {
        const all = ["ok", "idle", "disabled", "unpowered", "brownout", "noCoolant", "throttled", "tripped", "failed"];
        const alerting = all.filter((s) => alertSeverity(s) > 0);
        expect(alerting.sort()).toEqual(["failed", "noCoolant", "tripped", "unpowered"]);
    });
    it("ranks failed/tripped over unpowered over noCoolant", () => {
        expect(alertSeverity("failed")).toBe(3);
        expect(alertSeverity("tripped")).toBe(3);
        expect(alertSeverity("unpowered")).toBe(2);
        expect(alertSeverity("noCoolant")).toBe(1);
    });
    it("colours by severity, with a colour-blind scheme", () => {
        expect(alertArrowColor(3)).toBe(T.red);
        expect(alertArrowColor(2)).toBe(T.sodium);
        expect(alertArrowColor(3, true)).toBe(CB.vermilion);
        expect(alertArrowColor(2, true)).toBe(CB.orange);
        expect(alertArrowColor(1, true)).toBe(CB.blue);
        expect(new Set([1, 2, 3].map((s) => alertArrowColor(s))).size).toBe(3);
    });
});
describe("isOffscreen", () => {
    it("is false while any part of the rect is visible", () => {
        expect(isOffscreen(cam, { x: 100, y: 100, w: 32, h: 31 })).toBe(false);
        expect(isOffscreen(cam, { x: -20, y: 100, w: 32, h: 31 })).toBe(false); // straddles the left edge
        expect(isOffscreen(cam, { x: 790, y: 590, w: 32, h: 31 })).toBe(false);
    });
    it("is true once the rect is fully outside, touching edges count as outside", () => {
        expect(isOffscreen(cam, { x: -32, y: 100, w: 32, h: 31 })).toBe(true);
        expect(isOffscreen(cam, { x: 800, y: 100, w: 32, h: 31 })).toBe(true);
        expect(isOffscreen(cam, { x: 100, y: -31, w: 32, h: 31 })).toBe(true);
        expect(isOffscreen(cam, { x: 100, y: 900, w: 32, h: 31 })).toBe(true);
    });
    it("accounts for zoom", () => {
        const z = { ...cam, zoom: 2 }; // visible world x 200..600
        expect(isOffscreen(z, { x: 150, y: 250, w: 32, h: 31 })).toBe(true);
        expect(isOffscreen(z, { x: 190, y: 250, w: 32, h: 31 })).toBe(false);
    });
});
describe("edgePoint", () => {
    const M = 20;
    it("sits on the inset rectangle along the ray from the centre", () => {
        expect(edgePoint(800, 600, M, 2000, 300)).toMatchObject({ x: 780, y: 300, angle: 0 });
        expect(edgePoint(800, 600, M, -2000, 300).x).toBe(20);
        expect(edgePoint(800, 600, M, 400, -900)).toMatchObject({ x: 400, y: 20 });
        expect(edgePoint(800, 600, M, 400, 900)).toMatchObject({ x: 400, y: 580 });
    });
    it("never leaves the inset rectangle, whatever the direction", () => {
        for (let a = 0; a < 360; a += 7) {
            const r = (a * Math.PI) / 180;
            const p = edgePoint(800, 600, M, 400 + Math.cos(r) * 5000, 300 + Math.sin(r) * 5000);
            expect(p.x).toBeGreaterThanOrEqual(M);
            expect(p.x).toBeLessThanOrEqual(800 - M);
            expect(p.y).toBeGreaterThanOrEqual(M);
            expect(p.y).toBeLessThanOrEqual(600 - M);
            // On the boundary of the inset rect.
            expect(p.x === M || p.x === 800 - M || p.y === M || p.y === 600 - M).toBe(true);
        }
    });
    it("points toward the target", () => {
        const p = edgePoint(800, 600, M, 400, 5000);
        expect(p.angle).toBeCloseTo(Math.PI / 2);
        const q = edgePoint(800, 600, M, -4000, -4000);
        expect(q.x).toBeLessThan(400);
        expect(q.y).toBeLessThan(300);
    });
    it("copes with a target at the exact centre and a tiny viewport", () => {
        expect(edgePoint(800, 600, M, 400, 300).y).toBe(M);
        const p = edgePoint(30, 30, M, 500, 500);
        expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
        expect(p.x).toBe(15);
    });
});
describe("computeArrows", () => {
    it("ignores on-screen facilities and severity 0", () => {
        expect(computeArrows(cam, [target(1, 100, 100), target(2, 5000, 100, 3)].slice(0, 1), 22, 26)).toEqual([]);
        expect(computeArrows(cam, [{ id: 3, severity: 0, rect: { x: 5000, y: 0, w: 32, h: 31 } }], 22, 26)).toEqual([]);
    });
    it("makes one arrow per distant alert, pointing at it", () => {
        const g = computeArrows(cam, [target(1, 3000, 300)], 22, 26);
        expect(g).toHaveLength(1);
        expect(g[0]).toMatchObject({ x: 778, count: 1, ids: [1], severity: 3 });
        expect(g[0].angle).toBeCloseTo(0, 1);
        expect(g[0].focus).toEqual({ x: 3016, y: 315.5 });
    });
    it("groups arrows that land close together, keeping the worst and nearest as representative", () => {
        const g = computeArrows(cam, [target(1, 3000, 300, 1), target(2, 4000, 310, 3), target(3, 2500, 305, 3), target(4, 3500, 305, 2)], 22, 26);
        expect(g).toHaveLength(1);
        expect(g[0].count).toBe(4);
        expect(g[0].severity).toBe(3);
        expect(g[0].ids[0]).toBe(3); // severity 3 and nearest to the centre
        expect(g[0].focus.x).toBeCloseTo(2516);
    });
    it("keeps distant directions apart and never overlaps surviving arrows", () => {
        const targets = [];
        for (let i = 0; i < 40; i++) {
            const a = (i / 40) * Math.PI * 2;
            targets.push(target(i + 1, 400 + Math.cos(a) * 4000, 300 + Math.sin(a) * 4000, ((i % 3) + 1)));
        }
        const groups = computeArrows(cam, targets, 22, 26);
        expect(groups.length).toBeGreaterThan(4);
        expect(groups.reduce((n, g) => n + g.count, 0)).toBe(40);
        for (let i = 0; i < groups.length; i++)
            for (let j = i + 1; j < groups.length; j++)
                expect(Math.hypot(groups[i].x - groups[j].x, groups[i].y - groups[j].y)).toBeGreaterThanOrEqual(26);
    });
    it("is deterministic: same inputs in any order give the same arrows", () => {
        const ts = [target(1, 3000, 300, 2), target(2, 3100, 305, 2), target(3, -3000, 100, 3)];
        expect(computeArrows(cam, [...ts].reverse(), 22, 26)).toEqual(computeArrows(cam, ts, 22, 26));
    });
    it("sorts by severity then distance", () => {
        const g = computeArrows(cam, [target(1, 3000, 300, 1), target(2, -3000, 300, 3)], 22, 26);
        expect(g.map((q) => q.ids[0])).toEqual([2, 1]);
    });
});
describe("hitArrow", () => {
    const groups = computeArrows(cam, [target(1, 3000, 300, 3), target(2, -3000, 300, 2)], 22, 26);
    it("hits within the radius and returns the nearest", () => {
        expect(hitArrow(groups, 780, 305, 14)?.ids).toEqual([1]);
        expect(hitArrow(groups, 20, 295, 14)?.ids).toEqual([2]);
    });
    it("misses outside the radius or with no arrows", () => {
        expect(hitArrow(groups, 400, 300, 14)).toBeNull();
        expect(hitArrow([], 10, 10, 14)).toBeNull();
    });
});
describe("arrowPixels", () => {
    it("has a fill, an outline and no overlap between them", () => {
        for (const a of [0, 0.7, Math.PI / 2, Math.PI, -1.2]) {
            const { fill, edge } = arrowPixels(a);
            expect(fill.length).toBeGreaterThan(20);
            expect(edge.length).toBeGreaterThan(10);
            const f = new Set(fill.map(([x, y]) => `${x},${y}`));
            for (const [x, y] of edge)
                expect(f.has(`${x},${y}`)).toBe(false);
        }
    });
    it("points the way it is told (tip is the farthest pixel along the angle)", () => {
        const farthest = (a) => {
            let best = [0, 0];
            let bd = -Infinity;
            for (const [x, y] of arrowPixels(a).fill) {
                const d = x * Math.cos(a) + y * Math.sin(a);
                if (d > bd) {
                    bd = d;
                    best = [x, y];
                }
            }
            return best;
        };
        expect(farthest(0)[0]).toBeGreaterThanOrEqual(5);
        expect(farthest(Math.PI)[0]).toBeLessThanOrEqual(-5);
        expect(farthest(Math.PI / 2)[1]).toBeGreaterThanOrEqual(5);
        expect(farthest(-Math.PI / 2)[1]).toBeLessThanOrEqual(-5);
    });
    it("is centred (extent roughly balanced) and fits a small box", () => {
        const { fill, edge } = arrowPixels(0.3);
        for (const [x, y] of [...fill, ...edge])
            expect(Math.max(Math.abs(x), Math.abs(y))).toBeLessThanOrEqual(8);
        const mx = fill.reduce((s, [x]) => s + x, 0) / fill.length;
        expect(Math.abs(mx)).toBeLessThan(2);
    });
});
