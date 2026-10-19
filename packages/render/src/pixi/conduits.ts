/**
 * Power: a thin warm-white cable line in a graphite tray; nutrient: a pale-green line (row 7). Legacy note: cloth bundle on ceramic
 * standoffs (floor void). Coolant: exposed copper supply + verdigris return
 * pipes under the ceiling with flanges and pressure dials. Horizontal runs join
 * neighbouring cells; vertically linked cells get risers (one per stretch).
 * With a colour callback the same geometry is drawn as a flat highlight for overlays.
 */
import type { SimView } from "@aitower/sim";
import type { Graphics } from "pixi.js";
import { floorTop } from "../camera";
import { CABLE_Y, FLOOR_H, PIPE_H, PIPE_RETURN_Y, PIPE_SUPPLY_Y, TILE } from "../constants";
import { BRASS, CLOTH, COPPER, NUTRIENT, PAPER, STEEL, T, VERDI, type Mat, lt } from "../palette";
import { dialFace, needle, px } from "./draw";

export const POWER_COLOR = T.amber;
export const SUPPLY_COLOR = T.copper;
export const RETURN_COLOR = T.verdigris;
export const NUTRIENT_COLOR = NUTRIENT.mid;
/** Row of the thin nutrient line: the free pixel row between the coolant return and the pneumatic tube. */
export const NUTRIENT_Y = 7;
const NUTRIENT_RISER_X = 14;

/** Riser column offsets within a tile. */
const POWER_RISER_X = 1;
const SUPPLY_RISER_X = 9;
const RETURN_RISER_X = 12;

type Colorer = (cellIndex: number) => number;

const at = (arr: Uint8Array, view: SimView, x: number, f: number): boolean =>
	x >= 0 && x < view.width && f >= view.floorMin && f <= view.floorMax && arr[(f - view.floorMin) * view.width + x] === 1;

/** One riser per contiguous stretch of vertical links, to avoid clutter. */
const riserUp = (arr: Uint8Array, view: SimView, x: number, f: number): boolean =>
	at(arr, view, x, f + 1) && !(at(arr, view, x - 1, f) && at(arr, view, x - 1, f + 1));

// ─── Power ─────────────────────────────────────────────────────────────

export function drawPower(g: Graphics, view: SimView, color?: Colorer): void {
	const arr = view.power;
	for (let f = view.floorMin; f <= view.floorMax; f++) {
		const top = floorTop(view, f);
		for (let x = 0; x < view.width; x++) {
			if (!at(arr, view, x, f)) continue;
			const i = (f - view.floorMin) * view.width + x;
			const wx = x * TILE;
			const y = top + CABLE_Y;
			const l = at(arr, view, x - 1, f);
			const r = at(arr, view, x + 1, f);
			const x0 = l ? wx : wx + POWER_RISER_X;
			const x1 = r ? wx + TILE : wx + TILE - 2;
			const up = riserUp(arr, view, x, f);
			const upY = top - FLOOR_H + CABLE_Y;
			if (color) {
				const c = color(i);
				px(g, x0, y - 1, x1 - x0, 5, c, 0.25);
				px(g, x0, y, x1 - x0, 3, c);
				px(g, x0, y, x1 - x0, 1, lt(c, 0.5));
				if (up) {
					px(g, wx + POWER_RISER_X - 1, upY, 5, y - upY + 3, c, 0.25);
					px(g, wx + POWER_RISER_X, upY, 3, y - upY + 3, c);
					px(g, wx + POWER_RISER_X, upY, 1, y - upY + 3, lt(c, 0.5));
				}
				continue;
			}
			// Braided bundle (2 rows, diagonal twist) over a riveted steel tray.
			for (let k = x0; k < x1; k++) {
				// Black cloth with an ochre tracer wound around it (3-px pitch diagonal).
				const tw = (k + 64) % 3;
				px(g, k, y, 1, 1, tw === 0 ? CLOTH.ochre : CLOTH.black);
				px(g, k, y + 1, 1, 1, tw === 1 ? CLOTH.ochreDk : CLOTH.black);
			}
			px(g, x0, y + 2, x1 - x0, 1, STEEL.lo);
			for (let k = wx + 1; k < x1; k += 4) if (k >= x0) px(g, k, y + 2, 1, 1, BRASS.hi);
			// Ceramic standoffs on the beam flange.
			if (x % 2 === 0) {
				px(g, wx + 6, y + 3, 3, 1, PAPER.mid);
				px(g, wx + 6, y + 3, 1, 1, PAPER.hi);
			}
			if (up) {
				// Vertical bundle in a channel, brass clamps every 6 px.
				const h = y - upY + 3;
				px(g, wx + POWER_RISER_X, upY, 1, h, STEEL.lo);
				for (let k = 0; k < h; k++) {
					const tw = (k + 64) % 4;
					px(g, wx + POWER_RISER_X + 1, upY + k, 1, 1, tw < 2 ? CLOTH.ochre : CLOTH.black);
					px(g, wx + POWER_RISER_X + 2, upY + k, 1, 1, tw === 1 || tw === 2 ? CLOTH.black : CLOTH.ochreDk);
				}
				for (let k = 4; k < h - 2; k += 6) px(g, wx + POWER_RISER_X, upY + k, 4, 1, BRASS.mid);
			}
			// Junction box at run ends.
			if (!l || !r) {
				const bx = l ? x1 - 3 : x0;
				px(g, bx, y - 2, 4, 5, STEEL.line);
				px(g, bx + 1, y - 1, 2, 3, STEEL.mid);
				px(g, bx + 1, y - 1, 2, 1, STEEL.hi);
			}
		}
	}
}

