import { cellIndex, inBounds } from "@aitower/shared";
import { fmtMoney } from "../format";
import { pushNotice } from "../notices";
import { cellKey, footprint, lPath, liftSpan, sameCell, slabSpan } from "./geometry";
import { pickAt } from "./pick";
const LEFT = 0;
const RIGHT = 2;
/**
 * Pure tool logic: turns world-cell pointer events into ghosts (`store.setGhost`) and
 * `SimCommand`s (`store.dispatch`). No React, no DOM.
 *
 * - Left button drives tools. A right-button click (down+up on the same cell, i.e. not a
 *   camera pan) returns to the select tool.
 * - Tools stay active after use (SimTower style); Esc in the HUD returns to select.
 */
export function createToolController(store, content, opts = {}) {
    const notify = opts.notify ?? pushNotice;
    let drag = null;
    let hover = null;
    let rightDown = null;
    let lastTool = toolKey(store.get().tool);
    const reject = (r, key = "reject") => {
        if (r.ok)
            return true;
        notify({ text: r.reason, severity: "warn", key: `${key}:${r.reason}` });
        return false;
    };
    const send = (cmd) => reject(store.dispatch(cmd), cmd.type);
    const cancel = () => {
        drag = null;
        store.setGhost(null);
    };
    const ghostFor = (tool, cell) => {
        if (!cell)
            return null;
        const { view } = store.get();
        switch (tool.kind) {
            case "select":
                return null;
            case "place": {
                const def = content.facilities[tool.defId];
                if (!def)
                    return null;
                const r = store.canPlace(tool.defId, cell.floor, cell.x);
                return {
                    cells: footprint(cell, def.width),
                    valid: r.ok,
                    defId: tool.defId,
                    label: r.ok ? `${def.name} · ${fmtMoney(def.cost)}` : r.reason,
                };
            }
            case "slab": {
                const s = drag ? slabSpan(drag.start.floor, drag.start.x, cell.x) : slabSpan(cell.floor, cell.x, cell.x);
                return slabGhost(store, view, content, s.floor, s.x0, s.x1, s.cells);
            }
            case "conduit": {
                const cells = drag ? lPath(drag.start, cell) : [cell];
                return conduitGhost(store, view, content, tool.layer, cells);
            }
            case "lift": {
                const s = drag ? liftSpan(drag.start.x, drag.start.floor, cell.floor) : liftSpan(cell.x, cell.floor, cell.floor);
                return liftGhost(store, content, s, !!drag);
            }
            case "demolish": {
                const cells = drag ? [...drag.cells.values()] : [cell];
                // Demolish ghosts are intentionally `valid: false` so the renderer draws them red.
                return { cells, valid: false, label: cells.length > 1 ? `Demolish ×${cells.length}` : "Demolish" };
            }
        }
    };
    const commit = (tool, start, end, collected) => {
        switch (tool.kind) {
            case "slab": {
                const s = slabSpan(start.floor, start.x, end.x);
                send({ type: "buildSlab", floor: s.floor, x0: s.x0, x1: s.x1 });
                return;
            }
            case "conduit":
                send({ type: "buildConduit", layer: tool.layer, cells: lPath(start, end) });
                return;
            case "lift": {
                const s = liftSpan(start.x, start.floor, end.floor);
                if (s.floorMin === s.floorMax) {
                    notify({ text: "Drag vertically to span at least two floors", severity: "info", key: "lift-span" });
                    return;
                }
                send({ type: "buildLift", x: s.x, floorMin: s.floorMin, floorMax: s.floorMax });
                return;
            }
            case "demolish": {
                let failed = 0;
                let reason = "";
                for (const c of collected) {
                    const r = store.dispatch({ type: "demolish", floor: c.floor, x: c.x });
                    if (!r.ok) {
                        failed++;
                        reason = r.reason;
                    }
                }
                if (failed)
                    notify({ text: failed > 1 ? `${reason} (×${failed})` : reason, severity: "warn", key: `demolish:${reason}` });
                return;
            }
            default:
                return;
        }
    };
    const handle = (e) => {
        const { tool, view } = store.get();
        const key = toolKey(tool);
        if (key !== lastTool) {
            drag = null;
            lastTool = key;
        }
        const cell = e.cell && inBounds(view, e.cell.x, e.cell.floor) ? e.cell : null;
        // Right click (without dragging) → back to select.
        if (e.button === RIGHT) {
            if (e.kind === "down")
                rightDown = cell;
            else if (e.kind === "up") {
                if (rightDown && sameCell(rightDown, cell)) {
                    cancel();
                    if (tool.kind !== "select")
                        store.setTool({ kind: "select" });
                }
                rightDown = null;
            }
            return;
        }
        switch (e.kind) {
            case "leave":
                hover = null;
                cancel();
                return;
            case "move":
                if (sameCell(hover, cell) && cell)
                    return;
                hover = cell;
                if (drag && cell && tool.kind === "demolish")
                    drag.cells.set(cellKey(cell), cell);
                store.setGhost(ghostFor(tool, cell));
                return;
            case "down": {
                if (e.button !== LEFT || !cell)
                    return;
                hover = cell;
                if (tool.kind === "select") {
                    store.setSelection(pickAt(view, cell));
                    return;
                }
                if (tool.kind === "place") {
                    if (send({ type: "place", defId: tool.defId, floor: cell.floor, x: cell.x })) {
                        // Stay in place mode; refresh the ghost (the cell is now occupied).
                        store.setGhost(ghostFor(tool, cell));
                    }
                    return;
                }
                drag = { start: cell, tool, cells: new Map([[cellKey(cell), cell]]) };
                store.setGhost(ghostFor(tool, cell));
                return;
            }
            case "up": {
                if (e.button !== LEFT || !drag)
                    return;
                const d = drag;
                drag = null;
                const end = cell ?? hover ?? d.start;
                if (d.tool.kind === "demolish" && cell)
                    d.cells.set(cellKey(cell), cell);
                commit(d.tool, d.start, end, [...d.cells.values()]);
                store.setGhost(ghostFor(tool, cell));
                return;
            }
        }
    };
    return { handle, cancel };
}
/** Structural identity of a tool (the store may hand out fresh objects). */
export const toolKey = (t) => t.kind === "place" ? `place:${t.defId}` : t.kind === "conduit" ? `conduit:${t.layer}` : t.kind;
// ─── Ghost validity: store.canBuild decides; the cost label is display-only ─────
/** "no slab below at x=3" → "No slab below at x=3". */
const sentence = (r) => (r ? r[0].toUpperCase() + r.slice(1) : r);
function slabGhost(store, view, content, floor, x0, x1, cells) {
    const r = store.canBuild({ type: "buildSlab", floor, x0, x1 });
    if (!r.ok)
        return { cells, valid: false, label: sentence(r.reason) };
    let cost = 0;
    for (const c of cells)
        if (!view.slab[cellIndex(view, c.x, c.floor)])
            cost += c.floor < 0 ? content.structure.basementSlabPerTile : content.structure.slabPerTile;
    return { cells, valid: true, label: `Slab ×${cells.length} · ${fmtMoney(cost)}` };
}
/** The cell grid a conduit layer occupies in the view (1 where a conduit of that layer exists). */
export const conduitGrid = (view, layer) => (layer === "power" ? view.power : layer === "coolant" ? view.coolant : view.nutrient);
export const conduitName = (layer) => (layer === "power" ? "Power conduit" : layer === "coolant" ? "Coolant conduit" : "Nutrient conduit");
/** Cost per new tile (display only; the sim charges). Nutrient pipes cost the same as coolant pipes. */
export const conduitUnitCost = (content, layer) => (layer === "power" ? content.structure.powerConduitPerTile : content.structure.coolantConduitPerTile);
function conduitGhost(store, view, content, layer, cells) {
    const r = store.canBuild({ type: "buildConduit", layer, cells });
    if (!r.ok)
        return { cells, valid: false, label: sentence(r.reason) };
    const grid = conduitGrid(view, layer);
    const per = conduitUnitCost(content, layer);
    let n = 0;
    for (const c of cells)
        if (!grid[cellIndex(view, c.x, c.floor)])
            n++;
    return { cells, valid: true, label: `${conduitName(layer)} ×${cells.length} · ${fmtMoney(n * per)}` };
}
/**
 * What a lift drag costs: a new shaft pays the base fee plus the per-floor price; a drag that overlaps or touches an
 * existing shaft in the column extends it and pays per-floor for the added floors only (no base fee).
 */
