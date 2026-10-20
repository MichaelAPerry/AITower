import { Graphics } from "pixi.js";
import { botDims, botKind, crateCount, hoverOffset, rotorSpeed } from "../botArt";
import { floorTop } from "../camera";
import { hex, satisfactionColor } from "../color";
import { FAC_BOTTOM, TILE } from "../constants";
import { BLOOD, BRASS, CRATE, FLESH, STEEL, T, dk, lt, mat, mix } from "../palette";
import { px } from "./draw";
export const BOT_W = 12;
export const BOT_H = 12;
/** World-space bounding box (left, top) of a bot at fractional tile x / floor; `w` is its body width (lifters are wider). */
export const botBox = (view, x, floor, w = BOT_W) => ({
    x: Math.round((x + 0.5) * TILE - w / 2),
    y: Math.round(floorTop(view, floor) + FAC_BOTTOM - BOT_H),
});
function crate(c, lx, ly) {
    c.R(lx, ly, 5, 5, CRATE.lo);
    c.R(lx, ly, 5, 1, CRATE.hi);
    c.R(lx, ly + 1, 4, 3, CRATE.mid);
    c.R(lx + 1, ly + 2, 2, 1, CRATE.stamp);
}
function batteryGauge(c, y) {
    const bw = Math.max(1, Math.round(6 * Math.max(0, Math.min(1, c.b.battery))));
    px(c.g, c.x + 3, y, 6, 1, T.ink, 0.8);
    px(c.g, c.x + 3, y, bw, 1, satisfactionColor(c.b.battery));
    if (c.b.state === "charging")
        px(c.g, c.x + 10, y - 1, 1, 3, Math.floor(c.t * 3) % 2 ? T.amber : T.amberDim);
}
/** One cyan eye; amber while repairing, green while charging. */
const eyeColor = (b) => (b.state === "repairing" ? lt(T.amber, 0.6) : b.state === "charging" ? T.green : T.brass);
function drawRover(c, crates) {
    const { R, m, b, t } = c;
    const repairing = b.state === "repairing";
    const bob = c.moving && Math.floor(t * 8) % 2 === 0 ? 1 : 0;
    // Carried crate strapped to the back.
    if (crates > 0) {
        R(0, 1 + bob, 5, 5, CRATE.lo);
        R(0, 1 + bob, 5, 1, CRATE.hi);
        R(0, 2 + bob, 4, 3, CRATE.mid);
        R(1, 3 + bob, 2, 1, CRATE.stamp);
    }
    // Dome head with brass collar.
    R(4, 0 + bob, 4, 1, m.line);
    R(3, 1 + bob, 6, 1, m.hi);
    R(2, 2 + bob, 8, 2, m.mid);
    R(2, 2 + bob, 1, 2, m.line);
    R(9, 2 + bob, 1, 2, m.line);
    R(3, 2 + bob, 2, 1, m.hi);
    R(5, -1 + bob, 1, 1, BRASS.hi); // knob
    R(1, 4 + bob, 10, 1, BRASS.mid);
    R(1, 4 + bob, 1, 1, BRASS.hi);
    // The eye: dark socket, glowing lens.
    const eye = eyeColor(b);
    R(7, 2 + bob, 3, 2, T.ink);
    R(8, 2 + bob, 1, 1, eye);
    if (Math.floor(t * 1.3 + b.id) % 7 !== 0)
        R(8, 3 + bob, 1, 1, dk(eye, 0.4));
    // Filing-cabinet body with two drawers.
    R(1, 5, 10, 4, m.line);
    R(2, 5, 8, 3, m.mid);
    R(2, 5, 8, 1, m.hi);
    R(2, 7, 8, 1, m.lo);
    R(5, 6, 2, 1, BRASS.mid);
    R(5, 8, 2, 1, BRASS.lo);
    // Arm + welding torch.
    if (repairing)
        torch(c, 10, 6, 5);
    else
        R(10, 6, 1, 2, STEEL.lo);
    // Treads with rolling links.
    R(0, 9, 12, 3, T.ink);
    R(1, 9, 10, 1, dk(T.steel, 0.35));
    const ph = c.moving ? Math.floor(t * 14) % 3 : 0;
    for (let k = 1 + ph; k < 11; k += 3)
        R(k, 11, 1, 1, STEEL.lo);
    for (const wx of [1, 5, 9])
        R(wx, 10, 2, 1, STEEL.mid);
    batteryGauge(c, c.y - 4);
}
/** Arm at local (lx, ly) ending in a welding torch whose tip sits at row `tipY`; registers the tip for sparks. */
function torch(c, lx, ly, tipY) {
    c.R(lx, ly, 2, 1, STEEL.mid);
    c.R(lx + 2, ly - 1, 1, 2, STEEL.hi);
    const tip = { x: c.X(lx + 3), y: c.y + tipY };
    c.torches.push(tip);
    if (Math.floor(c.t * 20) % 3 !== 0) {
        px(c.g, tip.x - 1, tip.y - 1, 3, 3, T.amber, 0.35);
        px(c.g, tip.x, tip.y, 1, 1, lt(T.amber, 0.8));
    }
}
/** Bulky lifter (BotDef.carry > 1): 14 px wide, hazard-striped chassis, brass bumper and a crate stack on the back. */
function drawLifter(c, crates) {
    const { R, m, b, t } = c;
    const bob = c.moving && Math.floor(t * 8) % 2 === 0 ? 1 : 0;
    // Rear deck and the crate stack (grows upward past the 12-px box).
    R(0, 5, 5, 1, BRASS.lo);
    for (let k = 0; k < crates; k++)
        crate(c, 0, 0 - 5 * k + bob);
    if (crates > 0)
        R(2, 0 - 5 * (crates - 1) - 1 + bob, 1, 5 * crates + 1, STEEL.lo, 0.8); // binding strap
    // Dome head.
    R(7, 0 + bob, 4, 1, m.line);
    R(6, 1 + bob, 6, 1, m.hi);
    R(5, 2 + bob, 8, 2, m.mid);
    R(5, 2 + bob, 1, 2, m.line);
    R(12, 2 + bob, 1, 2, m.line);
    R(6, 2 + bob, 2, 1, m.hi);
    R(8, -1 + bob, 1, 1, BRASS.hi);
    R(4, 4 + bob, 10, 1, BRASS.mid);
    R(4, 4 + bob, 1, 1, BRASS.hi);
    const eye = eyeColor(b);
    R(10, 2 + bob, 3, 2, T.ink);
    R(11, 2 + bob, 1, 1, eye);
    if (Math.floor(t * 1.3 + b.id) % 7 !== 0)
        R(11, 3 + bob, 1, 1, dk(eye, 0.4));
    // Heavy chassis with a hazard stripe.
    R(1, 5, 13, 4, m.line);
    R(2, 5, 11, 3, m.mid);
    R(2, 5, 11, 1, m.hi);
    R(2, 7, 11, 1, m.lo);
    for (let k = 0; k < 11; k += 2)
        R(2 + k, 8, 1, 1, T.amber);
    R(7, 6, 2, 1, BRASS.mid);
    // Brass bumper / mast on the front.
    R(13, 2, 1, 8, BRASS.mid);
    R(13, 2, 1, 1, BRASS.hi);
    if (b.state === "repairing")
        torch(c, 13, 6, 5);
    // Heavier treads.
    R(0, 9, 14, 3, T.ink);
    R(1, 9, 12, 1, dk(T.steel, 0.35));
    const ph = c.moving ? Math.floor(t * 12) % 3 : 0;
    for (let k = 1 + ph; k < 13; k += 3)
        R(k, 11, 1, 1, STEEL.lo);
    for (const wx of [1, 4, 8, 11])
        R(wx, 10, 2, 1, STEEL.mid);
    batteryGauge(c, c.y - 4);
}
/**
 * Rotor drone (BotDef.flying): pod body on skids under two rotor masts. Hovers above the floor line; blades blur
 * while spinning (steady blur under reduced motion), droop when landed. A parcel hangs underneath when carrying.
 */
