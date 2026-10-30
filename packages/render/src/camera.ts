/**
 * Pure camera math (no Pixi). The camera stores the world point shown at the
 * centre of the viewport and an integer zoom. The world container is placed at
 * an integer screen offset so pixels stay crisp; all conversions use that same
 * rounded offset so picking matches what is drawn.
 */
import type { CellRef } from "@aitower/sim";
import { FLOOR_H, MARGIN_BOTTOM, MARGIN_TOP, MARGIN_X, TILE, ZOOMS } from "./constants";

export interface Camera {
	/** World point at the viewport centre. */
	cx: number;
	cy: number;
	zoom: number;
	/** Viewport size in CSS pixels. */
	vw: number;
	vh: number;
	/** Screen px at the left/right edge covered by UI overlays (palette, inspector, tabs). The tower may be panned clear of them. */
	padL?: number;
	padR?: number;
}

export interface GridDims {
	width: number;
	floorMin: number;
	floorMax: number;
}

export interface Vec {
	x: number;
	y: number;
}

/** World y of the top edge of `floor` (floorMax's top is y = 0). */
export const floorTop = (grid: Pick<GridDims, "floorMax">, floor: number): number => (grid.floorMax - floor) * FLOOR_H;

/** World y of the ground line (bottom edge of floor 0). */
export const groundY = (grid: Pick<GridDims, "floorMax">): number => (grid.floorMax + 1) * FLOOR_H;

export const worldSize = (grid: GridDims): { w: number; h: number } => ({
	w: grid.width * TILE,
	h: (grid.floorMax - grid.floorMin + 1) * FLOOR_H,
});

/** Integer screen offset of world origin. */
export const offset = (cam: Camera): Vec => ({
	x: Math.round(cam.vw / 2 - cam.cx * cam.zoom),
	y: Math.round(cam.vh / 2 - cam.cy * cam.zoom),
});

export const screenToWorld = (cam: Camera, sx: number, sy: number): Vec => {
	const o = offset(cam);
	return { x: (sx - o.x) / cam.zoom, y: (sy - o.y) / cam.zoom };
};

export const worldToScreen = (cam: Camera, wx: number, wy: number): Vec => {
	const o = offset(cam);
	return { x: wx * cam.zoom + o.x, y: wy * cam.zoom + o.y };
};

/** World pixel → cell, or null outside the grid. */
export const worldToCell = (grid: GridDims, wx: number, wy: number): CellRef | null => {
	const x = Math.floor(wx / TILE);
	const floor = grid.floorMax - Math.floor(wy / FLOOR_H);
	if (x < 0 || x >= grid.width || floor < grid.floorMin || floor > grid.floorMax) return null;
	return { x, floor };
};

export const screenToCell = (cam: Camera, grid: GridDims, sx: number, sy: number): CellRef | null => {
	const w = screenToWorld(cam, sx, sy);
	return worldToCell(grid, w.x, w.y);
};

/** Centre of a cell in world pixels. */
export const cellCenter = (grid: GridDims, cell: CellRef): Vec => ({
	x: cell.x * TILE + TILE / 2,
	y: floorTop(grid, cell.floor) + FLOOR_H / 2,
});

/** Breathing room (screen px) between the tower end and an overlay edge. */
export const PAN_CLEAR = 24;

/**
 * Screen-pixel slack past a tower end: the fixed world margin, or enough to bring the end clear of the overlay on
 * that side, whichever is larger. Capped so the tower can never leave the screen entirely.
 */
export const sideMargin = (zoom: number, vw: number, pad = 0): number => {
	const want = Math.max(MARGIN_X * zoom, pad > 0 ? pad + PAN_CLEAR : 0);
	return Math.min(want, vw * 0.8);
};

/** Keep the camera centre within the world bounds plus margin. */
export const clampCamera = (cam: Camera, grid: GridDims): Camera => {
	const { w, h } = worldSize(grid);
	const halfW = cam.vw / 2 / cam.zoom;
	const halfH = cam.vh / 2 / cam.zoom;
	const clampAxis = (c: number, lo: number, hi: number, half: number): number => {
		// If the viewport is bigger than the allowed span, centre on the span.
		if (hi - lo <= half * 2) return (lo + hi) / 2;
		return Math.min(Math.max(c, lo + half), hi - half);
	};
	const mL = sideMargin(cam.zoom, cam.vw, cam.padL) / cam.zoom;
	const mR = sideMargin(cam.zoom, cam.vw, cam.padR) / cam.zoom;
	return {
		...cam,
		cx: clampAxis(cam.cx, -mL, w + mR, halfW),
		cy: clampAxis(cam.cy, -MARGIN_TOP, h + MARGIN_BOTTOM, halfH),
	};
};

/** Next zoom step in `dir` (+1 in, -1 out), clamped to ZOOMS. */
export const stepZoom = (zoom: number, dir: number): number => {
	const i = ZOOMS.indexOf(zoom as (typeof ZOOMS)[number]);
	const cur = i < 0 ? 0 : i;
	const next = Math.min(Math.max(cur + Math.sign(dir), 0), ZOOMS.length - 1);
	return ZOOMS[next];
};

/** Change zoom keeping the world point under the screen point (sx, sy) fixed. */
export const zoomAt = (cam: Camera, newZoom: number, sx: number, sy: number): Camera => {
	const w = screenToWorld(cam, sx, sy);
	return {
		...cam,
		zoom: newZoom,
		cx: w.x - (sx - cam.vw / 2) / newZoom,
		cy: w.y - (sy - cam.vh / 2) / newZoom,
	};
};

/** Pan by a screen-pixel delta. */
export const panBy = (cam: Camera, dsx: number, dsy: number): Camera => ({
	...cam,
	cx: cam.cx - dsx / cam.zoom,
	cy: cam.cy - dsy / cam.zoom,
});
