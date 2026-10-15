/**
 * Tick stage 3: per power net — genset control, supply vs demand, satisfaction, dispatch
 * (grid ▸ gensets ▸ UPS discharge), UPS charging from surplus, energy cost.
 */
import type { FacilityDef } from "@aitower/content";
import type { TickCtx } from "../core/context";
import { EPS, GENSET_STOP_SURPLUS_TICKS, MIN_POWERED_SATISFACTION, TICKS_PER_HOUR } from "../core/constants";
import { type Facility, GensetMode, type PowerNet } from "../core/state";
import { energyPriceAt } from "../core/time";
import { getDef, isComputeRack, needsPower } from "../world/defs";
import { facilityDemandKw } from "./demand";

interface NetBucket {
	loads: Facility[];
	liftKw: number;
	grids: Facility[];
	gensets: Facility[];
	upses: Facility[];
}

/** Share of requested power a load actually gets at satisfaction `sat`. */
export const powerFactor = (sat: number): number => (sat >= MIN_POWERED_SATISFACTION ? sat : 0);

const isUsableSource = (f: Facility): boolean => f.enabled;

export function powerSolve(ctx: TickCtx): void {
	const { state, content, events } = ctx;
	const prevNets = state.powerNets;
	const buckets: NetBucket[] = [];
	for (let n = 0; n < state.powerNetCount; n++) buckets.push({ loads: [], liftKw: 0, grids: [], gensets: [], upses: [] });

	const defs = new Map<Facility, FacilityDef>();
	for (const f of state.facilities) {
		const d = getDef(content, f.defId);
		defs.set(f, d);
		f.busy = isComputeRack(d) && f.jobId >= 0 && f.enabled && !f.failed && !f.tripped;
		f.demandKw = facilityDemandKw(state, content, f);
		if (f.powerNet < 0) continue;
		const b = buckets[f.powerNet];
		b.loads.push(f);
		if (d.kind === "grid_tie") b.grids.push(f);
		else if (d.kind === "genset") b.gensets.push(f);
		else if (d.kind === "ups") b.upses.push(f);
	}
	for (const lift of state.lifts) if (lift.powerNet >= 0) buckets[lift.powerNet].liftKw += content.lift.facilityKw;

	const price = energyPriceAt(content.balance, state.tick);
	let gridTotal = 0;
	let gensetTotal = 0;
	let energyCost = 0;
	const nets: PowerNet[] = [];

	for (let n = 0; n < buckets.length; n++) {
		const b = buckets[n];
		let demand = b.liftKw;
		for (const f of b.loads) demand += f.demandKw;

		const cap = (f: Facility): number => defs.get(f)?.power?.capacityKw ?? 0;
		let gridCap = 0;
		for (const g of b.grids) if (isUsableSource(g)) gridCap += cap(g);

		// Genset control.
		let committed = gridCap;
		for (const g of b.gensets) if (isUsableSource(g) && g.gensetMode !== GensetMode.Off) committed += cap(g);
		for (const g of b.gensets) {
			if (!isUsableSource(g)) {
				if (g.gensetMode !== GensetMode.Off) events.push({ type: "gensetStopped", facilityId: g.id });
				g.gensetMode = GensetMode.Off;
				continue;
			}
			if (g.gensetMode === GensetMode.Off && committed < demand - EPS) {
				g.gensetMode = GensetMode.Starting;
				g.gensetTimer = defs.get(g)?.power?.startDelayTicks ?? 0;
				g.surplusTicks = 0;
				committed += cap(g);
			}
			if (g.gensetMode === GensetMode.Starting) {
				if (g.gensetTimer <= 0) {
					g.gensetMode = GensetMode.Running;
					events.push({ type: "gensetStarted", facilityId: g.id });
				} else g.gensetTimer--;
			} else if (g.gensetMode === GensetMode.Running) {
				g.surplusTicks = gridCap >= demand ? g.surplusTicks + 1 : 0;
				if (g.surplusTicks >= GENSET_STOP_SURPLUS_TICKS) {
					g.gensetMode = GensetMode.Off;
					g.surplusTicks = 0;
					events.push({ type: "gensetStopped", facilityId: g.id });
				}
			}
		}
		let gensetCap = 0;
		for (const g of b.gensets) if (g.gensetMode === GensetMode.Running) gensetCap += cap(g);
		let upsAvail = 0;
		let storageCap = 0;
		for (const u of b.upses) {
			storageCap += defs.get(u)?.power?.storageKwh ?? 0;
			if (isUsableSource(u)) upsAvail += Math.min(cap(u), u.storedKwh * TICKS_PER_HOUR);
		}

		const supply = gridCap + gensetCap + upsAvail;
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
		const gridKw = Math.min(gridCap, rest);
		rest -= gridKw;
		let gensetKw = 0;
		const gensetOut = new Map<Facility, number>();
		for (const g of b.gensets) {
			if (g.gensetMode !== GensetMode.Running) continue;
			const out = Math.min(cap(g), rest);
			gensetOut.set(g, out);
			gensetKw += out;
			rest -= out;
		}
		for (const u of b.upses) {
			if (rest <= EPS || !isUsableSource(u)) continue;
			const out = Math.min(cap(u), u.storedKwh * TICKS_PER_HOUR, rest);
			const before = u.storedKwh;
			u.storedKwh = Math.max(0, u.storedKwh - out / TICKS_PER_HOUR);
			if (u.storedKwh <= EPS) u.storedKwh = 0;
			rest -= out;
			if (before > 0 && u.storedKwh === 0) events.push({ type: "upsDepleted", facilityId: u.id });
		}

		// Charge UPS from remaining grid ▸ genset headroom (only when nothing was discharged).
		const discharged = served > gridKw + gensetKw + EPS;
		let gridSpare = gridCap - gridKw;
		let gridCharge = 0;
		for (const u of b.upses) {
			if (discharged || !isUsableSource(u)) continue;
			const d = defs.get(u)?.power;
			const eff = d?.efficiency ?? 1;
			const room = (d?.storageKwh ?? 0) - u.storedKwh;
			if (room <= EPS || eff <= 0) continue;
			let input = Math.min(cap(u), (room * TICKS_PER_HOUR) / eff);
			const fromGrid = Math.min(input, gridSpare);
			gridSpare -= fromGrid;
			input -= fromGrid;
			let fromGenset = 0;
			for (const g of b.gensets) {
				if (input <= EPS) break;
				if (g.gensetMode !== GensetMode.Running) continue;
				const used = gensetOut.get(g) ?? 0;
				const extra = Math.min(cap(g) - used, input);
				gensetOut.set(g, used + extra);
				fromGenset += extra;
				input -= extra;
			}
			gridCharge += fromGrid;
			gensetKw += fromGenset;
			u.storedKwh = Math.min(d?.storageKwh ?? 0, u.storedKwh + ((fromGrid + fromGenset) / TICKS_PER_HOUR) * eff);
		}

		const gridImport = gridKw + gridCharge;
		gridTotal += gridImport;
		gensetTotal += gensetKw;
		energyCost += (gridImport / TICKS_PER_HOUR) * price;
		for (const [g, out] of gensetOut) energyCost += (out / TICKS_PER_HOUR) * (defs.get(g)?.power?.costPerKwh ?? 0);

		let storedAfter = 0;
		for (const u of b.upses) storedAfter += u.storedKwh;
		const net: PowerNet = {
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
		if (sat < 1 && (!prev || prev.satisfaction >= 1)) events.push({ type: "powerShortfall", netId: n, satisfaction: sat });
	}

	// Facilities off-net, or not needing power.
	let itKw = 0;
	for (const f of state.facilities) {
		const d = defs.get(f) as FacilityDef;
		if (f.powerNet < 0) {
			if (needsPower(d)) {
				f.sat = 0;
				f.powerKw = 0;
			} else {
				f.sat = 1;
				f.powerKw = 0;
			}
		}
		if (d.kind === "rack") itKw += f.powerKw;
	}
	for (const lift of state.lifts) lift.sat = lift.powerNet >= 0 ? nets[lift.powerNet].satisfaction : 0;

	state.powerNets = nets;
	const m = state.metrics;
	m.itKw = itKw;
	m.gridKw = gridTotal;
	m.gensetKw = gensetTotal;
	m.totalKw = gridTotal + gensetTotal;
	m.energyCost = energyCost;
}
