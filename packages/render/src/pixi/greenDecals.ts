/**
 * Greentech decals that are not part of a device body (M4): moss on slab edges (25 %), vines on conduits (50 %), small fish
 * tanks in coolant loops (75 %) and the roof garden of the living green tower (100 %). Static: rebuilt only when the layout,
 * the stage or the conduits change (the renderer passes a key), culled to nothing for other paths.
 */
import type { SimView } from "@aitower/sim";
import { Graphics } from "pixi.js";
import { floorTop } from "../camera";
import { CABLE_Y, TILE } from "../constants";
import { MOSS_DENSITY, ROOF_DENSITY, TANK_DENSITY, VINE_DENSITY, cellHas } from "../green";
import { hash2 } from "../horror";
import { GLASS, T, dk, lt, mat, mix } from "../palette";
import type { SkinStage } from "../skin";
import { px } from "./draw";

const LEAF = mat(mix(T.green, T.greenDim, 0.4));
const MOSS = mix(T.greenDim, T.green, 0.3);
const MOSS_LT = mix(T.greenDim, T.green, 0.6);
const WATER = mix(GLASS, T.brass, 0.3);
const FISH = mix(T.amber, T.red, 0.3);
const SOIL = dk(T.bile, 0.55);
const FLOWERS = [T.amber, T.paper, mix(T.red, T.paper, 0.4)] as const;

/** Rows (within a floor) of the coolant pipes and where the slab's top edge is. */
const PIPE_TOP = 1;
const PIPE_BOTTOM = 6;
const SLAB_TOP = 44;

export class GreenDecals {
	readonly g = new Graphics();
	private key = "";

	needsRebuild(key: string): boolean {
		return key !== this.key;
	}

	/** Redraw for `stage` (0 clears the layer). */
	rebuild(view: SimView, stage: SkinStage, key: string): void {
		this.key = key;
		const g = this.g;
		g.clear();
		if (stage === 0) return;
		const w = view.width;
		const idx = (x: number, f: number): number => (f - view.floorMin) * w + x;
		const has = (x: number, f: number): boolean => x >= 0 && x < w && f >= view.floorMin && f <= view.floorMax && view.slab[idx(x, f)] !== 0;
		for (let f = view.floorMin; f <= view.floorMax; f++) {
			const top = floorTop(view, f);
			for (let x = 0; x < w; x++) {
				if (!has(x, f)) continue;
				const wx = x * TILE;
				if (cellHas(MOSS_DENSITY, stage, x, f, 1)) {
					const o = Math.floor(hash2(x, f) * 9);
					px(g, wx + o, top + SLAB_TOP, 4, 1, MOSS);
					px(g, wx + o + 1, top + SLAB_TOP, 2, 1, MOSS_LT);
					px(g, wx + o, top + SLAB_TOP + 1, 2, 1, MOSS, 0.8);
				}
				const i = idx(x, f);
				if (view.coolant[i] !== 0 && cellHas(VINE_DENSITY, stage, x, f, 2)) {
					const vx = wx + 2 + Math.floor(hash2(f, x) * 11);
					const len = 3 + Math.floor(hash2(x, f + 9) * 4);
					for (let r = 0; r < len; r++) {
						px(g, vx + (r % 4 < 2 ? 0 : 1), top + PIPE_BOTTOM + 1 + r, 1, 1, LEAF.lo);
						if (r % 2 === 1) px(g, vx + (r % 4 < 2 ? -1 : 2), top + PIPE_BOTTOM + 1 + r, 1, 1, r % 3 ? LEAF.mid : LEAF.hi);
					}
				}
				if (view.power[i] !== 0 && cellHas(VINE_DENSITY, stage, x, f, 3)) {
					// Leaves climbing the cable tray.
					const vx = wx + 3 + Math.floor(hash2(x, f + 3) * 9);
					for (let r = 0; r < 3; r++) px(g, vx + (r & 1), top + CABLE_Y - r, 1, 1, r === 2 ? LEAF.hi : LEAF.mid);
				}
				// A fish tank in the coolant loop (never two in a row).
				if (view.coolant[i] !== 0 && cellHas(TANK_DENSITY, stage, x, f, 4) && !cellHas(TANK_DENSITY, stage, x - 1, f, 4)) {
					const tx = wx + 1;
					const ty = top + PIPE_TOP;
					px(g, tx, ty, 14, 6, GLASS);
					px(g, tx + 1, ty + 1, 12, 4, WATER, 0.9);
					px(g, tx + 1, ty + 4, 12, 1, SOIL);
					px(g, tx + 3, ty + 3, 1, 1, LEAF.mid);
					px(g, tx + 9, ty + 2, 2, 1, FISH);
					px(g, tx + 11, ty + 2, 1, 1, lt(FISH, 0.2));
					px(g, tx, ty, 14, 1, lt(GLASS, 0.35));
				}
				// Roof garden where nothing is built above.
				if (stage >= 4 && !has(x, f + 1) && cellHas(ROOF_DENSITY, stage, x, f, 5)) {
					const base = top - 1;
					px(g, wx + 2, base, 12, 2, SOIL);
					for (let k = 0; k < 4; k++) {
						const sx = wx + 3 + k * 3;
						const h = 3 + Math.floor(hash2(sx, f) * 4);
						px(g, sx, base - h, 1, h, LEAF.lo);
						px(g, sx - 1, base - h + 1, 1, 1, LEAF.mid);
						px(g, sx + 1, base - h + 2, 1, 1, LEAF.hi);
						px(g, sx, base - h - 1, 1, 1, hash2(sx, f + 7) < 0.45 ? FLOWERS[k % 3] : LEAF.hi);
					}
				}
			}
		}
	}
}
