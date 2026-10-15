/** Earth, building shell (slabs, back walls, roof) — cached, rebuilt only when the slab array changes. */
import type { SimView } from "@aitower/sim";
import { Graphics } from "pixi.js";
import { floorTop, groundY } from "../camera";
import { CABLE_Y, FLOOR_H, MARGIN_BOTTOM, MARGIN_X, SLAB_H, TILE } from "../constants";
import { px } from "./draw";

const EARTH = 0x3a2a1f;
const EARTH_DARK = 0x2c2018;
const EARTH_LIGHT = 0x4a3626;
const WALL_ABOVE = 0x262c37;
const WALL_BELOW = 0x23211f;
const SLAB_TOP = 0xa2a8b0;
const SLAB_MID = 0x7c838c;
const SLAB_BOT = 0x4d535b;
const RAISED = 0x323844;

export class Structure {
	readonly earth = new Graphics();
	readonly shell = new Graphics();

	rebuild(view: SimView): void {
		this.drawEarth(view);
		this.drawShell(view);
	}

	private drawEarth(view: SimView): void {
		const g = this.earth;
		g.clear();
		const gy = groundY(view);
		const x0 = -MARGIN_X - 4000;
		const x1 = view.width * TILE + MARGIN_X + 4000;
		const bottom = (view.floorMax - view.floorMin + 1) * FLOOR_H + MARGIN_BOTTOM + 4000;
		px(g, x0, gy, x1 - x0, bottom - gy, EARTH);
		// Strata and pebbles (deterministic).
		let s = 7;
		const r = () => {
			s = (Math.imul(s, 1103515245) + 12345) >>> 0;
			return s / 4294967296;
		};
		for (let y = gy + 10; y < gy + (1 - view.floorMin) * FLOOR_H + MARGIN_BOTTOM; y += 9) {
			for (let x = x0 + 2000; x < x1 - 2000; x += 4) {
				const v = r();
				if (v < 0.08) px(g, x, y + Math.floor(r() * 8), 2, 1, EARTH_DARK);
				else if (v < 0.12) px(g, x, y + Math.floor(r() * 8), 2, 2, EARTH_LIGHT);
			}
		}
		// Topsoil + pavement line.
		px(g, x0, gy, x1 - x0, 2, 0x5a6b3a);
		px(g, x0, gy + 2, x1 - x0, 2, 0x4a3a2a);
	}

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
				// Back wall with panel seams.
				const wall = below ? WALL_BELOW : WALL_ABOVE;
				px(g, wx, top, TILE, FLOOR_H, wall);
				px(g, wx + TILE - 1, top, 1, FLOOR_H - SLAB_H, below ? 0x1c1a18 : 0x1f242d);
				px(g, wx, top + 22, TILE, 1, below ? 0x1c1a18 : 0x2d3440);
				if (!below && x % 4 === 1) px(g, wx + 5, top + 14, 6, 4, 0x2d3542); // vent panel
				// Raised floor tiles (cable tray under them).
				px(g, wx, top + CABLE_Y, TILE, FLOOR_H - SLAB_H - CABLE_Y, RAISED);
				px(g, wx + 7, top + CABLE_Y + 1, 1, 1, 0x232831);
				// Slab.
				const sy = top + FLOOR_H - SLAB_H;
				px(g, wx, sy, TILE, 1, SLAB_TOP);
				px(g, wx, sy + 1, TILE, 2, SLAB_MID);
				px(g, wx, sy + 3, TILE, 1, SLAB_BOT);
				if ((x + f) % 3 === 0) px(g, wx + 4, sy + 2, 1, 1, SLAB_BOT);
				// Roof cap where nothing is built above.
				if (!has(x, f + 1)) {
					px(g, wx, top - 2, TILE, 2, SLAB_MID);
					px(g, wx, top - 3, TILE, 1, SLAB_TOP);
				}
				// Exterior walls at run ends.
				if (!has(x - 1, f)) {
					px(g, wx, top - (has(x, f + 1) ? 0 : 3), 2, FLOOR_H + (has(x, f + 1) ? 0 : 3), SLAB_MID);
					px(g, wx, top, 1, FLOOR_H, SLAB_BOT);
				}
				if (!has(x + 1, f)) {
					px(g, wx + TILE - 2, top - (has(x, f + 1) ? 0 : 3), 2, FLOOR_H + (has(x, f + 1) ? 0 : 3), SLAB_MID);
					px(g, wx + TILE - 1, top, 1, FLOOR_H, SLAB_BOT);
				}
			}
		}
	}
}
