/**
 * Earth, building shell (tiled walls, wainscot, ceiling duct, pneumatic tube,
 * riveted I-beam slabs, roof parapet) and stencilled floor plates. Cached:
 * rebuilt only when the slab array changes.
 */
import type { SimView } from "@aitower/sim";
import { Container, Graphics, Text } from "pixi.js";
import { floorTop, groundY } from "../camera";
import { CABLE_Y, FLOOR_H, MARGIN_BOTTOM, MARGIN_X, SLAB_H, TILE, TUBE_Y, WAINSCOT_Y } from "../constants";
import { BRASS, COPPER, CLOTH, PAPER, STEEL, T, VERDI, dk, lt, mat, mix } from "../palette";
import { WORLD_FONT } from "./labels";
import { dither, hash, px } from "./draw";

// Walls.
const TILE_ABOVE = mat(T.wall);
const TILE_BELOW = mat(mix(T.wall, T.olive, 0.35));
const GROUT_ABOVE = dk(T.wall, 0.42);
const GROUT_BELOW = dk(mix(T.wall, T.olive, 0.35), 0.5);
const WAINSCOT = dk(T.wall, 0.5);
const WAINSCOT_BELOW = dk(mix(T.wall, T.olive, 0.4), 0.58);
const DUCT = mat(mix(T.steel, T.wall, 0.45));
const FLOOR = mat(mix(T.housing, T.steel, 0.25));
const BEAM = mat(mix(T.steel, T.housing, 0.25));
const CONCRETE = mat(mix(T.steel, T.beige, 0.4));

// Earth.
const SOIL = mix(T.housingLo, T.brassDk, 0.12);
const SOIL_LT = mix(T.housing, T.brassDk, 0.18);
const SOIL_DK = dk(T.housingLo, 0.35);
const PEBBLE = dk(T.beige, 0.45);
const ASPHALT = mix(T.housing, T.steel, 0.15);

const floorName = (f: number): string => (f === 0 ? "G" : f > 0 ? `F${f}` : `B${-f}`);

export class Structure {
	readonly earth = new Graphics();
	readonly shell = new Graphics();
	/** Stencilled floor plates on the left facade (Text, VT323). */
	readonly plates = new Container();
	private plateGfx = new Graphics();
	private plateText: Text[] = [];

	constructor() {
		this.plates.addChild(this.plateGfx);
	}

	rebuild(view: SimView): void {
		this.drawEarth(view);
		this.drawShell(view);
		this.drawPlates(view);
	}

	// ─── Earth ───────────────────────────────────────────────────────────

