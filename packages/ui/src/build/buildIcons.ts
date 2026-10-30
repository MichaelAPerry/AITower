import type { SheetCell } from "../achievements/sheets";

/**
 * Which cell of the build-icon sheets shows each facility. One list per sheet, in the sheet's cell order (row-major, 64 px cells;
 * trailing empty plates are not listed). The order is the order of `facilities.json` filtered by `kind`, as in the icon prompts:
 *   build_racks   6x4  kind rack
 *   build_power   6x4  grid_tie, genset, ups, solar, wind, bioreactor
 *   build_cooling 6x3  crah, chiller, cdu
 *   build_support 5x3  nutrient, sterilizer, quarantine, heat_export, carbon, depot, charger, transfer
 * The test (buildIcons.test.ts) fails when a facility has no cell, so a new facility needs a new icon or an explicit decision.
 */
export const BUILD_SHEETS: { sheet: string; cols: number; ids: string[] }[] = [
	{
		sheet: "build_racks",
		cols: 6,
		ids: [
			"rack_air_gpu", "rack_dlc_gpu", "rack_storage", "rack_air_gpu2", "rack_dlc_gpu2", "rack_dlc_gpu3",
			"rack_infer", "rack_storage2", "organoid_incubator", "dna_vault", "neural_pit", "growth_mass",
			"growth_cyst", "growth_lobe", "rack_neuromorphic", "rack_photonic", "rack_mind_lattice", "backup_vault",
			"rack_organoid_2", "rack_organoid_3", "rack_neuromorphic2", "rack_photonic2",
		],
	},
	{
		sheet: "build_power",
		cols: 6,
		ids: [
			"grid_tie", "genset", "ups_battery", "grid_tie_2", "grid_tie_3", "genset_gas",
			"ups_flywheel", "ups_bank_big", "bioreactor", "solar_skin", "solar_canopy", "wind_mast",
			"continuity_monitor", "grid_tie_4", "genset_cc", "reactor_smr", "biogas_digester", "fuel_cell",
			"ups_iron_air", "geothermal", "grid_tie_lucy", "microgrid_bea",
		],
	},
	{
		sheet: "build_cooling",
		cols: 6,
		ids: [
			"crah_unit", "chiller", "cdu", "crah_rear_door", "crah_hc", "chiller_tower",
			"cdu_big", "chiller_free", "cryo_core", "cdu_hall", "cryo_plant", "perfusion_bath",
			"perfusion_manifold", "vascular_plant", "crah_econ", "crah_adiabatic", "ice_store", "cold_room",
		],
	},
	{
		sheet: "build_support",
		cols: 5,
		ids: [
			"parts_depot", "bot_charger", "depot_big", "charger_fast", "nutrient_plant",
			"sterile_bay", "culling_room", "quarantine_lock", "heat_exchanger", "heat_pipeline",
			"algae_facade", "carbon_capture", "nutrient_works", "consciousness_transfer",
		],
	},
];

/** Facility id to its sheet cell. */
export const BUILD_ICONS: Record<string, SheetCell> = Object.fromEntries(
	BUILD_SHEETS.flatMap(({ sheet, cols, ids }) => ids.map((id, i) => [id, { sheet, col: i % cols, row: Math.floor(i / cols) }] as const)),
);

/** The icon cell for a facility, or undefined (the card then shows its colour swatch). */
export const buildIcon = (facilityId: string): SheetCell | undefined => BUILD_ICONS[facilityId];
