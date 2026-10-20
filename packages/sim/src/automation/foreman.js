import { acceptCheck, installedPflops } from "../compute/allocation";
import { FOREMAN_HEAT_MARGIN_C, FOREMAN_IDLE_SHARE, FOREMAN_MIN_STANDING } from "../core/constants";
import { cellIdx } from "../core/grid";
import { rebuildNetworks } from "../networks/rebuild";
import { dayCosts } from "../economy/ledger";
import { findChargerWithSpace } from "../world/entities";
import { getDef, isComputeRack } from "../world/defs";
import { planNormalized } from "../commands/apply";
import { buildable, runCommand } from "./run";
const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
/**
 * Floors a bot can work on: every floor if a flying bot exists; otherwise the floors of the bots and chargers (a bot lives
 * at its charger), widened through any chain of lifts (a lift serving a reachable floor makes all its floors reachable).
 */
export function reachableFloors(state, content) {
    const out = new Set();
    if (state.bots.some((b) => content.bots[b.defId]?.flying)) {
        for (let f = state.floorMin; f <= state.floorMax; f++)
            out.add(f);
        return out;
    }
    for (const b of state.bots)
        out.add(Math.round(b.floor));
    for (const f of state.facilities)
        if (getDef(content, f.defId).kind === "charger")
            out.add(f.floor);
    for (let grew = true; grew;) {
        grew = false;
        for (const l of state.lifts) {
            let serves = false;
            for (let f = l.floorMin; f <= l.floorMax && !serves; f++)
                serves = out.has(f);
            if (!serves)
                continue;
            for (let f = l.floorMin; f <= l.floorMax; f++)
                if (!out.has(f)) {
                    out.add(f);
                    grew = true;
                }
        }
    }
    return out;
}
const affordable = (r, d) => r.ctx.state.cash - d.cost >= r.reserve;
/** Racks that exist (not growths). */
function realRacks(r) {
    const { state, content } = r.ctx;
    return state.facilities.filter((f) => {
        const d = getDef(content, f.defId);
        return d.kind === "rack" && !d.growth;
    });
}
/**
 * Leftmost accepted spot on the floor nearest the racks. `cellOk` gets the cell index of each tile of the footprint
 * (beyond slab + power conduit + empty); `spotOk` can veto a whole spot.
 */