	private drawEarth(view: SimView): void {
		const g = this.earth;
		g.clear();
		const gy = groundY(view);
		const x0 = -MARGIN_X - 4000;
		const x1 = view.width * TILE + MARGIN_X + 4000;
		const bottom = (view.floorMax - view.floorMin + 1) * FLOOR_H + MARGIN_BOTTOM + 4000;
		const depth = (1 - view.floorMin) * FLOOR_H + MARGIN_BOTTOM + 40;
		const dx0 = x0 + 3000;
		const dx1 = x1 - 3000;
		px(g, x0, gy, x1 - x0, bottom - gy, SOIL);
		// Strata: dithered lighter / darker bands.
		for (let y = gy + 14, k = 0; y < gy + depth; y += 22, k++) {
			const c = k % 2 ? SOIL_LT : SOIL_DK;
			dither(g, dx0, y, dx1 - dx0, 2, c, 0.8, 2, k);
		}
		// Pebbles and roots (deterministic).
		for (let y = gy + 6; y < gy + depth; y += 5) {
			for (let x = dx0; x < dx1; x += 6) {
				const v = hash(x, y);
				if (v < 0.05) px(g, x + ((v * 97) | 0) % 5, y, 2, 1, PEBBLE);
				else if (v < 0.075) px(g, x, y + 1, 1, 1, SOIL_LT);
				else if (v < 0.08) px(g, x, y, 2, 1, dk(T.beige, 0.62));
			}
		}
		// Old pipes and cable runs under the lot.
		const runs: [number, "copper" | "iron" | "cable"][] = [
			[gy + 26, "cable"],
			[gy + 58, "copper"],
			[gy + 104, "iron"],
			[gy + 150, "cable"],
			[gy + 196, "copper"],
		];
		for (const [ry, kind] of runs) {
			if (ry > gy + depth - 8) break;
			if (kind === "cable") {
				for (let x = dx0; x < dx1; x += 2) {
					px(g, x, ry, 2, 1, (x >> 1) % 3 === 0 ? CLOTH.ochreDk : CLOTH.black);
					px(g, x, ry + 1, 2, 1, (x >> 1) % 3 === 1 ? CLOTH.ochreDk : CLOTH.black);
				}
				for (let x = dx0 + 37; x < dx1; x += 173) {
					px(g, x, ry - 2, 5, 5, dk(T.steel, 0.55));
					px(g, x + 1, ry - 1, 3, 1, dk(T.steel, 0.3));
				}
			} else {
				const m = kind === "copper" ? mat(dk(T.copper, 0.35)) : mat(mix(T.steel, T.brassDk, 0.4));
				for (let x = dx0; x < dx1; x += 64) {
					const broken = hash(x, ry) < 0.12;
					const len = broken ? 40 : 64;
					px(g, x, ry, len, 4, m.line);
					px(g, x, ry + 1, len, 1, m.mid);
					px(g, x, ry + 2, len, 1, m.lo);
					// Flange and a patch of rust / verdigris.
					px(g, x, ry - 1, 2, 6, m.dk);
					if (hash(ry, x) < 0.5) px(g, x + 20 + ((hash(x, 3) * 30) | 0), ry + 1, 4, 2, kind === "copper" ? VERDI.lo : dk(T.copper, 0.5));
				}
			}
		}
		// Pavement: kerb + asphalt + topsoil edge.
		px(g, x0, gy, x1 - x0, 1, CONCRETE.hi);
		px(g, x0, gy + 1, x1 - x0, 2, ASPHALT);
		px(g, x0, gy + 3, x1 - x0, 1, dk(ASPHALT, 0.4));
		for (let x = dx0; x < dx1; x += 24) px(g, x, gy + 1, 1, 2, dk(ASPHALT, 0.3));
	}

	// ─── Shell ───────────────────────────────────────────────────────────

	private drawShell(view: SimView): void {
		const g = this.shell;
		g.clear();
		const { width, floorMin, floorMax, slab } = view;
		const has = (x: number, f: number): boolean =>
			x >= 0 && x < width && f >= floorMin && f <= floorMax && slab[(f - floorMin) * width + x] === 1;
		for (let f = floorMin; f <= floorMax; f++) {
			const top = floorTop(view, f);
			const below = f < 0;
			for (let x = 0; x < width; x++) {
				if (!has(x, f)) continue;
				const wx = x * TILE;
				const l = has(x - 1, f);
				const r = has(x + 1, f);
				this.wallCell(g, wx, top, x, f, below);
				this.ceiling(g, wx, top, x, l, r);
				this.floorAndBeam(g, wx, top, x, f);
				// Roof parapet where nothing is built above.
				if (!has(x, f + 1)) this.roof(g, wx, top, x, has(x - 1, f) && !has(x - 1, f + 1), has(x + 1, f) && !has(x + 1, f + 1), f >= 0);
				// Exterior walls at run ends (raw board-marked concrete).
				const capL = has(x, f + 1) ? 0 : 3;
				if (!l) this.exterior(g, wx, top - capL, FLOOR_H + capL, -1);
				if (!r) this.exterior(g, wx + TILE - 3, top - capL, FLOOR_H + capL, 1);
			}
		}
	}

