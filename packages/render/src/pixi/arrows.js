import { Container, Graphics } from "pixi.js";
import { alertArrowColor, alertSeverity, arrowPixels, computeArrows, hitArrow } from "../alerts";
import { floorTop } from "../camera";
import { FAC_BOTTOM, FAC_TOP, TILE } from "../constants";
import { T, lt } from "../palette";
import { px } from "./draw";
import { TextPool } from "./labels";
/** Screen px per arrow pixel. */
const UNIT = 2;
/** Arrow centre distance from the viewport edge. */
export const ARROW_MARGIN = 22;
/** Arrows closer than this merge into one with a count. */
export const ARROW_MERGE = 26;
/** Click radius around an arrow centre (screen px). */
export const ARROW_HIT = 14;
export class Arrows {
    content;
    root = new Container();
    g = new Graphics();
    labels = new TextPool(12, 2);
    groups = [];
    constructor(content) {
        this.content = content;
        this.root.addChild(this.g, this.labels.root);
    }
    /** Recompute and redraw for this frame's camera. */
    update(view, cam, t, opt) {
        const targets = [];
        for (const f of view.facilities) {
            const severity = alertSeverity(f.status);
            if (severity === 0)
                continue;
            const w = (this.content.facilities[f.defId]?.width ?? f.width) * TILE;
            targets.push({ id: f.id, severity, rect: { x: f.x * TILE, y: floorTop(view, f.floor) + FAC_TOP, w, h: FAC_BOTTOM - FAC_TOP } });
        }
        this.groups = computeArrows(cam, targets, ARROW_MARGIN, ARROW_MERGE);
        const g = this.g;
        g.clear();
        this.labels.begin();
        const pulse = opt.reducedMotion ? 1 : 0.78 + 0.22 * Math.sin(t * 6);
        for (const grp of this.groups) {
            const col = alertArrowColor(grp.severity, opt.colorBlind);
            const { fill, edge } = arrowPixels(grp.angle);
            const a = grp.severity >= 3 ? pulse : 1;
            // Soft halo, outline, body, light rim on the leading pixels.
            px(g, grp.x - 7 * UNIT, grp.y - 7 * UNIT, 14 * UNIT, 14 * UNIT, col, 0.12 * a);
            for (const [dx, dy] of edge)
                px(g, grp.x + dx * UNIT, grp.y + dy * UNIT, UNIT, UNIT, T.ink, 0.9);
            for (const [dx, dy] of fill)
                px(g, grp.x + dx * UNIT, grp.y + dy * UNIT, UNIT, UNIT, col, a);
            const tipX = Math.round(Math.cos(grp.angle) * 4);
            const tipY = Math.round(Math.sin(grp.angle) * 4);
            px(g, grp.x + tipX * UNIT, grp.y + tipY * UNIT, UNIT, UNIT, lt(col, 0.5), a);
            if (grp.count > 1) {
                // Count plate on the inner side of the arrow (towards the viewport centre).
                const lx = Math.round(grp.x - Math.cos(grp.angle) * 20);
                const ly = Math.round(grp.y - Math.sin(grp.angle) * 20);
                px(g, lx - 9, ly - 6, 18, 12, T.ink, 0.85);
                px(g, lx - 8, ly - 5, 16, 10, col, 0.9);
                this.labels.put(`x${grp.count}`, lx, ly, T.ink);
            }
        }
        this.labels.end();
    }
    /** The arrow under a screen point, for hover and click. */
    at(sx, sy) {
        return hitArrow(this.groups, sx, sy, ARROW_HIT);
    }
}