function findSpot(r, d, floors, spotOk) {
    const { state } = r.ctx;
    const rackFloors = [...new Set(realRacks(r).map((k) => k.floor))];
    const near = (floor) => (rackFloors.length === 0 ? Math.abs(floor) : Math.min(...rackFloors.map((k) => Math.abs(k - floor))));
    if (!r.reach)
        r.reach = reachableFloors(state, r.ctx.content);
    const reach = r.reach;
    const order = floors.filter((f) => reach.has(f)).sort((a, b) => near(a) - near(b) || a - b);
    for (const floor of order) {
        for (let x = 0; x + d.width <= state.width; x++) {
            let ok = true;
            for (let k = 0; k < d.width && ok; k++) {
                const i = cellIdx(state, x + k, floor);
                ok = state.slab[i] === 1 && state.power[i] === 1 && state.facilityAt[i] < 0 && state.liftAt[i] < 0;
            }
            if (!ok || !spotOk(floor, x))
                continue;
            if (planNormalized(r.ctx, { type: "place", defId: d.id, floor, x }).ok)
                return { floor, x };
        }
    }
    return null;
}
const allFloors = (r) => {
    const { state } = r.ctx;
    const out = [];
    for (let f = state.floorMin; f <= state.floorMax; f++)
        out.push(f);
    return out;
};
function place(r, d, spot) {
    const { state, events } = r.ctx;
    if (!runCommand(r.ctx, { type: "place", defId: d.id, floor: spot.floor, x: spot.x }))
        return false;
    events.push({ type: "autoBuilt", facilityId: state.nextId.facility - 1 });
    rebuildNetworks(r.ctx); // the new facility joins its nets now, like it would at the start of the next tick
    return true;
}
/** Netted under the whole footprint? */
const allCellsOn = (r, layer, floor, x, w, net) => {
    for (let k = 0; k < w; k++)
        if (layer[cellIdx(r.ctx.state, x + k, floor)] !== net)
            return false;
    return true;
};
function tryPower(r) {
    const { state, content } = r.ctx;
    const short = state.powerNets.filter((n) => n.satisfaction < 1 && !r.powerDone.has(n.id)).sort((a, b) => a.id - b.id);
    if (short.length === 0)
        return false;
    const defs = Object.values(content.facilities)
        .filter((d) => (d.kind === "grid_tie" || d.kind === "genset") && buildable(r.ctx, d))
        .sort((a, b) => (b.power?.capacityKw ?? 0) - (a.power?.capacityKw ?? 0) || (a.kind === b.kind ? 0 : a.kind === "grid_tie" ? -1 : 1) || byId(a, b));
    for (const net of short) {
        for (const d of defs) {
            if (!affordable(r, d))
                continue;
            const spot = findSpot(r, d, allFloors(r), (floor, x) => allCellsOn(r, state.powerNetOf, floor, x, d.width, net.id));
            if (!spot || !place(r, d, spot))
                continue;
            r.powerDone.add(net.id);
            return true;
        }
        r.powerDone.add(net.id); // nothing fits this net this hour: do not retry within the run
    }
    return false;
}
function tryCooling(r) {
    const { state, content } = r.ctx;
    const okC = content.balance.thermal.okC;
    const hot = realRacks(r)
        .filter((f) => f.enabled && f.tempC > okC && !r.coolDone.has(f.id))
        .sort((a, b) => b.tempC - a.tempC || a.id - b.id);
    if (hot.length === 0)
        return false;
    const defs = Object.values(content.facilities)
        .filter((d) => d.kind === "crah" && (d.cooling?.capacityKw ?? 0) > 0 && buildable(r.ctx, d))
        .sort((a, b) => (b.cooling?.capacityKw ?? 0) - (a.cooling?.capacityKw ?? 0) || byId(a, b));
    for (const rack of hot) {
        for (const d of defs) {
            if (!affordable(r, d))
                continue;
            const reach = d.cooling?.radius ?? 0;
            const rw = rack.width;
            const spot = findSpot(r, d, [rack.floor], (_floor, x) => Math.max(0, rack.x - (x + d.width - 1), x - (rack.x + rw - 1)) <= reach);
            if (!spot || !place(r, d, spot))
                continue;
            // Every hot rack on that floor within reach is now looked after.
            for (const o of hot) {
                if (o.floor === spot.floor && Math.max(0, o.x - (spot.x + d.width - 1), spot.x - (o.x + o.width - 1)) <= reach)
                    r.coolDone.add(o.id);
            }
            return true;
        }
        r.coolDone.add(rack.id); // no CRAH can be put in reach of this one this hour
    }
    return false;
}
/** Best unlocked facility of a kind by capacity, placed like any other (reserve, power conduit, nearest floor). */
function placeBest(r, kind) {
    const defs = Object.values(r.ctx.content.facilities)
        .filter((d) => d.kind === kind && buildable(r.ctx, d))
        .sort((a, b) => (b.logistics?.capacity ?? 0) - (a.logistics?.capacity ?? 0) || byId(a, b));
    for (const d of defs) {
        if (!affordable(r, d))
            continue;
        const spot = findSpot(r, d, allFloors(r), () => true);
        if (spot && place(r, d, spot))
            return true;
    }
    return false;
}
function tryLogistics(r) {
    const { state, content } = r.ctx;
    const a = state.automation;
    let racks = 0;
    let room = 0;
    let stock = 0;
    for (const f of state.facilities) {
        const d = getDef(content, f.defId);
        if (d.kind === "rack" && !d.growth)
            racks++;
        if (d.kind === "depot") {
            stock += f.stored;
            room += Math.max(0, (d.logistics?.capacity ?? 0) - f.stored);
        }
    }
    const wantBots = Math.min(a.bots.maxBots, Math.ceil(racks / a.bots.racksPerBot));
    if (state.bots.length < wantBots && findChargerWithSpace(state, content) < 0 && placeBest(r, "charger"))
        return true;
    if (a.parts.enabled && stock < a.parts.keep && room === 0 && placeBest(r, "depot"))
        return true;
    return false;
}
/** Idle compute (free enabled healthy racks) and whether it is short. */
function wantsRacks(r) {
    const { state, content } = r.ctx;
    if (state.workOrders.length > state.bots.length)
        return false; // repairs first
    if (state.metrics.uptime < (content.balance.tiers.uptime[state.tier - 1] ?? 0))
        return false;
    if (state.standing < FOREMAN_MIN_STANDING)
        return false; // the Ministry is watching: no expansion while standing is low
    const lastDay = state.ledger[state.ledger.length - 1];
    if (lastDay && dayCosts(lastDay) > lastDay.revenue)
        return false; // no expansion after a day in the red
    // Never grow into a shortage the Foreman is meant to be fixing: hot racks (cooling on) or a power net short of supply (power on).
    const p = state.automation.foreman;
    if (p.cooling && realRacks(r).some((f) => f.enabled && f.tempC > content.balance.thermal.okC - FOREMAN_HEAT_MARGIN_C))
        return false;
    if (p.power && state.powerNets.some((n) => n.satisfaction < 1))
        return false;
    let idle = 0;
    for (const f of state.facilities) {
        const d = getDef(content, f.defId);
        if (isComputeRack(d) && !d.growth && f.enabled && !f.failed && f.jobId < 0)
            idle += d.rack?.pflops ?? 0;
    }
    const installed = installedPflops(state, content);
    idle += r.addedPflops;
    const total = installed + r.addedPflops;
    if (total <= 0 || idle / total < FOREMAN_IDLE_SHARE)
        return true;
    // Offers that would not start on the idle compute (storage is not a compute problem, so it is ignored here).
    if (r.racksPlaced > 0 || state.offers.length === 0)
        return false;
    return state.offers.every((o) => !acceptCheck(state, content, { ...o.spec, storageTB: 0 }).ok);
}
/**
 * Racks leave room for air handling: a rack may only go where the `reach` cells to its left (the best CRAH's radius)
 * hold a free, powered run as wide as that CRAH, or the floor's edge. Otherwise a floor fills solid and the hot racks in the
 * middle can never get a CRAH within reach.
 */
