import { FLOOR_H, MARGIN_BOTTOM, MARGIN_TOP, MARGIN_X, TILE, ZOOMS } from "./constants";
/** World y of the top edge of `floor` (floorMax's top is y = 0). */
export const floorTop = (grid, floor) => (grid.floorMax - floor) * FLOOR_H;
/** World y of the ground line (bottom edge of floor 0). */
export const groundY = (grid) => (grid.floorMax + 1) * FLOOR_H;
export const worldSize = (grid) => ({
    w: grid.width * TILE,
    h: (grid.floorMax - grid.floorMin + 1) * FLOOR_H,
});
/** Integer screen offset of world origin. */
export const offset = (cam) => ({
    x: Math.round(cam.vw / 2 - cam.cx * cam.zoom),
    y: Math.round(cam.vh / 2 - cam.cy * cam.zoom),
});
export const screenToWorld = (cam, sx, sy) => {
    const o = offset(cam);
    return { x: (sx - o.x) / cam.zoom, y: (sy - o.y) / cam.zoom };
};
export const worldToScreen = (cam, wx, wy) => {
    const o = offset(cam);
    return { x: wx * cam.zoom + o.x, y: wy * cam.zoom + o.y };
};
/** World pixel → cell, or null outside the grid. */
export const worldToCell = (grid, wx, wy) => {
    const x = Math.floor(wx / TILE);
    const floor = grid.floorMax - Math.floor(wy / FLOOR_H);
    if (x < 0 || x >= grid.width || floor < grid.floorMin || floor > grid.floorMax)
        return null;
    return { x, floor };
};
export const screenToCell = (cam, grid, sx, sy) => {
    const w = screenToWorld(cam, sx, sy);
    return worldToCell(grid, w.x, w.y);
};
/** Centre of a cell in world pixels. */
export const cellCenter = (grid, cell) => ({
    x: cell.x * TILE + TILE / 2,
    y: floorTop(grid, cell.floor) + FLOOR_H / 2,
});
/** Keep the camera centre within the world bounds plus margin. */
export const clampCamera = (cam, grid) => {
    const { w, h } = worldSize(grid);
    const halfW = cam.vw / 2 / cam.zoom;
    const halfH = cam.vh / 2 / cam.zoom;
    const clampAxis = (c, lo, hi, half) => {
        // If the viewport is bigger than the allowed span, centre on the span.
        if (hi - lo <= half * 2)
            return (lo + hi) / 2;
        return Math.min(Math.max(c, lo + half), hi - half);
    };
    return {
        ...cam,
        cx: clampAxis(cam.cx, -MARGIN_X, w + MARGIN_X, halfW),
        cy: clampAxis(cam.cy, -MARGIN_TOP, h + MARGIN_BOTTOM, halfH),
    };
};
/** Next zoom step in `dir` (+1 in, -1 out), clamped to ZOOMS. */
export const stepZoom = (zoom, dir) => {
    const i = ZOOMS.indexOf(zoom);
    const cur = i < 0 ? 0 : i;
    const next = Math.min(Math.max(cur + Math.sign(dir), 0), ZOOMS.length - 1);
    return ZOOMS[next];
};
/** Change zoom keeping the world point under the screen point (sx, sy) fixed. */
export const zoomAt = (cam, newZoom, sx, sy) => {
    const w = screenToWorld(cam, sx, sy);
    return {
        ...cam,
        zoom: newZoom,
        cx: w.x - (sx - cam.vw / 2) / newZoom,
        cy: w.y - (sy - cam.vh / 2) / newZoom,
    };
};
/** Pan by a screen-pixel delta. */
export const panBy = (cam, dsx, dsy) => ({
    ...cam,
    cx: cam.cx - dsx / cam.zoom,
    cy: cam.cy - dsy / cam.zoom,
});
