import { Container, Graphics, Sprite, Texture } from "pixi.js";
import { floorTop } from "../camera";
import { alertColor, heatAlpha, heatColor, loadColor, netColor, rackTempColor, satisfactionColor } from "../color";
import { FAC_BOTTOM, FAC_TOP, FLOOR_H, MARGIN_BOTTOM, MARGIN_TOP, MARGIN_X, TILE } from "../constants";
import { contaminationColor, contaminationTexels, nutrientNetColor, nutrientSatisfaction, TEXEL } from "../horror";
import { drawCoolant, drawNutrient, drawPower } from "./conduits";
import { box, px } from "./draw";
import { T, dk, lt, mix } from "../palette";
const NONE = T.steel;
const DIM = T.ink;
/** Power nets: amber first, then other phosphor tints (bright, readable over the dimmed world). */
const powerNet = (id) => lt(netColor(id), 0.15);
/** Coolant nets: copper / verdigris highlights, nudged toward the net tint so separate loops differ. */
const coolNet = (base, id) => lt(id <= 0 ? base : mix(base, netColor(id + 1), 0.45), 0.3);
export class Overlays {
    content;
    root = new Container();
    base = new Graphics();
    anim = new Graphics();
    /** Contamination field: one dithered RGBA data texture for the whole tower, scaled 2× with nearest sampling. */
    field = new Sprite();
    canvas = null;
    tex = null;
    constructor(content) {
        this.content = content;
        this.field.visible = false;
        this.root.addChild(this.base, this.field, this.anim);
    }
    destroy() {
        this.tex?.destroy(true);
        this.tex = null;
    }
    /** Rebuilt once per tick (and when the mode or colour-blind option changes). */
    rebuild(view, mode, opt) {
        const g = this.base;
        g.clear();
        this.field.visible = false;
        if (mode === "nutrient")
            this.nutrient(view, opt.colorBlind);
        else if (mode === "contamination")
            this.contamination(view, opt.colorBlind);
        else if (mode === "heat")
            this.heat(view, opt.colorBlind);
        else if (mode === "power")
            this.power(view, opt.colorBlind);
        else if (mode === "coolant")
            this.coolant(view, opt.colorBlind);
    }
    dim(view, alpha) {
        const h = (view.floorMax - view.floorMin + 1) * FLOOR_H;
        px(this.base, -MARGIN_X - 4000, -MARGIN_TOP - 4000, view.width * TILE + 2 * MARGIN_X + 8000, h + MARGIN_TOP + MARGIN_BOTTOM + 8000, DIM, alpha);
    }
    heat(view, cb) {
        const g = this.base;
        this.dim(view, 0.5);
        const { width, floorMin, floorMax, airTemp, slab } = view;
        for (let f = floorMin; f <= floorMax; f++) {
            const top = floorTop(view, f);
            for (let x = 0; x < width; x++) {
                const i = (f - floorMin) * width + x;
                const t = airTemp[i];
                const a = heatAlpha(t) * (slab[i] ? 1 : 0.45);
                px(g, x * TILE, top, TILE, FLOOR_H, heatColor(t, cb), a);
            }
        }
        for (const fv of view.facilities) {
            const def = this.content.facilities[fv.defId];
            if (def?.kind !== "rack")
                continue;
            const x = fv.x * TILE;
            const y = floorTop(view, fv.floor) + FAC_TOP;
            const c = rackTempColor(fv.tempC, cb);
            px(g, x + 1, y, def.width * TILE - 1, FAC_BOTTOM - FAC_TOP, c, 0.55);
            box(g, x + 1, y, def.width * TILE - 1, FAC_BOTTOM - FAC_TOP, lt(c, 0.45), 0.9);
        }
    }
    /** Nutrient nets (bile-pale lines) and a fed / starved box on every device that eats or makes feed. */
    nutrient(view, cb) {
        const g = this.base;
        this.dim(view, 0.62);
        const nets = new Map(view.nutrientNets.map((n) => [n.id, n]));
        drawNutrient(g, view, (i) => (view.nutrientNetOf[i] >= 0 ? nutrientNetColor(view.nutrientNetOf[i]) : NONE));
        for (const fv of view.facilities) {
            const def = this.content.facilities[fv.defId];
            if (!def)
                continue;
            const needs = def.placement?.needsNutrient || def.kind === "nutrient" || def.kind === "bioreactor" || def.rack?.cooling === "bio";
            if (!needs && fv.nutrientNet === null)
                continue;
            const x = fv.x * TILE;
            const y = floorTop(view, fv.floor) + FAC_TOP;
            const w = def.width * TILE - 1;
            const h = FAC_BOTTOM - FAC_TOP;
            const sat = nutrientSatisfaction(fv.nutrientNet !== null ? nets.get(fv.nutrientNet) : undefined, fv.status);
            const c = satisfactionColor(sat, cb);
            px(g, x + 1, y, w, h, c, 0.3);
            box(g, x + 1, y, w, h, fv.nutrientNet !== null ? nutrientNetColor(fv.nutrientNet) : alertColor(cb), 1);
        }
    }
    /** Dithered contamination heat map (bile, flesh, blood; blue / orange when colour-blind) built from the data texture. */
    contamination(view, cb) {
        const g = this.base;
        this.dim(view, 0.55);
        const t = contaminationTexels(view.width, view.floorMin, view.floorMax, view.contamination, view.slab, cb);
        if (typeof document !== "undefined") {
            if (!this.canvas || this.canvas.width !== t.width || this.canvas.height !== t.height) {
                this.canvas = document.createElement("canvas");
                this.canvas.width = t.width;
                this.canvas.height = t.height;
                this.tex?.destroy(true);
                this.tex = Texture.from(this.canvas);
                this.tex.source.scaleMode = "nearest";
                this.field.texture = this.tex;
            }
            const ctx = this.canvas.getContext("2d");
            if (ctx && this.tex) {
                ctx.putImageData(new ImageData(t.data, t.width, t.height), 0, 0);
                this.tex.source.update();
                this.field.position.set(0, floorTop(view, view.floorMax));
                this.field.scale.set(TEXEL);
                this.field.visible = true;
            }
        }
        for (const fv of view.facilities) {
            if (fv.contamination < 0.1 && !fv.grown)
                continue;
            const def = this.content.facilities[fv.defId];
            if (!def)
                continue;
            box(g, fv.x * TILE + 1, floorTop(view, fv.floor) + FAC_TOP, def.width * TILE - 1, FAC_BOTTOM - FAC_TOP, contaminationColor(Math.max(0.5, fv.contamination), cb), 0.9);
        }
    }
    power(view, cb) {
        const g = this.base;
        this.dim(view, 0.62);
        const nets = new Map(view.powerNets.map((n) => [n.id, n]));
        drawPower(g, view, (i) => (view.powerNetOf[i] >= 0 ? powerNet(view.powerNetOf[i]) : NONE));
        for (const fv of view.facilities) {
            const def = this.content.facilities[fv.defId];
            if (!def)
                continue;
            const x = fv.x * TILE;
            const y = floorTop(view, fv.floor) + FAC_TOP;
            const w = def.width * TILE - 1;
            const h = FAC_BOTTOM - FAC_TOP;
            const net = fv.powerNet !== null ? nets.get(fv.powerNet) : undefined;
            const c = net ? satisfactionColor(net.satisfaction, cb) : alertColor(cb);
            px(g, x + 1, y, w, h, c, net ? 0.3 : 0.35);
            box(g, x + 1, y, w, h, fv.powerNet !== null ? powerNet(fv.powerNet) : alertColor(cb), 1);
        }
    }
    coolant(view, cb) {
        const g = this.base;
        this.dim(view, 0.62);
        const nets = new Map(view.coolantNets.map((n) => [n.id, n]));
        const sup = (i) => (view.coolantNetOf[i] >= 0 ? coolNet(T.copper, view.coolantNetOf[i]) : NONE);
        const ret = (i) => (view.coolantNetOf[i] >= 0 ? coolNet(T.verdigris, view.coolantNetOf[i]) : dk(NONE, 0.3));
        drawCoolant(g, view, sup, ret);
        for (const fv of view.facilities) {
            const def = this.content.facilities[fv.defId];
            if (!def)
                continue;
            const needs = def.placement?.needsCoolant || def.kind === "chiller" || def.kind === "cdu" || (def.rack?.liquidFraction ?? 0) > 0;
            if (!needs && fv.coolantNet === null)
                continue;
            const x = fv.x * TILE;
            const y = floorTop(view, fv.floor) + FAC_TOP;
            const w = def.width * TILE - 1;
            const h = FAC_BOTTOM - FAC_TOP;
            const net = fv.coolantNet !== null ? nets.get(fv.coolantNet) : undefined;
            const c = net ? loadColor(net.capacityKw > 0 ? net.loadKw / net.capacityKw : 1, cb) : alertColor(cb);
            px(g, x + 1, y, w, h, c, 0.45);
            box(g, x + 1, y, w, h, fv.coolantNet !== null ? coolNet(T.verdigris, fv.coolantNet) : alertColor(cb), 1);
        }
    }
    /** Per-frame animation: rising shimmer over hot cells in heat mode (none under reduced motion). */
    animate(view, mode, t, opt) {
        const g = this.anim;
        g.clear();
        if (mode !== "heat" || opt.reducedMotion)
            return;
        const { width, floorMin, floorMax, airTemp } = view;
        for (let f = floorMin; f <= floorMax; f++) {
            const top = floorTop(view, f);
            for (let x = 0; x < width; x++) {
                const temp = airTemp[(f - floorMin) * width + x];
                if (temp < 30)
                    continue;
                const k = Math.min(1, (temp - 30) / 15);
                for (let j = 0; j < 3; j++) {
                    const ph = (t * (0.5 + k * 0.8) + j / 3 + x * 0.13) % 1;
                    const sx = x * TILE + 3 + j * 5 + Math.round(Math.sin(t * 4 + x + j) * 1.5);
                    const sy = top + FLOOR_H - 6 - Math.round(ph * (FLOOR_H - 10));
                    px(g, sx, sy, 2, 1, T.paper, (1 - ph) * 0.35 * k);
                }
            }
        }
    }
}
