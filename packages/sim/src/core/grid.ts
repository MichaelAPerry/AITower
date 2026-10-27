/** Grid index helpers. Index = (floor - floorMin) * width + x. */

export interface GridDims {
	width: number;
	floorMin: number;
	floorMax: number;
}

export const floorCount = (g: GridDims): number => g.floorMax - g.floorMin + 1;

export const cellCount = (g: GridDims): number => g.width * floorCount(g);

export const cellIdx = (g: GridDims, x: number, floor: number): number => (floor - g.floorMin) * g.width + x;

export const inBounds = (g: GridDims, x: number, floor: number): boolean =>
	Number.isInteger(x) && Number.isInteger(floor) && x >= 0 && x < g.width && floor >= g.floorMin && floor <= g.floorMax;

/** Binary search an id-sorted entity array. */
export function findById<T extends { id: number }>(arr: T[], id: number): T | undefined {
	let lo = 0;
	let hi = arr.length - 1;
	if (hi < 0) return undefined;
	// Ids are strictly increasing integers, so `id` can sit no further right than `id - first`; with no removals that is exactly where it is.
	const guess = id - arr[0].id;
	if (guess < 0) return undefined;
	if (guess <= hi) {
		const g = arr[guess];
		if (g.id === id) return g;
		hi = guess;
	}
	while (lo <= hi) {
		const mid = (lo + hi) >> 1;
		const v = arr[mid].id;
		if (v === id) return arr[mid];
		if (v < id) lo = mid + 1;
		else hi = mid - 1;
	}
	return undefined;
}

/** Remove the entity with `id` from an id-sorted array (no-op if absent). */
export function removeById<T extends { id: number }>(arr: T[], id: number): void {
	const e = findById(arr, id);
	if (e) arr.splice(arr.indexOf(e), 1);
}
