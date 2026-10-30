/**
 * PC-98 art (docs/ART_BRIEFS.md): advisor busts in four expressions, full portraits, and the title and tree-floor backdrops.
 * Sources were quantised to 32 colours (48 for backdrops) and stored as lossless WebP.
 */
import luci_neutral from "./luci-neutral.webp";
import luci_pleased from "./luci-pleased.webp";
import luci_displeased from "./luci-displeased.webp";
import luci_unsettling from "./luci-unsettling.webp";
import luci_full from "./luci-full.webp";
import mel_neutral from "./mel-neutral.webp";
import mel_pleased from "./mel-pleased.webp";
import mel_displeased from "./mel-displeased.webp";
import mel_unsettling from "./mel-unsettling.webp";
import mel_full from "./mel-full.webp";
import bea_neutral from "./bea-neutral.webp";
import bea_pleased from "./bea-pleased.webp";
import bea_displeased from "./bea-displeased.webp";
import bea_unsettling from "./bea-unsettling.webp";
import bea_full from "./bea-full.webp";
import cass_neutral from "./cass-neutral.webp";
import cass_pleased from "./cass-pleased.webp";
import cass_displeased from "./cass-displeased.webp";
import cass_unsettling from "./cass-unsettling.webp";
import cass_full from "./cass-full.webp";
import bg_title from "./bg-title.webp";
import bg_bio from "./bg-bio.webp";
import bg_green from "./bg-green.webp";
import bg_synth from "./bg-synth.webp";

export type ArtAdvisor = "luci" | "mel" | "bea" | "cass";
export type Expression = "neutral" | "pleased" | "displeased" | "unsettling";

export const PORTRAITS: Record<ArtAdvisor, Record<Expression, string>> = {
	luci: { neutral: luci_neutral, pleased: luci_pleased, displeased: luci_displeased, unsettling: luci_unsettling },
	mel: { neutral: mel_neutral, pleased: mel_pleased, displeased: mel_displeased, unsettling: mel_unsettling },
	bea: { neutral: bea_neutral, pleased: bea_pleased, displeased: bea_displeased, unsettling: bea_unsettling },
	cass: { neutral: cass_neutral, pleased: cass_pleased, displeased: cass_displeased, unsettling: cass_unsettling },
};

export const FULL: Record<ArtAdvisor, string> = { luci: luci_full, mel: mel_full, bea: bea_full, cass: cass_full };

/** Backdrops: the title skyline and the three tree floors (B-3 Bio, C-4 Green, D-2 Synthetic). */
export const BACKDROP = { title: bg_title, biotech: bg_bio, greentech: bg_green, synthetic: bg_synth } as const;
export type BackdropId = keyof typeof BACKDROP;

/**
 * Ending paintings by the `art` name in endings.json (docs/ENDING_PROMPTS.md). Until a new painting is dropped in and imported
 * here, the three tree endings borrow their tree floor (`bg-synth`, `bg-bio`, `bg-green`); Absorbed and Bankrupt have no entry,
 * so they show the plain stage.
 */
export const ENDING_ART: Record<string, string | undefined> = {
	"bg-end-lattice": bg_synth,
	"bg-end-flesh": bg_bio,
	"bg-end-garden": bg_green,
};

/** The backdrop image of an ending, or undefined for the plain stage. */
export const endingBackdrop = (e: { art?: string; backdrop?: BackdropId }): string | undefined => (e.art && e.art in ENDING_ART ? ENDING_ART[e.art] : e.backdrop ? BACKDROP[e.backdrop] : undefined);
