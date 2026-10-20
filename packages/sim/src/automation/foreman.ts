/**
 * The Foreman: at most `balance.automation.foremanPerHour` placements per game-hour, never spending below `reserve`, and only on
 * built slab whose cells all carry a power conduit (it never builds slab, floors or conduits). Priority per placement:
 *   1. power   — a grid tie or genset (highest capacity first) on a net whose satisfaction is below 1;
 *   2. cooling — the best CRAH within reach of the hottest rack above `thermal.okC`;
 *   3. racks   — the best air rack (a DLC rack when a coolant loop with spare capacity is reachable) when no offer fits the
 *                idle compute, or less than FOREMAN_IDLE_SHARE of the installed compute is idle.
 * Spot: on the floor nearest the existing racks (floor 0 when there are none), the leftmost cell run that placement accepts.
 */
import type { FacilityDef } from "@aitower/content";
import { acceptCheck, installedPflops } from "../compute/allocation";
import type { TickCtx } from "../core/context";
import { FOREMAN_IDLE_SHARE } from "../core/constants";
import { cellIdx } from "../core/grid";
import type { Facility } from "../core/state";
import { rebuildNetworks } from "../networks/rebuild";
import { getDef, isComputeRack } from "../world/defs";
import { planNormalized } from "../commands/apply";
import { buildable, runCommand } from "./run";

const byId = (a: FacilityDef, b: FacilityDef): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

interface Run {
	ctx: TickCtx;
	reserve: number;
	/** Power nets already served this run. */
	powerDone: Set<number>;
	/** Racks already covered by a CRAH placed this run, or that no CRAH could reach. */
	coolDone: Set<number>;
	/** Spare coolant capacity already promised to racks placed this run, by net. */
	coolUsed: Map<number, number>;
	racksPlaced: number;
	/** PFLOPS placed this run (idle until jobs take them). */
	addedPflops: number;
}

const affordable = (r: Run, d: FacilityDef): boolean => r.ctx.state.cash - d.cost >= r.reserve;

