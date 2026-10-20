/**
 * Pure rules of the M3 body-horror overlay pipeline. Everything here is a function of
 * (the biotech skin stage from `skin.ts`, `view.corruption`, `RenderOptions.horrorIntensity`, time) and draws nothing: `pixi/horror.ts` and the
 * facility / bot / background art read the results. Horror is wrongness, never gore: lamps out of step, damp,
 * veins, breathing walls, eyes that follow the cursor, tissue creeping over the slabs and a sign that says
 * another word. `mild` halves the alpha and drops eyes and faces; `off` disables all of it.
 */
import type { HorrorIntensity } from "@aitower/shared";
import type { FacilityStatus } from "@aitower/sim";
import { clamp01, lerpColor } from "./color";
import { STAGE_AT, type SkinPath, type SkinStage } from "./skin";
import { CB, T, dk, lt, mix } from "./palette";

// ─── Stage selection ──────────────────────────────────────────────────

export interface HorrorStages {
	intensity: HorrorIntensity;
	/** Skin stage in force (0 when off or no biotech skin). */
	stage: SkinStage;
	/** Alpha multiplier for every horror layer: 1 full, 0.5 mild, 0 off. */
	alpha: number;
	/** Stage 1 (25 %): lamps and organoids pulse faintly out of sync. */
	lamps: boolean;
	/** Stage 1: damp stains and sweating cooling pipes. */
	damp: boolean;
	/** Stage 2 (50 %): veined conduits and surfaces, flesh-tone panels, bile coolant return. */
	veined: boolean;
	/** Stage 3 (75 %): breathing walls and housings. */
	breathing: boolean;
	/** Stage 3 (full only): eyes in the status lights, faces, a second eye on mutated bots. */
	eyes: boolean;
	/** Stage 4 (100 %): devices are tissue and the slabs creep. */
	tissue: boolean;
	/** Stage 4: the MINISTRY sign flickers to another word. */
	sign: boolean;
	/** 0..1 growth of the veined stage above its threshold (drives coverage and tint). */
	amount: number;
	/** 0..1 coverage of the slabs by tissue (0 before stage 4). */
	creep: number;
}

const OFF: HorrorStages = {
	intensity: "off",
	stage: 0,
	alpha: 0,
	lamps: false,
	damp: false,
	veined: false,
	breathing: false,
	eyes: false,
	tissue: false,
	sign: false,
	amount: 0,
	creep: 0,
};

/**
 * Which horror layers are active for a biotech skin stage (`skin.ts`: the stage and the 0..1 score it came from).
 * `mild` halves the alpha and drops eyes and faces; `off` disables everything (the plain synthetic look).
 */
export const horrorStages = (stage: SkinStage, score: number, intensity: HorrorIntensity): HorrorStages => {
	if (intensity === "off") return OFF;
	const c = Number.isFinite(score) ? score : 0;
	const full = intensity === "full";
	return {
		intensity,
		stage,
		alpha: full ? 1 : 0.5,
		lamps: stage >= 1,
		damp: stage >= 1,
		veined: stage >= 2,
		breathing: stage >= 3,
		eyes: full && stage >= 3,
		tissue: stage >= 4,
		sign: stage >= 4,
		amount: clamp01((c - STAGE_AT[1]) / (1 - STAGE_AT[1])),
		creep: stage >= 4 ? Math.max(0.5, clamp01((c - STAGE_AT[2]) / (1 - STAGE_AT[2]))) : 0,
	};
};

/** Cache key of everything the static decal layer depends on (amount and creep quantised so it rebuilds rarely). */
export const horrorKey = (s: HorrorStages): string =>
	[s.alpha, +s.lamps, +s.damp, +s.veined, +s.breathing, +s.eyes, +s.tissue, Math.round(s.amount * 8), Math.round(s.creep * 16)].join(",");

/** True when any horror layer would draw. */
export const horrorActive = (s: HorrorStages): boolean => s.alpha > 0 && (s.lamps || s.damp || s.veined || s.breathing || s.eyes || s.tissue || s.sign);

