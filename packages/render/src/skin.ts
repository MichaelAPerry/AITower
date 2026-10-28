/**
 * Staged path reskins (M3-T3b). Every ascension path re-skins every device at 25 / 50 / 75 / 100 % of its path score:
 * Biotech turns fleshy (score = `view.corruption`, applied even before the path is chosen), Greentech grows moss, fungus, plants
 * and fish and Synthetic Mind grows more refined (score = `view.pathScore`).
 * Pure: `pathSkin` picks path and stage, `skinEffects` says what a device kind shows at a stage.
 */
import type { AscensionPath, FacilityKind } from "@aitower/content";
import { clamp01 } from "./color";

export type SkinStage = 0 | 1 | 2 | 3 | 4;
export type SkinPath = AscensionPath;

/** Share of the path score at which stages 1..4 begin (25 / 50 / 75 / 100 %; 100 % allows for float and cap rounding). */
export const STAGE_AT: readonly [number, number, number, number] = [0.25, 0.5, 0.75, 0.98];

export const stageOf = (score: number): SkinStage => {
	const s = Number.isFinite(score) ? score : 0;
	let st = 0;
	for (let i = 0; i < STAGE_AT.length; i++) if (s >= STAGE_AT[i]) st = i + 1;
	return st as SkinStage;
};

export interface PathSkin {
	path: SkinPath | null;
	stage: SkinStage;
	/** 0..1 path score the stage came from. */
	score: number;
}

/** What `pathSkin` reads of a `SimView`. */
export type SkinInput = { path: AscensionPath | null; corruption: number; pathScore?: number };

/** Score of a path: biotech reads `corruption`; greentech and Synthetic Mind read `view.pathScore` (greenScore / refinement). */
export const pathScore = (path: AscensionPath, v: SkinInput): number => (path === "biotech" ? clamp01(v.corruption) : clamp01(v.pathScore ?? 0));

/**
 * The active skin. Biotech wins when chosen, and also applies before any path is chosen once corruption has started
 * (the Wetware tier seeds it). Another chosen path shows its own score and never the biotech skin.
 */
export const pathSkin = (v: SkinInput): PathSkin => {
	const path: SkinPath | null = v.path ?? (clamp01(v.corruption) > 0 ? "biotech" : null);
	if (path === null) return { path: null, stage: 0, score: 0 };
	const score = pathScore(path, v);
	return { path, stage: stageOf(score), score };
};

/**
 * Effects a device can show. Biotech: damp .. tissue. Greentech: moss, fungus (the quiet horror: spores and gills), vines,
 * plants, tank (a fish tank), garden. Synthetic Mind: lines, glass, panels, light.
 */
export type SkinEffect =
	| "damp"
	| "pulse"
	| "veins"
	| "flesh"
	| "bile"
	| "breathe"
	| "eyes"
	| "tissue"
	| "moss"
	| "fungus"
	| "vines"
	| "plants"
	| "tank"
	| "garden"
	| "lines"
	| "glass"
	| "panels"
	| "light";

/** Effects each biotech stage adds (cumulative): 25 % damp + pulse, 50 % veins + flesh + bile, 75 % breathe + eyes, 100 % tissue. */
export const BIOTECH_STAGES: readonly (readonly SkinEffect[])[] = [["damp", "pulse"], ["veins", "flesh", "bile"], ["breathe", "eyes"], ["tissue"]];

type DeviceClass = FacilityKind | "growth";

/** Which effects a device kind responds to at all (a device "stays the same" at stages that add nothing it responds to). */
const RESPONDS: Record<DeviceClass, readonly SkinEffect[]> = {
	rack: ["damp", "pulse", "veins", "flesh", "breathe", "eyes", "tissue"],
	crah: ["damp", "pulse", "veins", "flesh", "breathe", "tissue"],
	chiller: ["damp", "bile", "veins", "tissue"],
	cdu: ["damp", "bile", "veins", "tissue"],
	grid_tie: ["damp", "veins", "tissue"],
	genset: ["damp", "pulse", "veins", "tissue"],
	ups: ["damp", "pulse", "bile", "tissue"],
	depot: ["damp", "flesh", "tissue"],
	charger: ["damp", "pulse", "tissue"],
	nutrient: ["damp", "pulse", "veins", "bile", "breathe", "tissue"],
	bioreactor: ["damp", "pulse", "veins", "flesh", "breathe", "eyes", "tissue"],
	// The clean devices hold out: sterile bays and quarantine locks only give way at the very end.
	sterilizer: ["damp", "tissue"],
	quarantine: ["damp", "tissue"],
	// Green kinds: biotech barely touches them (tissue and damp only).
	solar: ["damp", "tissue"],
	wind: ["damp", "tissue"],
	heat_export: ["damp", "veins", "tissue"],
	carbon: ["damp", "flesh", "tissue"],
	transfer: ["damp", "pulse"],
	// Growths are already tissue.
	growth: ["pulse", "veins", "breathe", "eyes"],
};