/** Racks that exist (not growths). */
function realRacks(r: Run): Facility[] {
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
function findSpot(r: Run, d: FacilityDef, floors: number[], spotOk: (floor: number, x: number) => boolean): { floor: number; x: number } | null {
	const { state } = r.ctx;
	const rackFloors = [...new Set(realRacks(r).map((k) => k.floor))];
	const near = (floor: number): number => (rackFloors.length === 0 ? Math.abs(floor) : Math.min(...rackFloors.map((k) => Math.abs(k - floor))));
	const order = floors.slice().sort((a, b) => near(a) - near(b) || a - b);
	for (const floor of order) {
		for (let x = 0; x + d.width <= state.width; x++) {
			let ok = true;
			for (let k = 0; k < d.width && ok; k++) {
				const i = cellIdx(state, x + k, floor);
				ok = state.slab[i] === 1 && state.power[i] === 1 && state.facilityAt[i] < 0 && state.liftAt[i] < 0;
			}
			if (!ok || !spotOk(floor, x)) continue;
			if (planNormalized(r.ctx, { type: "place", defId: d.id, floor, x }).ok) return { floor, x };
		}
	}
	return null;
}

const allFloors = (r: Run): number[] => {
	const { state } = r.ctx;
	const out: number[] = [];
	for (let f = state.floorMin; f <= state.floorMax; f++) out.push(f);
	return out;
};

function place(r: Run, d: FacilityDef, spot: { floor: number; x: number }): boolean {
	const { state, events } = r.ctx;
	if (!runCommand(r.ctx, { type: "place", defId: d.id, floor: spot.floor, x: spot.x })) return false;
	events.push({ type: "autoBuilt", facilityId: state.nextId.facility - 1 });
	rebuildNetworks(r.ctx); // the new facility joins its nets now, like it would at the start of the next tick
	return true;
}

/** Netted under the whole footprint? */
const allCellsOn = (r: Run, layer: Int32Array, floor: number, x: number, w: number, net: number): boolean => {
	for (let k = 0; k < w; k++) if (layer[cellIdx(r.ctx.state, x + k, floor)] !== net) return false;
	return true;
};

function tryPower(r: Run): boolean {
	const { state, content } = r.ctx;
	const short = state.powerNets.filter((n) => n.satisfaction < 1 && !r.powerDone.has(n.id)).sort((a, b) => a.id - b.id);
	if (short.length === 0) return false;
	const defs = Object.values(content.facilities)
		.filter((d) => (d.kind === "grid_tie" || d.kind === "genset") && buildable(r.ctx, d))
		.sort((a, b) => (b.power?.capacityKw ?? 0) - (a.power?.capacityKw ?? 0) || (a.kind === b.kind ? 0 : a.kind === "grid_tie" ? -1 : 1) || byId(a, b));
	for (const net of short) {
		for (const d of defs) {
			if (!affordable(r, d)) continue;
			const spot = findSpot(r, d, allFloors(r), (floor, x) => allCellsOn(r, state.powerNetOf, floor, x, d.width, net.id));
			if (!spot || !place(r, d, spot)) continue;
			r.powerDone.add(net.id);
			return true;
		}
		r.powerDone.add(net.id); // nothing fits this net this hour: do not retry within the run
	}
	return false;
}

function tryCooling(r: Run): boolean {
	const { state, content } = r.ctx;
	const okC = content.balance.thermal.okC;
	const hot = realRacks(r)
		.filter((f) => f.enabled && f.tempC > okC && !r.coolDone.has(f.id))
		.sort((a, b) => b.tempC - a.tempC || a.id - b.id);
	if (hot.length === 0) return false;
	const defs = Object.values(content.facilities)
		.filter((d) => d.kind === "crah" && (d.cooling?.capacityKw ?? 0) > 0 && buildable(r.ctx, d))
		.sort((a, b) => (b.cooling?.capacityKw ?? 0) - (a.cooling?.capacityKw ?? 0) || byId(a, b));
	for (const rack of hot) {
		for (const d of defs) {
			if (!affordable(r, d)) continue;
			const reach = d.cooling?.radius ?? 0;
			const rw = rack.width;
			const spot = findSpot(r, d, [rack.floor], (_floor, x) => Math.max(0, rack.x - (x + d.width - 1), x - (rack.x + rw - 1)) <= reach);
			if (!spot || !place(r, d, spot)) continue;
			// Every hot rack on that floor within reach is now looked after.
			for (const o of hot) {
				if (o.floor === spot.floor && Math.max(0, o.x - (spot.x + d.width - 1), spot.x - (o.x + o.width - 1)) <= reach) r.coolDone.add(o.id);
			}
			return true;
		}
		r.coolDone.add(rack.id); // no CRAH can be put in reach of this one this hour
	}
	return false;
}

/** Idle compute (free enabled healthy racks) and whether it is short. */
function wantsRacks(r: Run): boolean {
	const { state, content } = r.ctx;
	let idle = 0;
	for (const f of state.facilities) {
		const d = getDef(content, f.defId);
		if (isComputeRack(d) && !d.growth && f.enabled && !f.failed && f.jobId < 0) idle += d.rack?.pflops ?? 0;
	}
	const installed = installedPflops(state, content);
	idle += r.addedPflops;
	const total = installed + r.addedPflops;
	if (total <= 0 || idle / total < FOREMAN_IDLE_SHARE) return true;
	// Offers that would not start on the idle compute (storage is not a compute problem, so it is ignored here).
	if (r.racksPlaced > 0 || state.offers.length === 0) return false;
	return state.offers.every((o) => !acceptCheck(state, content, { ...o.spec, storageTB: 0 }).ok);
}

function tryRacks(r: Run): boolean {
	const { state, content } = r.ctx;
	if (!wantsRacks(r)) return false;
	const racks = Object.values(content.facilities).filter((d) => isComputeRack(d) && buildable(r.ctx, d));
	const best = (pred: (d: FacilityDef) => boolean): FacilityDef[] => racks.filter(pred).sort((a, b) => (b.rack?.pflops ?? 0) - (a.rack?.pflops ?? 0) || byId(a, b));
	let placed: FacilityDef | null = null;
	// A DLC rack when a coolant loop with room for it is reachable.
	for (const net of state.coolantNets) {
		const spare = net.capacityKw - net.loadKw - (r.coolUsed.get(net.id) ?? 0);
		for (const d of best((x) => x.rack?.cooling === "dlc")) {
			const load = (d.rack?.powerKw ?? 0) * (d.rack?.liquidFraction ?? 0);
			if (load > spare || !affordable(r, d)) continue;
			const spot = findSpot(r, d, allFloors(r), (floor, x) => lowestNet(r, floor, x, d.width) === net.id);
			if (!spot || !place(r, d, spot)) continue;
			r.coolUsed.set(net.id, (r.coolUsed.get(net.id) ?? 0) + load);
			placed = d;
			break;
		}
		if (placed) break;
	}
	if (!placed) {
		for (const d of best((x) => x.rack?.cooling === "air")) {
			if (!affordable(r, d)) continue;
			const spot = findSpot(r, d, allFloors(r), () => true);
			if (!spot || !place(r, d, spot)) continue;
			placed = d;
			break;
		}
	}
	if (!placed) return false;
	r.racksPlaced++;
	r.addedPflops += placed.rack?.pflops ?? 0;
	return true;
}

/** Coolant net a footprint would attach to (lowest id under its cells), or -1. */
function lowestNet(r: Run, floor: number, x: number, w: number): number {
	const { state } = r.ctx;
	let best = -1;
	for (let k = 0; k < w; k++) {
		const n = state.coolantNetOf[cellIdx(state, x + k, floor)];
		if (n >= 0 && (best < 0 || n < best)) best = n;
	}
	return best;
}

export function foremanStep(ctx: TickCtx): void {
	const { state, content } = ctx;
	const p = state.automation.foreman;
	const r: Run = { ctx, reserve: p.reserve, powerDone: new Set(), coolDone: new Set(), coolUsed: new Map(), racksPlaced: 0, addedPflops: 0 };
	for (let placed = 0; placed < content.balance.automation.foremanPerHour; placed++) {
		if (state.netsDirty) rebuildNetworks(ctx);
		const did = (p.power && tryPower(r)) || (p.cooling && tryCooling(r)) || (p.racks && tryRacks(r));
		if (!did) break;
	}
}