// ─── Coolant ───────────────────────────────────────────────────────────

/** 3-row pipe: highlight, body, shadow. */
const pipeRun = (g: Graphics, x0: number, x1: number, y: number, m: Mat): void => {
	px(g, x0, y, x1 - x0, 1, m.hi);
	px(g, x0, y + 1, x1 - x0, 1, m.mid);
	px(g, x0, y + 2, x1 - x0, 1, m.lo);
};

const pipeRiser = (g: Graphics, x: number, y0: number, y1: number, m: Mat): void => {
	px(g, x, y0, 1, y1 - y0, m.hi);
	px(g, x + 1, y0, 1, y1 - y0, m.mid);
	px(g, x + 2, y0, 1, y1 - y0, m.lo);
};

export function drawCoolant(g: Graphics, view: SimView, supply?: Colorer, ret?: Colorer): void {
	const arr = view.coolant;
	for (let f = view.floorMin; f <= view.floorMax; f++) {
		const top = floorTop(view, f);
		for (let x = 0; x < view.width; x++) {
			if (!at(arr, view, x, f)) continue;
			const i = (f - view.floorMin) * view.width + x;
			const wx = x * TILE;
			const l = at(arr, view, x - 1, f);
			const r = at(arr, view, x + 1, f);
			const up = riserUp(arr, view, x, f);
			const x0 = l ? wx : wx + 1;
			const x1 = r ? wx + TILE : wx + TILE - 1;
			if (supply && ret) {
				for (const [c, py, rx] of [
					[supply(i), PIPE_SUPPLY_Y, SUPPLY_RISER_X],
					[ret(i), PIPE_RETURN_Y, RETURN_RISER_X],
				] as const) {
					const y = top + py;
					px(g, x0, y - 1, x1 - x0, PIPE_H + 2, c, 0.25);
					px(g, x0, y, x1 - x0, PIPE_H, c);
					px(g, x0, y, x1 - x0, 1, lt(c, 0.5));
					if (up) {
						const upY = top - FLOOR_H + py;
						px(g, wx + rx, upY, PIPE_H, y - upY, c);
						px(g, wx + rx, upY, 1, y - upY, lt(c, 0.5));
					}
				}
				continue;
			}
			// Hanger straps from the ceiling.
			if (x % 3 === 1) px(g, wx + 3, top, 1, PIPE_SUPPLY_Y, STEEL.lo);
			pipeRun(g, x0, x1, top + PIPE_SUPPLY_Y, COPPER);
			pipeRun(g, x0, x1, top + PIPE_RETURN_Y, VERDI);
			// Copper patina blotch on the return line now and then.
			if ((x * 7 + f * 3) % 11 === 0) px(g, wx + 5, top + PIPE_RETURN_Y + 1, 3, 1, VERDI.hi);
			// Bolted flanges every 3 tiles.
			if (x % 3 === 0) {
				px(g, wx + 11, top + PIPE_SUPPLY_Y - 1, 2, PIPE_H + 1, COPPER.dk);
				px(g, wx + 11, top + PIPE_SUPPLY_Y - 1, 1, 1, COPPER.hi);
				px(g, wx + 11, top + PIPE_RETURN_Y, 2, PIPE_H + 1, VERDI.dk);
				px(g, wx + 11, top + PIPE_RETURN_Y + PIPE_H, 1, 1, VERDI.hi);
			}
			// Pressure dial at the joint every 6 tiles and at run starts.
			if (x % 6 === 2 || (!l && r)) {
				const dx = l ? wx + 4 : wx + 5;
				px(g, dx + 2, top + PIPE_SUPPLY_Y + 1, 1, 3, BRASS.lo);
				dialFace(g, dx, top + PIPE_SUPPLY_Y + 1, 5);
				needle(g, dx, top + PIPE_SUPPLY_Y + 1, 5, 0.35 + ((x * 13) % 7) / 14);
			}
			if (up) {
				const upTop = top - FLOOR_H;
				pipeRiser(g, wx + SUPPLY_RISER_X, upTop + PIPE_SUPPLY_Y, top + PIPE_SUPPLY_Y + PIPE_H, COPPER);
				pipeRiser(g, wx + RETURN_RISER_X, upTop + PIPE_RETURN_Y, top + PIPE_RETURN_Y + PIPE_H, VERDI);
				// Collars where the risers pass the slab.
				px(g, wx + SUPPLY_RISER_X - 1, top - 3, 8, 2, BRASS.lo);
				px(g, wx + SUPPLY_RISER_X - 1, top - 3, 8, 1, BRASS.mid);
			}
			// Blind end flanges.
			if (!l) px(g, wx, top + PIPE_SUPPLY_Y - 1, 2, PIPE_RETURN_Y - PIPE_SUPPLY_Y + PIPE_H + 2, STEEL.line);
			if (!r) px(g, wx + TILE - 2, top + PIPE_SUPPLY_Y - 1, 2, PIPE_RETURN_Y - PIPE_SUPPLY_Y + PIPE_H + 2, STEEL.line);
		}
	}
}