function drawDrone(c, crates, speed, hover, nearFloor) {
    const { g, R, m, b, t } = c;
    const y0 = c.y - hover; // shift everything up by the hover height
    const r = (lx, ly, w, h, col, a = 1) => R(lx, ly - hover, w, h, col, a);
    // Ground shadow when close to a floor.
    if (hover > 0 && nearFloor)
        px(g, c.X(3, 6), c.y + BOT_H - 1, 6, 1, T.ink, 0.35);
    const bob = speed > 0 && !c.calm && Math.floor(t * 6 + b.id) % 2 === 0 ? 1 : 0;
    const by = bob;
    // Rotor masts and hubs.
    for (const lx of [2, 9]) {
        r(lx, 2 + by, 1, 3, STEEL.lo);
        r(lx, 1 + by, 1, 1, BRASS.mid);
    }
    // Blades (light on a dark under-line so they read against the slab behind).
    const blade = lt(STEEL.hi, 0.4);
    for (const lx of [0, 7]) {
        if (speed === 0) {
            r(lx, 2 + by, 2, 1, STEEL.mid); // landed: drooping
            r(lx + 3, 2 + by, 2, 1, STEEL.mid);
            continue;
        }
        r(lx, 1 + by, 5, 1, T.ink, 0.35);
        if (c.calm) {
            r(lx, 0 + by, 5, 1, blade, 0.6); // steady blur
            r(lx + 1, 0 + by, 3, 1, blade);
        }
        else {
            const wdt = Math.floor(t * 30 * speed + lx) % 3 === 0 ? 5 : 3;
            r(lx, 0 + by, 5, 1, STEEL.mid, 0.4);
            r(lx + (5 - wdt) / 2, 0 + by, wdt, 1, blade);
        }
    }
    // Pod body.
    r(2, 4 + by, 8, 1, BRASS.mid);
    r(2, 4 + by, 1, 1, BRASS.hi);
    r(1, 5 + by, 10, 4, m.line);
    r(2, 5 + by, 8, 3, m.mid);
    r(2, 5 + by, 8, 1, m.hi);
    r(2, 7 + by, 8, 1, m.lo);
    // Camera eye.
    const eye = eyeColor(b);
    r(7, 5 + by, 3, 2, T.ink);
    r(8, 5 + by, 1, 1, eye);
    r(5, 6 + by, 2, 1, BRASS.lo);
    // Skids.
    r(2, 9 + by, 1, 2, STEEL.lo);
    r(9, 9 + by, 1, 2, STEEL.lo);
    r(1, 10 + by, 4, 1, STEEL.mid);
    r(7, 10 + by, 4, 1, STEEL.mid);
    // Parcel on a strap under the pod.
    if (crates > 0) {
        r(5, 9 + by, 1, 1, STEEL.lo);
        r(4, 10 + by, 4, 2, CRATE.mid);
        r(4, 10 + by, 4, 1, CRATE.hi);
        r(5, 11 + by, 2, 1, CRATE.stamp);
    }
    if (b.state === "repairing") {
        const tip = { x: c.X(11), y: y0 + 7 + by };
        r(10, 7 + by, 1, 1, STEEL.mid);
        c.torches.push(tip);
        if (Math.floor(t * 20) % 3 !== 0) {
            px(g, tip.x - 1, tip.y - 1, 3, 3, T.amber, 0.35);
            px(g, tip.x, tip.y, 1, 1, lt(T.amber, 0.8));
        }
    }
    batteryGauge(c, y0 - 3);
}
const MUT = {
    standard: { eye: [3, 2], patch: [4, 1, 3, 2] },
    lifter: { eye: [6, 2], patch: [7, 1, 3, 2] },
    drone: { eye: [3, 5], patch: [4, 7, 3, 2] },
};
/**
 * Mutated bots ("reclassified"): `fleshed` gets a flesh patch on the head, `tendriled` gets tendrils trailing from the back;
 * the second, smaller eye needs the `eyes` stage (full intensity, stage 3). With horror off a plain amber band marks the trait.
 */