/** Greentech stages: 25 % moss on edges, 50 % fungus shelves and vines on conduits, 75 % plants out of devices and fish tanks in coolant loops, 100 % a living green tower. */
export const GREEN_STAGES: readonly (readonly SkinEffect[])[] = [["moss"], ["fungus", "vines"], ["plants", "tank"], ["garden"]];

/** Synthetic Mind stages: finer light lines, brighter glass, monolithic panels, then light-only geometry. */
export const SYNTH_STAGES: readonly (readonly SkinEffect[])[] = [["lines"], ["glass"], ["panels"], ["light"]];

const ALL_SYNTH: readonly SkinEffect[] = ["lines", "glass", "panels", "light"];

/** Which greentech effects a device class responds to ("stays the same" at stages that add nothing it responds to). */
const GREEN_RESPONDS: Record<DeviceClass, readonly SkinEffect[]> = {
	rack: ["moss", "fungus", "plants", "garden"],
	crah: ["moss", "fungus", "vines", "plants", "garden"],
	chiller: ["moss", "vines", "tank", "garden"],
	cdu: ["moss", "vines", "tank", "garden"],
	grid_tie: ["moss", "vines"],
	genset: ["moss", "garden"],
	ups: ["moss", "vines"],
	depot: ["moss", "fungus", "plants", "garden"],
	charger: ["moss", "plants"],
	nutrient: ["moss", "fungus", "plants", "garden"],
	bioreactor: ["moss", "fungus", "garden"],
	// The clean devices hold out.
	sterilizer: ["moss"],
	quarantine: ["moss"],
	// Green devices are already half there: they take the living tower, not the first stages.
	solar: ["moss", "plants", "garden"],
	wind: ["moss", "vines"],
	heat_export: ["moss", "vines", "plants", "garden"],
	carbon: ["fungus", "tank", "garden"],
	transfer: ["moss"],
	growth: [],
};

/** Which synthetic effects a device class responds to. */
const SYNTH_RESPONDS: Record<DeviceClass, readonly SkinEffect[]> = {
	rack: ALL_SYNTH,
	crah: ["lines", "glass", "light"],
	chiller: ["lines", "glass", "light"],
	cdu: ["lines", "glass", "light"],
	grid_tie: ["lines", "panels", "light"],
	genset: ["lines", "panels", "light"],
	ups: ["lines", "glass", "panels", "light"],
	depot: ["lines", "glass", "light"],
	charger: ["lines", "glass", "light"],
	nutrient: ["lines", "glass", "light"],
	bioreactor: ["lines", "glass", "light"],
	sterilizer: ALL_SYNTH,
	quarantine: ALL_SYNTH,
	solar: ["lines", "glass", "light"],
	wind: ["lines", "light"],
	heat_export: ["lines", "glass", "light"],
	carbon: ["lines", "glass", "light"],
	transfer: ["lines", "light"],
	growth: [],
};

/** Per-path table: for each device class, the effects it shows at each stage (index 0 = stage 1). */
export const skinTable = (path: SkinPath, kind: DeviceClass): readonly (readonly SkinEffect[])[] => {
	const [stages, responds]: [readonly (readonly SkinEffect[])[], Record<DeviceClass, readonly SkinEffect[]>] =
		path === "biotech" ? [BIOTECH_STAGES, RESPONDS] : path === "greentech" ? [GREEN_STAGES, GREEN_RESPONDS] : [SYNTH_STAGES, SYNTH_RESPONDS];
	const ok = responds[kind] ?? [];
	return stages.map((s) => s.filter((e) => ok.includes(e)));
};


/** Effects shown by a device kind at `skin` (cumulative up to the stage; empty at stage 0 or without a path). */
export const skinEffects = (skin: Pick<PathSkin, "path" | "stage">, kind: DeviceClass): ReadonlySet<SkinEffect> => {
	const out = new Set<SkinEffect>();
	if (skin.path === null) return out;
	const t = skinTable(skin.path, kind);
	for (let i = 0; i < skin.stage; i++) for (const e of t[i]) out.add(e);
	return out;
};

/** Whether a device changes when going from stage `stage - 1` to `stage` (false = it stays the same). */
export const changesAt = (path: SkinPath, kind: DeviceClass, stage: 1 | 2 | 3 | 4): boolean => skinTable(path, kind)[stage - 1].length > 0;
