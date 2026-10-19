/** Build ghost preview and pulsing selection outline. */
import type { ContentDB } from "@aitower/content";
import type { Ghost, Selection } from "@aitower/shared";
import type { SimView } from "@aitower/sim";
import { Container, Graphics, Text } from "pixi.js";
import { floorTop } from "../camera";
import { FAC_BOTTOM, FAC_TOP, FLOOR_H, TILE } from "../constants";
import type { Sample } from "../interp";
import { botDims, botKind } from "../botArt";
import { BOT_H, botBox } from "./bots";
import { box, px } from "./draw";
import { drawBody } from "./facilityArt";
import { WORLD_FONT } from "./labels";
import { BRASS, HEAT_RAMP, T, dk, lt, mix } from "../palette";

/** Cyanotype ground (the cold end of the STYLE.md heat ramp) and its chalk lines. */
const CYAN = HEAT_RAMP[0];
const CYAN_LINE = mix(T.paper, CYAN, 0.12);
const CYAN_TINT = mix(CYAN, T.paper, 0.55);
const STAMP = T.red;

export interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

export class GhostLayer {
	readonly root = new Container();
	private cells = new Graphics();
	private body = new Graphics();
	private tag = new Graphics();
	private label = new Text({ text: "", style: { fontFamily: WORLD_FONT, fontSize: 10, fill: T.ink }, resolution: 4 });
	private stamp = new Text({ text: "DENIED", style: { fontFamily: WORLD_FONT, fontSize: 11, fill: STAMP }, resolution: 4 });
	private ghost: Ghost | null = null;
	private dirty = true;
	private floorMax = Number.NaN;

	constructor(private readonly content: ContentDB) {
		this.body.alpha = 0.85;
		this.label.visible = false;
		this.label.anchor.set(0, 0.5);
		this.stamp.visible = false;
		this.stamp.anchor.set(0.5, 0.5);
		this.stamp.rotation = -0.18;
		this.root.addChild(this.cells, this.body, this.tag, this.label, this.stamp);
	}

	set(ghost: Ghost | null): void {
		this.ghost = ghost;
		this.dirty = true;
	}

	update(view: SimView, t: number): void {
		if (view.floorMax !== this.floorMax) this.dirty = true;
		if (this.dirty) this.rebuild(view);
		this.root.alpha = 0.8 + 0.2 * Math.sin(t * 6);
	}

	private rebuild(view: SimView): void {
		this.dirty = false;
		this.floorMax = view.floorMax;
		const g = this.cells;
		g.clear();
		this.body.clear();
		this.tag.clear();
		this.label.visible = false;
		this.stamp.visible = false;
		const gh = this.ghost;
		if (!gh || gh.cells.length === 0) return;
		let minX = Infinity;
		let maxX = -Infinity;
		let minY = Infinity;
		let maxY = -Infinity;
		for (const cell of gh.cells) {
			const x = cell.x * TILE;
			const y = floorTop(view, cell.floor);
			minX = Math.min(minX, x);
			maxX = Math.max(maxX, x + TILE);
			minY = Math.min(minY, y);
			maxY = Math.max(maxY, y + FLOOR_H);
			if (gh.valid) {
				// Blueprint: cyanotype wash, chalk grid, dashed outline.
				px(g, x, y, TILE, FLOOR_H, CYAN, 0.55);
				for (let k = 4; k < FLOOR_H; k += 8) px(g, x, y + k, TILE, 1, CYAN_LINE, 0.18);
				px(g, x + 8, y, 1, FLOOR_H, CYAN_LINE, 0.18);
				for (let k = 0; k < TILE; k += 4) {
					px(g, x + k, y, 2, 1, CYAN_LINE, 0.9);
					px(g, x + k, y + FLOOR_H - 1, 2, 1, CYAN_LINE, 0.9);
				}
				for (let k = 0; k < FLOOR_H; k += 4) {
					px(g, x, y + k, 1, 2, CYAN_LINE, 0.9);
					px(g, x + TILE - 1, y + k, 1, 2, CYAN_LINE, 0.9);
				}
			} else {
				// Rejected: red hatching and a stamped border.
				px(g, x, y, TILE, FLOOR_H, STAMP, 0.16);
				for (let k = -TILE; k < FLOOR_H; k += 5) {
					for (let j = 0; j < TILE; j++) {
						const yy = k + j;
						if (yy >= 0 && yy < FLOOR_H) px(g, x + j, y + yy, 1, 1, STAMP, 0.45);
					}
				}
				box(g, x, y, TILE, FLOOR_H, STAMP, 0.9);
			}
		}
		const first = gh.cells[0];
		const def = gh.defId ? this.content.facilities[gh.defId] : undefined;
		if (def) {
			drawBody(this.body, def, first.x * TILE, floorTop(view, first.floor));
			this.body.tint = gh.valid ? CYAN_TINT : lt(STAMP, 0.35);
		}
		if (!gh.valid && (gh.defId || gh.cells.length > 1)) {
			this.stamp.position.set((minX + maxX) / 2, (minY + maxY) / 2);
			this.stamp.visible = true;
		}
		if (gh.label) {
			// Paper requisition tag above the first cell.
			this.label.text = gh.label;
			this.label.style.fill = gh.valid ? T.ink : dk(STAMP, 0.25);
			const tx = first.x * TILE;
			const ty = floorTop(view, first.floor) - 12;
			const tw = Math.ceil(this.label.width) + 6;
			px(this.tag, tx - 1, ty - 1, tw + 2, 12, BRASS.line);
			px(this.tag, tx, ty, tw, 10, gh.valid ? T.paper : lt(T.paper, 0.1));
			px(this.tag, tx, ty, tw, 1, lt(T.paper, 0.5));
			px(this.tag, tx + 1, ty + 1, 1, 1, BRASS.mid);
			this.label.position.set(tx + 4, ty + 5);
			this.label.visible = true;
		}
	}
}