function mutate(c, kind, h) {
    const trait = c.b.trait;
    if (!trait)
        return;
    const geo = MUT[kind];
    const { R } = c;
    if (h.alpha <= 0) {
        R(geo.patch[0], geo.patch[1] - 1, 4, 1, T.amber);
        return;
    }
    const a = h.alpha === 1 ? 1 : 0.6;
    if (trait === "fleshed") {
        const [px0, py0, pw, ph] = geo.patch;
        R(px0, py0, pw, ph, FLESH.mid, a);
        R(px0, py0, pw - 1, 1, FLESH.hi, a);
        R(px0 + 1, py0 + 1, 1, 1, BLOOD.mid, a);
    }
    else {
        const base = kind === "drone" ? 8 : 6;
        for (let j = 0; j < 3; j++)
            for (let k = 0; k < 4; k++) {
                const wig = c.calm ? 0 : Math.round(Math.sin(c.t * 3 + j * 1.7 + k * 0.8));
                R(-1 - k, base + j * 2 + wig, 1, 1, k === 3 ? BLOOD.hi : FLESH.mid, a);
            }
    }
    if (h.eyes) {
        R(geo.eye[0], geo.eye[1], 2, 2, T.ink);
        R(geo.eye[0], geo.eye[1], 1, 1, mix(T.bile, T.paper, 0.5));
    }
}
export class Bots {
    content;
    g = new Graphics();
    /** Welding-torch tips of repairing bots this frame (world px), for the sparks effect. */
    torches = [];
    facing = new Map();
    constructor(content) {
        this.content = content;
    }
    draw(view, pos, vel, t, opt, horror) {
        const g = this.g;
        g.clear();
        this.torches.length = 0;
        for (const b of view.bots) {
            const p = pos(b);
            const v = vel(b);
            const def = this.content.bots[b.defId];
            const kind = botKind(def);
            const dims = botDims(kind);
            const { x, y } = botBox(view, p.x, p.y, dims.w);
            const m = mat(mix(T.paper, def ? hex(def.color) : T.steel, 0.12));
            const moving = Math.abs(v.x) > 1e-4 || Math.abs(v.y) > 1e-4;
            if (v.x > 1e-4)
                this.facing.set(b.id, 1);
            else if (v.x < -1e-4)
                this.facing.set(b.id, -1);
            const face = this.facing.get(b.id) ?? 1;
            const w = dims.w;
            // Mirror helper: local x (from the back) → world x.
            const X = (lx, wd = 1) => (face > 0 ? x + lx : x + w - lx - wd);
            const R = (lx, ly, wd, h, c, a = 1) => px(g, X(lx, wd), y + ly, wd, h, c, a);
            const ctx = { g, x, y, w, face, t, b, m, moving, calm: opt?.reducedMotion === true, torches: this.torches, X, R };
            const crates = crateCount(def, b.carrying);
            if (kind === "drone") {
                const near = Math.abs(p.y - Math.round(p.y)) < 0.05;
                const hover = hoverOffset(b.state);
                drawDrone(ctx, crates, rotorSpeed(b.state), hover, near);
                if (horror && b.trait)
                    mutate({ ...ctx, R: (lx, ly, wd, h, c2, a2) => R(lx, ly - hover, wd, h, c2, a2) }, "drone", horror);
            }
            else if (kind === "lifter") {
                drawLifter(ctx, crates);
                if (horror && b.trait)
                    mutate(ctx, "lifter", horror);
            }
            else {
                drawRover(ctx, crates);
                if (horror && b.trait)
                    mutate(ctx, "standard", horror);
            }
        }
    }
}
