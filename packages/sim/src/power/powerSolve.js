import { EPS, GENSET_STOP_SURPLUS_TICKS, MIN_POWERED_SATISFACTION, TICKS_PER_HOUR } from "../core/constants";
import { GensetMode } from "../core/state";
import { energyPriceAt } from "../core/time";
import { modFactor } from "../ministry/modifiers";
import { renewableFactors } from "../green/weather";
import { getDef, isComputeRack, needsPower } from "../world/defs";
import { facilityDemandKw } from "./demand";
import { perk } from "../research/research";
/** Share of requested power a load actually gets at satisfaction `sat`. */
export const powerFactor = (sat) => (sat >= MIN_POWERED_SATISFACTION ? sat : 0);
const isUsableSource = (f) => f.enabled;
export function powerSolve(ctx) {
    const { state, content, events } = ctx;
    const prevNets = state.powerNets;
    const pool = ctx.scratch.power;
    const buckets = pool.buckets;
    const netCount = state.powerNetCount;
    while (buckets.length < netCount)
        buckets.push({ loads: [], liftKw: 0, grids: [], reactors: [], greens: [], gensets: [], upses: [] });
    for (let n = 0; n < netCount; n++) {
        const b = buckets[n];
        b.loads.length = 0;
        b.grids.length = 0;
        b.reactors.length = 0;
        b.greens.length = 0;
        b.gensets.length = 0;
        b.upses.length = 0;
        b.liftKw = 0;
    }
    for (const f of state.facilities) {
        const d = getDef(content, f.defId);
        f.busy = isComputeRack(d) && f.jobId >= 0 && f.enabled && !f.failed && !f.tripped;
        f.demandKw = facilityDemandKw(state, content, f);
        if (f.powerNet < 0 || d.growth)
            continue;
        const b = buckets[f.powerNet];
        b.loads.push(f);
        if (d.kind === "grid_tie")
            b.grids.push(f);
        else if (d.kind === "genset")
            b.gensets.push(f);
        else if (d.kind === "ups")
            b.upses.push(f);
        else if (d.kind === "bioreactor")
            b.reactors.push(f);
        else if (d.kind === "solar" || d.kind === "wind")
            b.greens.push(f);
    }
    for (const lift of state.lifts)
        if (lift.powerNet >= 0)
            buckets[lift.powerNet].liftKw += content.lift.facilityKw;
    const price = energyPriceAt(content.balance, state.tick) * modFactor(state, "energyPrice") * perk(state, content, "energyPrice");
    const gridFactor = modFactor(state, "gridCap");
    let gridTotal = 0;
    let gensetTotal = 0;
    let reactorTotal = 0;
    let greenTotal = 0;
    const weather = renewableFactors(state, content.balance.green.droughtFactor);
    const greenFactor = (f) => (getDef(content, f.defId).kind === "solar" ? weather.solar : weather.wind);
    let energyCost = 0;
    const nets = [];
    for (let n = 0; n < netCount; n++) {
        const b = buckets[n];
        let demand = b.liftKw;
        for (const f of b.loads)
            demand += f.demandKw;
        const cap = (f) => getDef(content, f.defId).power?.capacityKw ?? 0;
        let gridCap = 0;
        for (const g of b.grids)
            if (isUsableSource(g))
                gridCap += cap(g);
        gridCap *= gridFactor;
        // Bioreactors: capacity scales with the nutrients their net delivered last tick.
        let reactorCap = 0;
        for (const r of b.reactors)
            if (isUsableSource(r))
                reactorCap += cap(r) * r.nutrientSat;
        // Solar and wind: capacity × daylight / wind × drought.
        let greenCap = 0;
        for (const g of b.greens)
            if (isUsableSource(g))
                greenCap += cap(g) * greenFactor(g);
        // Genset control.
        let committed = gridCap + reactorCap + greenCap;
        for (const g of b.gensets)
            if (isUsableSource(g) && g.gensetMode !== GensetMode.Off)
                committed += cap(g);
        for (const g of b.gensets) {
            if (!isUsableSource(g)) {
                if (g.gensetMode !== GensetMode.Off)
                    events.push({ type: "gensetStopped", facilityId: g.id });
                g.gensetMode = GensetMode.Off;
                continue;
            }
            if (g.gensetMode === GensetMode.Off && committed < demand - EPS) {
                g.gensetMode = GensetMode.Starting;
                g.gensetTimer = getDef(content, g.defId).power?.startDelayTicks ?? 0;
                g.surplusTicks = 0;
                committed += cap(g);
            }
            if (g.gensetMode === GensetMode.Starting) {
                if (g.gensetTimer <= 0) {
                    g.gensetMode = GensetMode.Running;
                    events.push({ type: "gensetStarted", facilityId: g.id });
                }
                else
                    g.gensetTimer--;
            }
            else if (g.gensetMode === GensetMode.Running) {
                g.surplusTicks = gridCap + reactorCap + greenCap >= demand ? g.surplusTicks + 1 : 0;
                if (g.surplusTicks >= GENSET_STOP_SURPLUS_TICKS) {
                    g.gensetMode = GensetMode.Off;
                    g.surplusTicks = 0;
                    events.push({ type: "gensetStopped", facilityId: g.id });
                }
            }
        }
        let gensetCap = 0;
        for (const g of b.gensets)
            if (g.gensetMode === GensetMode.Running)
                gensetCap += cap(g);
        let upsAvail = 0;
        let storageCap = 0;
        for (const u of b.upses) {
            storageCap += getDef(content, u.defId).power?.storageKwh ?? 0;
            if (isUsableSource(u))
                upsAvail += Math.min(cap(u), u.storedKwh * TICKS_PER_HOUR);
        }
        const supply = gridCap + reactorCap + greenCap + gensetCap + upsAvail;
        const sat = demand > EPS ? Math.min(1, supply / demand) : 1;
        const factor = powerFactor(sat);
        // Actual draws.
        let served = b.liftKw * factor;
        for (const f of b.loads) {
            f.sat = sat;
            f.powerKw = f.demandKw * factor;
            served += f.powerKw;
        }
        // Dispatch: grid ▸ gensets ▸ UPS.
        let rest = served;
        // Free power first: sun and wind, then reactors (their nutrients are paid for whether or not they run flat out).
        const greenKw = Math.min(greenCap, rest);
        rest -= greenKw;
        const reactorKw = Math.min(reactorCap, rest);
        rest -= reactorKw;
        const gridKw = Math.min(gridCap, rest);
        rest -= gridKw;
        let gensetKw = 0;
        const gensetOut = pool.gensetOut;
        gensetOut.length = b.gensets.length;
        for (let gi = 0; gi < b.gensets.length; gi++) {
            const g = b.gensets[gi];
            gensetOut[gi] = 0;
            if (g.gensetMode !== GensetMode.Running)
                continue;
            const out = Math.min(cap(g), rest);
            gensetOut[gi] = out;
            gensetKw += out;
            rest -= out;
        }
        for (const u of b.upses) {
            if (rest <= EPS || !isUsableSource(u))
                continue;
            const out = Math.min(cap(u), u.storedKwh * TICKS_PER_HOUR, rest);
            const before = u.storedKwh;
            u.storedKwh = Math.max(0, u.storedKwh - out / TICKS_PER_HOUR);
            if (u.storedKwh <= EPS)
                u.storedKwh = 0;
            rest -= out;
            if (before > 0 && u.storedKwh === 0)
                events.push({ type: "upsDepleted", facilityId: u.id });
        }
        // Charge UPS from remaining grid ▸ genset headroom, only when they cover the full demand
        // (charging a short net would make it flicker between powered and unpowered).
        let reactorOut = reactorKw;
        const discharged = reactorCap + greenCap + gridCap + gensetCap < demand - EPS;
        let greenOut = greenKw;
        let greenSpare = greenCap - greenKw;
        let reactorSpare = reactorCap - reactorKw;
        let gridSpare = gridCap - gridKw;
        let gridCharge = 0;
        for (const u of b.upses) {
            if (discharged || !isUsableSource(u))
                continue;
            const d = getDef(content, u.defId).power;
            const eff = d?.efficiency ?? 1;
            const room = (d?.storageKwh ?? 0) - u.storedKwh;
            if (room <= EPS || eff <= 0)
                continue;
            let input = Math.min(cap(u), (room * TICKS_PER_HOUR) / eff);
            const fromGreen = Math.min(input, greenSpare);
            greenSpare -= fromGreen;
            input -= fromGreen;
            const fromReactor = Math.min(input, reactorSpare);
            reactorSpare -= fromReactor;
            input -= fromReactor;
            const fromGrid = Math.min(input, gridSpare);
            gridSpare -= fromGrid;
            input -= fromGrid;
            let fromGenset = 0;
            for (let gi = 0; gi < b.gensets.length; gi++) {
                const g = b.gensets[gi];
                if (input <= EPS)
                    break;
                if (g.gensetMode !== GensetMode.Running)
                    continue;
                const used = gensetOut[gi];
                const extra = Math.min(cap(g) - used, input);
                gensetOut[gi] = used + extra;
                fromGenset += extra;
                input -= extra;
            }
            gridCharge += fromGrid;
            gensetKw += fromGenset;
            u.storedKwh = Math.min(d?.storageKwh ?? 0, u.storedKwh + ((fromGreen + fromReactor + fromGrid + fromGenset) / TICKS_PER_HOUR) * eff);
            reactorOut += fromReactor;
            greenOut += fromGreen;
        }
        const gridImport = gridKw + gridCharge;
        gridTotal += gridImport;
        gensetTotal += gensetKw;
        reactorTotal += reactorOut;
        greenTotal += greenOut;
        if (greenCap > 0) {
            for (const g of b.greens) {
                if (isUsableSource(g))
                    energyCost += ((greenOut * cap(g) * greenFactor(g)) / greenCap / TICKS_PER_HOUR) * (getDef(content, g.defId).power?.costPerKwh ?? 0);
            }
        }
        if (reactorCap > 0) {
            for (const r of b.reactors) {
                if (isUsableSource(r))
                    energyCost += ((reactorOut * cap(r) * r.nutrientSat) / reactorCap / TICKS_PER_HOUR) * (getDef(content, r.defId).power?.costPerKwh ?? 0);
            }
        }
        energyCost += (gridImport / TICKS_PER_HOUR) * price;
        for (let gi = 0; gi < b.gensets.length; gi++) {
            const g = b.gensets[gi];
            if (g.gensetMode === GensetMode.Running)
                energyCost += (gensetOut[gi] / TICKS_PER_HOUR) * (getDef(content, g.defId).power?.costPerKwh ?? 0);
        }
        let storedAfter = 0;
        for (const u of b.upses)
            storedAfter += u.storedKwh;
        const net = {
            id: n,
            supplyKw: supply,
            demandKw: demand,
            satisfaction: sat,
            storedKwh: storedAfter,
            storageCapacityKwh: storageCap,
            gridImportKw: gridImport,
            gensetKw,
        };
        nets.push(net);
        const prev = prevNets[n];
        if (sat < 1 && (!prev || prev.satisfaction >= 1))
            events.push({ type: "powerShortfall", netId: n, satisfaction: sat });
    }
    // Facilities off-net, or not needing power.
    let itKw = 0;
    for (const f of state.facilities) {
        const d = getDef(content, f.defId);
        if (f.powerNet < 0 || d.growth) {
            if (needsPower(d)) {
                f.sat = 0;
                f.powerKw = 0;
            }
            else {
                f.sat = 1;
                f.powerKw = 0;
            }
        }
        if (d.kind === "rack") {
            f.heatKw = f.powerKw; // all electrical draw becomes heat
            itKw += f.powerKw;
        }
    }
    for (const lift of state.lifts)
        lift.sat = lift.powerNet >= 0 ? nets[lift.powerNet].satisfaction : 0;
    state.powerNets = nets;
    const m = state.metrics;
    m.itKw = itKw;
    m.gridKw = gridTotal;
    m.gensetKw = gensetTotal;
    m.greenKw = greenTotal;
    m.totalKw = gridTotal + gensetTotal + reactorTotal + greenTotal;
    m.energyCost = energyCost;
}
