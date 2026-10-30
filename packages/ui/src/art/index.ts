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
import bg_end_lattice from "./bg-end-lattice.webp";
import bg_loc_f1_lot from "./bg-loc-f1-lot.webp";
import bg_end_flesh from "./bg-end-flesh.webp";
import bg_end_garden from "./bg-end-garden.webp";
import bg_end_absorbed from "./bg-end-absorbed.webp";
import bg_end_bankrupt from "./bg-end-bankrupt.webp";
import bg_loc_site_install from "./bg-loc-site-install.webp";
import bg_loc_control_room from "./bg-loc-control-room.webp";
import bg_loc_finance_office from "./bg-loc-finance-office.webp";
import bg_loc_plant_room from "./bg-loc-plant-room.webp";
import bg_loc_floor_f2 from "./bg-loc-floor-f2.webp";
import bg_loc_wetware_annex from "./bg-loc-wetware-annex.webp";
import bg_loc_nutrient_line from "./bg-loc-nutrient-line.webp";
import bg_loc_neural_pit from "./bg-loc-neural-pit.webp";
import bg_loc_panel_deck from "./bg-loc-panel-deck.webp";
import bg_loc_stairwell from "./bg-loc-stairwell.webp";
import bg_loc_sunrise from "./bg-loc-sunrise.webp";

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
 * Ending paintings by the `art` name in endings.json (docs/ENDING_PROMPTS.md). An ending whose name has no entry here falls back
 * to its tree floor (`backdrop`), else the plain stage.
 */
export const ENDING_ART: Record<string, string | undefined> = {
	"bg-end-lattice": bg_end_lattice,
	"bg-end-flesh": bg_end_flesh,
	"bg-end-garden": bg_end_garden,
	"bg-end-absorbed": bg_end_absorbed,
	"bg-end-bankrupt": bg_end_bankrupt,
};

/**
 * Story-location paintings (docs/ART_NEEDED.md), keyed by file name without extension. Add an entry (static import) when a
 * painting is dropped in; scenes whose file is absent fall back to the tree backdrop (or the plain stage).
 */
export const LOCATION_FILES: Record<string, string | undefined> = {
	"bg-loc-f1-lot": bg_loc_f1_lot,
	"bg-loc-site-install": bg_loc_site_install,
	"bg-loc-control-room": bg_loc_control_room,
	"bg-loc-finance-office": bg_loc_finance_office,
	"bg-loc-plant-room": bg_loc_plant_room,
	"bg-loc-floor-f2": bg_loc_floor_f2,
	"bg-loc-wetware-annex": bg_loc_wetware_annex,
	"bg-loc-nutrient-line": bg_loc_nutrient_line,
	"bg-loc-neural-pit": bg_loc_neural_pit,
	"bg-loc-panel-deck": bg_loc_panel_deck,
	"bg-loc-stairwell": bg_loc_stairwell,
	"bg-loc-sunrise": bg_loc_sunrise,
};

/** Scene id -> location painting name (HANDOFF "Art slots"). Only names present in LOCATION_FILES resolve to an image. */
export const LOCATION_ART: Record<string, string> = {
	st_intro: "bg-loc-f1-lot",
	obj_greentech: "bg-loc-site-install",
	obj_biotech: "bg-loc-site-install",
	rung_syn_1: "bg-loc-control-room",
	rung_syn_2: "bg-loc-finance-office",
	rung_syn_3: "bg-loc-plant-room",
	rung_green_2: "bg-loc-plant-room",
	rung_syn_4: "bg-loc-floor-f2",
	rung_bio_1: "bg-loc-wetware-annex",
	rung_bio_2: "bg-loc-wetware-annex",
	rung_bio_3: "bg-loc-nutrient-line",
	rung_bio_4: "bg-loc-neural-pit",
	rung_green_1: "bg-loc-panel-deck",
	rung_green_3: "bg-loc-stairwell",
	rung_green_4: "bg-loc-sunrise",
	cass_night_shift: "bg-loc-plant-room",
	seal_biotech: "bg-loc-wetware-annex",
	seal_greentech: "bg-loc-panel-deck",
	bond50_luci: "bg-loc-finance-office",
	bond50_mel: "bg-loc-wetware-annex",
	bond50_bea: "bg-loc-panel-deck",
	bond50_cass: "bg-loc-plant-room",
};

/** The painting for a scene: its location file if one exists, else the tree backdrop, else undefined (plain stage). */
export const sceneBackdrop = (sceneId: string, tree?: BackdropId, files: Record<string, string | undefined> = LOCATION_FILES): string | undefined => {
	const name = LOCATION_ART[sceneId];
	return (name && files[name]) || (tree ? BACKDROP[tree] : undefined);
};

/** The backdrop image of an ending, or undefined for the plain stage. */
export const endingBackdrop = (e: { art?: string; backdrop?: BackdropId }): string | undefined => (e.art && e.art in ENDING_ART ? ENDING_ART[e.art] : e.backdrop ? BACKDROP[e.backdrop] : undefined);
