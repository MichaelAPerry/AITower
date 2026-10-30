import { describe, expect, it } from "vitest";
import {
	type Camera,
	clampCamera,
	floorTop,
	groundY,
	offset,
	screenToCell,
	screenToWorld,
	sideMargin,
	stepZoom,
	worldToCell,
	worldToScreen,
	zoomAt,
} from "./camera";
import { FLOOR_H, TILE } from "./constants";

const grid = { width: 48, floorMin: -2, floorMax: 10 };
const cam = (cx: number, cy: number, zoom: number): Camera => ({ cx, cy, zoom, vw: 1280, vh: 800 });

describe("camera", () => {
	it("places floors top-down with floorMax at y=0", () => {
		expect(floorTop(grid, 10)).toBe(0);
		expect(floorTop(grid, 0)).toBe(10 * FLOOR_H);
		expect(floorTop(grid, -2)).toBe(12 * FLOOR_H);
		expect(groundY(grid)).toBe(11 * FLOOR_H);
	});

	it("maps world pixels to cells and rejects out-of-grid points", () => {
		expect(worldToCell(grid, 0, 0)).toEqual({ x: 0, floor: 10 });
		expect(worldToCell(grid, 5 * TILE + 15, 10 * FLOOR_H + 47)).toEqual({ x: 5, floor: 0 });
		expect(worldToCell(grid, 47 * TILE + 1, 12 * FLOOR_H + 1)).toEqual({ x: 47, floor: -2 });
		expect(worldToCell(grid, -1, 0)).toBeNull();
		expect(worldToCell(grid, 48 * TILE, 0)).toBeNull();
		expect(worldToCell(grid, 0, -1)).toBeNull();
		expect(worldToCell(grid, 0, 13 * FLOOR_H)).toBeNull();
	});

	for (const zoom of [1, 2, 3, 4]) {
		for (const [cx, cy] of [
			[384, 504],
			[100.3, 77.7],
			[-50, 900],
		]) {
			it(`round-trips screen↔world at zoom ${zoom}, centre ${cx},${cy}`, () => {
				const c = cam(cx, cy, zoom);
				const o = offset(c);
				expect(Number.isInteger(o.x) && Number.isInteger(o.y)).toBe(true);
				const s = worldToScreen(c, 123, 456);
				const w = screenToWorld(c, s.x, s.y);
				expect(w.x).toBeCloseTo(123);
				expect(w.y).toBeCloseTo(456);
			});
		}
	}

	it("picks the cell under the screen centre", () => {
		const c = cam(5 * TILE + 8, floorTop(grid, 0) + 24, 3);
		expect(screenToCell(c, grid, 640, 400)).toEqual({ x: 5, floor: 0 });
		// One tile to the right at zoom 3 = 48 screen px.
		expect(screenToCell(c, grid, 640 + 48, 400)).toEqual({ x: 6, floor: 0 });
		// One floor up = 144 screen px.
		expect(screenToCell(c, grid, 640, 400 - 144)).toEqual({ x: 5, floor: 1 });
	});

	it("zooms toward the cursor keeping the world point fixed", () => {
		const c = cam(300, 300, 1);
		const before = screenToWorld(c, 900, 200);
		const z = zoomAt(c, 3, 900, 200);
		const after = screenToWorld(z, 900, 200);
		expect(after.x).toBeCloseTo(before.x, 0);
		expect(after.y).toBeCloseTo(before.y, 0);
	});

	it("steps zoom within 1..4", () => {
		expect(stepZoom(2, 1)).toBe(3);
		expect(stepZoom(4, 1)).toBe(4);
		expect(stepZoom(1, -1)).toBe(1);
		expect(stepZoom(3, -5)).toBe(2);
	});

	it("clamps the camera to world bounds + margin", () => {
		const far = clampCamera(cam(1e6, -1e6, 2), grid);
		expect(far.cx).toBeLessThan(48 * TILE + 400);
		expect(far.cy).toBeGreaterThan(-400);
		const ok = clampCamera(cam(384, 400, 2), grid);
		expect(ok.cx).toBe(384);
	});
});

describe("camera insets", () => {
	const g = { width: 48, floorMin: -2, floorMax: 10 };
	const w = 48 * TILE;
	const leftEdgeX = (c: Camera) => worldToScreen(c, 0, 0).x;
	const rightEdgeX = (c: Camera) => worldToScreen(c, w, 0).x;
	for (const zoom of [1, 2, 3, 4]) {
		it(`brings both tower ends clear of overlays at zoom ${zoom}`, () => {
			const base = { zoom, vw: 1280, vh: 800, padL: 400, padR: 380 };
			const l = clampCamera({ ...base, cx: -99999, cy: 300 }, g);
			expect(leftEdgeX(l)).toBeGreaterThanOrEqual(400 + 24 - 1);
			const r = clampCamera({ ...base, cx: 99999, cy: 300 }, g);
			expect(rightEdgeX(r)).toBeLessThanOrEqual(1280 - 380 - 24 + 1);
		});
		it(`never loses the tower off screen at zoom ${zoom}`, () => {
			const base = { zoom, vw: 800, vh: 600, padL: 5000, padR: 5000 };
			expect(leftEdgeX(clampCamera({ ...base, cx: -99999, cy: 300 }, g))).toBeLessThan(800);
			expect(rightEdgeX(clampCamera({ ...base, cx: 99999, cy: 300 }, g))).toBeGreaterThan(0);
		});
	}
	it("without insets keeps the old world margin", () => {
		const c = clampCamera(cam(-99999, 300, 2), g);
		expect(leftEdgeX(c)).toBeCloseTo(12 * TILE * 2, 0);
	});
	it("sideMargin takes the larger of world margin and overlay, capped", () => {
		expect(sideMargin(1, 1000, 300)).toBe(324);
		expect(sideMargin(4, 1000, 0)).toBe(768);
		expect(sideMargin(1, 1000, 9999)).toBe(800);
	});
});
