/**
 * The Foreman: at most `balance.automation.foremanPerHour` placements per game-hour, never spending below `reserve`, and only on
 * built slab whose cells all carry a power conduit (it never builds slab, floors or conduits). Priority per placement:
 *   1. power   — a grid tie or genset (the cheapest unit that covers the shortfall, else the biggest) on a net whose satisfaction is below 1;
 *   2. cooling — the best CRAH within reach of the hottest rack above `thermal.okC`;
 *   3. racks   — the best-value rack (PFLOPS per $) that is unlocked, affordable and supported: air anywhere, liquid/immersion
 *                where a coolant loop has spare capacity for its liquid share, organoid where a nutrient line has spare supply; when no offer fits the
 *                idle compute, or less than FOREMAN_IDLE_SHARE of the installed compute is idle.
 * Maintenance comes before growth (and rides on the `racks` toggle): between cooling and racks the Foreman adds a charger when the bots order wants more bots than
 * the docks hold, and a depot when the spare-parts stock is below its target and every depot is full. Racks wait while open work
 * orders outnumber the bots, the rolling uptime is under the current tier's target, standing is under FOREMAN_MIN_STANDING, the last closed day lost money, a rack runs above `okC` (cooling on) or a
 * power net is short (power on).
 * Spot: on the floor nearest the existing racks (floor 0 when there are none), the leftmost cell run that placement accepts.
 * Reach: only on slab a ground bot can path to by the real nav graph (see `reachableRuns`); with none reachable nothing is placed.
 */
import type { ContentDB, FacilityDef } from "@aitower/content";
import { acceptCheck, installedPflops } from "../compute/allocation";
import type { TickCtx } from "../core/context";
import { FOREMAN_HEAT_MARGIN_C, FOREMAN_IDLE_SHARE, FOREMAN_MIN_STANDING, FOREMAN_RUNWAY_DAYS } from "../core/constants";
import { cellCount, cellIdx } from "../core/grid";
import type { Facility, SimState } from "../core/state";
import { rebuildNetworks } from "../networks/rebuild";
import { dayCosts } from "../economy/ledger";
import { createNav, type Nav, reachableRuns } from "../logistics/routing";
import { findChargerWithSpace } from "../world/entities";
import { getDef, isComputeRack } from "../world/defs";
import { planNormalized } from "../commands/apply";
import { buildable, runCommand } from "./run";
import { foremanPerHour } from "../research/research";

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
	/** Spare nutrient supply already promised to organoid racks placed this run, by net. */
	nutrientUsed: Map<number, number>;
	racksPlaced: number;
	/** PFLOPS placed this run (idle until jobs take them). */
	addedPflops: number;
	/** Slab runs bots can reach (computed on first use; the Foreman builds no lifts or slab, so it holds for the run). */
	reach?: Set<number> | null;
}