// ─── Dither masks ─────────────────────────────────────────────────────

/** 4×4 Bayer matrix (0..15): ordered dither, so creep never reads as a smooth gradient. */
export const BAYER4: readonly number[] = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Whether block (bx, by) is filled at `density` 0..1 (ordered dither; 0 = none, 1 = all). */
export const ditherOn = (bx: number, by: number, density: number): boolean => {
	const d = clamp01(density);
	if (d <= 0) return false;
	if (d >= 1) return true;
	return (BAYER4[((by & 3) << 2) | (bx & 3)] + 0.5) / 16 < d;
};

/** Small integer hash in [0,1) (same mixing as `pixi/draw.ts`, kept here so this module stays pure). */
export const hash2 = (a: number, b: number): number => {
	let h = Math.imul(a + 0x9e37, 0x85ebca6b) ^ Math.imul(b + 0x7f4a, 0xc2b2ae35);
	h ^= h >>> 15;
	h = Math.imul(h, 0x2c1b3c6d);
	h ^= h >>> 12;
	return (h >>> 0) / 4294967296;
};

/**
 * Tissue mask: is 2×2 block (bx, by) of slab cell (cx, floor) covered at creep `creep` (0..1)? Coverage varies per cell
 * so the tissue starts in patches, then closes up; dithered inside a cell.
 */
export const creepBlock = (cx: number, floor: number, bx: number, by: number, creep: number): boolean => {
	if (creep <= 0) return false;
	const local = 0.25 + 0.75 * hash2(cx * 7 + 3, floor * 13 + 5);
	return ditherOn(bx + cx * 3, by + floor, creep * (0.4 + 0.9 * local));
};

// ─── Lamps, eyes, breathing, sign ─────────────────────────────────────

/**
 * T2+: each lamp pulses on its own period and phase, so a row of lamps drifts out of step. Returns a brightness factor
 * 1 (full) down to 0.55 (full intensity) / 0.775 (mild); always 1 when disabled, and a fixed 1 under reduced motion.
 */
export const lampFactor = (s: HorrorStages, id: number, lamp: number, t: number, reducedMotion: boolean): number => {
	if (!s.lamps || s.alpha <= 0 || reducedMotion) return 1;
	const period = 1.3 + 0.9 * hash2(id, lamp * 5 + 1);
	const phase = hash2(lamp + 11, id);
	const level = 0.5 + 0.5 * Math.sin(Math.PI * 2 * (t / period + phase));
	return 1 - 0.45 * s.alpha * (1 - level);
};

/** Wainscot breathing frame (0/1): two frames at 0.2 Hz (2.5 s each); frame 0 held under reduced motion. */
export const breathFrame = (t: number, reducedMotion: boolean): 0 | 1 => (reducedMotion ? 0 : Math.floor(t / 2.5) % 2 === 0 ? 0 : 1);

/** Sky sign text: "MINISTRY", or a flicker to "HUNGRY" at the tissue stage (stage 4, never under reduced motion). */
export const SIGN_WORD = "MINISTRY";
export const SIGN_ALT = "HUNGRY";
export const signWord = (s: HorrorStages, t: number, reducedMotion: boolean): string => {
	if (!s.sign || s.alpha <= 0 || reducedMotion) return SIGN_WORD;
	const p = ((t % 9) + 9) % 9;
	return (p >= 6 && p < 6.12) || (p >= 6.25 && p < 6.37) || (p >= 6.55 && p < 7.2) ? SIGN_ALT : SIGN_WORD;
};

export type CrtMotif = "none" | "eyes" | "face";

/**
 * What a status light strip shows instead of its glow. Needs the `eyes` stage (so never at mild or off); faults keep their red
 * alarm; the share of screens affected grows with corruption; about one in five of those is a face.
 */
export const crtMotif = (s: HorrorStages, seed: number, score: number, fault: boolean): CrtMotif => {
	if (!s.eyes || fault) return "none";
	const share = 0.25 + 0.6 * clamp01((score - STAGE_AT[2]) / (1 - STAGE_AT[2]));
	if (hash2(seed, 77) >= share) return "none";
	return hash2(seed, 91) < 0.2 ? "face" : "eyes";
};

