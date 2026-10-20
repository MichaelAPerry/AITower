/** Grid index helpers. Index = (floor - floorMin) * width + x. */
export const floorCount = (g) => g.floorMax - g.floorMin + 1;
export const cellCount = (g) => g.width * floorCount(g);
export const cellIdx = (g, x, floor) => (floor - g.floorMin) * g.width + x;
export const inBounds = (g, x, floor) => Number.isInteger(x) && Number.isInteger(floor) && x >= 0 && x < g.width && floor >= g.floorMin && floor <= g.floorMax;
/** Binary search an id-sorted entity array. */
export function findById(arr, id) {
    let lo = 0;
    let hi = arr.length - 1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const v = arr[mid].id;
        if (v === id)
            return arr[mid];
        if (v < id)
            lo = mid + 1;
        else
            hi = mid - 1;
    }
    return undefined;
}
/** Remove the entity with `id` from an id-sorted array (no-op if absent). */
export function removeById(arr, id) {
    const e = findById(arr, id);
    if (e)
        arr.splice(arr.indexOf(e), 1);
}