/** Floors with at least one slab run a ground bot can path to (every floor when a flying bot exists). */
export function reachableFloors(state: SimState, content: ContentDB, nav: Nav = createNav(cellCount(state))): Set<number> {
	const out = new Set<number>();
	const runs = reachableRuns(state, content, nav);
	for (let fl = state.floorMin; fl <= state.floorMax; fl++) {
		if (runs === null) out.add(fl);
		else for (let x = 0; x < state.width; x++) if (runs.has(nav.run[cellIdx(state, x, fl)])) {
			out.add(fl);
			break;
		}
	}
	return out;
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
	if (r.reach === undefined) r.reach = reachableRuns(state, r.ctx.content, r.ctx.scratch.nav);
	const reach = r.reach;
	const nav = r.ctx.scratch.nav;
	const order = [...floors].sort((a, b) => near(a) - near(b) || a - b);
	for (const floor of order) {
		for (let x = 0; x + d.width <= state.width; x++) {
			let ok = true;
			for (let k = 0; k < d.width && ok; k++) {
				const i = cellIdx(state, x + k, floor);
				ok = state.slab[i] === 1 && state.power[i] === 1 && state.facilityAt[i] < 0 && state.liftAt[i] < 0;
			}
			if (!ok) continue;
			// Only where a bot can walk (and ride) to: the slab run under the spot must be one a bot can path to.
			if (reach !== null && !reach.has(nav.run[cellIdx(state, x + (d.width >> 1), floor)])) continue;
			if (!spotOk(floor, x)) continue;
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
		// Right-sized: the cheapest unit that covers the shortfall; when none does, the biggest ones first.
		const need = Math.max(0, net.demandKw - net.supplyKw);
		const enough = defs.filter((d) => (d.power?.capacityKw ?? 0) >= need).sort((a, b) => a.cost - b.cost || byId(a, b));
		const fallback = defs.filter((d) => (d.power?.capacityKw ?? 0) < need);
		for (const d of [...enough, ...fallback]) {
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
	const { content } = r.ctx;
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

/** Best unlocked facility of a kind by capacity, placed like any other (reserve, power conduit, nearest floor). */
function placeBest(r: Run, kind: "charger" | "depot"): boolean {
	const defs = Object.values(r.ctx.content.facilities)
		.filter((d) => d.kind === kind && buildable(r.ctx, d))
		.sort((a, b) => (b.logistics?.capacity ?? 0) - (a.logistics?.capacity ?? 0) || byId(a, b));
	for (const d of defs) {
		if (!affordable(r, d)) continue;
		const spot = findSpot(r, d, allFloors(r), () => true);
		if (spot && place(r, d, spot)) return true;
	}
	return false;
}

function tryLogistics(r: Run): boolean {
	const { state, content } = r.ctx;
	const a = state.automation;
	let racks = 0;
	let room = 0;
	let stock = 0;
	for (const f of state.facilities) {
		const d = getDef(content, f.defId);
		if (d.kind === "rack" && !d.growth) racks++;
		if (d.kind === "depot") {
			stock += f.stored;
			room += Math.max(0, (d.logistics?.capacity ?? 0) - f.stored);
		}
	}
	const wantBots = Math.min(a.bots.maxBots, Math.ceil(racks / a.bots.racksPerBot));
	if (state.bots.length < wantBots && findChargerWithSpace(state, content) < 0 && placeBest(r, "charger")) return true;
	if (a.parts.enabled && stock < a.parts.keep && room === 0 && placeBest(r, "depot")) return true;
	return false;
}

/** Idle compute (free enabled healthy racks) and whether it is short. */
function wantsRacks(r: Run): boolean {
	const { state, content } = r.ctx;
	if (state.workOrders.length > state.bots.length) return false; // repairs first
	if (state.metrics.uptime < (content.balance.tiers.uptime[state.tier - 1] ?? 0)) return false;
	if (state.standing < FOREMAN_MIN_STANDING) return false; // the Ministry is watching: no expansion while standing is low
	const lastDay = state.ledger[state.ledger.length - 1];
	if (lastDay && dayCosts(lastDay) > lastDay.revenue) return false; // no expansion after a day in the red
	// Never grow into a shortage the Foreman is meant to be fixing: hot racks (cooling on) or a power net short of supply (power on).
	const p = state.automation.foreman;
	if (p.cooling && realRacks(r).some((f) => f.enabled && f.tempC > content.balance.thermal.okC - FOREMAN_HEAT_MARGIN_C)) return false;
	if (p.power && state.powerNets.some((n) => n.satisfaction < 1)) return false;
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

/**
 * Racks leave room for air handling: a rack may only go where the `reach` cells to its left (the best CRAH's radius)
 * hold a free, powered run as wide as that CRAH, or the floor's edge. Otherwise a floor fills solid and the hot racks in the
 * middle can never get a CRAH within reach.
 */
function leavesRoom(r: Run, floor: number, x: number): boolean {
	const { state, content } = r.ctx;
	const crah = Object.values(content.facilities)
		.filter((d) => d.kind === "crah" && buildable(r.ctx, d))
		.sort((a, b) => (b.cooling?.capacityKw ?? 0) - (a.cooling?.capacityKw ?? 0) || byId(a, b))[0];
	if (!crah) return true;
	const reach = crah.cooling?.radius ?? 8;
	let run = 0;
	for (let cx = x - 1; cx >= x - reach; cx--) {
		if (cx < 0) return true;
		const i = cellIdx(state, cx, floor);
		const free = state.slab[i] === 1 && state.power[i] === 1 && state.facilityAt[i] < 0 && state.liftAt[i] < 0;
		if (!free) {
			if (state.slab[i] === 0) return true; // the edge of the built floor
			run = 0;
			continue;
		}
		if (++run >= crah.width) return true;
	}
	return false;
}

/**
 * Compute value of a rack: PFLOPS per dollar of purchase price (ties: more PFLOPS, then id). The Foreman buys the
 * best-value rack it can both afford and support, not the first or the cheapest.
 */
const rackValue = (d: FacilityDef): number => (d.rack?.pflops ?? 0) / Math.max(1, d.cost);

function tryRacks(r: Run): boolean {
	const { state, content } = r.ctx;
	if (!wantsRacks(r)) return false;
	const candidates = Object.values(content.facilities)
		.filter((d) => isComputeRack(d) && buildable(r.ctx, d))
		.sort((a, b) => rackValue(b) - rackValue(a) || (b.rack?.pflops ?? 0) - (a.rack?.pflops ?? 0) || byId(a, b));
	let placed: FacilityDef | null = null;
	for (const d of candidates) {
		if (!affordable(r, d)) continue;
		const rk = d.rack;
		const liquid = (rk?.powerKw ?? 0) * (rk?.liquidFraction ?? 0);
		if (liquid > 0) {
			// Liquid-cooled: needs a coolant loop (chiller + CDU capacity) with room for its liquid share.
			for (const net of state.coolantNets) {
				const spare = net.capacityKw - net.loadKw - (r.coolUsed.get(net.id) ?? 0);
				if (liquid > spare) continue;
				const spot = findSpot(r, d, allFloors(r), (floor, x) => lowestNet(r, state.coolantNetOf, floor, x, d.width) === net.id && leavesRoom(r, floor, x));
				if (!spot || !place(r, d, spot)) continue;
				r.coolUsed.set(net.id, (r.coolUsed.get(net.id) ?? 0) + liquid);
				placed = d;
				break;
			}
		} else if (rk?.cooling === "bio") {
			// Organoid: needs a nutrient line with spare supply.
			const use = rk.bio?.nutrientUse ?? 0;
			for (const net of state.nutrientNets) {
				const spare = net.supply - net.demand - (r.nutrientUsed.get(net.id) ?? 0);
				if (use > spare) continue;
				const spot = findSpot(r, d, allFloors(r), (floor, x) => lowestNet(r, state.nutrientNetOf, floor, x, d.width) === net.id && leavesRoom(r, floor, x));
				if (!spot || !place(r, d, spot)) continue;
				r.nutrientUsed.set(net.id, (r.nutrientUsed.get(net.id) ?? 0) + use);
				placed = d;
				break;
			}
		} else {
			const spot = findSpot(r, d, allFloors(r), (floor, x) => leavesRoom(r, floor, x));
			if (spot && place(r, d, spot)) placed = d;
		}
		if (placed) break;
	}
	if (!placed) return false;
	r.racksPlaced++;
	r.addedPflops += placed.rack?.pflops ?? 0;
	return true;
}

/** Net of a layer a footprint would attach to (lowest id under its cells), or -1. */
function lowestNet(r: Run, layer: Int32Array, floor: number, x: number, w: number): number {
	const { state } = r.ctx;
	let best = -1;
	for (let k = 0; k < w; k++) {
		const n = layer[cellIdx(state, x + k, floor)];
		if (n >= 0 && (best < 0 || n < best)) best = n;
	}
	return best;
}

export function foremanStep(ctx: TickCtx): void {
	const { state, content } = ctx;
	const p = state.automation.foreman;
	const lastDay = state.ledger[state.ledger.length - 1];
	const runway = lastDay ? FOREMAN_RUNWAY_DAYS * (lastDay.energy + lastDay.upkeep + lastDay.fees) : 0;
	const r: Run = { ctx, reserve: Math.max(p.reserve, runway), powerDone: new Set(), coolDone: new Set(), coolUsed: new Map(), nutrientUsed: new Map(), racksPlaced: 0, addedPflops: 0 };
	for (let placed = 0; placed < foremanPerHour(state, content); placed++) {
		if (state.netsDirty) rebuildNetworks(ctx);
		const did = (p.power && tryPower(r)) || (p.cooling && tryCooling(r)) || (p.racks && (tryLogistics(r) || tryRacks(r)));
		if (!did) break;
	}
}