	private wallCell(g: Graphics, wx: number, top: number, x: number, f: number, below: boolean): void {
		const m = below ? TILE_BELOW : TILE_ABOVE;
		const grout = below ? GROUT_BELOW : GROUT_ABOVE;
		// Glass façade panels: two 8-px panels per cell with a dark seam, a cold top edge and the odd lit panel.
		const y0 = top + TUBE_Y + 2;
		const y1 = top + WAINSCOT_Y;
		px(g, wx, top, TILE, y1 - top, grout);
		for (let tx = 0; tx < TILE; tx += 8) {
			const v = hash(x * 2 + (tx >> 3), f * 40);
			const base = v > 0.93 ? mix(m.mid, T.brass, 0.22) : v < 0.1 ? m.lo : m.mid;
			px(g, wx + tx, y0, 7, y1 - y0 - 1, base);
			px(g, wx + tx, y0, 7, 1, mix(base, T.brass, 0.3));
			px(g, wx + tx + 1, y0 + 1, 1, y1 - y0 - 3, mix(base, m.hi, 0.35));
		}
		// Water stains running down the basement walls.
		if (below && hash(x, f * 7) < 0.25) {
			const sx = wx + 3 + ((hash(f, x) * 9) | 0);
			for (let k = 0; k < 10; k++) px(g, sx, y0 + k * 1.6, 1, 2, dk(m.mid, 0.3), 0.6 - k * 0.05);
		}
		// Wainscot: chair rail + darker panels with vertical seams.
		const wc = below ? WAINSCOT_BELOW : WAINSCOT;
		px(g, wx, y1, TILE, 1, dk(T.brassDk, 0.25));
		px(g, wx, y1 + 1, TILE, 1, lt(wc, 0.18));
		px(g, wx, y1 + 2, TILE, top + CABLE_Y - y1 - 3, wc);
		px(g, wx + (x % 2 ? 0 : 8), y1 + 2, 1, top + CABLE_Y - y1 - 3, dk(wc, 0.35));
		px(g, wx, top + CABLE_Y - 1, TILE, 1, dk(wc, 0.5)); // skirting
		// Pendant lamp with a faint sodium cone on the tiles every 6 tiles.
		if (((x % 6) + 6) % 6 === 3) {
			const cx = wx + 8;
			const ly = top + TUBE_Y + 3;
			px(g, cx - 1, top + TUBE_Y + 2, 1, 2, dk(T.steel, 0.5)); // cord
			px(g, cx - 2, ly + 1, 3, 1, BRASS.mid);
			px(g, cx - 3, ly + 2, 5, 1, BRASS.lo);
			px(g, cx - 2, ly + 2, 2, 1, BRASS.hi);
			px(g, cx - 2, ly + 3, 3, 1, lt(T.sodium, 0.55));
			for (let r = ly + 4, k = 0; r < top + CABLE_Y; r += 2, k++) {
				const hw = 2 + Math.floor(k * 0.75);
				const a = 0.09 - k * 0.0045;
				if (a <= 0) break;
				px(g, cx - hw, r, hw * 2 - 1, 2, T.sodium, a * 0.6);
				px(g, cx - Math.ceil(hw / 2), r, Math.ceil(hw / 2) * 2 - 1, 2, lt(T.sodium, 0.5), a * 0.5);
			}
			// Pool of light on the floor plate.
			px(g, cx - 6, top + CABLE_Y - 1, 11, 1, lt(T.sodium, 0.5), 0.12);
		}
		// An occasional cold status dot on the façade (no memos, no clocks).
		if (hash(x * 13 + 5, f * 31 + 2) < 0.04) {
			px(g, wx + 7, top + 16, 2, 2, mix(T.brass, T.ink, 0.5));
			px(g, wx + 7, top + 16, 1, 1, T.brass);
		}
	}

