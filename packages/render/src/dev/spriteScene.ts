/**
 * Dev scene for sprite sheets (`dev/sprites.html`, `tools/sprites/preview.ts`): one floor holding a row of real defs side by side,
 * all running, so the real renderer draws them on the game's own walls, pipes and sky.
 */
import type { ContentDB } from "@aitower/content";
import type { FacilityView, SimView } from "@aitower/sim";
import { TILE } from "../constants";
import { createFixture } from "./fixtureView";

export const SPRITE_PAD = 2;
export const SPRITE_GAP = 1;

/** Tiles a row of def ids needs (widths plus one tile between each), without the side padding. */
export const rowTiles = (content: Pick<ContentDB, "facilities">, ids: readonly string[]): number => ids.reduce((n, id) => n + content.facilities[id].width, 0) + SPRITE_GAP * (ids.length - 1);

export interface SpriteScene {
	view: SimView;
	step(): SimView;
	/** Width of the lot in px (tiles x 16). */
	widthPx: number;
}

/** A one-floor scene: `ids` placed left to right from tile `SPRITE_PAD`, daylight, clock held at `minute`. */
export interface SpriteSceneOpts {
	/** A lift shaft at the left edge of the lot, then `gapBeforeFirst` free tiles, then the defs (the Consciousness Transfer Unit preview). */
	lift?: boolean;
	gapBeforeFirst?: number;
	/** Facility ids start at `idBase + 1` (previews that hold several scenes at once give each its own range). */
	idBase?: number;
}

export function createSpriteScene(content: Pick<ContentDB, "facilities">, ids: readonly string[], minute = 780, opts: SpriteSceneOpts = {}): SpriteScene {
	const base = createFixture(minute, 0).view;
	const lead = opts.lift ? 1 + (opts.gapBeforeFirst ?? 1) : 0;
	const width = rowTiles(content, ids) + SPRITE_PAD * 2 + lead;
	const n = width;
	const slab = new Uint8Array(n).fill(1);
	const power = new Uint8Array(n).fill(1);
	const facilities: FacilityView[] = [];
	let x = SPRITE_PAD + lead;
	ids.forEach((defId, i) => {
		const d = content.facilities[defId];
		const isRack = d.kind === "rack";
		facilities.push({
			id: (opts.idBase ?? 0) + i + 1,
			defId,
			floor: 0,
			x,
			width: d.width,
			enabled: true,
			status: "ok",
			tempC: isRack ? 60 : 24,
			clock: 0.9,
			health: 1,
			powerKw: 30,
			heatKw: isRack ? 30 : d.kind === "heat_export" ? 260 : 120,
			jobId: isRack ? 1 : null,
			powerNet: 0,
			coolantNet: null,
			nutrientNet: null,
			grown: false,
			contamination: 0,
			running: d.kind === "genset" ? true : undefined,
			charge: d.kind === "ups" ? 0.6 : undefined,
		});
		x += d.width + SPRITE_GAP;
	});
	const view: SimView = {
		...base,
		tick: 0,
		width,
		floorMin: 0,
		floorMax: 0,
		slab,
		power,
		coolant: new Uint8Array(n),
		airTemp: new Float32Array(n).fill(24),
		powerNetOf: new Int32Array(n).fill(0),
		coolantNetOf: new Int32Array(n).fill(-1),
		nutrient: new Uint8Array(n),
		nutrientNetOf: new Int32Array(n).fill(-1),
		contamination: new Float32Array(n),
		facilities,
		lifts: opts.lift ? [{ id: 1, x: SPRITE_PAD, floorMin: 0, floorMax: 0, carFloor: 0, dir: 0, doorsOpen: true, riders: 0, powered: true }] : [],
		bots: [],
		powerNets: [{ id: 0, supplyKw: 9000, demandKw: 100, satisfaction: 1, storedKwh: 0, storageCapacityKwh: 0, gridImportKw: 100 }],
		coolantNets: [],
		nutrientNets: [],
		path: null,
		corruption: 0,
		pathScore: 0,
		drought: false,
		minuteOfDay: minute,
	};
	return {
		view,
		widthPx: width * TILE,
		step: () => {
			view.tick++;
			return view;
		},
	};
}