function leavesRoom(r, floor, x) {
    const { state, content } = r.ctx;
    const crah = Object.values(content.facilities)
        .filter((d) => d.kind === "crah" && buildable(r.ctx, d))
        .sort((a, b) => (b.cooling?.capacityKw ?? 0) - (a.cooling?.capacityKw ?? 0) || byId(a, b))[0];
    if (!crah)
        return true;
    const reach = crah.cooling?.radius ?? 8;
    let run = 0;
    for (let cx = x - 1; cx >= x - reach; cx--) {
        if (cx < 0)
            return true;
        const i = cellIdx(state, cx, floor);
        const free = state.slab[i] === 1 && state.power[i] === 1 && state.facilityAt[i] < 0 && state.liftAt[i] < 0;
        if (!free) {
            if (state.slab[i] === 0)
                return true; // the edge of the built floor
            run = 0;
            continue;
        }
        if (++run >= crah.width)
            return true;
    }
    return false;
}
function tryRacks(r) {
    const { state, content } = r.ctx;
    if (!wantsRacks(r))
        return false;
    const racks = Object.values(content.facilities).filter((d) => isComputeRack(d) && buildable(r.ctx, d));
    const best = (pred) => racks.filter(pred).sort((a, b) => (b.rack?.pflops ?? 0) - (a.rack?.pflops ?? 0) || byId(a, b));
    let placed = null;
    // A DLC rack when a coolant loop with room for it is reachable.
    for (const net of state.coolantNets) {
        const spare = net.capacityKw - net.loadKw - (r.coolUsed.get(net.id) ?? 0);
        for (const d of best((x) => x.rack?.cooling === "dlc")) {
            const load = (d.rack?.powerKw ?? 0) * (d.rack?.liquidFraction ?? 0);
            if (load > spare || !affordable(r, d))
                continue;
            const spot = findSpot(r, d, allFloors(r), (floor, x) => lowestNet(r, floor, x, d.width) === net.id && leavesRoom(r, floor, x));
            if (!spot || !place(r, d, spot))
                continue;
            r.coolUsed.set(net.id, (r.coolUsed.get(net.id) ?? 0) + load);
            placed = d;
            break;
        }
        if (placed)
            break;
    }
    if (!placed) {
        for (const d of best((x) => x.rack?.cooling === "air")) {
            if (!affordable(r, d))
                continue;
            const spot = findSpot(r, d, allFloors(r), (floor, x) => leavesRoom(r, floor, x));
            if (!spot || !place(r, d, spot))
                continue;
            placed = d;
            break;
        }
    }
    if (!placed)
        return false;
    r.racksPlaced++;
    r.addedPflops += placed.rack?.pflops ?? 0;
    return true;
}
/** Coolant net a footprint would attach to (lowest id under its cells), or -1. */
function lowestNet(r, floor, x, w) {
    const { state } = r.ctx;
    let best = -1;
    for (let k = 0; k < w; k++) {
        const n = state.coolantNetOf[cellIdx(state, x + k, floor)];
        if (n >= 0 && (best < 0 || n < best))
            best = n;
    }
    return best;
}
export function foremanStep(ctx) {
    const { state, content } = ctx;
    const p = state.automation.foreman;
    const r = { ctx, reserve: p.reserve, powerDone: new Set(), coolDone: new Set(), coolUsed: new Map(), racksPlaced: 0, addedPflops: 0 };
    for (let placed = 0; placed < content.balance.automation.foremanPerHour; placed++) {
        if (state.netsDirty)
            rebuildNetworks(ctx);
        const did = (p.power && tryPower(r)) || (p.cooling && tryCooling(r)) || (p.racks && (tryLogistics(r) || tryRacks(r)));
        if (!did)
            break;
    }
}
