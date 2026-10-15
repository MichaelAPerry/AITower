/** buildSlab, buildConduit, buildLift. */
import type { CellRef, ConduitLayer } from "../api";
import { cellIdx, inBounds } from "../core/grid";
import { addLift } from "../world/entities";
import { accept, type Plan, type PlanCtx, reject } from "./plan";

export const slabCost = (ctx: PlanCtx, floor: number): number =>
	floor < 0 ? ctx.content.structure.basementSlabPerTile : ctx.content.structure.slabPerTile;

export const conduitCost = (ctx: PlanCtx, layer: ConduitLayer): number =>
	layer === "power" ? ctx.content.structure.powerConduitPerTile : ctx.content.structure.coolantConduitPerTile;

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
		events.push({ type: "built", what: "slab", floor, x: x0 });
	});
}

export function planConduit(ctx: PlanCtx, layer: ConduitLayer, cells: CellRef[]): Plan {
	const s = ctx.state;
	if (layer !== "power" && layer !== "coolant") return reject("unknown conduit layer");
	if (!Array.isArray(cells) || cells.length === 0) return reject("no cells");
	const grid = layer === "power" ? s.power : s.coolant;
	const added = new Set<number>();
	const order: number[] = [];
	const hasConduit = (x: number, floor: number): boolean => {
		if (!inBounds(s, x, floor)) return false;
		const i = cellIdx(s, x, floor);
		return grid[i] === 1 || added.has(i);
	};
	for (const c of cells) {
		if (!inBounds(s, c.x, c.floor)) return reject("conduit cell out of bounds");
		const i = cellIdx(s, c.x, c.floor);
		if (grid[i] || added.has(i)) continue;
		const supported =
			s.slab[i] === 1 ||
			hasConduit(c.x - 1, c.floor) ||
			hasConduit(c.x + 1, c.floor) ||
			hasConduit(c.x, c.floor - 1) ||
			hasConduit(c.x, c.floor + 1);
		if (!supported) return reject(`conduit at (${c.x}, ${c.floor}) needs slab or an adjacent conduit`);
		added.add(i);
		order.push(i);
	}
	if (order.length === 0) return reject("already built");
	const first = cells[0];
	return accept(order.length * conduitCost(ctx, layer), (events) => {
		for (const i of order) grid[i] = 1;
		s.netsDirty = true;
		events.push({ type: "built", what: "conduit", floor: first.floor, x: first.x });
	});
}

export function planLift(ctx: PlanCtx, x: number, floorMin: number, floorMax: number): Plan {
	const s = ctx.state;
	if (!inBounds(s, x, floorMin) || !inBounds(s, x, floorMax) || floorMax <= floorMin)
		return reject("lift must span at least two floors inside the lot");
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
