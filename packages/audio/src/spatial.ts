/**
 * Pure spatial helpers: pan and attenuate a one-shot by where it happened
 * relative to the listener. The contract has no camera, so the engine
 * approximates the listener from the facilities (see `listenerFromView`).
 */
import type { SimEvent, SimView } from "@aitower/sim";

export interface Spot {
	/** Tile column (fractional allowed). */
	x: number;
	floor: number;
}

export interface Spatial {
	/** -1 (left) .. 1 (right). */
	pan: number;
	/** 0..1 distance attenuation. */
	gain: number;
}

export const SPATIAL = {
	/** Columns from the listener at which the pan reaches `maxPan`. */
	panSpanCols: 14,
	maxPan: 0.8,
	/** Attenuation per column / per floor away. */
	colFalloff: 0.012,
	floorFalloff: 0.06,
	/** Distant sounds never fall below this (the tower is not that big). */
	minGain: 0.4,
} as const;

const finite = (v: number): number => (Number.isFinite(v) ? v : 0);

/** Pan (equal-ish, clamped) and distance gain of a sound at `pos` heard from `listener`. */
export function spatialParams(pos: Spot, listener: Spot): Spatial {
	const dx = finite(pos.x) - finite(listener.x);
	const df = Math.abs(finite(pos.floor) - finite(listener.floor));
	const S = SPATIAL;
	const pan = Math.max(-S.maxPan, Math.min(S.maxPan, (dx / S.panSpanCols) * S.maxPan));
	const gain = Math.max(S.minGain, 1 - Math.abs(dx) * S.colFalloff - df * S.floorFalloff);
	return { pan, gain };
}

export const CENTRE: Spatial = { pan: 0, gain: 1 };

/** Where the listener is assumed to be: the centroid of the built facilities, else the middle of the grid. */
export function listenerFromView(view: Pick<SimView, "facilities" | "width" | "floorMin" | "floorMax">): Spot {
	const fs = view.facilities ?? [];
	if (fs.length === 0) return { x: finite(view.width) / 2, floor: (finite(view.floorMin) + finite(view.floorMax)) / 2 };
	let x = 0;
	let floor = 0;
	for (const f of fs) {
		x += f.x + (f.width ?? 1) / 2;
		floor += f.floor;
	}
	return { x: x / fs.length, floor: floor / fs.length };
}

/** World position of an event, or null if it has none (it then plays centred). */
export function eventSpot(e: SimEvent, view: Pick<SimView, "facilities" | "lifts">): Spot | null {
	switch (e.type) {
		case "rackTripped":
		case "rackRecovered":
		case "componentFailed":
		case "repaired":
		case "gensetStarted":
		case "gensetStopped":
		case "autoBuilt":
		case "growthSprouted": {
			const f = (view.facilities ?? []).find((q) => q.id === e.facilityId);
			return f ? { x: f.x + (f.width ?? 1) / 2, floor: f.floor } : null;
		}
		case "built":
		case "demolished":
			return { x: e.x, floor: e.floor };
		case "liftArrived": {
			const l = (view.lifts ?? []).find((q) => q.id === e.liftId);
			return l ? { x: l.x, floor: e.floor } : null;
		}
		default:
			return null;
	}
}

/** Pan/gain for an event heard from `listener` (centred full volume when it has no position). */
export function spatialForEvent(e: SimEvent, view: Pick<SimView, "facilities" | "lifts">, listener: Spot): Spatial {
	const spot = eventSpot(e, view);
	return spot ? spatialParams(spot, listener) : CENTRE;
}
