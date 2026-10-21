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
import { facilityTier, rackLine, TIER_ORDER, type ContentDB, type FacilityDef } from "@aitower/content";
import type { ForemanTierCap } from "../api";
import { fmtKw, fmtUsd } from "./text";
import { setForemanStatus } from "./status";
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
	/** Power already promised to racks placed this run, by net. */
	powerUsed: Map<number, number>;
	/** What each kind of job did or why it waited (last writer wins), shown as the Foreman's status. */
	notes: { racks?: string; cooling?: string; power?: string };
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

/** Tier cap and path rule: core-ladder items up to `cap` ("auto" = highest unlocked); path items only when that path was chosen. */
function allowed(r: Run, d: FacilityDef, cap: ForemanTierCap | undefined): boolean {
	const info = facilityTier(d, r.ctx.content);
	if (info.tier === "path") return r.ctx.state.path !== null && info.path === r.ctx.state.path;
	const c = cap ?? "auto";
	return c === "auto" || TIER_ORDER.indexOf(info.tier) <= TIER_ORDER.indexOf(c);
}

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

/** Place the cheapest supply unit that covers `need` kW on `net` (else the biggest), within the power tier cap. Null when none fits. */
function placeSupply(r: Run, net: { id: number }, need: number): FacilityDef | null {
	const { state, content } = r.ctx;
	const defs = Object.values(content.facilities)
		.filter((d) => (d.kind === "grid_tie" || d.kind === "genset") && buildable(r.ctx, d) && allowed(r, d, state.automation.foreman.powerCap))
		.sort((a, b) => (b.power?.capacityKw ?? 0) - (a.power?.capacityKw ?? 0) || (a.kind === b.kind ? 0 : a.kind === "grid_tie" ? -1 : 1) || byId(a, b));
	const enough = defs.filter((d) => (d.power?.capacityKw ?? 0) >= need).sort((a, b) => a.cost - b.cost || byId(a, b));
	const fallback = defs.filter((d) => (d.power?.capacityKw ?? 0) < need);
	for (const d of [...enough, ...fallback]) {
		if (!affordable(r, d)) continue;
		const spot = findSpot(r, d, allFloors(r), (floor, x) => allCellsOn(r, state.powerNetOf, floor, x, d.width, net.id));
		if (spot && place(r, d, spot)) return d;
	}
	return null;
}

