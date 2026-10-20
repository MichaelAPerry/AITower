/** Horizontal span on `floor` between two x's, normalised left→right. */
export function slabSpan(floor, xa, xb) {
    const x0 = Math.min(xa, xb);
    const x1 = Math.max(xa, xb);
    const cells = [];
    for (let x = x0; x <= x1; x++)
        cells.push({ x, floor });
    return { floor, x0, x1, cells };
}
/** L-shaped path: horizontal along `a.floor` from a.x to b.x, then vertical along b.x to b.floor. No duplicates. */
export function lPath(a, b) {
    const cells = [];
    const sx = b.x >= a.x ? 1 : -1;
    for (let x = a.x; x !== b.x + sx; x += sx)
        cells.push({ x, floor: a.floor });
    const sf = b.floor >= a.floor ? 1 : -1;
    for (let f = a.floor + sf; b.floor !== a.floor && f !== b.floor + sf; f += sf)
        cells.push({ x: b.x, floor: f });
    return cells;
}
/** Vertical span at column `x` between two floors, normalised bottom→top. */
export function liftSpan(x, fa, fb) {
    const floorMin = Math.min(fa, fb);
    const floorMax = Math.max(fa, fb);
    const cells = [];
    for (let f = floorMin; f <= floorMax; f++)
        cells.push({ x, floor: f });
    return { x, floorMin, floorMax, cells };
}
/** Cells covered by a facility of `width` with left edge at `cell`. */
export function footprint(cell, width) {
    const cells = [];
    for (let i = 0; i < width; i++)
        cells.push({ x: cell.x + i, floor: cell.floor });
    return cells;
}
export const sameCell = (a, b) => a === b || (!!a && !!b && a.x === b.x && a.floor === b.floor);
export const cellKey = (c) => `${c.x},${c.floor}`;