export function liftDragCost(view, st, x, floorMin, floorMax) {
    const host = view.lifts.find((l) => l.x === x && l.floorMin <= floorMax + 1 && l.floorMax >= floorMin - 1);
    if (!host)
        return { cost: st.liftBase + st.liftPerFloor * (floorMax - floorMin + 1), extends: false, added: floorMax - floorMin + 1 };
    const added = Math.max(host.floorMax, floorMax) - Math.min(host.floorMin, floorMin) - (host.floorMax - host.floorMin);
    return { cost: st.liftPerFloor * added, extends: true, added };
}
function liftGhost(store, content, span, dragging) {
    const st = content.structure;
    const { x, floorMin, floorMax, cells } = span;
    const view = store.get().view;
    if (!dragging) {
        // A lift spans two or more floors: this column is a valid start if the cell can pair with the floor above or below.
        const f = floorMin;
        if (view.lifts.some((l) => l.x === x && f >= l.floorMin && f <= l.floorMax))
            return { cells, valid: true, label: `Drag up/down to extend this lift · ${fmtMoney(st.liftPerFloor)}/floor` };
        const up = store.canBuild({ type: "buildLift", x, floorMin: f, floorMax: f + 1 });
        if (up.ok)
            return { cells, valid: true, label: "Drag up/down to size the shaft" };
        const down = store.canBuild({ type: "buildLift", x, floorMin: f - 1, floorMax: f });
        if (down.ok)
            return { cells, valid: true, label: "Drag up/down to size the shaft" };
        return { cells, valid: false, label: sentence(up.reason) };
    }
    const r = store.canBuild({ type: "buildLift", x, floorMin, floorMax });
    if (!r.ok)
        return { cells, valid: false, label: sentence(r.reason) };
    const c = liftDragCost(view, st, x, floorMin, floorMax);
    return { cells, valid: true, label: c.extends ? `Extend lift +${c.added} floor${c.added === 1 ? "" : "s"} · ${fmtMoney(c.cost)}` : `Lift ${cells.length} floors · ${fmtMoney(c.cost)}` };
}
