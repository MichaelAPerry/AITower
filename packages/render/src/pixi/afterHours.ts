/**
 * The four after-hours items (docs/AFTER_HOURS.md), drawn in code: Bea's fern and Cass's coffee machine in the lobby, Mel's fish
 * tank on B1 and the book on Luci's desk on F2. Each has a plain look and an upgraded one (big self-watering pot, bio-enhanced
 * tank, cappuccino machine, licence and certificate). They are not facilities: the sim keeps the cells free, and a click on them is
 * counted by the UI.
 */
import type { SimView } from "@aitower/sim";
import { Graphics } from "pixi.js";
import { floorTop } from "../camera";
import { FAC_BOTTOM, TILE } from "../constants";
import { box, disc, px } from "./draw";

type Item = SimView["afterHours"]["items"][number];

const C = {
	wood: 0x8a5a2b,
	woodDk: 0x5c3a1a,
	woodHi: 0xb07a3f,
	steel: 0x9aa0b8,
	steelDk: 0x5a6086,
	steelHi: 0xd6dcf2,
	dark: 0x14142e,
	glass: 0xbff0ff,
	water: 0x3fa7d6,
	waterDk: 0x2a7ba8,
	leaf: 0x3fbf5a,
	leafDk: 0x23803a,
	leafHi: 0x8be67a,
	clay: 0xc2693a,
	clayDk: 0x8a4526,
	clayHi: 0xe08a57,
	cream: 0xf3ead2,
	creamDk: 0xc9bd9a,
	gold: 0xffd75e,
	goldDk: 0xb98a1f,
	red: 0xff4d5e,
	green: 0x6cf08f,
	teal: 0x35f0c8,
	tealDk: 0x14907c,
	orange: 0xff9a3c,
	leather: 0x6a2c22,
	leatherHi: 0x944038,
	ink: 0x2d3278,
	white: 0xf0f0ff,
};

/** A little table/desk: top slab and two legs. */
function desk(g: Graphics, x: number, yb: number, w: number, h: number): void {
	px(g, x, yb - h, w, 3, C.woodHi);
	px(g, x, yb - h + 3, w, 1, C.woodDk);
	px(g, x + 2, yb - h + 4, 3, h - 4, C.wood);
	px(g, x + w - 5, yb - h + 4, 3, h - 4, C.wood);
	px(g, x + 2, yb - h + 4, 1, h - 4, C.woodHi);
	px(g, x + w - 5, yb - h + 4, 1, h - 4, C.woodHi);
}

// ─── Bea's fern ──────────────────────────────────────────────────────────

function drawFern(g: Graphics, x: number, yb: number, w: number, bought: boolean): void {
	if (!bought) {
		// A small plant stand and a clay pot with a modest fern called Nigel.
		desk(g, x + 3, yb, w - 6, 16);
		const px0 = x + w / 2 - 6;
		const top = yb - 16 - 9;
		px(g, px0, top, 12, 3, C.clayHi);
		px(g, px0 + 1, top + 3, 10, 6, C.clay);
		px(g, px0 + 2, top + 8, 8, 1, C.clayDk);
		px(g, px0 + 9, top + 3, 2, 6, C.clayDk);
		// Fronds.
		const cx = x + w / 2;
		for (const [dx, dy, len] of [[-1, -1, 8], [0, -1, 10], [1, -1, 8], [-2, 0, 6], [2, 0, 6]] as const) {
			for (let k = 1; k <= len; k++) px(g, cx + dx * Math.ceil(k / 2) - 1, top - k * 1 - (dy === 0 ? 0 : 0), 2, 1, k % 3 === 0 ? C.leafHi : C.leaf);
		}
		px(g, cx - 1, top - 10, 2, 10, C.leafDk);
		px(g, cx - 5, top - 5, 2, 3, C.leaf);
		px(g, cx + 3, top - 5, 2, 3, C.leaf);
		return;
	}
	// Upgraded: a big pot on the floor with a lush fern, a water reservoir and a feeding tube with a green "auto" lamp.
	const potW = 20;
	const pxl = x + 2;
	const top = yb - 17;
	px(g, pxl, top, potW, 4, C.clayHi);
	px(g, pxl + 1, top + 4, potW - 2, 12, C.clay);
	px(g, pxl + 2, top + 15, potW - 4, 2, C.clayDk);
	px(g, pxl + potW - 5, top + 4, 4, 12, C.clayDk);
	px(g, pxl + 3, top + 7, potW - 8, 2, C.clayHi);
	const cx = pxl + potW / 2;
	for (let k = 1; k <= 18; k++) {
		const spread = Math.ceil(k / 2);
		px(g, cx - spread - 1, top - k, 2, 1, k % 3 === 0 ? C.leafHi : C.leaf);
		px(g, cx + spread - 1, top - k, 2, 1, k % 4 === 0 ? C.leafHi : C.leafDk);
	}
	px(g, cx - 1, top - 18, 2, 18, C.leafDk);
	px(g, cx - 10, top - 8, 3, 3, C.leaf);
	px(g, cx + 7, top - 8, 3, 3, C.leaf);
	px(g, cx - 3, top - 22, 6, 3, C.leafHi);
	// Reservoir with a tube into the pot.
	const rx = x + w - 10;
	px(g, rx, yb - 18, 8, 18, C.steelDk);
	px(g, rx + 1, yb - 17, 6, 16, C.glass);
	px(g, rx + 1, yb - 11, 6, 10, C.water);
	px(g, rx + 1, yb - 11, 6, 1, C.steelHi);
	px(g, rx - 2, yb - 12, 2, 1, C.steel);
	px(g, rx - 3, yb - 12, 1, 5, C.steel);
	px(g, rx + 2, yb - 21, 4, 3, C.dark);
	px(g, rx + 3, yb - 20, 2, 1, C.green);
}

