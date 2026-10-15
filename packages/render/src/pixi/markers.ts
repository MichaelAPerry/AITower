/** Build ghost preview and pulsing selection outline. */
import type { ContentDB } from "@aitower/content";
import type { Ghost, Selection } from "@aitower/shared";
import type { SimView } from "@aitower/sim";
import { Container, Graphics, Text } from "pixi.js";
import { floorTop } from "../camera";
import { FAC_BOTTOM, FAC_TOP, FLOOR_H, TILE } from "../constants";
import type { Sample } from "../interp";
import { BOT_H, BOT_W, botBox } from "./bots";
import { box, px } from "./draw";
import { drawBody } from "./facilityArt";

const VALID = 0x40e070;
const INVALID = 0xff3a3a;

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
	private label = new Text({ text: "", style: { fontFamily: "monospace", fontSize: 8, fill: 0xffffff }, resolution: 4 });
	private ghost: Ghost | null = null;
	private dirty = true;
	private floorMax = Number.NaN;

	constructor(private readonly content: ContentDB) {
		this.body.alpha = 0.6;
		this.label.visible = false;
		this.root.addChild(this.cells, this.body, this.label);
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
		this.label.visible = false;
		const gh = this.ghost;
		if (!gh || gh.cells.length === 0) return;
		const c = gh.valid ? VALID : INVALID;
		for (const cell of gh.cells) {
			const x = cell.x * TILE;
			const y = floorTop(view, cell.floor);
			px(g, x, y, TILE, FLOOR_H, c, 0.25);
			box(g, x, y, TILE, FLOOR_H, c, 0.7);
		}
		const first = gh.cells[0];
		const def = gh.defId ? this.content.facilities[gh.defId] : undefined;
		if (def) {
			drawBody(this.body, def, first.x * TILE, floorTop(view, first.floor));
			this.body.tint = gh.valid ? 0xffffff : 0xff8080;
		}
		if (gh.label) {
			this.label.text = gh.label;
			this.label.style.fill = c;
			this.label.position.set(first.x * TILE, floorTop(view, first.floor) - 10);
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
		const b = botBox(view, p.x, p.y);
		return { x: b.x - 2, y: b.y - 5, w: BOT_W + 4, h: BOT_H + 6 };
	}
	const l = view.lifts.find((v) => v.id === sel.id);
	if (!l) return null;
	const cf = liftPos(sel.id) ?? l.carFloor;
	return { x: l.x * TILE, y: floorTop(view, cf) + FAC_TOP - 3, w: TILE, h: FAC_BOTTOM - FAC_TOP + 4 };
}

export function drawSelection(g: Graphics, r: Rect | null, t: number): void {
	g.clear();
	if (!r) return;
	const pulse = 0.55 + 0.45 * Math.sin(t * 5);
	const grow = Math.round(1 + pulse);
	const x = r.x - grow;
	const y = r.y - grow;
	const w = r.w + grow * 2;
	const h = r.h + grow * 2;
	box(g, x, y, w, h, 0xffffff, 0.35 + 0.4 * pulse);
	// Corner brackets.
	const k = 4;
	const c = 0xfff27a;
	px(g, x - 1, y - 1, k, 1, c);
	px(g, x - 1, y - 1, 1, k, c);
	px(g, x + w - k + 1, y - 1, k, 1, c);
	px(g, x + w, y - 1, 1, k, c);
	px(g, x - 1, y + h, k, 1, c);
	px(g, x - 1, y + h - k + 1, 1, k, c);
	px(g, x + w - k + 1, y + h, k, 1, c);
	px(g, x + w, y + h - k + 1, 1, k, c);
}
