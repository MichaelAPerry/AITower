/**
 * Pure rules of the M4 green kinds (solar, wind, heat export, carbon) and the greentech decals: daylight, a cosmetic wind
 * level, rotor phase, and which cells carry moss, vines, fish tanks and roof plants at a skin stage. Draws nothing:
 * `pixi/greenArt.ts` and `pixi/greenDecals.ts` read the results.
 */
import { clamp01 } from "./color";
import { hash2 } from "./horror";
import type { SkinStage } from "./skin";

/** Same shape as the sim: dark from 20:00 to 06:00, a sine over the day peaking at 13:00. */
export const DAYLIGHT_START = 360;
export const DAYLIGHT_END = 1200;

export const daylight = (minuteOfDay: number): number => {
	const m = Number.isFinite(minuteOfDay) ? ((minuteOfDay % 1440) + 1440) % 1440 : 0;
	if (m <= DAYLIGHT_START || m >= DAYLIGHT_END) return 0;
	return Math.sin((Math.PI * (m - DAYLIGHT_START)) / (DAYLIGHT_END - DAYLIGHT_START));
};

/** Share of the daylight output a drought leaves (the real factor is content-defined; this only dims the art). */
export const DROUGHT_DIM = 0.15;

/** Solar panel brightness 0..1: daylight, dimmed by a drought, zero when the panel is not producing. */
export const solarGlow = (minuteOfDay: number, drought: boolean, usable: boolean): number => (usable ? daylight(minuteOfDay) * (drought ? DROUGHT_DIM : 1) : 0);

/**
 * Cosmetic wind level 0.2..1 (the sim's hourly wind range): a smooth blend between hashed hourly values. The sim does not
 * expose the real wind, so the rotors follow this deterministic stand-in; a drought and an unusable mast stop them.
 */
export const windLevel = (tick: number, drought: boolean, usable: boolean): number => {
	if (!usable || drought || !Number.isFinite(tick)) return 0;
	const h = Math.max(0, tick) / 60;
	const i = Math.floor(h);
	const u = h - i;
	const s = u * u * (3 - 2 * u);
	const a = hash2(i, 41);
	const b = hash2(i + 1, 41);
	return 0.2 + 0.8 * (a + (b - a) * s);
};

/** Rotor angular speed in rad/s for a wind level (0 = stopped). */
export const rotorOmega = (level: number): number => 3.2 * clamp01(level);

/** Integrates rotor phase per mast so a changing speed never makes the blades jump. Reused across frames (no allocation once seen). */
export class RotorPhases {
	private phase = new Map<number, number>();
	private last = new Map<number, number>();

	/** Phase (radians) of mast `id` at time `t` seconds turning at `omega`. */
	at(id: number, t: number, omega: number): number {
		const p = this.phase.get(id) ?? hash2(id, 5) * Math.PI * 2;
		const l = this.last.get(id);
		const dt = l === undefined ? 0 : Math.min(0.25, Math.max(0, t - l));
		const n = p + omega * dt;
		this.phase.set(id, n);
		this.last.set(id, t);
		return n;
	}
}

// ─── Decals (static, per cell) ─────────────────────────────────────────

/** Share of eligible cells that carry a decal at a stage. */
export const MOSS_DENSITY: readonly number[] = [0, 0.3, 0.45, 0.6, 0.8];
export const VINE_DENSITY: readonly number[] = [0, 0, 0.18, 0.3, 0.5];
export const TANK_DENSITY: readonly number[] = [0, 0, 0, 0.12, 0.2];
/** Roof garden planters on the top floor (stage 4 only). */
export const ROOF_DENSITY: readonly number[] = [0, 0, 0, 0, 0.7];

const at = (table: readonly number[], stage: SkinStage): number => table[stage] ?? 0;

/** Does cell (x, floor) carry the decal `salt` at `stage`? Deterministic, so a stage only adds cells. */
export const cellHas = (table: readonly number[], stage: SkinStage, x: number, floor: number, salt: number): boolean => hash2(x * 31 + salt, floor * 17 + salt) < at(table, stage);

/** Solar kind variants: a façade panel field, or (6+ tiles) a tilted rooftop canopy on stilts. */
export type SolarVariant = "facade" | "canopy";
export const solarVariant = (width: number): SolarVariant => (width >= 6 ? "canopy" : "facade");
/** Heat export: an exchanger, or (5+ tiles) the long pipeline. */
export type HeatVariant = "exchanger" | "pipeline";
export const heatVariant = (width: number): HeatVariant => (width >= 5 ? "pipeline" : "exchanger");
/** Carbon: an algae façade of tubes, or (5+ tiles) the capture plant with a stack. */
export type CarbonVariant = "algae" | "plant";
export const carbonVariant = (width: number): CarbonVariant => (width >= 5 ? "plant" : "algae");
/** Masts side by side in a wind facility: one per 2 tiles (at least 1); each carries two stacked rotors. */
export const mastCount = (width: number): number => Math.max(1, Math.floor(width / 2));