/** World rect of the selected thing, or null if it no longer exists. */
export function selectionRect(
	view: SimView,
	sel: Selection,
	content: ContentDB,
	botPos: (id: number) => Sample | null,
	liftPos: (id: number) => number | null,
): Rect | null {
	if (!sel) return null;
	if (sel.kind === "facility") {
		const f = view.facilities.find((v) => v.id === sel.id);
		if (!f) return null;
		const w = (content.facilities[f.defId]?.width ?? f.width) * TILE;
		const top = floorTop(view, f.floor);
		return { x: f.x * TILE, y: top + FAC_TOP - 2, w, h: FAC_BOTTOM - FAC_TOP + 3 };
	}
	if (sel.kind === "bot") {
		const p = botPos(sel.id);
		if (!p) return null;
		const def = content.bots[view.bots.find((v) => v.id === sel.id)?.defId ?? ""];
		const w = botDims(botKind(def)).w;
		const b = botBox(view, p.x, p.y, w);
		return { x: b.x - 2, y: b.y - 5, w: w + 4, h: BOT_H + 6 };
	}
	const l = view.lifts.find((v) => v.id === sel.id);
	if (!l) return null;
	const cf = liftPos(sel.id) ?? l.carFloor;
	return { x: l.x * TILE, y: floorTop(view, cf) + FAC_TOP - 3, w: TILE, h: FAC_BOTTOM - FAC_TOP + 4 };
}

/** Pulsing brass corner brackets around the selection. */
export function drawSelection(g: Graphics, r: Rect | null, t: number): void {
	g.clear();
	if (!r) return;
	const pulse = 0.5 + 0.5 * Math.sin(t * 5);
	const grow = 1 + Math.round(pulse * 2);
	const x = r.x - grow;
	const y = r.y - grow;
	const w = r.w + grow * 2;
	const h = r.h + grow * 2;
	box(g, x, y, w, h, BRASS.hi, 0.18 + 0.2 * pulse);
	const k = Math.min(6, Math.floor(Math.min(w, h) / 2));
	const corner = (cx: number, cy: number, sx: number, sy: number): void => {
		// Dark outline, then 2-px brass L with a highlight and a rivet.
		const hx = sx > 0 ? cx : cx - k + 1;
		const vy = sy > 0 ? cy : cy - k + 1;
		px(g, hx - 1, (sy > 0 ? cy : cy - 1) - 1, k + 2, 4, BRASS.line);
		px(g, (sx > 0 ? cx : cx - 1) - 1, vy - 1, 4, k + 2, BRASS.line);
		px(g, hx, sy > 0 ? cy : cy - 1, k, 2, BRASS.mid);
		px(g, sx > 0 ? cx : cx - 1, vy, 2, k, BRASS.mid);
		px(g, hx, sy > 0 ? cy : cy, k, 1, BRASS.hi);
		px(g, sx > 0 ? cx : cx, vy, 1, k, BRASS.hi);
		px(g, sx > 0 ? cx : cx - 1, sy > 0 ? cy : cy - 1, 1, 1, lt(T.brass, 0.8));
	};
	corner(x - 1, y - 1, 1, 1);
	corner(x + w, y - 1, -1, 1);
	corner(x - 1, y + h, 1, -1);
	corner(x + w, y + h, -1, -1);
}
