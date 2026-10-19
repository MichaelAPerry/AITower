/**
 * Pure rules for in-world failure feedback: which facility states trigger which effect, which floor cells have
 * their lights out / flickering, and where an overloaded coolant net leaks. `pixi/feedback.ts` draws the result.
 */
import type { FacilityStatus, SimView } from "@aitower/sim";
import { floorTop } from "./camera";
import { CABLE_Y, PIPE_H, PIPE_RETURN_Y, TILE } from "./constants";

/** Used when content has no `balance.thermal.tripC`. */
export const DEFAULT_TRIP_C = 95;
/** A failed rack this close to (or above) the trip temperature caught fire. */
export const FIRE_MARGIN_C = 3;

export interface FacilityFx {
	/** Tripped: steam burst vented from the cabinet. */
	steam: boolean;
	/** Tripped: red strobe over the cabinet. */
	strobe: boolean;
	/** Failed: a wrench left on the cabinet. */
	wrench: boolean;
	/** Failed: sparks. */
	sparks: boolean;
	/** Failed and hot (>= tripC - FIRE_MARGIN_C): a small fire. */
	fire: boolean;
	/** Fire gives off smoke. */
	smoke: boolean;
	/** On a power net with satisfaction 0 (blackout): emergency lamps. */
	blackout: boolean;
	/** On a power net with 0 < satisfaction < 1 (brownout): lights flicker. */
	brownout: boolean;
}

export const NO_FX: Readonly<FacilityFx> = {
	steam: false,
	strobe: false,
	wrench: false,
	sparks: false,
	fire: false,
	smoke: false,
	blackout: false,
	brownout: false,
};

/** Which effects a facility triggers, given its status, temperature and its power net's satisfaction (null = no net). */
export const facilityFx = (f: { status: FacilityStatus; tempC: number }, netSatisfaction: number | null, tripC = DEFAULT_TRIP_C): FacilityFx => {
	const failed = f.status === "failed";
	const fire = failed && f.tempC >= tripC - FIRE_MARGIN_C;
	return {
		steam: f.status === "tripped",
		strobe: f.status === "tripped",
		wrench: failed,
		sparks: failed,
		fire,
		smoke: fire,
		blackout: netSatisfaction !== null && netSatisfaction <= 0,
		brownout: netSatisfaction !== null && netSatisfaction > 0 && netSatisfaction < 1,
	};
};

export const hasAnyFx = (fx: FacilityFx): boolean => Object.values(fx).some(Boolean);

// ─── Lights ─────────────────────────────────────────────────────────────

export interface LightRun {
	floor: number;
	/** First tile and one past the last tile. */
	x0: number;
	x1: number;
	/** 0 = lights out (blackout), otherwise the net satisfaction in (0, 1) (brownout). */
	satisfaction: number;
}

/**
 * Horizontal runs of power-conduit cells whose net has satisfaction < 1, per floor (floor lights live on the
 * conduit run). Runs split where satisfaction changes. Nets at 1 (or unknown) produce nothing.
 */
export const lightRuns = (view: Pick<SimView, "width" | "floorMin" | "floorMax" | "powerNetOf" | "powerNets">): LightRun[] => {
	const sat = new Map<number, number>();
	for (const n of view.powerNets) if (n.satisfaction < 1) sat.set(n.id, Math.max(0, n.satisfaction));
	const out: LightRun[] = [];
	if (sat.size === 0) return out;
	for (let f = view.floorMin; f <= view.floorMax; f++) {
		let run: LightRun | null = null;
		for (let x = 0; x < view.width; x++) {
			const s = sat.get(view.powerNetOf[(f - view.floorMin) * view.width + x]);
			if (s !== undefined && run && run.satisfaction === s && run.x1 === x) run.x1 = x + 1;
			else {
				if (run) out.push(run);
				run = s === undefined ? null : { floor: f, x0: x, x1: x + 1, satisfaction: s };
			}
		}
		if (run) out.push(run);
	}
	return out;
};

// ─── Coolant leaks ──────────────────────────────────────────────────────

/** Coolant nets over capacity (`loadKw > capacityKw`). */
export const overloadedCoolantNets = (view: Pick<SimView, "coolantNets">): Set<number> => {
	const s = new Set<number>();
	for (const n of view.coolantNets) if (n.loadKw > n.capacityKw) s.add(n.id);
	return s;
};

export interface LeakDrip {
	/** World px of the leaking joint. */
	x: number;
	y: number;
	/** World y the drop lands on (the facility's top when one stands below). */
	floorY: number;
	floor: number;
}

/**
 * One leak per conduit cell of every overloaded coolant net (via `coolantNetOf`), at a deterministic x inside the
 * tile. `occupied(x, floor)` says whether a facility stands there; its drops land on top of the cabinet instead.
 */
export const leakDrips = (
	view: Pick<SimView, "width" | "floorMin" | "floorMax" | "coolant" | "coolantNetOf" | "coolantNets">,
	occupied: (x: number, floor: number) => boolean,
	facTopOffset: number,
): LeakDrip[] => {
	const bad = overloadedCoolantNets(view);
	const out: LeakDrip[] = [];
	if (bad.size === 0) return out;
	for (let f = view.floorMin; f <= view.floorMax; f++) {
		const top = floorTop(view, f);
		for (let x = 0; x < view.width; x++) {
			const i = (f - view.floorMin) * view.width + x;
			if (view.coolant[i] !== 1 || !bad.has(view.coolantNetOf[i])) continue;
			out.push({
				x: x * TILE + 3 + ((x * 5 + f * 3) & 7),
				y: top + PIPE_RETURN_Y + PIPE_H,
				floorY: top + (occupied(x, f) ? facTopOffset : CABLE_Y),
				floor: f,
			});
		}
	}
	return out;
};
