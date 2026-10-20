import { clamp01 } from "./color";
/** Share of the path score at which stages 1..4 begin (25 / 50 / 75 / 100 %; 100 % allows for float and cap rounding). */
export const STAGE_AT = [0.25, 0.5, 0.75, 0.98];
export const stageOf = (score) => {
    const s = Number.isFinite(score) ? score : 0;
    let st = 0;
    for (let i = 0; i < STAGE_AT.length; i++)
        if (s >= STAGE_AT[i])
            st = i + 1;
    return st;
};
/** Score of a path: biotech reads `corruption`; greentech and Synthetic Mind read `view.pathScore` (greenScore / refinement). */
export const pathScore = (path, v) => (path === "biotech" ? clamp01(v.corruption) : clamp01(v.pathScore ?? 0));
/**
 * The active skin. Biotech wins when chosen, and also applies before any path is chosen once corruption has started
 * (the Wetware tier seeds it). Another chosen path shows its own score and never the biotech skin.
 */
export const pathSkin = (v) => {
    const path = v.path ?? (clamp01(v.corruption) > 0 ? "biotech" : null);
    if (path === null)
        return { path: null, stage: 0, score: 0 };
    const score = pathScore(path, v);
    return { path, stage: stageOf(score), score };
};
/** Effects each biotech stage adds (cumulative): 25 % damp + pulse, 50 % veins + flesh + bile, 75 % breathe + eyes, 100 % tissue. */
export const BIOTECH_STAGES = [["damp", "pulse"], ["veins", "flesh", "bile"], ["breathe", "eyes"], ["tissue"]];
/** Which effects a device kind responds to at all (a device "stays the same" at stages that add nothing it responds to). */
const RESPONDS = {
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
    // Growths are already tissue.
    growth: ["pulse", "veins", "breathe", "eyes"],
};
/** Greentech stages: 25 % moss on edges, 50 % fungus shelves and vines on conduits, 75 % plants out of devices and fish tanks in coolant loops, 100 % a living green tower. */
export const GREEN_STAGES = [["moss"], ["fungus", "vines"], ["plants", "tank"], ["garden"]];
/** Synthetic Mind stages: finer light lines, brighter glass, monolithic panels, then light-only geometry. */
export const SYNTH_STAGES = [["lines"], ["glass"], ["panels"], ["light"]];
const ALL_SYNTH = ["lines", "glass", "panels", "light"];
/** Which greentech effects a device class responds to ("stays the same" at stages that add nothing it responds to). */
const GREEN_RESPONDS = {
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
    growth: [],
};
/** Which synthetic effects a device class responds to. */
const SYNTH_RESPONDS = {
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
    growth: [],
};
/** Per-path table: for each device class, the effects it shows at each stage (index 0 = stage 1). */
export const skinTable = (path, kind) => {
    const [stages, responds] = path === "biotech" ? [BIOTECH_STAGES, RESPONDS] : path === "greentech" ? [GREEN_STAGES, GREEN_RESPONDS] : [SYNTH_STAGES, SYNTH_RESPONDS];
    const ok = responds[kind] ?? [];
    return stages.map((s) => s.filter((e) => ok.includes(e)));
};
/** Effects shown by a device kind at `skin` (cumulative up to the stage; empty at stage 0 or without a path). */
export const skinEffects = (skin, kind) => {
    const out = new Set();
    if (skin.path === null)
        return out;
    const t = skinTable(skin.path, kind);
    for (let i = 0; i < skin.stage; i++)
        for (const e of t[i])
            out.add(e);
    return out;
};
/** Whether a device changes when going from stage `stage - 1` to `stage` (false = it stays the same). */
export const changesAt = (path, kind, stage) => skinTable(path, kind)[stage - 1].length > 0;