// ─── Mel's fish tank ─────────────────────────────────────────────────────

function drawTank(g: Graphics, x: number, yb: number, w: number, bought: boolean): void {
	// Her desk, with a small stack of papers at the right end.
	desk(g, x + 2, yb, w - 4, 15);
	px(g, x + w - 14, yb - 15 - 3, 9, 3, C.cream);
	px(g, x + w - 14, yb - 15 - 4, 9, 1, C.creamDk);
	const tw = bought ? 28 : 22;
	const th = bought ? 18 : 14;
	const tx = x + 8;
	const ty = yb - 15 - th - 1;
	// Stand/base light.
	px(g, tx - 1, ty + th, tw + 2, 2, C.steelDk);
	// Glass and water.
	px(g, tx, ty, tw, th, bought ? C.tealDk : C.waterDk);
	px(g, tx + 1, ty + 1, tw - 2, th - 2, bought ? C.teal : C.water);
	px(g, tx + 1, ty + 1, tw - 2, 2, C.glass);
	px(g, tx, ty, 1, th, C.glass);
	px(g, tx + tw - 1, ty, 1, th, bought ? C.tealDk : C.waterDk);
	// Gravel and plant.
	px(g, tx + 1, ty + th - 3, tw - 2, 2, bought ? C.tealDk : C.creamDk);
	px(g, tx + 4, ty + th - 8, 1, 5, C.leafDk);
	px(g, tx + 5, ty + th - 10, 1, 7, C.leaf);
	px(g, tx + 6, ty + th - 7, 1, 4, C.leafDk);
	if (!bought) {
		// Fido: a little orange fish.
		const fx = tx + 11;
		const fy = ty + 5;
		px(g, fx, fy, 5, 3, C.orange);
		px(g, fx + 5, fy - 1, 2, 5, C.orange);
		px(g, fx + 1, fy - 1, 3, 1, C.red);
		px(g, fx + 1, fy + 1, 1, 1, C.dark);
		px(g, tx + 16, ty + 3, 1, 1, C.glass);
		px(g, tx + 17, ty + 1, 1, 1, C.glass);
		return;
	}
	// Bio-enhanced: a bigger glowing Fido with extra fins, tendrils, bubbles and a pump with tubes.
	const fx = tx + 11;
	const fy = ty + 6;
	px(g, fx, fy, 9, 5, C.orange);
	px(g, fx + 9, fy - 2, 3, 9, C.red);
	px(g, fx + 2, fy - 2, 5, 2, C.red);
	px(g, fx + 2, fy + 5, 5, 2, C.red);
	px(g, fx + 2, fy + 1, 2, 2, C.white);
	px(g, fx + 3, fy + 2, 1, 1, C.dark);
	px(g, fx + 5, fy + 1, 3, 1, C.gold);
	for (const [bx, by] of [[18, 3], [20, 6], [21, 1], [6, 6]] as const) px(g, tx + bx, ty + by, 1, 1, C.white);
	for (let k = 0; k < 5; k++) px(g, tx + 14 + (k % 2), ty + th - 3 - k, 1, 1, C.green);
	px(g, tx + tw - 5, ty + th - 6, 1, 4, C.green);
	px(g, tx + tw - 4, ty + th - 8, 1, 6, C.green);
	// Lamp above and a pump box with tubes.
	px(g, tx, ty - 3, tw, 2, C.steelDk);
	px(g, tx + 2, ty - 2, tw - 4, 1, C.teal);
	const bxp = tx + tw + 3;
	px(g, bxp, yb - 15 - 10, 8, 10, C.steelDk);
	px(g, bxp + 1, yb - 15 - 9, 6, 8, C.steel);
	px(g, bxp + 2, yb - 15 - 7, 2, 2, C.green);
	px(g, bxp + 5, yb - 15 - 7, 1, 2, C.red);
	px(g, tx + tw, ty + 3, 3, 1, C.steel);
	px(g, bxp + 1, ty + 3, 1, yb - 15 - 10 - ty - 3, C.steel);
}

