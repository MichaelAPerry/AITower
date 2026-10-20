import { cellIdx } from "../core/grid";
import { labelLayer } from "./unionFind";
/** Lowest net id under any of the given cells, or -1. */
function lowestNet(netOf, cells) {
    let best = -1;
    for (const i of cells) {
        const n = netOf[i];
        if (n >= 0 && (best < 0 || n < best))
            best = n;
    }
    return best;
}
export function attachToNets(state) {
    for (const f of state.facilities) {
        const cells = [];
        for (let k = 0; k < f.width; k++)
            cells.push(cellIdx(state, f.x + k, f.floor));
        f.powerNet = lowestNet(state.powerNetOf, cells);
        f.coolantNet = lowestNet(state.coolantNetOf, cells);
        f.nutrientNet = lowestNet(state.nutrientNetOf, cells);
    }
    for (const lift of state.lifts) {
        const cells = [];
        for (let fl = lift.floorMin; fl <= lift.floorMax; fl++)
            cells.push(cellIdx(state, lift.x, fl));
        lift.powerNet = lowestNet(state.powerNetOf, cells);
    }
}
export function rebuildNetworks(ctx) {
    const { state, scratch } = ctx;
    if (!state.netsDirty)
        return;
    state.powerNetCount = labelLayer(state, state.power, state.powerNetOf, scratch.parent, scratch.label);
    state.coolantNetCount = labelLayer(state, state.coolant, state.coolantNetOf, scratch.parent, scratch.label);
    state.nutrientNetCount = labelLayer(state, state.nutrient, state.nutrientNetOf, scratch.parent, scratch.label);
    attachToNets(state);
    state.netsDirty = false;
}
