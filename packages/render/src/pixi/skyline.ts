/**
 * Pure skyline planning: which buildings stand in one silhouette tile for a given Level (`view.tier`) and path stage.
 * Deterministic (seeded; never Math.random) and free of Pixi, so it is cheap to test. `skylineArt.ts` draws the plan.
 */
import type { SkinPath, SkinStage } from "../skin";

export const CITY_SPAN = 1024; // world px per silhouette tile

export function rand(seed: number): () => number {
	let s = seed >>> 0;
	return () => {
		s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
		return s / 4294967296;
	};
}

export interface SkyStyle {
	/** Level, 1..5 (clamped). */
	tier: number;
	path: SkinPath | null;
	stage: SkinStage;
}

export interface SkyBuilding {
	x: number;
	w: number;
	/** Main slab height above the horizon. */
	h: number;
	/** 0 cantilevered block, 1 setback + stair core, 2 plain. */
	kind: 0 | 1 | 2;
	/** Height of the cantilever block (kind 0). */
	extra: number;
	/** Antenna mast height, 0 for none. */
	mast: number;
	/** Searchlight on the roof. */
	beam: boolean;
	/** Construction crane: 0 none, otherwise the jib's direction (1 right, -1 left). */
	crane: 0 | 1 | -1;
	/** Wind turbine on the roof (Greentech). */
	turbine: boolean;
	/** Share of strip-window cells that are lit. */
	lit: number;
	/** Gets the path's decoration. */
	deco: boolean;
	/** Seed for this building's own details (windows, growths). */
	seed: number;
	sign: boolean;
}

export const tierFrac = (tier: number): number => Math.min(1, Math.max(0, ((Number.isFinite(tier) ? tier : 1) - 1) / 4));
/** Share of buildings that wear the path look at a stage 0..4. */
export const DECO_AT: readonly number[] = [0, 0.25, 0.5, 0.75, 0.95];
/** Cumulative crane chance per tier 1..5 on the near layer. */
const CRANE_AT: readonly number[] = [0, 0, 0.12, 0.2, 0.3];

export const styleKey = (s: SkyStyle): string => `${Math.min(5, Math.max(1, Math.round(s.tier)))}${s.path?.[0] ?? "-"}${s.stage}`;

export function planCity(seed: number, minH: number, maxH: number, withSign: boolean, style: SkyStyle, far = false): SkyBuilding[] {
	const f = tierFrac(style.tier);
	const tier = Math.min(5, Math.max(1, Math.round(style.tier)));
	const hScale = 0.62 + 0.66 * f; // Level 1 low-rise .. Level 5 high-rise
	const gapMax = Math.round(10 - 6 * f);
	const decoP = style.path ? DECO_AT[style.stage] * (far ? 0.7 : 1) : 0;
	const r = rand(seed);
	const out: SkyBuilding[] = [];
	let x = 0;
	let i = 0;
	while (x < CITY_SPAN - 20) {
		const sign = withSign && i === 3;
		// A fixed number of rolls per building, so the plan stays steady when only the style changes.
		const rw = r();
		const rh = r();
		const rk = r();
		const re = r();
		const rm = r();
		const rmh = r();
		const rb = r();
		const rc = r();
		const rd = r();
		const rg = r();
		const w = sign ? 116 : 22 + Math.floor(rw * 46);
		const h = sign ? Math.max(48, Math.floor(maxH * hScale) - 10) : Math.floor((minH + rh * (maxH - minH)) * hScale);
		const kind = (rk < 0.35 ? 0 : rk < 0.6 ? 1 : 2) as 0 | 1 | 2;
		const crane = !far && !sign && rc < CRANE_AT[tier - 1] ? ((rg < 0.5 ? 1 : -1) as 1 | -1) : 0;
		out.push({
			x,
			w,
			h,
			kind,
			extra: 14 + Math.floor(re * 18),
			mast: !sign && !crane && rm < 0.45 ? 10 + Math.floor(rmh * (18 + 10 * f)) : 0,
			beam: !sign && rb < 0.18,
			crane,
			turbine: style.path === "greentech" && style.stage >= 2 && !sign && !crane && rd < 0.5 && h > 40,
			lit: 0.1 + 0.34 * f,
			deco: rd < decoP,
			seed: (seed * 31 + i * 7919) >>> 0,
			sign,
		});
		x += w + 2 + Math.floor(rg * gapMax);
		i++;
	}
	return out;
}