	private ceiling(g: Graphics, wx: number, top: number, x: number, l: boolean, r: boolean): void {
		// Underside shadow of the slab above.
		px(g, wx, top, TILE, 1, dk(T.wall, 0.75));
		// Sheet-metal duct with seams and rivets.
		px(g, wx, top + 1, TILE, 6, DUCT.lo);
		px(g, wx, top + 1, TILE, 1, DUCT.mid);
		px(g, wx, top + 6, TILE, 1, DUCT.dk);
		if (x % 2 === 0) {
			px(g, wx, top + 1, 1, 6, DUCT.line);
			px(g, wx + 2, top + 2, 1, 1, DUCT.hi);
			px(g, wx + 2, top + 5, 1, 1, DUCT.hi);
		}
		if (x % 5 === 3) {
			// Vent grille hanging under the duct.
			px(g, wx + 4, top + 7, 8, 2, DUCT.line);
			px(g, wx + 5, top + 7, 6, 1, DUCT.mid);
		} else px(g, wx, top + 7, TILE, 1, dk(T.wall, 0.6));
		// Pneumatic job tube: brass, collars every 3 tiles, dispatch boxes at run ends.
		const ty = top + TUBE_Y;
		const tx0 = l ? wx : wx + 3;
		const tx1 = r ? wx + TILE : wx + TILE - 3;
		px(g, tx0, ty, tx1 - tx0, 1, BRASS.hi);
		px(g, tx0, ty + 1, tx1 - tx0, 1, BRASS.lo);
		px(g, tx0, ty + 2, tx1 - tx0, 1, dk(T.wall, 0.55)); // cast shadow
		if (x % 3 === 1) {
			px(g, wx + 7, ty - 1, 2, 4, BRASS.line);
			px(g, wx + 7, ty, 1, 2, BRASS.mid);
		}
		if (!l) this.tubeBox(g, wx + 1, ty - 2);
		if (!r) this.tubeBox(g, wx + TILE - 6, ty - 2);
	}

	private tubeBox(g: Graphics, x: number, y: number): void {
		px(g, x, y, 5, 6, BRASS.line);
		px(g, x + 1, y + 1, 3, 4, BRASS.mid);
		px(g, x + 1, y + 1, 3, 1, BRASS.hi);
		px(g, x + 2, y + 3, 1, 1, T.ink);
	}

	private floorAndBeam(g: Graphics, wx: number, top: number, x: number, f: number): void {
		// Floor plate + under-floor void (the cable tray sits in it).
		const fy = top + CABLE_Y;
		px(g, wx, fy, TILE, 1, T.brass, 0.55); // thin cyan floor edge
		px(g, wx, fy + 1, TILE, 1, FLOOR.hi);
		px(g, wx, fy + 1, TILE, FLOOR_H - SLAB_H - CABLE_Y - 1, FLOOR.dk);
		if ((x + f) % 2 === 0) px(g, wx + 3, fy + 2, 1, 1, FLOOR.line);
		// Riveted steel I-beam slab.
		const sy = top + FLOOR_H - SLAB_H;
		px(g, wx, sy, TILE, 1, BEAM.hi);
		px(g, wx, sy + 1, TILE, 2, BEAM.lo);
		px(g, wx, sy + 3, TILE, 1, BEAM.line);
		
		if (x % 4 === 0) {
			px(g, wx, sy + 1, 1, 2, BEAM.mid); // web stiffener
			px(g, wx + 1, sy + 1, 1, 2, BEAM.dk);
		}
	}