// ─── Cass's coffee machine ───────────────────────────────────────────────

function drawCoffee(g: Graphics, x: number, yb: number, w: number, bought: boolean): void {
	// A counter with a cabinet under it.
	px(g, x + 1, yb - 16, w - 2, 3, C.woodHi);
	px(g, x + 1, yb - 13, w - 2, 1, C.woodDk);
	px(g, x + 3, yb - 12, w - 6, 12, C.wood);
	px(g, x + w / 2 - 1, yb - 12, 2, 12, C.woodDk);
	px(g, x + 5, yb - 9, 3, 2, C.steel);
	px(g, x + w - 8, yb - 9, 3, 2, C.steel);
	const top = yb - 16;
	if (!bought) {
		// A plain drip machine and its carafe.
		const mx = x + 8;
		px(g, mx, top - 16, 14, 16, C.dark);
		px(g, mx + 1, top - 15, 12, 14, C.steelDk);
		px(g, mx + 1, top - 15, 12, 3, C.steel);
		px(g, mx + 9, top - 13, 2, 2, C.red);
		px(g, mx + 2, top - 9, 6, 8, C.glass);
		px(g, mx + 3, top - 6, 4, 5, C.leather);
		px(g, mx + 2, top - 1, 9, 1, C.dark);
		// A mug.
		px(g, x + w - 14, top - 5, 5, 5, C.white);
		px(g, x + w - 9, top - 4, 2, 3, C.white);
		px(g, x + w - 13, top - 4, 3, 1, C.leather);
		return;
	}
	// Cappuccino machine: chrome body, gauge, steam wand, cups and wisps of steam.
	const mx = x + 4;
	px(g, mx, top - 24, 28, 24, C.steelDk);
	px(g, mx + 1, top - 23, 26, 22, C.steel);
	px(g, mx + 1, top - 23, 26, 3, C.steelHi);
	px(g, mx + 2, top - 18, 3, 16, C.steelHi);
	px(g, mx + 8, top - 18, 8, 8, C.dark);
	disc(g, mx + 9, top - 17, 6, C.gold);
	px(g, mx + 11, top - 16, 1, 3, C.dark);
	px(g, mx + 19, top - 18, 5, 2, C.green);
	px(g, mx + 19, top - 14, 5, 2, C.red);
	px(g, mx + 7, top - 8, 14, 3, C.dark);
	px(g, mx + 10, top - 5, 8, 5, C.white);
	px(g, mx + 18, top - 4, 2, 3, C.white);
	px(g, mx + 11, top - 5, 6, 1, C.leather);
	px(g, mx + 27, top - 16, 2, 14, C.steelHi);
	px(g, mx + 29, top - 4, 3, 2, C.steelHi);
	for (const [sx, sy, a] of [[12, 30, 0.7], [14, 33, 0.5], [11, 36, 0.35], [13, 38, 0.25]] as const) px(g, mx + sx, top - sy, 2, 2, C.white, a);
	px(g, x + w - 9, top - 5, 6, 5, C.white);
	px(g, x + w - 6, top - 4, 2, 3, C.white);
}

