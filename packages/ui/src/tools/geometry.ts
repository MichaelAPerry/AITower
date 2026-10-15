import type { CellRef } from "@aitower/sim";

/** Horizontal span on `floor` between two x's, normalised left→right. */
export function slabSpan(floor: number, xa: number, xb: number): { floor: number; x0: number; x1: number; cells: CellRef[] } {
	const x0 = Math.min(xa, xb);
	const x1 = Math.max(xa, xb);
	const cells: CellRef[] = [];
	for (let x = x0; x <= x1; x++) cells.push({ x, floor });
	return { floor, x0, x1, cells };
}

/** L-shaped path: horizontal along `a.floor` from a.x to b.x, then vertical along b.x to b.floor. No duplicates. */
export function lPath(a: CellRef, b: CellRef): CellRef[] {
	const cells: CellRef[] = [];
	const sx = b.x >= a.x ? 1 : -1;
	for (let x = a.x; x !== b.x + sx; x += sx) cells.push({ x, floor: a.floor });
	const sf = b.floor >= a.floor ? 1 : -1;
	for (let f = a.floor + sf; b.floor !== a.floor && f !== b.floor + sf; f += sf) cells.push({ x: b.x, floor: f });
	return cells;
}

/** Vertical span at column `x` between two floors, normalised bottom→top. */
export function liftSpan(x: number, fa: number, fb: number): { x: number; floorMin: number; floorMax: number; cells: CellRef[] } {
	const floorMin = Math.min(fa, fb);
	const floorMax = Math.max(fa, fb);
	const cells: CellRef[] = [];
	for (let f = floorMin; f <= floorMax; f++) cells.push({ x, floor: f });
	return { x, floorMin, floorMax, cells };
}

/** Cells covered by a facility of `width` with left edge at `cell`. */
export function footprint(cell: CellRef, width: number): CellRef[] {
	const cells: CellRef[] = [];
	for (let i = 0; i < width; i++) cells.push({ x: cell.x + i, floor: cell.floor });
	return cells;
}

export const sameCell = (a: CellRef | null, b: CellRef | null): boolean =>
	a === b || (!!a && !!b && a.x === b.x && a.floor === b.floor);

export const cellKey = (c: CellRef): string => `${c.x},${c.floor}`;