// ─── Nutrient ──────────────────────────────────────────────────────────

/**
 * Third conduit layer (`view.nutrient`): a thin pale-green line under the coolant pair with hanger dots and risers. With a
 * colour callback the same geometry is drawn as a flat highlight (the nutrient overlay).
 */
export function drawNutrient(g: Graphics, view: SimView, color?: Colorer): void {
	const arr = view.nutrient;
	for (let f = view.floorMin; f <= view.floorMax; f++) {
		const top = floorTop(view, f);
		for (let x = 0; x < view.width; x++) {
			if (!at(arr, view, x, f)) continue;
			const i = (f - view.floorMin) * view.width + x;
			const wx = x * TILE;
			const l = at(arr, view, x - 1, f);
			const r = at(arr, view, x + 1, f);
			const up = riserUp(arr, view, x, f);
			const x0 = l ? wx : wx + 2;
			const x1 = r ? wx + TILE : wx + TILE - 2;
			const y = top + NUTRIENT_Y;
			const upY = top - FLOOR_H + NUTRIENT_Y;
			if (color) {
				const c = color(i);
				px(g, x0, y - 2, x1 - x0, 5, c, 0.25);
				px(g, x0, y - 1, x1 - x0, 3, c);
				px(g, x0, y - 1, x1 - x0, 1, lt(c, 0.5));
				if (up) {
					px(g, wx + NUTRIENT_RISER_X - 1, upY, 4, y - upY, c, 0.25);
					px(g, wx + NUTRIENT_RISER_X, upY, 2, y - upY, c);
				}
				continue;
			}
			px(g, x0, y, x1 - x0, 1, NUTRIENT.mid);
			for (let k = x0 + 1; k < x1; k += 4) px(g, k, y, 1, 1, NUTRIENT.hi);
			if (!l) px(g, wx + 1, y - 1, 2, 3, NUTRIENT.dk);
			if (!r) px(g, wx + TILE - 3, y - 1, 2, 3, NUTRIENT.dk);
			if (up) {
				px(g, wx + NUTRIENT_RISER_X, upY, 1, y - upY, NUTRIENT.mid);
				px(g, wx + NUTRIENT_RISER_X + 1, upY, 1, y - upY, NUTRIENT.lo, 0.7);
			}
		}
	}
}

/** Cells along coolant runs that occasionally drip (deterministic), for the effects layer. */
export const dripCells = (view: SimView): { x: number; y: number; floor: number }[] => {
	const out: { x: number; y: number; floor: number }[] = [];
	for (let f = view.floorMin; f <= view.floorMax; f++) {
		for (let x = 0; x < view.width; x++) {
			if (!at(view.coolant, view, x, f) || (x * 31 + f * 17) % 9 !== 0) continue;
			out.push({ x: x * TILE + 6, y: floorTop(view, f) + PIPE_RETURN_Y + PIPE_H, floor: f });
		}
	}
	return out;
};