// ─── The book on Luci's desk ─────────────────────────────────────────────

function drawBook(g: Graphics, x: number, yb: number, w: number, bought: boolean): void {
	// A heavy desk with a drawer.
	px(g, x + 2, yb - 17, w - 4, 3, C.woodHi);
	px(g, x + 2, yb - 14, w - 4, 1, C.woodDk);
	px(g, x + 4, yb - 13, w - 8, 13, C.wood);
	px(g, x + 6, yb - 11, 14, 5, C.woodDk);
	px(g, x + 12, yb - 9, 2, 1, C.gold);
	px(g, x + 4, yb - 13, 1, 13, C.woodHi);
	const top = yb - 17;
	// The ledger: an open book.
	const bx = x + 14;
	if (!bought) {
		px(g, bx, top - 3, 22, 3, C.leather);
		px(g, bx + 1, top - 7, 10, 4, C.cream);
		px(g, bx + 11, top - 7, 10, 4, C.cream);
		px(g, bx + 10, top - 7, 2, 4, C.creamDk);
		for (const ly of [6, 4]) {
			px(g, bx + 2, top - ly, 7, 1, C.ink, 0.6);
			px(g, bx + 13, top - ly, 7, 1, C.ink, 0.6);
		}
	} else {
		// A closed leather ledger with a gold clasp and a ribbon.
		px(g, bx, top - 6, 20, 6, C.leather);
		px(g, bx, top - 6, 20, 1, C.leatherHi);
		px(g, bx + 1, top - 1, 18, 1, C.creamDk);
		px(g, bx + 16, top - 6, 2, 9, C.red);
		px(g, bx + 8, top - 4, 4, 2, C.gold);
	}
	// A pen and a lamp.
	px(g, bx + 24, top - 1, 6, 1, C.steelDk);
	px(g, bx + 24, top - 2, 2, 1, C.red);
	px(g, x + w - 14, top - 14, 2, 14, C.steelDk);
	px(g, x + w - 18, top - 17, 9, 3, C.steel);
	px(g, x + w - 17, top - 14, 7, 1, C.gold, 0.5);
	px(g, x + w - 18, top - 1, 8, 1, C.steelDk);
	if (bought) {
		// The licence: a framed certificate on the wall above the desk with a gold seal and ribbon.
		const fx = x + 12;
		const fy = yb - 41;
		px(g, fx, fy, 26, 18, C.goldDk);
		px(g, fx + 1, fy + 1, 24, 16, C.gold);
		px(g, fx + 2, fy + 2, 22, 14, C.cream);
		for (const ly of [4, 7, 10]) px(g, fx + 4, fy + ly, ly === 10 ? 10 : 18, 1, C.ink, 0.6);
		disc(g, fx + 16, fy + 9, 6, C.red);
		disc(g, fx + 17, fy + 10, 4, C.gold);
		px(g, fx + 17, fy + 14, 2, 3, C.red);
		px(g, fx + 20, fy + 14, 2, 3, C.red);
		box(g, fx, fy, 26, 18, C.goldDk);
	}
}

const DRAW: Record<Item["id"], (g: Graphics, x: number, yb: number, w: number, bought: boolean) => void> = {
	fern: drawFern,
	tank: drawTank,
	coffee: drawCoffee,
	book: drawBook,
};

/** Cache key: which items stand where, and in which look. */
export const afterHoursKey = (view: SimView): string => view.afterHours.items.map((i) => `${i.id}:${i.visible ? 1 : 0}:${i.bought ? 1 : 0}:${i.floor}:${i.x}`).join("|");

/** The layer: redrawn only when `afterHoursKey` changes. */
export class AfterHoursLayer {
	readonly g = new Graphics();
	private key = "";

	update(view: SimView): void {
		const k = `${afterHoursKey(view)}#${view.floorMax}`;
		if (k === this.key) return;
		this.key = k;
		this.g.clear();
		for (const item of view.afterHours.items) {
			if (!item.visible) continue;
			DRAW[item.id](this.g, item.x * TILE, floorTop(view, item.floor) + FAC_BOTTOM, item.width * TILE, item.bought);
		}
	}
}
