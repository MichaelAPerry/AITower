import { worldToScreen } from "./camera";
import { CB, T, lt } from "./palette";
/** failed / tripped need a repair or a cool-down (3), unpowered is a wiring/power fault (2), noCoolant is degraded (1). */
export const alertSeverity = (status) => {
    switch (status) {
        case "failed":
        case "tripped":
            return 3;
        case "unpowered":
            return 2;
        case "noCoolant":
            return 1;
        default:
            return 0;
    }
};
/** Arrow colour by severity: red / sodium / verdigris, or vermilion / orange / blue when colour-blind. */
export const alertArrowColor = (severity, colorBlind = false) => {
    if (colorBlind)
        return severity >= 3 ? CB.vermilion : severity === 2 ? CB.orange : CB.blue;
    return severity >= 3 ? T.red : severity === 2 ? T.sodium : lt(T.verdigris, 0.25);
};
/** True when the world rect lies completely outside the viewport (no overlap at all). */
export const isOffscreen = (cam, r) => {
    const a = worldToScreen(cam, r.x, r.y);
    const w = r.w * cam.zoom;
    const h = r.h * cam.zoom;
    return a.x + w <= 0 || a.y + h <= 0 || a.x >= cam.vw || a.y >= cam.vh;
};
/**
 * Where the arrow for a target at screen point (tx, ty) sits: on the viewport rectangle inset by `margin`, along
 * the ray from the viewport centre. Always on the inset boundary, so it never leaves the screen.
 */
export const edgePoint = (vw, vh, margin, tx, ty) => {
    const cx = vw / 2;
    const cy = vh / 2;
    const dx = tx - cx;
    const dy = ty - cy;
    if (dx === 0 && dy === 0)
        return { x: cx, y: Math.max(0, margin), angle: -Math.PI / 2 };
    const hx = Math.max(0, cx - margin);
    const hy = Math.max(0, cy - margin);
    const sx = dx === 0 ? Number.POSITIVE_INFINITY : hx / Math.abs(dx);
    const sy = dy === 0 ? Number.POSITIVE_INFINITY : hy / Math.abs(dy);
    const s = Math.min(sx, sy);
    return { x: Math.round(cx + dx * s), y: Math.round(cy + dy * s), angle: Math.atan2(dy, dx) };
};
/**
 * One arrow per off-screen alert, with arrows closer than `mergeDist` screen px merged into the worst /
 * nearest one (which keeps its place and shows a count). Surviving arrows are at least `mergeDist` apart,
 * so they never overlap. Order: severity desc, then distance to the viewport centre, then id.
 */
export const computeArrows = (cam, targets, margin, mergeDist) => {
    const cx = cam.vw / 2;
    const cy = cam.vh / 2;
    const items = [];
    for (const t of targets) {
        if (t.severity === 0 || !isOffscreen(cam, t.rect))
            continue;
        const fx = t.rect.x + t.rect.w / 2;
        const fy = t.rect.y + t.rect.h / 2;
        const s = worldToScreen(cam, fx, fy);
        items.push({ t, p: edgePoint(cam.vw, cam.vh, margin, s.x, s.y), dist: Math.hypot(s.x - cx, s.y - cy), fx, fy });
    }
    items.sort((a, b) => b.t.severity - a.t.severity || a.dist - b.dist || a.t.id - b.t.id);
    const groups = [];
    for (const it of items) {
        const g = groups.find((q) => Math.hypot(q.x - it.p.x, q.y - it.p.y) < mergeDist);
        if (g) {
            g.count++;
            g.ids.push(it.t.id);
        }
        else
            groups.push({ ...it.p, severity: it.t.severity, count: 1, ids: [it.t.id], focus: { x: it.fx, y: it.fy } });
    }
    return groups;
};
/** The arrow under a screen point (nearest within `radius`), or null. */
export const hitArrow = (groups, sx, sy, radius) => {
    let best = null;
    let bestD = radius;
    for (const g of groups) {
        const d = Math.hypot(g.x - sx, g.y - sy);
        if (d <= bestD) {
            best = g;
            bestD = d;
        }
    }
    return best;
};
/**
 * Arrow pixels pointing along `angle` (screen space), centred on (0, 0): a triangular head on a shaft. `fill` is
 * the arrow, `edge` the 1-px outline around it. Pixel centres are tested, so the shape stays blocky.
 */
export const arrowPixels = (angle) => {
    const ca = Math.cos(angle);
    const sa = Math.sin(angle);
    const R = 8;
    const inside = (dx, dy) => {
        const u = dx * ca + dy * sa;
        const v = -dx * sa + dy * ca;
        const head = u >= -0.5 && u <= 5.5 && Math.abs(v) <= (5.5 - u) * 0.85 + 0.25;
        const shaft = u >= -5.5 && u < -0.5 && Math.abs(v) <= 1.1;
        return head || shaft;
    };
    const fill = [];
    const set = new Set();
    const key = (x, y) => (y + R + 2) * 64 + (x + R + 2);
    for (let y = -R; y <= R; y++)
        for (let x = -R; x <= R; x++)
            if (inside(x, y)) {
                fill.push([x, y]);
                set.add(key(x, y));
            }
    const edge = [];
    const seen = new Set();
    for (const [x, y] of fill)
        for (const [ox, oy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
        ]) {
            const k = key(x + ox, y + oy);
            if (!set.has(k) && !seen.has(k)) {
                seen.add(k);
                edge.push([x + ox, y + oy]);
            }
        }
    return { fill, edge };
};
