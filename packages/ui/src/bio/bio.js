import { fmtPct } from "../format";
/** Wording for the current intensity: Compute Authority euphemism (full, mild) or plain words (off). */
export function bioWords(h) {
    if (h === "off")
        return { gauge: "CONTAMINATION", contamination: "Contamination", overlayButton: "Contam.", grown: "Growth", overlayLegend: "Contamination per cell" };
    return { gauge: "ASSET GROWTH INDEX", contamination: "Growth index", overlayButton: "Growth", grown: "Unregistered asset", overlayLegend: "Asset growth index per cell" };
}
export function organoidBand(spec) {
    const { targetC: t, toleranceC: k } = spec;
    return { targetC: t, lo: t - k, hi: t + k, slowLo: t - 2 * k, slowHi: t + 2 * k, failLo: t - 3 * k, failHi: t + 3 * k };
}
const deg = (c) => `${Math.round(c * 10) / 10} °C`;
/** "37 °C ±3": the band as printed in the spec sheet. */
export function bandText(spec) {
    return `${deg(spec.targetC)} ±${Math.round(spec.toleranceC * 10) / 10}`;
}
/** Where `tempC` sits in the organoid band: full speed, slowed, or failing. */
export function tissueState(tempC, spec) {
    const b = organoidBand(spec);
    if (tempC >= b.lo && tempC <= b.hi)
        return { kind: "inBand", side: null, text: `In band (${deg(b.lo)} to ${deg(b.hi)}): full speed` };
    const side = tempC < b.lo ? "cold" : "hot";
    const failing = tempC < b.failLo || tempC > b.failHi;
    if (failing)
        return { kind: "failing", side, text: `Too ${side}: the tissue is failing (band ${deg(b.lo)} to ${deg(b.hi)})` };
    return { kind: "slow", side, text: `Too ${side}: slowed (band ${deg(b.lo)} to ${deg(b.hi)})` };
}
/** Classification of a mutated bot. Full/mild: "reclassified" (Schedule F / T). Off: plain. */
export function traitInfo(trait, h) {
    if (h === "off") {
        return trait === "fleshed"
            ? { label: "Mutated: fleshed", effect: "Repairs faster but contaminates where it works." }
            : { label: "Mutated: tendriled", effect: "Carries more parts but never rides lifts." };
    }
    return trait === "fleshed"
        ? { label: "Reclassified: Schedule F", effect: "Repairs faster. Leaves residue where it works." }
        : { label: "Reclassified: Schedule T", effect: "Carries more parts. Declines to use lifts." };
}
/** Short trait name for event text ("Schedule F" / "fleshed"). */
export const traitName = (trait, h) => (h === "off" ? trait : trait === "fleshed" ? "Schedule F" : "Schedule T");
// ─── HUD: corruption gauge and memo stain ────────────────────────────────────
/**
 * The top-bar gauge shows once any corruption exists, or from Clearance 3 on. On the Greentech and Synthetic paths it
 * gives way to the path's own gauge and returns only if corruption is actually above zero.
 */
export const showGrowthGauge = (view) => {
    if ((view.corruption ?? 0) > 0)
        return true;
    return view.tier >= 3 && view.path !== "greentech" && view.path !== "synthetic";
};
/** Gauge tooltip. */
export function growthTitle(view, h) {
    const pct = fmtPct(view.corruption ?? 0, 0);
    return h === "off"
        ? `Corruption ${pct}. It rises with contamination and with organoid racks.`
        : `Asset Growth Index ${pct}. The Compute Authority classes any figure as within tolerance.`;
}
/** How stained the memo slip is. Off: never. Mild: half as much (a faint stain only, at a higher corruption). */
export function memoStain(corruption, h) {
    if (h === "off")
        return "none";
    if (h === "mild")
        return corruption >= 0.6 ? "faint" : "none";
    return corruption >= 0.75 ? "heavy" : corruption >= 0.4 ? "faint" : "none";
}
/** Display name of a facility in the dossier: grown ones are unregistered assets. */
export function facilityName(content, defId, grown, h) {
    const name = content.facilities[defId]?.name ?? defId;
    return grown ? bioWords(h).grown : name;
}
