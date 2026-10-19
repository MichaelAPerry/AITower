/** Creation / removal of world entities, keeping grid occupancy and cross-references consistent. */
import type { ContentDB } from "@aitower/content";
import { cellIdx, findById, removeById } from "../core/grid";
import { type Bot, type Facility, GensetMode, type Lift, type SimState } from "../core/state";
import { getDef, serviceTile } from "./defs";

export function addFacility(state: SimState, content: ContentDB, defId: string, floor: number, x: number): Facility {
	const d = getDef(content, defId);
	const id = state.nextId.facility++;
	const tempC = state.airTemp[cellIdx(state, x, floor)];
	const f: Facility = {
		id,
		defId,
		floor,
		x,
		width: d.width,
		enabled: true,
		powerNet: -1,
		coolantNet: -1,
		sat: 0,
		demandKw: 0,
		powerKw: 0,
		heatKw: 0,
		tempC,
		busy: false,
		thermalClock: 1,
		clock: 0,
		pflops: 0,
		health: 1,
		jobId: -1,
		failed: false,
		tripped: false,
		cooldown: -1,
		throttled: false,
		noCoolant: false,
		coolantC: content.balance.thermal.coolantSupplyC,
		gensetMode: GensetMode.Off,
		gensetTimer: 0,
		surplusTicks: 0,
		storedKwh: 0,
		stored: 0,
		charging: false,
	};
	for (let i = 0; i < d.width; i++) state.facilityAt[cellIdx(state, x + i, floor)] = id;
	state.facilities.push(f);
	state.netsDirty = true;
	state.topologyRev++;
	return f;
}

/** Remove a facility and detach everything that referenced it. */
export function removeFacility(state: SimState, content: ContentDB, f: Facility): void {
	for (let i = 0; i < f.width; i++) state.facilityAt[cellIdx(state, f.x + i, f.floor)] = -1;
	removeById(state.facilities, f.id);
	state.netsDirty = true;
	state.topologyRev++;
	// Job allocations referencing it are released (with rollback) by the next compute step.
	// Work orders on it (bots notice the missing order and drop the task).
	state.workOrders = state.workOrders.filter((w) => w.facilityId !== f.id);
	// Bots homed at a removed charger look for another one.
	for (const b of state.bots) if (b.homeId === f.id) b.homeId = findChargerWithSpace(state, content);
}

/** Lowest-id enabled charger with a free dock, or -1. */
export function findChargerWithSpace(state: SimState, content: ContentDB): number {
	for (const f of state.facilities) {
		const d = getDef(content, f.defId);
		if (d.kind !== "charger") continue;
		const cap = d.logistics?.capacity ?? 0;
		let homed = 0;
		for (const b of state.bots) if (b.homeId === f.id) homed++;
		if (homed < cap) return f.id;
	}
	return -1;
}

export function addLift(state: SimState, x: number, floorMin: number, floorMax: number): Lift {
	const lift: Lift = {
		id: state.nextId.lift++,
		x,
		floorMin,
		floorMax,
		powerNet: -1,
		sat: 0,
		carFloor: floorMin,
		dir: 0,
		doorsOpen: false,
		doorTimer: 0,
		riders: [],
	};
	for (let fl = floorMin; fl <= floorMax; fl++) state.liftAt[cellIdx(state, x, fl)] = lift.id;
	state.lifts.push(lift);
	state.netsDirty = true;
	state.topologyRev++;
	return lift;
}

export function removeLift(state: SimState, lift: Lift): void {
	for (let fl = lift.floorMin; fl <= lift.floorMax; fl++) state.liftAt[cellIdx(state, lift.x, fl)] = -1;
	removeById(state.lifts, lift.id);
	state.netsDirty = true;
	state.topologyRev++;
	const stop = Math.min(lift.floorMax, Math.max(lift.floorMin, Math.round(lift.carFloor)));
	for (const b of state.bots) {
		if (b.liftId !== lift.id) continue;
		if (b.leg === "ride") {
			b.floor = stop;
			b.x = lift.x;
		}
		b.leg = "walk";
		b.liftId = -1;
		b.goalId = -1; // forces a re-plan
	}
}

export function addBot(state: SimState, defId: string, floor: number, x: number, homeId: number): Bot {
	const bot: Bot = {
		id: state.nextId.bot++,
		defId,
		x,
		floor,
		battery: 1,
		carrying: false,
		parts: 0,
		task: "none",
		leg: "walk",
		goalId: -1,
		goalX: x,
		goalFloor: floor,
		liftId: -1,
		workOrderId: -1,
		homeId,
		timer: 0,
		exitFloor: floor,
		stuck: 0,
		retryAt: 0,
		fails: 0,
		routeRev: state.topologyRev,
	};
	state.bots.push(bot);
	return bot;
}

/** Position of a charger's dock tile. */
export function chargerSpot(state: SimState, chargerId: number): { x: number; floor: number } | null {
	const f = findById(state.facilities, chargerId);
	return f ? { x: serviceTile(f), floor: f.floor } : null;
}