export interface Pupil {
	dx: -1 | 0 | 1;
	dy: -1 | 0 | 1;
}

/** Which way an eye at (ex, ey) looks toward the cursor (cx, cy), in world px; centred inside `dead` px or without a cursor. */
export const pupilOffset = (ex: number, ey: number, cx: number | null, cy: number | null, dead = 6): Pupil => {
	if (cx === null || cy === null) return { dx: 0, dy: 0 };
	const dx = cx - ex;
	const dy = cy - ey;
	return { dx: Math.abs(dx) < dead ? 0 : dx < 0 ? -1 : 1, dy: Math.abs(dy) < dead ? 0 : dy < 0 ? -1 : 1 };
};

/** Frame-rate independent ease of `cur` toward `target` (`rate` per second): slow, so the eyes "slowly track". */
export const easeToward = (cur: number, target: number, dt: number, rate = 1.4): number => cur + (target - cur) * (1 - Math.exp(-rate * Math.max(0, dt)));

/** Eyes blink only while the game is paused (about every 2.4 s, 0.25 s closed, per-seed phase); otherwise they stare. */
export const eyeClosed = (t: number, paused: boolean, seed: number): boolean => {
	if (!paused) return false;
	const p = (((t + hash2(seed, 5) * 2.4) % 2.4) + 2.4) % 2.4;
	return p < 0.25;
};

// ─── Overlay colour ramps ─────────────────────────────────────────────

/** Contamination heat-map stops (0 = clean): bile, then flesh, then a brightened blood. Dither density carries the magnitude. */
const CONTAM_STOPS: readonly (readonly [number, number])[] = [
	[0, mix(T.bile, T.ink, 0.35)],
	[0.4, T.bile],
	[0.7, T.flesh],
	[1, lt(T.blood, 0.3)],
];
/** Colour-blind contamination ramp: dark blue to orange to paper (blue / orange are the Okabe-Ito colour-blind tokens). */
const CONTAM_STOPS_CB: readonly (readonly [number, number])[] = [
	[0, dk(CB.blue, 0.5)],
	[0.4, CB.blue],
	[0.7, CB.orange],
	[1, T.paper],
];

const rampAt = (stops: readonly (readonly [number, number])[], v: number): number => {
	const x = clamp01(v);
	for (let i = 1; i < stops.length; i++) {
		if (x <= stops[i][0]) {
			const [x0, c0] = stops[i - 1];
			const [x1, c1] = stops[i];
			return lerpColor(c0, c1, (x - x0) / (x1 - x0));
		}
	}
	return stops[stops.length - 1][1];
};

/** Colour of a contamination value 0..1. */
export const contaminationColor = (v: number, colorBlind = false): number => rampAt(colorBlind ? CONTAM_STOPS_CB : CONTAM_STOPS, v);

/** Dither density of a contamination value: nothing below 0.02, then 0.15..1. */
export const contaminationDensity = (v: number): number => (v < 0.02 ? 0 : 0.15 + 0.85 * clamp01(v));

/** One data texel is 2×2 world px: a 16×48 cell is 8×24 texels. */
export const TEXEL = 2;
export const TEXELS_X = 8;
export const TEXELS_Y = 24;

export interface ContamTexture {
	width: number;
	height: number;
	/** RGBA, row-major, top row = `floorMax`. Transparent where the dither is off. */
	data: Uint8ClampedArray<ArrayBuffer>;
}

/**
 * Builds the contamination field as dithered RGBA texels (the data-texture approach: one texture for the whole tower
 * instead of a rect per pixel). Values blend smoothly between cell centres, then an ordered dither decides each texel,
 * so the field reads as a stippled heat map rather than a gradient. Cells without a slab count as clean.
 */
