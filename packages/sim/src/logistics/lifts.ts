/**
 * Lift cars: one car per shaft, SCAN ("elevator algorithm") dispatch over hall calls (waiting bots)
 * and rider destinations. Moves `speed` floors/tick, doors stay open `dwellTicks`, carries
 * `capacity` bots. Unpowered lifts (no net or satisfaction < 0.5) freeze.
 */
import type { TickCtx } from "../core/context";
import { EPS, MIN_POWERED_SATISFACTION } from "../core/constants";
import { findById } from "../core/grid";
import type { Lift, SimState } from "../core/state";

/** Where a rider gets off: its route's exit floor, kept inside the shaft so a bad value cannot strand it. */
const exitOf = (lift: Lift, b: { exitFloor: number }): number => Math.min(lift.floorMax, Math.max(lift.floorMin, Math.round(b.exitFloor)));

/**
 * Floors the car must visit: riders' exits, plus hall calls while there is room. A full car ignores calls (it cannot
 * board anyone), otherwise it would reopen its doors at a crowded floor forever instead of delivering its riders.
 */
function stopsFor(state: SimState, lift: Lift, capacity: number): Set<number> {
	const stops = new Set<number>();
	for (const id of lift.riders) {
		const b = findById(state.bots, id);
		if (b) stops.add(exitOf(lift, b));
	}
	if (lift.riders.length < capacity) for (const b of state.bots) if (b.leg === "waitLift" && b.liftId === lift.id) stops.add(b.floor);
	return stops;
}

/** Unload riders for this floor and board waiting bots (FIFO by bot id) up to capacity. */
function exchange(ctx: TickCtx, lift: Lift, floor: number): void {
	const { state, content } = ctx;
	lift.riders = lift.riders.filter((id) => {
		const b = findById(state.bots, id);
		if (!b) return false;
		if (exitOf(lift, b) !== floor) return true;
		b.floor = floor;
		b.x = lift.x;
		b.leg = "walk";
		b.liftId = -1;
		return false;
	});
	for (const b of state.bots) {
		if (lift.riders.length >= content.lift.capacity) break;
		if (b.leg !== "waitLift" || b.liftId !== lift.id || b.floor !== floor) continue;
		b.leg = "ride";
		lift.riders.push(b.id);
	}
}

function openDoors(ctx: TickCtx, lift: Lift, floor: number): void {
	lift.carFloor = floor;
	lift.doorsOpen = true;
	lift.doorTimer = ctx.content.lift.dwellTicks;
	ctx.events.push({ type: "liftArrived", liftId: lift.id, floor });
	exchange(ctx, lift, floor);
}

function stepLift(ctx: TickCtx, lift: Lift): void {
	if (lift.powerNet < 0 || lift.sat < MIN_POWERED_SATISFACTION) return;
	if (lift.doorsOpen) {
		const floor = Math.round(lift.carFloor);
		exchange(ctx, lift, floor);
		lift.doorTimer--;
		if (lift.doorTimer <= 0) lift.doorsOpen = false;
		return;
	}
	const stops = stopsFor(ctx.state, lift, ctx.content.lift.capacity);
	if (stops.size === 0) {
		lift.dir = 0;
		return;
	}
	const cur = lift.carFloor;
	const atFloor = Math.abs(cur - Math.round(cur)) < EPS;
	if (atFloor && stops.has(Math.round(cur))) {
		openDoors(ctx, lift, Math.round(cur));
		return;
	}
	let above = Number.POSITIVE_INFINITY;
	let below = Number.NEGATIVE_INFINITY;
	for (const s of stops) {
		if (s > cur + EPS && s < above) above = s;
		if (s < cur - EPS && s > below) below = s;
	}
	const hasAbove = Number.isFinite(above);
	const hasBelow = Number.isFinite(below);
	if (lift.dir === 1 && !hasAbove) lift.dir = hasBelow ? -1 : 0;
	else if (lift.dir === -1 && !hasBelow) lift.dir = hasAbove ? 1 : 0;
	else if (lift.dir === 0) {
		if (hasAbove && hasBelow) lift.dir = above - cur <= cur - below ? 1 : -1;
		else lift.dir = hasAbove ? 1 : -1;
	}
	if (lift.dir === 0) return;
	const target = lift.dir === 1 ? above : below;
	const next = cur + lift.dir * ctx.content.lift.speed;
	if (lift.dir * (target - next) <= EPS) openDoors(ctx, lift, target);
	else lift.carFloor = next;
}

export function stepLifts(ctx: TickCtx): void {
	for (const lift of ctx.state.lifts) {
		stepLift(ctx, lift);
		for (const id of lift.riders) {
			const b = findById(ctx.state.bots, id);
			if (b) {
				b.floor = lift.carFloor;
				b.x = lift.x;
			}
		}
	}
}