	private roof(g: Graphics, wx: number, top: number, x: number, joinL: boolean, joinR: boolean, aboveGround: boolean): void {
		// Concrete coping on the slab.
		px(g, wx, top - 3, TILE, 3, CONCRETE.mid);
		px(g, wx, top - 3, TILE, 1, CONCRETE.hi);
		px(g, wx, top - 1, TILE, 1, CONCRETE.lo);
		if (!aboveGround) return;
		// Steel railing posts.
		px(g, wx + (joinL ? 0 : 2), top - 8, TILE - (joinL ? 0 : 2) - (joinR ? 0 : 2), 1, STEEL.mid);
		if (x % 2 === 0) px(g, wx + 2, top - 8, 1, 5, STEEL.lo);
		px(g, wx + (joinL ? 0 : 2), top - 6, TILE - (joinL ? 0 : 2) - (joinR ? 0 : 2), 1, dk(T.steel, 0.4));
		// Rooftop clutter: a vent cowl or a copper exhaust stub every few tiles.
		const v = hash(x * 3 + 11, 977);
		if (v < 0.12) {
			px(g, wx + 5, top - 9, 6, 6, STEEL.line);
			px(g, wx + 6, top - 8, 4, 5, STEEL.mid);
			px(g, wx + 6, top - 8, 4, 1, STEEL.hi);
			px(g, wx + 4, top - 10, 8, 2, STEEL.lo);
		} else if (v < 0.2) {
			px(g, wx + 9, top - 12, 3, 9, COPPER.line);
			px(g, wx + 10, top - 12, 1, 9, COPPER.mid);
			px(g, wx + 8, top - 13, 5, 2, VERDI.lo);
		}
	}

	private exterior(g: Graphics, x: number, y: number, h: number, side: -1 | 1): void {
		px(g, x, y, 3, h, CONCRETE.mid);
		px(g, side < 0 ? x : x + 2, y, 1, h, CONCRETE.line);
		px(g, side < 0 ? x + 1 : x + 1, y, 1, h, side < 0 ? CONCRETE.hi : CONCRETE.lo);
		// Board marks.
		for (let k = 6; k < h; k += 12) px(g, x, y + k, 3, 1, CONCRETE.lo);
	}

	// ─── Floor plates ────────────────────────────────────────────────────

	private drawPlates(view: SimView): void {
		const g = this.plateGfx;
		g.clear();
		const { width, floorMin, floorMax, slab } = view;
		let used = 0;
		for (let f = floorMin; f <= floorMax; f++) {
			let left = -1;
			for (let x = 0; x < width; x++) {
				if (slab[(f - floorMin) * width + x] === 1) {
					left = x;
					break;
				}
			}
			if (left < 0) continue;
			const top = floorTop(view, f);
			const name = floorName(f);
			const pw = name.length > 1 ? 14 : 9;
			const x = left * TILE - pw - 2;
			const y = top + 13;
			// Bracket bolting the plate to the facade.
			px(g, x + pw, y + 4, 2, 2, BRASS.lo);
			// Enamel plate: brass rim, paper face, corner screws.
			px(g, x, y, pw, 11, BRASS.line);
			px(g, x + 1, y + 1, pw - 2, 9, f < 0 ? mix(T.paper, T.amber, 0.25) : PAPER.mid);
			px(g, x + 1, y + 1, pw - 2, 1, PAPER.hi);
			px(g, x + 1, y + 9, pw - 2, 1, PAPER.lo);
			px(g, x + 1, y + 1, 1, 1, BRASS.mid);
			px(g, x + pw - 2, y + 1, 1, 1, BRASS.mid);
			px(g, x + 1, y + 9, 1, 1, BRASS.mid);
			px(g, x + pw - 2, y + 9, 1, 1, BRASS.mid);
			let tx = this.plateText[used];
			if (!tx) {
				tx = new Text({ text: "", style: { fontFamily: WORLD_FONT, fontSize: 10, fill: T.ink }, resolution: 4 });
				tx.anchor.set(0.5, 0.5);
				this.plateText.push(tx);
				this.plates.addChild(tx);
			}
			tx.text = name;
			tx.visible = true;
			tx.position.set(x + pw / 2, y + 5);
			used++;
		}
		for (let i = used; i < this.plateText.length; i++) this.plateText[i].visible = false;
	}
}
