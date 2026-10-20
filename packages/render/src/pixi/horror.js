import { Container, Graphics } from "pixi.js";
import { floorTop } from "../camera";
import { CABLE_Y, FLOOR_H, PIPE_RETURN_Y, PIPE_SUPPLY_Y, SLAB_H, TILE, WAINSCOT_Y } from "../constants";
import { breathFrame, creepBlock, hash2, horrorKey } from "../horror";
import { COPPER, T, dk, lt, mix } from "../palette";
import { dither, disc, px } from "./draw";
const DAMP = mix(T.ink, T.bile, 0.3);
const WAINSCOT = dk(T.wall, 0.5);
export class HorrorLayer {
    /** Static decals; sits above the conduits, below the facility bodies. */
    decals = new Graphics();
    /** Breathing wainscot frame; same depth as the decals. */
    breath = new Graphics();
    /** Beads and vein pulses; sits above the facilities. */
    live = new Graphics();
    root = new Container();
    key = "";
    frame = -1;
    beads = [];
    pulses = [];
    constructor() {
        this.root.addChild(this.decals, this.breath);
    }
    /** True when `rebuild` is needed for these inputs. */
    needsRebuild(layoutKey, s) {
        return `${layoutKey}|${horrorKey(s)}` !== this.key;
    }
    rebuild(view, layoutKey, s) {
        this.key = `${layoutKey}|${horrorKey(s)}`;
        this.frame = -1; // force the breathing layer to redraw
        const g = this.decals;
        g.clear();
        this.beads = [];
        this.pulses = [];
        if (s.alpha <= 0)
            return;
        const a = s.alpha;
        const { width, floorMin, floorMax, slab, power, coolant } = view;
        for (let f = floorMin; f <= floorMax; f++) {
            const top = floorTop(view, f);
            for (let x = 0; x < width; x++) {
                const i = (f - floorMin) * width + x;
                if (!slab[i])
                    continue;
                const wx = x * TILE;
                if (s.damp && hash2(x * 5 + 1, f * 3 + 7) < 0.16) {
                    const sx = wx + 2 + Math.floor(hash2(x, f) * 10);
                    const len = 8 + Math.floor(hash2(f, x + 4) * 12);
                    const y0 = top + 12;
                    px(g, sx, y0, 2, len, DAMP, 0.45 * a);
                    dither(g, sx - 1, y0 + len, 4, 2, DAMP, 0.4 * a);
                }
                if (coolant[i]) {
                    if (s.damp && hash2(x * 3, f * 11) < 0.5) {
                        const bx = wx + 3 + Math.floor(hash2(x, f + 2) * 9);
                        px(g, bx, top + PIPE_SUPPLY_Y + 3, 1, 1, lt(COPPER.mid, 0.6), 0.8 * a);
                        if (hash2(x, f + 6) < 0.5)
                            this.beads.push({ x: bx, y: top + PIPE_SUPPLY_Y + 3, seed: x * 7 + f });
                    }
                    if (s.veined) {
                        // Bile-green coolant return, cloudy.
                        px(g, wx, top + PIPE_RETURN_Y, TILE, 3, T.bile, (0.3 + 0.4 * s.amount) * a);
                        dither(g, wx, top + PIPE_RETURN_Y, TILE, 3, T.paper, 0.12 * a);
                    }
                }
                if (s.veined) {
                    const cov = 0.25 + 0.7 * s.amount;
                    if (power[i] && hash2(x * 2 + 1, f * 5) < cov) {
                        const y = top + CABLE_Y;
                        for (let k = 0; k < TILE; k++)
                            px(g, wx + k, y + ((k >> 2) & 1), 1, 1, T.blood, 0.85 * a);
                        if (hash2(x, f + 8) < 0.5)
                            this.pulses.push({ x: wx, y, seed: x * 3 + f });
                    }
                    if (hash2(x * 3 + 2, f * 7) < cov * 0.8)
                        dither(g, wx, top + 1, TILE, 6, T.flesh, (0.3 + 0.35 * s.amount) * a, 2);
                }
                if (s.tissue) {
                    const sy = top + FLOOR_H - SLAB_H;
                    for (let by = 0; by < 2; by++)
                        for (let bx = 0; bx < 8; bx++) {
                            if (!creepBlock(x, f, bx, by, s.creep))
                                continue;
                            const v = hash2(x * 8 + bx, f * 2 + by);
                            px(g, wx + bx * 2, sy + by * 2, 2, 2, v < 0.5 ? T.flesh : v < 0.85 ? mix(T.flesh, T.blood, 0.4) : T.blood, 0.9 * a);
                        }
                    for (let bx = 0; bx < 8; bx++)
                        if (creepBlock(x + 99, f, bx, 0, s.creep * 0.7))
                            px(g, wx + bx * 2, top + CABLE_Y + 1, 2, 2, T.flesh, 0.8 * a);
                }
            }
        }
        void floorMax;
    }
    /** Breathing walls: two frames at 0.2 Hz; the inflated frame lifts the wainscot a pixel and flushes it flesh-tone. */
    updateBreath(view, s, t, opt) {
        const fr = s.breathing && s.alpha > 0 ? breathFrame(t, opt.reducedMotion) : 0;
        if (fr === this.frame)
            return;
        this.frame = fr;
        const g = this.breath;
        g.clear();
        if (fr === 0)
            return;
        const a = s.alpha;
        const { width, floorMin, floorMax, slab } = view;
        for (let f = floorMin; f <= floorMax; f++) {
            const top = floorTop(view, f);
            for (let x = 0; x < width; x++) {
                if (!slab[(f - floorMin) * width + x])
                    continue;
                const wx = x * TILE;
                px(g, wx, top + WAINSCOT_Y - 1, TILE, 1, WAINSCOT, 0.9);
                dither(g, wx, top + WAINSCOT_Y + 2, TILE, 8, T.flesh, 0.25 * a, 2);
            }
        }
    }
    /** Per-frame beads and vein pulses, culled to the viewport. */
    update(vp, s, t, opt) {
        const g = this.live;
        g.clear();
        if (s.alpha <= 0 || opt.reducedMotion)
            return;
        const a = s.alpha;
        for (const b of this.beads) {
            if (b.x < vp.x0 || b.x > vp.x1 || b.y < vp.y0 || b.y > vp.y1)
                continue;
            const ph = (t * 0.16 + hash2(b.seed, 1)) % 1;
            if (ph > 0.8)
                continue;
            disc(g, b.x - 1, b.y + Math.round(ph * 14), 3, lt(COPPER.mid, 0.55), 0.85 * a);
        }
        for (const p of this.pulses) {
            if (p.x < vp.x0 || p.x > vp.x1 || p.y < vp.y0 || p.y > vp.y1)
                continue;
            const dx = Math.floor((t * 5 + p.seed * 3) % TILE);
            px(g, p.x + dx, p.y + ((dx >> 2) & 1), 1, 1, lt(T.blood, 0.55), 0.95 * a);
        }
    }
}