function tryPower(r: Run): boolean {
	const { state } = r.ctx;
	const short = state.powerNets.filter((n) => n.satisfaction < 1 && !r.powerDone.has(n.id)).sort((a, b) => a.id - b.id);
	if (short.length === 0) return false;
	for (const net of short) {
		// Right-sized: the cheapest unit that covers the shortfall; when none does, the biggest ones first.
		const need = Math.max(0, net.demandKw - net.supplyKw);
		r.powerDone.add(net.id); // one go per net per run
		const d = placeSupply(r, net, need);
		if (d) {
			r.notes.power = `Power: Placed ${d.name} for a ${fmtKw(need)} shortfall`;
			return true;
		}
		r.notes.power = `Power: Waiting: ${fmtKw(need)} short, no grid tie or generator fits (cost, tier cap or space)`;
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
		.filter((d) => d.kind === "crah" && (d.cooling?.capacityKw ?? 0) > 0 && buildable(r.ctx, d) && allowed(r, d, r.ctx.state.automation.foreman.coolingCap))
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
			r.notes.cooling = `Cooling: Placed ${d.name} for a rack at ${Math.round(rack.tempC)} C`;
			return true;
		}
		r.notes.cooling = `Cooling: Waiting: a rack runs at ${Math.round(rack.tempC)} C and no air handler fits within reach (cost, tier cap or space)`;
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

/** Why racks should wait (or that none are needed), or null when the Foreman wants more compute. */
function racksBlocker(r: Run): string | null {
	const { state, content } = r.ctx;
	if (state.workOrders.length > state.bots.length) return `Waiting: ${state.workOrders.length} repair jobs open for ${state.bots.length} bots, repairs first`;
	const target = content.balance.tiers.uptime[state.tier - 1] ?? 0;
	if (state.metrics.uptime < target) return `Waiting: uptime ${Math.round(state.metrics.uptime * 100)}% is under the ${Math.round(target * 100)}% target`;
	if (state.standing < FOREMAN_MIN_STANDING) return `Waiting: Reputation ${Math.round(state.standing)} is under ${FOREMAN_MIN_STANDING}`;
	const lastDay = state.ledger[state.ledger.length - 1];
	if (lastDay && dayCosts(lastDay) > lastDay.revenue) return "Waiting: the last day closed in the red";
	// Never grow into a shortage the Foreman is meant to be fixing: hot racks (cooling on) or a power net short of supply (power on).
	const p = state.automation.foreman;
	if (p.cooling && realRacks(r).some((f) => f.enabled && f.tempC > content.balance.thermal.okC - FOREMAN_HEAT_MARGIN_C)) return "Waiting: a rack is running hot, cooling comes first";
	if (p.power && state.powerNets.some((n) => n.satisfaction < 1)) return "Waiting: a power net is short, power comes first";
	let idle = 0;
	for (const f of state.facilities) {
		const d = getDef(content, f.defId);
		if (isComputeRack(d) && !d.growth && f.enabled && !f.failed && f.jobId < 0) idle += d.rack?.pflops ?? 0;
	}
	const installed = installedPflops(state, content);
	idle += r.addedPflops;
	const total = installed + r.addedPflops;
	if (total <= 0 || idle / total < FOREMAN_IDLE_SHARE) return null;
	const idlePct = Math.round((idle / total) * 100);
	if (r.racksPlaced > 0) return `Enough compute for now (${idlePct}% idle)`;
	// Offers that would not start on the idle compute (storage is not a compute problem, so it is ignored here).
	if (state.offers.length === 0) return `Enough compute for now (${idlePct}% idle, no offers waiting)`;
	return state.offers.every((o) => !acceptCheck(state, content, { ...o.spec, storageTB: 0 }).ok) ? null : `Enough compute for now (${idlePct}% idle, offers fit)`;
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
 * Compute value of a rack: PFLOPS per dollar of purchase price (ties: more PFLOPS, then id). In "auto" the Foreman buys the
 * best-value rack it can both afford and support; on a chosen line it buys the best (most PFLOPS) unlocked item of that line.
 */
const rackValue = (d: FacilityDef): number => (d.rack?.pflops ?? 0) / Math.max(1, d.cost);

function rackCandidates(r: Run): FacilityDef[] {
	const { content } = r.ctx;
	const p = r.ctx.state.automation.foreman;
	const line = p.rackLine ?? "auto";
	const base = Object.values(content.facilities).filter((d) => isComputeRack(d) && buildable(r.ctx, d) && allowed(r, d, p.rackCap));
	if (line === "auto") return base.sort((a, b) => rackValue(b) - rackValue(a) || (b.rack?.pflops ?? 0) - (a.rack?.pflops ?? 0) || byId(a, b));
	return base
		.filter((d) => facilityTier(d, content).tier !== "path" && rackLine(d) === line)
		.sort((a, b) => (b.rack?.pflops ?? 0) - (a.rack?.pflops ?? 0) || a.cost - b.cost || byId(a, b));
}

/** Why a rack could not go down, and which support item would fix it. */
interface Block {
	text: string;
	support?: { kind: "power"; net: number; shortKw: number } | { kind: "air"; floor: number; x: number; w: number; shortKw: number } | { kind: "coolant"; net: number; shortKw: number };
}

/** CRAH capacity covering a footprint on its floor, and the air heat already on it. */
function airRoom(r: Run, floor: number, x: number, w: number): { capKw: number; loadKw: number } {
	const { state, content } = r.ctx;
	const perk = 1;
	const covering = state.facilities.filter((f) => {
		const d = getDef(content, f.defId);
		return d.kind === "crah" && f.enabled && f.floor === floor && Math.max(0, f.x - (x + w - 1), x - (f.x + f.width - 1)) <= (d.cooling?.radius ?? 0);
	});
	let capKw = 0;
	for (const c of covering) capKw += (getDef(content, c.defId).cooling?.capacityKw ?? 0) * perk;
	let loadKw = 0;
	for (const f of state.facilities) {
		const d = getDef(content, f.defId);
		if (d.kind !== "rack" || d.growth || !f.enabled || f.floor !== floor || d.rack?.cooling === "bio") continue;
		const seen = covering.some((c) => Math.max(0, f.x - (c.x + c.width - 1), c.x - (f.x + f.width - 1)) <= (getDef(content, c.defId).cooling?.radius ?? 0));
		if (seen) loadKw += (d.rack?.powerKw ?? 0) * (1 - (d.rack?.liquidFraction ?? 0)) + d.facilityKw;
	}
	return { capKw, loadKw };
}

/** Try to put one rack down with its support in place. Never places a rack the power or cooling toggles say it cannot carry. */
function tryPlaceRack(r: Run, d: FacilityDef): { placed: true } | { placed: false; block: Block } {
	const { state } = r.ctx;
	const p = state.automation.foreman;
	if (!affordable(r, d)) return { placed: false, block: { text: `Waiting: ${fmtUsd(d.cost)} needed for ${d.name}, ${fmtUsd(Math.max(0, state.cash - r.reserve))} free` } };
	const rk = d.rack;
	const liquid = (rk?.powerKw ?? 0) * (rk?.liquidFraction ?? 0);
	const powerNeed = (rk?.powerKw ?? 0) + d.facilityKw;
	const airNeed = (rk?.powerKw ?? 0) * (1 - (rk?.liquidFraction ?? 0)) + d.facilityKw;
	const checkAir = p.cooling && rk?.cooling !== "bio" && airNeed > 0;
	let powerFail: { free: number; net: number } | null = null;
	let airFail: { free: number; floor: number; x: number } | null = null;

	// Spot check shared by every kind: headroom on the power net and the air around it, then room for an air handler.
	const spotChecks = (floor: number, x: number): boolean => {
		if (!leavesRoom(r, floor, x)) return false;
		if (p.power) {
			const net = lowestNet(r, state.powerNetOf, floor, x, d.width);
			const n = state.powerNets.find((q) => q.id === net);
			if (n) {
				const free = n.supplyKw - n.demandKw - (r.powerUsed.get(n.id) ?? 0);
				if (free < powerNeed) {
					if (!powerFail || free > powerFail.free) powerFail = { free, net: n.id };
					return false;
				}
			}
		}
		if (checkAir) {
			const a = airRoom(r, floor, x, d.width);
			const free = a.capKw - a.loadKw;
			if (a.capKw <= 0 || free < airNeed) {
				if (!airFail || free > airFail.free) airFail = { free, floor, x };
				return false;
			}
		}
		return true;
	};
	const finish = (net: number, used: Map<number, number>, amount: number, spot: { floor: number; x: number }): { placed: true } => {
		if (net >= 0) used.set(net, (used.get(net) ?? 0) + amount);
		const pn = lowestNet(r, state.powerNetOf, spot.floor, spot.x, d.width);
		if (pn >= 0) r.powerUsed.set(pn, (r.powerUsed.get(pn) ?? 0) + powerNeed);
		return { placed: true };
	};

	let netBlock: Block | null = null;
	if (liquid > 0 || rk?.cooling === "bio") {
		const isLiquid = liquid > 0;
		const nets = isLiquid ? state.coolantNets.map((n) => ({ id: n.id, spare: n.capacityKw - n.loadKw - (r.coolUsed.get(n.id) ?? 0), cap: n.capacityKw })) : state.nutrientNets.map((n) => ({ id: n.id, spare: n.supply - n.demand - (r.nutrientUsed.get(n.id) ?? 0), cap: n.supply }));
		const need = isLiquid ? liquid : (rk?.bio?.nutrientUse ?? 0);
		const layer = isLiquid ? state.coolantNetOf : state.nutrientNetOf;
		const used = isLiquid ? r.coolUsed : r.nutrientUsed;
		for (const net of nets) {
			if (need > net.spare) continue;
			const spot = findSpot(r, d, allFloors(r), (floor, x) => lowestNet(r, layer, floor, x, d.width) === net.id && spotChecks(floor, x));
			if (spot && place(r, d, spot)) return finish(net.id, used, need, spot);
		}
		if (nets.length === 0 || nets.every((n) => n.cap <= 0)) {
			netBlock = isLiquid
				? { text: `Waiting: ${d.name} needs a coolant loop (chiller, CDU and coolant pipe)`, support: nets.length > 0 ? { kind: "coolant", net: nets[0].id, shortKw: need } : undefined }
				: { text: `Waiting: ${d.name} needs a nutrient line with a nutrient plant` };
		} else {
			const best = nets.reduce((a, b) => (b.spare > a.spare ? b : a));
			if (need > best.spare) netBlock = { text: `Waiting: ${isLiquid ? `${fmtKw(need)} of coolant` : `${need} nutrient`} needed, ${isLiquid ? fmtKw(Math.max(0, best.spare)) : Math.max(0, Math.floor(best.spare))} free`, support: isLiquid ? { kind: "coolant", net: best.id, shortKw: need - best.spare } : undefined };
		}
	} else {
		const spot = findSpot(r, d, allFloors(r), spotChecks);
		if (spot && place(r, d, spot)) return finish(-1, r.coolUsed, 0, spot);
	}
	if (netBlock) return { placed: false, block: netBlock };
	const pf = powerFail as { free: number; net: number } | null;
	const af = airFail as { free: number; floor: number; x: number } | null;
	if (af) return { placed: false, block: { text: `Waiting: ${fmtKw(airNeed)} of air cooling needed, ${fmtKw(Math.max(0, af.free))} free`, support: { kind: "air", floor: af.floor, x: af.x, w: d.width, shortKw: airNeed - af.free } } };
	if (pf) return { placed: false, block: { text: `Waiting: ${fmtKw(powerNeed)} needed, ${fmtKw(Math.max(0, pf.free))} free`, support: { kind: "power", net: pf.net, shortKw: powerNeed - pf.free } } };
	return { placed: false, block: { text: `Waiting: no free powered slab a bot can reach for ${d.name}` } };
}

/** Queue the support item a blocked rack needs. Returns what it placed, or null. */
function placeSupport(r: Run, b: Block): FacilityDef | null {
	const { state, content } = r.ctx;
	const p = state.automation.foreman;
	const s = b.support;
	if (!s) return null;
	if (s.kind === "power") return p.power ? placeSupply(r, { id: s.net }, s.shortKw) : null;
	if (!p.cooling) return null;
	if (s.kind === "air") {
		const defs = Object.values(content.facilities)
			.filter((d) => d.kind === "crah" && (d.cooling?.capacityKw ?? 0) > 0 && buildable(r.ctx, d) && allowed(r, d, p.coolingCap))
			.sort((a, b) => (b.cooling?.capacityKw ?? 0) - (a.cooling?.capacityKw ?? 0) || byId(a, b));
		const enough = defs.filter((d) => (d.cooling?.capacityKw ?? 0) >= s.shortKw).sort((a, b) => a.cost - b.cost || byId(a, b));
		for (const d of [...enough, ...defs.filter((x) => !enough.includes(x))]) {
			if (!affordable(r, d)) continue;
			const reach = d.cooling?.radius ?? 0;
			const spot = findSpot(r, d, [s.floor], (_f, x) => Math.max(0, s.x - (x + d.width - 1), x - (s.x + s.w - 1)) <= reach);
			if (spot && place(r, d, spot)) return d;
		}
		return null;
	}
	// Coolant: add whichever of chiller and CDU limits the loop (capacity = the smaller of the two totals).
	let chiller = 0;
	let cdu = 0;
	for (const f of state.facilities) {
		if (f.coolantNet !== s.net) continue;
		const d = getDef(content, f.defId);
		if (d.kind === "chiller") chiller += d.cooling?.capacityKw ?? 0;
		else if (d.kind === "cdu") cdu += d.cooling?.capacityKw ?? 0;
	}
	const order: ("chiller" | "cdu")[] = chiller <= cdu ? ["chiller", "cdu"] : ["cdu", "chiller"];
	for (const kind of order) {
		const defs = Object.values(content.facilities)
			.filter((d) => d.kind === kind && buildable(r.ctx, d) && allowed(r, d, p.coolingCap))
			.sort((a, b) => (b.cooling?.capacityKw ?? 0) - (a.cooling?.capacityKw ?? 0) || byId(a, b));
		for (const d of defs) {
			if (!affordable(r, d)) continue;
			const spot = findSpot(r, d, allFloors(r), (floor, x) => lowestNet(r, state.coolantNetOf, floor, x, d.width) === s.net);
			if (spot && place(r, d, spot)) return d;
		}
	}
	return null;
}

function tryRacks(r: Run): boolean {
	const { state } = r.ctx;
	const p = state.automation.foreman;
	const wait = racksBlocker(r);
	if (wait) {
		r.notes.racks = `Racks: ${wait}`;
		return false;
	}
	const line = p.rackLine ?? "auto";
	const candidates = rackCandidates(r);
	if (candidates.length === 0) {
		r.notes.racks = `Racks: Waiting: nothing unlocked on the ${line === "auto" ? "racks menu" : `${line} line`} within the tier cap`;
		return false;
	}
	let first: { d: FacilityDef; block: Block } | null = null;
	const blocked: { d: FacilityDef; block: Block }[] = [];
	for (const d of candidates) {
		const res = tryPlaceRack(r, d);
		if (res.placed) {
			r.racksPlaced++;
			r.addedPflops += d.rack?.pflops ?? 0;
			r.notes.racks = `Racks: Placed ${d.name}`;
			return true;
		}
		first ??= { d, block: res.block };
		blocked.push({ d, block: res.block });
		if (line !== "auto") break; // a chosen line waits for its best item
	}
	if (!first) return false;
	// Support first: the best blocked rack whose missing support can be placed now.
	for (const b of blocked) {
		const sup = placeSupport(r, b.block);
		if (sup) {
			r.notes.racks = `Racks: Next: ${sup.name}, then ${b.d.name}`;
			return true;
		}
	}
	r.notes.racks = `Racks: ${first.block.text}`;
	return false;
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
	const r: Run = { ctx, reserve: Math.max(p.reserve, runway), powerDone: new Set(), coolDone: new Set(), coolUsed: new Map(), nutrientUsed: new Map(), powerUsed: new Map(), notes: {}, racksPlaced: 0, addedPflops: 0 };
	const budget = foremanPerHour(state, content);
	let placed = 0;
	for (; placed < budget; placed++) {
		if (state.netsDirty) rebuildNetworks(ctx);
		const did = (p.power && tryPower(r)) || (p.cooling && tryCooling(r)) || (p.racks && (tryLogistics(r) || tryRacks(r)));
		if (!did) break;
	}
	if (p.racks && !r.notes.racks && placed >= budget) r.notes.racks = `Racks: Waiting: ${budget} build${budget === 1 ? "" : "s"} per hour used`;
	const out: string[] = [];
	if (p.racks) out.push(r.notes.racks ?? "Racks: Nothing to add");
	if (p.cooling) out.push(r.notes.cooling ?? "Cooling: Matches the racks");
	if (p.power) out.push(r.notes.power ?? "Power: Matches the load");
	setForemanStatus(state, out);
}
