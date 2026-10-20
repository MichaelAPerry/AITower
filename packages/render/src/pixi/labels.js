/** World-space text (VT323) — a small pool of Pixi `Text` objects reused frame to frame. */
import { Container, Text } from "pixi.js";
/** STYLE.md §3: VT323 for all in-world numbers and labels. The app loads it before the renderer is created. */
export const WORLD_FONT = '"VT323", ui-monospace, monospace';
export class TextPool {
    fontSize;
    resolution;
    root = new Container();
    items = [];
    fills = [];
    used = 0;
    constructor(fontSize, resolution = 4) {
        this.fontSize = fontSize;
        this.resolution = resolution;
    }
    /** Start a frame: every label is hidden until `put` is called again. */
    begin() {
        this.used = 0;
    }
    /** Place a label (anchor 0.5,0.5). Only re-rasterises when text or colour changed. */
    put(text, x, y, fill) {
        let t = this.items[this.used];
        if (!t) {
            t = new Text({ text, style: { fontFamily: WORLD_FONT, fontSize: this.fontSize, fill }, resolution: this.resolution });
            t.anchor.set(0.5, 0.5);
            this.items.push(t);
            this.fills.push(fill);
            this.root.addChild(t);
        }
        if (t.text !== text)
            t.text = text;
        if (this.fills[this.used] !== fill) {
            this.fills[this.used] = fill;
            t.style.fill = fill;
        }
        t.position.set(x, y);
        t.visible = true;
        this.used++;
        return t;
    }
    end() {
        for (let i = this.used; i < this.items.length; i++)
            this.items[i].visible = false;
    }
}
