/**
 * Pure helpers for the Biotech / body-horror layer of the HUD: wording per `horrorIntensity`, the organoid temperature
 * band, bot traits, the corruption gauge and the memo stain.
 *
 * The Ministry never acknowledges the horror: growths are "assets", a mutated bot is "reclassified", contamination is an
 * "asset growth index". `horrorIntensity: "off"` keeps every mechanic and switches to plain wording.
 */
import type { ContentDB, OrganoidSpec } from "@aitower/content";
import type { HorrorIntensity } from "@aitower/shared";
import type { BotTrait, SimView } from "@aitower/sim";
import { fmtPct } from "../format";

export interface BioWords {
	/** Top-bar gauge label. */
	gauge: string;
	/** Dossier row and overlay name for the contamination field. */
	contamination: string;
	/** Short overlay button label. */
	overlayButton: string;
	/** What a grown facility is called. */
	grown: string;
	/** Legend title of the contamination overlay. */
	overlayLegend: string;
}

/** Wording for the current intensity: Ministry euphemism (full, mild) or plain words (off). */
export function bioWords(h: HorrorIntensity): BioWords {
	if (h === "off") return { gauge: "CONTAMINATION", contamination: "Contamination", overlayButton: "Contam.", grown: "Growth", overlayLegend: "Contamination per cell" };
	return { gauge: "ASSET GROWTH INDEX", contamination: "Growth index", overlayButton: "Growth", grown: "Unregistered asset", overlayLegend: "Asset growth index per cell" };
}

// ─── Organoid temperature band ───────────────────────────────────────────────

export interface OrganoidBand {
	targetC: number;
	/** Full speed between these. */
	lo: number;
	hi: number;
	/** The clock falls off linearly to the minimum at these. */
	slowLo: number;
	slowHi: number;
	/** Beyond these the tissue fails. */
	failLo: number;
	failHi: number;
}

export function organoidBand(spec: OrganoidSpec): OrganoidBand {
	const { targetC: t, toleranceC: k } = spec;
	return { targetC: t, lo: t - k, hi: t + k, slowLo: t - 2 * k, slowHi: t + 2 * k, failLo: t - 3 * k, failHi: t + 3 * k };
}

const deg = (c: number): string => `${Math.round(c * 10) / 10} °C`;

/** "37 °C ±3": the band as printed in the spec sheet. */
export function bandText(spec: OrganoidSpec): string {
	return `${deg(spec.targetC)} ±${Math.round(spec.toleranceC * 10) / 10}`;
}

export type TissueKind = "inBand" | "slow" | "failing";

export interface TissueState {
	kind: TissueKind;
	/** Which side of the band it is on (null in band). */
	side: "cold" | "hot" | null;
	/** One line for the dossier. */
	text: string;
}

/** Where `tempC` sits in the organoid band: full speed, slowed, or failing. */
export function tissueState(tempC: number, spec: OrganoidSpec): TissueState {
	const b = organoidBand(spec);
	if (tempC >= b.lo && tempC <= b.hi) return { kind: "inBand", side: null, text: `In band (${deg(b.lo)} to ${deg(b.hi)}): full speed` };
	const side = tempC < b.lo ? "cold" : "hot";
	const failing = tempC < b.failLo || tempC > b.failHi;
	if (failing) return { kind: "failing", side, text: `Too ${side}: the tissue is failing (band ${deg(b.lo)} to ${deg(b.hi)})` };
	return { kind: "slow", side, text: `Too ${side}: slowed (band ${deg(b.lo)} to ${deg(b.hi)})` };
}

// ─── Bot traits ───────────────────────────────────────────────────────────────

export interface TraitInfo {
	/** Pill text. */
	label: string;
	/** What it does, in the words of the intensity. */
	effect: string;
}

/** Classification of a mutated bot. Full/mild: "reclassified" (Schedule F / T). Off: plain. */
export function traitInfo(trait: BotTrait, h: HorrorIntensity): TraitInfo {
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
export const traitName = (trait: BotTrait, h: HorrorIntensity): string => (h === "off" ? trait : trait === "fleshed" ? "Schedule F" : "Schedule T");

// ─── HUD: corruption gauge and memo stain ────────────────────────────────────

/** The top-bar gauge shows once any corruption exists, or from Clearance 3 on. */
export const showGrowthGauge = (view: Pick<SimView, "corruption" | "tier">): boolean => (view.corruption ?? 0) > 0 || view.tier >= 3;

/** Gauge tooltip. */
export function growthTitle(view: Pick<SimView, "corruption" | "contaminatedShare">, h: HorrorIntensity): string {
	const pct = fmtPct(view.corruption ?? 0, 0);
	return h === "off"
		? `Corruption ${pct}. It rises with contamination and with organoid racks.`
		: `Asset Growth Index ${pct}. The Ministry regards any figure as satisfactory.`;
}

export type Stain = "none" | "faint" | "heavy";

/** How stained the memo slip is. Off: never. Mild: half as much (a faint stain only, at a higher corruption). */
export function memoStain(corruption: number, h: HorrorIntensity): Stain {
	if (h === "off") return "none";
	if (h === "mild") return corruption >= 0.6 ? "faint" : "none";
	return corruption >= 0.75 ? "heavy" : corruption >= 0.4 ? "faint" : "none";
}

/** Display name of a facility in the dossier: grown ones are unregistered assets. */
export function facilityName(content: ContentDB, defId: string, grown: boolean, h: HorrorIntensity): string {
	const name = content.facilities[defId]?.name ?? defId;
	return grown ? bioWords(h).grown : name;
}
