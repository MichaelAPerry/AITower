import { FAC_BOTTOM, FAC_TOP } from "../constants";
import { clamp01 } from "../color";
import { carbonVariant, heatVariant, mastCount, rotorOmega, solarGlow, solarVariant, windLevel } from "../green";
import { hash2 } from "../horror";
import { GLASS, STEEL, T, dk, lt, mat, mix } from "../palette";
import { dither, px } from "./draw";
const H = FAC_BOTTOM - FAC_TOP;
const HOUSING = mat(T.housing);
// ─── Colours (all derived from tokens) ─────────────────────────────────
const PV = mat(dk(mix(T.verdigris, T.accent2, 0.3), 0.5));
const LEAF = mat(mix(T.green, T.greenDim, 0.4));
const MOSS = mix(T.greenDim, T.green, 0.3);
const MOSS_LT = mix(T.greenDim, T.green, 0.6);
const SOIL = dk(T.bile, 0.55);
const WARM = mat(mix(T.amber, T.red, 0.45));
const ALGA = mat(mix(T.green, T.greenDim, 0.25));
const WATER = mix(GLASS, T.brass, 0.3);
const FISH = mix(T.amber, T.red, 0.3);
/** Bracket fungus: pale cream cap, bile-brown gills (quiet, never fleshy). */
const CAP = mix(T.sodium, T.bile, 0.35);
const GILL = dk(mix(T.sodium, T.bile, 0.6), 0.35);
const FLOWERS = [T.amber, T.paper, mix(T.red, T.paper, 0.4)];
const solarCache = new Map();
/** Panel cells of a solar body, relative to (0, 0) = body top-left. Façade = a flat field; canopy = two tilted bands on stilts. */
export const solarCells = (W) => {
    const variant = solarVariant(W / 16);
    const key = `${variant}${W}`;
    let out = solarCache.get(key);
    if (out)
        return out;
    const cells = [];
    if (variant === "facade") {
        const cols = Math.max(1, Math.floor((W - 4) / 8));
        const x0 = 2 + Math.floor((W - 4 - cols * 8 + 1) / 2);
        for (let r = 0; r < 3; r++)
            for (let c = 0; c < cols; c++)
                cells.push({ x: x0 + c * 8, y: 4 + r * 7, w: 7, h: 6 });
    }
    else {
        const cols = Math.max(1, Math.floor((W - 4) / 8));
        const x0 = 2 + Math.floor((W - 4 - cols * 8 + 1) / 2);
        for (let b = 0; b < 2; b++)
            for (let c = 0; c < cols; c++) {
                // Tilt: each band steps up toward the right.
                cells.push({ x: x0 + c * 8, y: 3 + b * 11 + Math.floor(((cols - 1 - c) * 4) / Math.max(1, cols)), w: 7, h: 5 });
            }
    }
    out = cells;
    solarCache.set(key, out);
    return out;
};
/** Tube layout of an algae façade: count, first x, step. */
export const tubeLayout = (W) => {
    const tubesW = carbonVariant(W / 16) === "plant" ? W - 14 : W;
    const n = Math.max(1, Math.floor((tubesW - 6) / 5));
    return { n, x0: 3 + Math.floor((tubesW - 6 - n * 5 + 1) / 2), step: 5 };
};
/** Fish tank that body skins and decals share: null when the device is too narrow. */
export const tankRect = (W) => (W < 14 ? null : { x: 3, y: H - 13, w: Math.min(16, W - 6), h: 9 });
// ─── Bodies of the four green kinds ────────────────────────────────────
function solarBody(g, x, y, W, c) {
    const canopy = solarVariant(W / 16) === "canopy";
    const frame = mat(mix(dk(c, 0.3), T.housing, 0.5));
    if (!canopy) {
        px(g, x + 1, y + 2, W - 2, H - 7, frame.line);
        px(g, x + 2, y + 3, W - 4, H - 9, frame.lo);
    }
    for (const q of solarCells(W)) {
        px(g, x + q.x, y + q.y, q.w, q.h, PV.line);
        px(g, x + q.x, y + q.y, q.w - 1, q.h - 1, PV.lo);
        px(g, x + q.x + 2, y + q.y + 1, 1, q.h - 3, PV.mid, 0.6); // cell busbar
        px(g, x + q.x, y + q.y, q.w - 1, 1, PV.mid);
    }
    if (canopy) {
        // Stilts, a gangway with rail posts, and a bench.
        for (let sx = x + 4; sx < x + W - 3; sx += 12)
            px(g, sx, y + 20, 1, H - 20, STEEL.lo);
        px(g, x + 2, y + H - 6, W - 4, 1, STEEL.hi);
        px(g, x + 2, y + H - 5, W - 4, 1, STEEL.lo);
        for (let sx = x + 3; sx < x + W - 3; sx += 8)
            px(g, sx, y + H - 10, 1, 4, STEEL.mid);
        px(g, x + 2, y + H - 10, W - 4, 1, STEEL.mid, 0.7);
    }
    else {
        px(g, x + 1, y + H - 4, W - 2, 3, HOUSING.line);
        px(g, x + W - 8, y + H - 4, 6, 3, HOUSING.hi);
    }
}
function windBody(g, x, y, W) {
    const masts = mastCount(W / 16);
    const x0 = x + Math.floor((W - masts * 32) / 2);
    for (let m = 0; m < masts; m++) {
        const cx = x0 + m * 32 + 16;
        // Lattice mast: two rails with alternating cross braces.
        px(g, cx - 1, y + 1, 1, H - 4, STEEL.mid);
        px(g, cx + 1, y + 1, 1, H - 4, STEEL.lo);
        for (let r = 2; r < H - 5; r += 3)
            px(g, cx, y + r, 1, 1, (r / 3) & 1 ? STEEL.hi : STEEL.dk);
        // Hubs and the arms the blades hang from (blades turn live).
        for (const cy of [y + 9, y + 22]) {
            px(g, cx - 10, cy, 21, 1, STEEL.dk, 0.55);
            px(g, cx - 2, cy - 1, 5, 3, STEEL.line);
            px(g, cx - 1, cy - 1, 3, 1, STEEL.hi);
        }
        px(g, cx - 6, y + H - 3, 13, 3, HOUSING.line);
        px(g, cx - 5, y + H - 3, 11, 1, HOUSING.hi);
        for (const bx of [cx - 5, cx - 2, cx + 2, cx + 5])
            px(g, bx, y + H - 2, 1, 1, STEEL.hi); // anchor bolts
        // Anemometer on top and aviation bands on the mast.
        px(g, cx - 3, y + 1, 7, 1, STEEL.mid);
        px(g, cx - 3, y, 2, 2, STEEL.hi);
        px(g, cx + 2, y, 2, 2, STEEL.lo);
        for (const by of [y + 15, y + 28]) {
            px(g, cx - 1, by, 3, 1, T.red, 0.8);
            px(g, cx - 1, by + 1, 3, 1, T.paper, 0.7);
        }
    }
}
/** Where the street pipe leaves a heat-export body (relative): it runs along this row to the right edge. */
export const PIPE_ROW = H - 8;
function heatBody(g, x, y, W, c) {
    const m = mat(mix(dk(c, 0.45), T.housing, 0.5));
    const long = heatVariant(W / 16) === "pipeline";
    const tanks = long ? 2 : 1;
    const tw = long ? Math.floor((W - 16) / 2) : W - 14;
    for (let i = 0; i < tanks; i++) {
        const tx = x + 2 + i * (tw + 3);
        px(g, tx, y + 3, tw, H - 12, m.line);
        px(g, tx + 1, y + 4, tw - 2, H - 14, m.mid);
        px(g, tx + 1, y + 4, tw - 2, 2, m.hi);
        // Coil: warm zigzag behind a glass panel.
        for (let k = 0; k < tw - 6; k++)
            px(g, tx + 3 + k, y + 8 + ((k >> 1) & 1) * 2 + (k % 6 < 3 ? 0 : 6), 1, 1, WARM.mid);
        px(g, tx + 3, y + 8, tw - 6, 1, WARM.lo, 0.6);
        px(g, tx + 3, y + H - 11, tw - 6, 1, WARM.lo, 0.6);
        px(g, tx + 2, y + H - 9, tw - 4, 1, m.dk);
    }
    // Pipe to the street: along PIPE_ROW to the right edge, supports, a flange and a grille at the end.
    px(g, x + 2, y + PIPE_ROW, W - 4, 3, WARM.line);
    px(g, x + 2, y + PIPE_ROW, W - 4, 2, WARM.mid);
    px(g, x + 2, y + PIPE_ROW, W - 4, 1, WARM.hi);
    for (let sx = x + 6; sx < x + W - 8; sx += 12)
        px(g, sx, y + PIPE_ROW + 3, 2, 4, HOUSING.line);
    px(g, x + W - 5, y + PIPE_ROW - 3, 3, 9, WARM.line);
    px(g, x + W - 4, y + PIPE_ROW - 2, 1, 7, WARM.lo);
    px(g, x + W - 3, y + PIPE_ROW - 2, 1, 7, WARM.dk);
    px(g, x + 1, y + H - 1, W - 2, 1, HOUSING.line);
}
function carbonBody(g, x, y, W, c) {
    const m = mat(mix(dk(c, 0.4), T.housing, 0.5));
    const plant = carbonVariant(W / 16) === "plant";
    const { n, x0, step } = tubeLayout(W);
    const tubesW = plant ? W - 14 : W;
    px(g, x + 1, y + 2, tubesW - 2, H - 5, m.line);
    px(g, x + 2, y + 3, tubesW - 4, H - 7, m.lo);
    for (let i = 0; i < n; i++) {
        const tx = x + x0 + i * step;
        px(g, tx, y + 4, 4, H - 10, GLASS);
        px(g, tx + 1, y + 5, 2, H - 12, i & 1 ? ALGA.mid : ALGA.lo);
        px(g, tx + 1, y + 5, 1, H - 12, ALGA.hi, 0.7);
        px(g, tx, y + 4, 4, 1, lt(GLASS, 0.3));
    }
    px(g, x + 2, y + 2, tubesW - 4, 2, STEEL.mid);
    px(g, x + 2, y + H - 5, tubesW - 4, 3, m.dk);
    if (plant) {
        // Capture stack: a banded chimney with an intake duct.
        const sx = x + W - 12;
        px(g, sx, y + 1, 9, H - 3, m.line);
        px(g, sx + 1, y + 2, 7, H - 5, m.mid);
        for (let r = 4; r < H - 6; r += 6)
            px(g, sx + 1, y + r, 7, 1, m.hi);
        px(g, sx + 1, y + 2, 7, 1, m.hi);
        px(g, sx + 3, y + 1, 3, 1, LEAF.hi);
        px(g, x + tubesW - 2, y + H - 12, 5, 2, STEEL.mid);
    }
}
/** Static body of a green kind. */
export function greenKindBody(g, kind, x, y, W, c) {
    if (kind === "solar")
        solarBody(g, x, y, W, c);
    else if (kind === "wind")
        windBody(g, x, y, W);
    else if (kind === "heat_export")
        heatBody(g, x, y, W, c);
    else if (kind === "carbon")
        carbonBody(g, x, y, W, c);
}
/** Rotor speed (rad/s) of a wind facility right now. */
export const windOmega = (tick, drought, usable) => rotorOmega(windLevel(tick, drought, usable));
export function greenKindLive(g, x, y, W, s) {
    switch (s.kind) {
        case "solar": {
            const glow = solarGlow(s.minute, s.drought, s.usable);
            if (glow <= 0.01)
                return;
            const cells = solarCells(W);
            const sky = lt(PV.hi, 0.35);
            for (const q of cells)
                px(g, x + q.x, y + q.y, q.w - 1, q.h - 1, sky, 0.5 * glow);
            if (!s.calm && glow > 0.3) {
                // A glint slides over the cells.
                const q = cells[Math.floor(s.t * 3) % cells.length];
                px(g, x + q.x, y + q.y, q.w - 1, 1, T.paper, 0.7 * glow);
                px(g, x + q.x, y + q.y, 1, q.h - 1, T.paper, 0.5 * glow);
            }
            return;
        }
        case "wind": {
            const masts = mastCount(W / 16);
            const x0 = x + Math.floor((W - masts * 32) / 2);
            for (let m = 0; m < masts; m++) {
                const cx = x0 + m * 32 + 16;
                for (let j = 0; j < 2; j++) {
                    const cy = y + (j === 0 ? 9 : 22);
                    for (let k = 0; k < 3; k++) {
                        const a = s.phase + (k * Math.PI * 2) / 3 + j * 0.9 + m * 0.5;
                        const bx = cx + Math.round(Math.cos(a) * 10);
                        const front = Math.sin(a) > 0;
                        px(g, bx, cy - 4, 1, 9, front ? STEEL.hi : STEEL.dk);
                        if (front)
                            px(g, bx, cy - 4, 1, 2, T.paper, 0.5);
                    }
                }
                if (s.usable)
                    px(g, cx, y, 1, 1, T.red, s.calm || Math.floor(s.t * 1.2) % 2 === 0 ? 0.9 : 0.25);
            }
            return;
        }
        case "heat_export": {
            if (!s.usable)
                return;
            const load = s.exportKw > 0 ? clamp01(s.heatKw / s.exportKw) : 0;
            const glow = 0.25 + 0.75 * load;
            // Warm glow around the end of the pipe, dithered, plus the pipe itself running hotter.
            dither(g, x + W - 14, y + PIPE_ROW - 5, 13, 13, WARM.hi, 0.22 * glow, 1, 0);
            dither(g, x + W - 10, y + PIPE_ROW - 3, 9, 9, T.sodium, 0.2 * glow, 1, 1);
            px(g, x + 2, y + PIPE_ROW, W - 4, 1, lt(WARM.hi, 0.35), 0.35 * glow);
            // Heat running toward the street.
            const span = W - 12;
            for (let k = 0; k < 3; k++) {
                const u = s.calm ? (k + 0.5) / 3 : (s.t * (0.25 + 0.5 * load) + k / 3) % 1;
                px(g, x + 4 + Math.floor(u * span), y + PIPE_ROW + 1, 2, 1, T.sodium, 0.8);
            }
            return;
        }
        case "carbon": {
            if (!s.usable)
                return;
            const { n, x0, step } = tubeLayout(W);
            const bubble = lt(T.green, 0.55);
            for (let i = 0; i < n; i++) {
                const tx = x + x0 + i * step;
                for (let j = 0; j < 2; j++) {
                    const ph = s.calm ? hash2(s.id + i, j + 3) : (s.t * 0.35 + hash2(s.id + i, j)) % 1;
                    px(g, tx + 1 + ((i + j) & 1), y + H - 8 - Math.round(ph * (H - 15)), 1, 1, bubble, 0.85 * (1 - 0.5 * ph));
                }
            }
            return;
        }
    }
}
const leafPx = (g, x, y, k, a) => px(g, x, y, 1, 1, k < 0.4 ? LEAF.hi : k < 0.75 ? LEAF.mid : LEAF.lo, a);
function plant(g, sx, base, h, seed, a) {
    px(g, sx, base - h, 1, h, LEAF.lo, a);
    for (let r = 1; r <= h; r++) {
        const side = r & 1 ? -1 : 1;
        leafPx(g, sx + side, base - r, hash2(seed, r), a);
        if (r > 1 && h > 2 && r === h)
            leafPx(g, sx - side, base - r, hash2(seed, r + 5), a);
    }
}
/** Greentech stage extras painted into the body: moss, fungus shelves, vines, plants, a fish tank, a garden. */
export function greenSkin(g, x, y, W, p) {
    const e = p.effects;
    const a = p.alpha;
    const s = p.seed;
    if (e.has("moss")) {
        const n = Math.max(2, Math.floor(W / 9));
        for (let k = 0; k < n; k++) {
            const mx = x + 1 + Math.floor(hash2(s, k) * (W - 5));
            const top = hash2(s, k + 40) < 0.4;
            const w = 2 + Math.floor(hash2(s, k + 8) * 3);
            px(g, mx, top ? y : y + H - 2, w, 2, MOSS, 0.8 * a);
            px(g, mx + 1, top ? y : y + H - 2, Math.max(1, w - 2), 1, MOSS_LT, 0.8 * a);
        }
        px(g, x + 1, y + H - 3, 1, 3, MOSS, 0.8 * a);
        px(g, x + W - 2, y + H - 3, 1, 3, MOSS, 0.8 * a);
    }
    if (e.has("fungus") && p.horror > 0) {
        const fa = p.horror * a;
        const n = Math.max(1, Math.floor(H / 14));
        for (let k = 0; k < n; k++) {
            for (const left of [true, false]) {
                if (hash2(s + (left ? 0 : 7), k + 20) < 0.35)
                    continue;
                const fx = left ? x + 1 : x + W - 6;
                const fy = y + 6 + k * 12 + Math.floor(hash2(s, k + (left ? 50 : 60)) * 5);
                if (fy + 4 > y + H - 3)
                    continue;
                // Shelf: a pale cap, gill ticks under it, a shadow.
                px(g, fx, fy, 5, 1, CAP, 0.9 * fa);
                px(g, fx + 1, fy - 1, 3, 1, lt(CAP, 0.3), 0.8 * fa);
                for (let q = 0; q < 5; q += 2)
                    px(g, fx + q, fy + 1, 1, 2, GILL, 0.85 * fa);
                px(g, fx + 1, fy + 3, 3, 1, T.ink, 0.3 * fa);
            }
        }
    }
    if (e.has("vines")) {
        const n = Math.max(1, Math.floor(W / 12));
        for (let k = 0; k < n; k++) {
            const vx = x + 2 + Math.floor(hash2(s, k + 70) * (W - 5));
            const len = 5 + Math.floor(hash2(s, k + 71) * 12);
            for (let r = 0; r < len; r++) {
                px(g, vx + (r % 5 < 2 ? 0 : 1), y + r, 1, 1, LEAF.lo, a);
                if (r % 3 === 1)
                    leafPx(g, vx + (r % 2 ? -1 : 2), y + r, hash2(s + k, r), a);
            }
        }
    }
    if (e.has("plants")) {
        const n = Math.max(1, Math.floor(W / 10));
        for (let k = 0; k < n; k++) {
            const sx = x + 3 + Math.floor(hash2(s, k + 90) * (W - 7));
            plant(g, sx, y + 1, 2 + Math.floor(hash2(s, k + 91) * 3), s + k, a);
        }
    }
    const tank = e.has("tank") ? tankRect(W) : null;
    if (tank) {
        const tx = x + tank.x;
        const ty = y + tank.y;
        px(g, tx, ty, tank.w, tank.h, GLASS);
        px(g, tx + 1, ty + 1, tank.w - 2, tank.h - 2, WATER, 0.9);
        px(g, tx + 1, ty + tank.h - 3, tank.w - 2, 2, SOIL);
        plant(g, tx + 3, ty + tank.h - 3, 3, s + 5, a);
        px(g, tx, ty, tank.w, 1, lt(GLASS, 0.35));
        px(g, tx + 1, ty + 1, 1, tank.h - 3, T.paper, 0.18);
        // A resting fish (live fish swim over it).
        px(g, tx + tank.w - 6, ty + 3, 2, 1, FISH);
    }
    if (e.has("garden")) {
        // Planter box along the top with plants and flowers, ivy down both sides.
        px(g, x + 1, y, W - 2, 3, HOUSING.line);
        px(g, x + 2, y + 1, W - 4, 1, SOIL);
        for (let sx = x + 3; sx < x + W - 3; sx += 3) {
            const h = 2 + Math.floor(hash2(s, sx) * 2);
            plant(g, sx, y + 1, h, s + sx, a);
            if (hash2(s, sx + 3) < 0.4)
                px(g, sx, y - h, 1, 1, FLOWERS[Math.floor(hash2(sx, s) * 3) % 3], a);
        }
        for (const ix of [x + 1, x + W - 2]) {
            const len = 8 + Math.floor(hash2(s, ix) * 10);
            for (let r = 3; r < len; r++)
                leafPx(g, ix, y + r, hash2(ix, r), r % 2 ? a : 0.7 * a);
        }
    }
}
/** Synthetic Mind stage extras painted into the body: finer light lines, brighter glass, monolithic panels, light-only geometry. */
export function synthSkin(g, x, y, W, p) {
    const e = p.effects;
    if (e.has("glass")) {
        px(g, x + 1, y + 2, W - 2, 4, T.paper, 0.07);
        px(g, x + 1, y + 6, W - 2, 3, T.paper, 0.04);
        const len = Math.min(H - 6, (W - 5) * 2);
        for (let r = 0; r < len; r++)
            px(g, x + 2 + (r >> 1), y + 3 + r, 1, 1, T.paper, 0.16);
    }
    if (e.has("panels")) {
        px(g, x + 2, y + 3, W - 4, H - 6, dk(T.housing, 0.25), 0.82);
        px(g, x + 2, y + 3, W - 4, 1, lt(T.housingHi, 0.3), 0.5);
        px(g, x + 2, y + H - 4, W - 4, 1, T.ink, 0.5);
    }
    if (e.has("lines")) {
        px(g, x + 2, y + 1, W - 4, 1, T.brass, 0.5);
        px(g, x + 2, y + H - 2, W - 4, 1, T.brass, 0.35);
        px(g, x + 1, y + 2, 1, 3, T.brass, 0.6);
        px(g, x + W - 2, y + H - 5, 1, 3, T.brass, 0.6);
    }
    if (e.has("light")) {
        // The body gives way to its outline: ink panel, a 1-px cyan frame and two seams.
        px(g, x + 1, y + 1, W - 2, H - 2, T.ink, 0.88);
        px(g, x + 1, y + 1, W - 2, 1, T.brass, 0.9);
        px(g, x + 1, y + H - 2, W - 2, 1, T.brass, 0.9);
        px(g, x + 1, y + 2, 1, H - 4, T.brass, 0.9);
        px(g, x + W - 2, y + 2, 1, H - 4, T.brass, 0.9);
        px(g, x + 2, y + Math.floor(H / 2), W - 4, 1, T.brass, 0.4);
        px(g, x + Math.floor(W / 3), y + 2, 1, H - 4, T.brass, 0.3);
    }
}
// ─── Path live extras (every frame) ────────────────────────────────────
/** Fish swimming in the tank, bubbles, drifting spores (greentech); a light travelling the hairline (synthetic). */
export function pathLive(g, x, y, W, id, t, calm, effects, horror) {
    if (effects.has("tank")) {
        const tank = tankRect(W);
        if (tank) {
            const tx = x + tank.x;
            const ty = y + tank.y;
            for (let k = 0; k < 2; k++) {
                const u = calm ? 0.3 + 0.4 * k : (Math.sin(t * (0.5 + 0.2 * k) + id + k * 2) + 1) / 2;
                const fx = tx + 1 + Math.floor(u * (tank.w - 5));
                const dir = calm ? 1 : Math.cos(t * (0.5 + 0.2 * k) + id + k * 2) >= 0 ? 1 : -1;
                const fy = ty + 2 + k * 2;
                px(g, fx, fy, 2, 1, FISH);
                px(g, dir > 0 ? fx - 1 : fx + 2, fy, 1, 1, lt(FISH, 0.2));
                px(g, dir > 0 ? fx + 1 : fx, fy - 1, 1, 1, T.paper, 0.6);
            }
            if (!calm) {
                const ph = (t * 0.6 + hash2(id, 9)) % 1;
                px(g, tx + tank.w - 4, ty + tank.h - 4 - Math.round(ph * (tank.h - 5)), 1, 1, T.paper, 0.6 * (1 - ph));
            }
        }
    }
    if (!calm && effects.has("fungus") && horror > 0) {
        for (let k = 0; k < 2; k++) {
            const ph = (t * 0.12 + hash2(id, k + 11)) % 1;
            const sx = x + 2 + Math.floor(hash2(id, k + 13) * (W - 4)) + Math.round(Math.sin(t * 0.8 + k * 3) * 2);
            px(g, Math.max(x + 1, Math.min(x + W - 2, sx)), y + H - 6 - Math.round(ph * (H - 9)), 1, 1, CAP, 0.45 * (1 - ph) * horror);
        }
    }
    if (!calm && effects.has("lines")) {
        const pos = Math.floor(t * 14 + hash2(id, 2) * (W - 4)) % Math.max(1, W - 5);
        px(g, x + 2 + pos, y + 1, 2, 1, T.paper, 0.75);
    }
}
