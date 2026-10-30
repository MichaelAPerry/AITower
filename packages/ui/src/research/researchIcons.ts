import type { SheetCell } from "../achievements/sheets";

/**
 * Which cell of the research-icon sheets shows each technology. One list per sheet, in the sheet's cell order (row-major, 64 px cells;
 * trailing empty plates are not listed). The order is the order of `tech.json` filtered by `branch` (file order, branches interleaved):
 *   research_power             6x4  power
 *   research_compute_admin     6x4  compute, administration
 *   research_cooling_logistics 6x3  cooling, logistics
 *   research_wetware           5x3  wetware
 * The test (researchIcons.test.ts) fails when a technology has no cell, so a new technology needs a new icon or an explicit decision.
 */
export const RESEARCH_SHEETS: { sheet: string; cols: number; branches: string[]; ids: string[] }[] = [
	{
		sheet: "research_power",
		cols: 6,
		branches: ["power"],
		ids: [
			"surge_memo", "offpeak_petition", "substation_licence", "flywheel_patent", "gas_concession", "accumulator_charter",
			"feeder_treaty", "wind_permit", "district_heat_accord", "algae_licence", "canopy_array", "heat_pipeline_franchise",
			"carbon_capture_dossier", "green_ledger", "grid_autonomy", "hydrogen_cell", "iron_air_charter", "geothermal_charter",
			"combined_cycle", "reactor_licence", "rate_card", "leaf_bolt",
		],
	},
	{
		sheet: "research_compute_admin",
		cols: 6,
		branches: ["compute", "administration"],
		ids: [
			"contracts_clerk", "reading_room", "vendor_stamp", "ledger_audit", "grand_concordat", "batch_cards",
			"rear_door_drawings", "tape_silo", "cold_plate_gen3", "inference_foundry", "manifold_blade", "works_foreman",
			"standing_orders_binder", "photonic_bench", "cryo_core_dossier", "continuity_form", "backup_vault_charter", "mind_lattice_dossier",
			"continuity_doctrine", "authority_charter", "event_array", "photonic_mesh", "neuromorphic_bench", "transfer_protocol",
		],
	},
	{
		sheet: "research_cooling_logistics",
		cols: 6,
		branches: ["cooling", "logistics"],
		ids: [
			"desk_fan_standard", "rear_door_exchanger", "chilled_loop", "high_capacity_air", "tower_hydraulics", "adiabatic_cooling",
			"pit_crew", "brass_gearing", "logistics_drone", "central_stores", "fast_charge", "logistics_lifter",
			"maintenance_corps", "fleet_command", "immersion_vault", "cryo_plant", "ice_battery", "cold_room_spec",
		],
	},
	{
		sheet: "research_wetware",
		cols: 5,
		branches: ["wetware"],
		ids: [
			"wetware_annex", "sterile_protocols", "quarantine_doctrine", "culling_licence", "dna_archive_charter",
			"bioreactor_permit", "neural_pit_dossier", "tissue_scaffolds", "asset_register", "culture_media",
			"organoid_vats", "synaptic_mesh", "biogas_digester",
		],
	},
];

/** Technology id to its sheet cell. */
export const RESEARCH_ICONS: Record<string, SheetCell> = Object.fromEntries(
	RESEARCH_SHEETS.flatMap(({ sheet, cols, ids }) => ids.map((id, i) => [id, { sheet, col: i % cols, row: Math.floor(i / cols) }] as const)),
);

/** The icon cell for a technology, or undefined (the card then shows no picture). */
export const researchIcon = (techId: string): SheetCell | undefined => RESEARCH_ICONS[techId];