export const contaminationTexels = (
	width: number,
	floorMin: number,
	floorMax: number,
	contamination: ArrayLike<number>,
	slab: ArrayLike<number>,
	colorBlind = false,
	alpha = 0.82,
): ContamTexture => {
	const floors = floorMax - floorMin + 1;
	const w = width * TEXELS_X;
	const h = floors * TEXELS_Y;
	const data = new Uint8ClampedArray(new ArrayBuffer(w * h * 4));
	const cell = (x: number, row: number): number => {
		if (x < 0 || x >= width || row < 0 || row >= floors) return 0;
		const i = (floorMax - row - floorMin) * width + x;
		return slab[i] ? clamp01(contamination[i] ?? 0) : 0;
	};
	const a8 = Math.round(255 * clamp01(alpha));
	for (let ty = 0; ty < h; ty++) {
		const row = Math.floor(ty / TEXELS_Y);
		// Position between cell centres, vertically and horizontally.
		const fy = (ty % TEXELS_Y) + 0.5 - TEXELS_Y / 2;
		const r1 = fy < 0 ? row - 1 : row + 1;
		const ky = Math.abs(fy) / TEXELS_Y;
		for (let tx = 0; tx < w; tx++) {
			const cx = Math.floor(tx / TEXELS_X);
			const fx = (tx % TEXELS_X) + 0.5 - TEXELS_X / 2;
			const c1 = fx < 0 ? cx - 1 : cx + 1;
			const kx = Math.abs(fx) / TEXELS_X;
			const top = cell(cx, row) * (1 - kx) + cell(c1, row) * kx;
			const bot = cell(cx, r1) * (1 - kx) + cell(c1, r1) * kx;
			const v = top * (1 - ky) + bot * ky;
			// Never bleed onto cells that have no slab.
			if (!slab[(floorMax - row - floorMin) * width + cx]) continue;
			if (!ditherOn(tx, ty, contaminationDensity(v))) continue;
			const c = contaminationColor(v, colorBlind);
			const o = (ty * w + tx) * 4;
			data[o] = (c >> 16) & 0xff;
			data[o + 1] = (c >> 8) & 0xff;
			data[o + 2] = c & 0xff;
			data[o + 3] = a8;
		}
	}
	return { width: w, height: h, data };
};

/** Nutrient pipe / net tints: bile with a per-net nudge so separate nets read apart. */
export const nutrientNetColor = (id: number): number => lt(mix(T.bile, [T.verdigris, T.amber, T.paper, T.flesh][((id % 4) + 4) % 4], 0.28), 0.18);

/**
 * Nutrient satisfaction of a facility for the overlay, 0 (starved) .. 1 (fed): the satisfaction of its nutrient net, 0 without
 * a net, and never above 0.4 while the facility itself reports `noNutrient`.
 */
export const nutrientSatisfaction = (net: { satisfaction: number } | undefined, status: FacilityStatus): number => {
	if (!net) return 0;
	const s = clamp01(net.satisfaction);
	return status === "noNutrient" ? Math.min(0.4, s) : s;
};

// ─── Per-frame inputs of the facility art ─────────────────────────────

/** What facility / bot art needs per frame to draw the horror layers: stages, path score, cursor in world px, paused. */
export interface LiveFx {
	stages: HorrorStages;
	/** Path score 0..1 (corruption for the biotech skin). */
	score: number;
	stage: SkinStage;
	cursor: { x: number; y: number } | null;
	paused: boolean;
	/** Greentech / synthetic skin in force (undefined = none): its stage and the horror alpha that tones the fungus (0 off, 0.5 mild, 1 full). */
	pskin?: { path: SkinPath; stage: SkinStage; horror: number };
	/** Game clock for the green kinds: minute of day and tick (cosmetic daylight and wind), and whether a drought is in force. */
	minute?: number;
	tick?: number;
	drought?: boolean;
}

/** No horror: the plain synthetic look at full intensity (what the art tests and old callers get). */
export const NO_FX: LiveFx = { stages: horrorStages(0, 0, "full"), score: 0, stage: 0, cursor: null, paused: false };

/** Wetware art that is alive on its own (pulsing jars) holds still when horror is off. */
export const isPlain = (fx: LiveFx): boolean => fx.stages.intensity === "off";
