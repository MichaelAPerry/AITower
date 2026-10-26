/**
 * The Foreman grows the tower when it runs out of room (playtest bug: "the Foreman stops after a while"):
 *  - up: a new top floor over the full width of the floor below, a power conduit along it (a riser joins it to the conduit
 *    below), and the lift extended to reach it;
 *  - down: a new basement under the lowest floor the same way, because generators and grid ties sit at floor 0 or below.
 * Every step goes through the normal commands, so costs, rules and refusals are the player's own. When a step is refused
 * nothing more is tried this hour (half-built floors are fine: the next hour finishes them).
 */
import type { CellRef } from "../api";
import type { TickCtx } from "../core/context";
import { cellIdx } from "../core/grid";
import { planNormalized } from "../commands/apply";
import type { SimCommand } from "../api";
import { runCommand } from "./run";

/** Whether the Foreman may spend this much now (its reserve). */
export type CanSpend = (cost: number) => boolean;

/** Run a command only when it is valid and the reserve allows its cost. */
function guarded(ctx: TickCtx, cmd: SimCommand, canSpend: CanSpend): boolean {
	const plan = planNormalized(ctx, cmd);
	return plan.ok && canSpend(plan.cost) && runCommand(ctx, cmd);
}

/** x-range of slab on a floor, or null. */
function slabSpan(ctx: TickCtx, floor: number): { x0: number; x1: number } | null {
	const { state } = ctx;
	let x0 = -1;
	let x1 = -1;
	for (let x = 0; x < state.width; x++) {
		if (state.slab[cellIdx(state, x, floor)] === 1) {
			if (x0 < 0) x0 = x;
			x1 = x;
		}
	}
	return x0 < 0 ? null : { x0, x1 };
}

/** Floors that hold slab, low to high. */
function builtFloors(ctx: TickCtx): number[] {
	const out: number[] = [];
	for (let f = ctx.state.floorMin; f <= ctx.state.floorMax; f++) if (slabSpan(ctx, f)) out.push(f);
	return out;
}

/** Lay power conduit on every slab cell of the floor that lacks it (cells over/under an existing conduit act as risers). */
function powerFloor(ctx: TickCtx, floor: number, span: { x0: number; x1: number }, canSpend: CanSpend): boolean {
	const { state } = ctx;
	const cells: CellRef[] = [];
	for (let x = span.x0; x <= span.x1; x++) {
		const i = cellIdx(state, x, floor);
		if (state.slab[i] === 1 && state.power[i] === 0) cells.push({ x, floor });
	}
	return cells.length === 0 || guarded(ctx, { type: "buildConduit", layer: "power", cells }, canSpend);
}

/** Extend the lift that reaches `from` to also stop at `to` (adjacent floor). True when one already does or was extended. */
function reachWithLift(ctx: TickCtx, from: number, to: number, canSpend: CanSpend): boolean {
	const { state } = ctx;
	if (state.lifts.some((l) => l.floorMin <= to && to <= l.floorMax)) return true;
	const lift = state.lifts.find((l) => l.floorMin <= from && from <= l.floorMax);
	if (!lift) return state.bots.length === 0 || state.bots.every((b) => b.defId.includes("drone"));
	return guarded(ctx, { type: "buildLift", x: lift.x, floorMin: Math.min(lift.floorMin, to), floorMax: Math.max(lift.floorMax, to) }, canSpend);
}

/** Finish a floor already started (slab without full conduit, or not yet on a lift) before adding another. */
function finishFloor(ctx: TickCtx, floor: number, neighbour: number, canSpend: CanSpend): boolean {
	const span = slabSpan(ctx, floor);
	if (!span) return false;
	return powerFloor(ctx, floor, span, canSpend) && reachWithLift(ctx, neighbour, floor, canSpend);
}

/** Add (or finish) a floor above the top one. Returns a status note, or null when nothing could be done. */
export function expandUp(ctx: TickCtx, canSpend: CanSpend): string | null {
	const { state } = ctx;
	const floors = builtFloors(ctx);
	const top = floors.at(-1);
	if (top === undefined || top < 0) return null;
	// A started top floor (conduit or lift missing) is finished first.
	if (top > 0 && floors.includes(top - 1)) {
		const span = slabSpan(ctx, top);
		const lacksPower = span ? Array.from({ length: span.x1 - span.x0 + 1 }, (_, k) => state.power[cellIdx(state, span.x0 + k, top)]).some((p) => p === 0) : false;
		const lacksLift = !state.lifts.some((l) => l.floorMin <= top && top <= l.floorMax);
		if (lacksPower || lacksLift) return finishFloor(ctx, top, top - 1, canSpend) ? `Built out floor ${top}` : null;
	}
	if (top + 1 > state.floorMax) return null;
	const below = slabSpan(ctx, top);
	if (!below) return null;
	if (!guarded(ctx, { type: "buildSlab", floor: top + 1, x0: below.x0, x1: below.x1 }, canSpend)) return null;
	finishFloor(ctx, top + 1, top, canSpend);
	return `Added floor ${top + 1}`;
}

/** Add (or finish) a basement under the lowest floor, for generators and grid ties. */
export function expandDown(ctx: TickCtx, canSpend: CanSpend): string | null {
	const { state } = ctx;
	const floors = builtFloors(ctx);
	const low = floors[0];
	if (low === undefined || low > 0) return null;
	if (low < 0 && floors.includes(low + 1)) {
		const span = slabSpan(ctx, low);
		const lacksPower = span ? Array.from({ length: span.x1 - span.x0 + 1 }, (_, k) => state.power[cellIdx(state, span.x0 + k, low)]).some((p) => p === 0) : false;
		const lacksLift = !state.lifts.some((l) => l.floorMin <= low && low <= l.floorMax);
		if (lacksPower || lacksLift) return finishFloor(ctx, low, low + 1, canSpend) ? `Built out basement ${low}` : null;
	}
	if (low - 1 < state.floorMin) return null;
	const above = slabSpan(ctx, low);
	if (!above) return null;
	if (!guarded(ctx, { type: "buildSlab", floor: low - 1, x0: above.x0, x1: above.x1 }, canSpend)) return null;
	finishFloor(ctx, low - 1, low, canSpend);
	return `Dug basement ${low - 1}`;
}
