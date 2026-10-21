/** buildSlab, buildConduit, buildLift. */
import { conduitTech } from "@aitower/content";
import type { CellRef, ConduitLayer } from "../api";
import { cellIdx, inBounds } from "../core/grid";
import { techGate } from "../research/research";
import type { Lift } from "../core/state";
import { addLift, extendLift } from "../world/entities";
import { accept, type Plan, type PlanCtx, reject } from "./plan";

export const slabCost = (ctx: PlanCtx, floor: number): number =>
	floor < 0 ? ctx.content.structure.basementSlabPerTile : ctx.content.structure.slabPerTile;

/** Nutrient pipes cost the same as coolant pipes (`coolantConduitPerTile`; the schema has no separate field). */
export const conduitCost = (ctx: PlanCtx, layer: ConduitLayer): number =>
	layer === "power" ? ctx.content.structure.powerConduitPerTile : ctx.content.structure.coolantConduitPerTile;

export const layerGrid = (s: { power: Uint8Array; coolant: Uint8Array; nutrient: Uint8Array }, layer: ConduitLayer): Uint8Array =>
	layer === "power" ? s.power : layer === "coolant" ? s.coolant : s.nutrient;

export const liftCost = (ctx: PlanCtx, floors: number): number =>
	ctx.content.structure.liftBase + ctx.content.structure.liftPerFloor * floors;

export function planSlab(ctx: PlanCtx, floor: number, x0: number, x1: number): Plan {
	const s = ctx.state;
	if (!inBounds(s, x0, floor) || !inBounds(s, x1, floor) || x1 < x0) return reject("slab span out of bounds");
	const cells: number[] = [];
	for (let x = x0; x <= x1; x++) {
		const i = cellIdx(s, x, floor);
		if (s.slab[i]) continue;
		if (floor > 0 && !s.slab[cellIdx(s, x, floor - 1)]) return reject(`no slab below at x=${x}`);
		cells.push(i);
	}
	if (cells.length === 0) return reject("already built");
	return accept(cells.length * slabCost(ctx, floor), (events) => {
		for (const i of cells) s.slab[i] = 1;
		s.topologyRev++;
		events.push({ type: "built", what: "slab", floor, x: x0 });
	});
}

export function planConduit(ctx: PlanCtx, layer: ConduitLayer, cells: CellRef[]): Plan {
	const s = ctx.state;
	if (layer !== "power" && layer !== "coolant" && layer !== "nutrient") return reject("unknown conduit layer");
	if (!Array.isArray(cells) || cells.length === 0) return reject("no cells");
	// Coolant piping arrives with liquid cooling, nutrient piping with the nutrient plant (data-driven, no hard-coded ids).
	// Conduit already in the ground (older saves, scenarios) stays; only new runs are gated.
	const gate = techGate(s, ctx.content, conduitTech(ctx.content, layer));
	if (gate) return reject(gate);
	const grid = layerGrid(s, layer);
	// Unique new cells in input order.
	const wanted = new Set<number>();
	const order: CellRef[] = [];
	for (const c of cells) {
		if (!c || !inBounds(s, c.x, c.floor)) return reject("conduit cell out of bounds");
		const i = cellIdx(s, c.x, c.floor);
		if (grid[i] || wanted.has(i)) continue;
		wanted.add(i);
		order.push(c);
	}
	if (order.length === 0) return reject("already built");
	// Support is resolved to a fixed point, so the result does not depend on the order of `cells`: a cell
	// without slab is accepted once a neighbour (existing, or accepted earlier in this pass) carries conduit.
	const placed = new Set<number>();
	const has = (x: number, floor: number): boolean => {
		if (!inBounds(s, x, floor)) return false;
		const i = cellIdx(s, x, floor);
		return grid[i] === 1 || placed.has(i);
	};
	let pending = order;
	for (;;) {
		const next: CellRef[] = [];
		for (const c of pending) {
			const i = cellIdx(s, c.x, c.floor);
			const supported =
				s.slab[i] === 1 || has(c.x - 1, c.floor) || has(c.x + 1, c.floor) || has(c.x, c.floor - 1) || has(c.x, c.floor + 1);
			if (supported) placed.add(i);
			else next.push(c);
		}
		if (next.length === 0) break;
		if (next.length === pending.length) return reject(`conduit at (${next[0].x}, ${next[0].floor}) needs slab or an adjacent conduit`);
		pending = next;
	}
	const first = cells[0];
	return accept(placed.size * conduitCost(ctx, layer), (events) => {
		for (const i of placed) grid[i] = 1;
		s.netsDirty = true;
		events.push({ type: "built", what: "conduit", floor: first.floor, x: first.x });
	});
}

export function planLift(ctx: PlanCtx, x: number, floorMin: number, floorMax: number): Plan {
	const s = ctx.state;
	if (!inBounds(s, x, floorMin) || !inBounds(s, x, floorMax) || floorMax < floorMin) return reject("lift must stay inside the lot");
	// A drag that overlaps or touches an existing lift in this column extends that lift (only the new floors are paid for).
	const host = s.lifts.find((l) => l.x === x && l.floorMin <= floorMax + 1 && l.floorMax >= floorMin - 1);
	if (host) return planLiftExtend(ctx, host, Math.min(host.floorMin, floorMin), Math.max(host.floorMax, floorMax));
	if (floorMax === floorMin) return reject("lift must span at least two floors inside the lot");
	for (let fl = floorMin; fl <= floorMax; fl++) {
		const i = cellIdx(s, x, fl);
		if (!s.slab[i]) return reject(`no slab at floor ${fl}`);
		if (s.facilityAt[i] >= 0) return reject(`facility in the way at floor ${fl}`);
		if (s.liftAt[i] >= 0) return reject(`lift already at floor ${fl}`);
	}
	return accept(liftCost(ctx, floorMax - floorMin + 1), (events) => {
		addLift(s, x, floorMin, floorMax);
		events.push({ type: "built", what: "lift", floor: floorMin, x });
	});
}

function planLiftExtend(ctx: PlanCtx, lift: Lift, floorMin: number, floorMax: number): Plan {
	const s = ctx.state;
	if (floorMin === lift.floorMin && floorMax === lift.floorMax) return reject("already built");
	for (let fl = floorMin; fl <= floorMax; fl++) {
		if (fl >= lift.floorMin && fl <= lift.floorMax) continue;
		const i = cellIdx(s, lift.x, fl);
		if (!s.slab[i]) return reject(`no slab at floor ${fl}`);
		if (s.facilityAt[i] >= 0) return reject(`facility in the way at floor ${fl}`);
		if (s.liftAt[i] >= 0) return reject(`another lift at floor ${fl}`);
	}
	const added = floorMax - floorMin - (lift.floorMax - lift.floorMin);
	return accept(ctx.content.structure.liftPerFloor * added, (events) => {
		extendLift(s, lift, floorMin, floorMax);
		events.push({ type: "built", what: "lift", floor: floorMin, x: lift.x });
	});
}
