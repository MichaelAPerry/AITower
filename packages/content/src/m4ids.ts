/** Ids of the M4 (Greentech, Synthetic Mind and automation) content, so the older trunk/biotech tests can set them aside. */
export const M4_FACILITIES = [
	"solar_skin",
	"solar_canopy",
	"wind_mast",
	"heat_exchanger",
	"heat_pipeline",
	"algae_facade",
	"carbon_capture",
	"rack_neuromorphic",
	"rack_photonic",
	"cryo_core",
	"rack_mind_lattice",
	"continuity_monitor",
	"backup_vault",
];

export const GREEN_TECH = [
	"solar_charter",
	"wind_permit",
	"district_heat_accord",
	"algae_licence",
	"neuromorphic_cards",
	"canopy_array",
	"heat_pipeline_franchise",
	"carbon_capture_dossier",
	"green_ledger",
	"photonic_bench",
];

export const SYNTH_TECH = ["cryo_core_dossier", "continuity_form", "backup_vault_charter", "mind_lattice_dossier", "identity_register", "continuity_doctrine"];

export const AUTOMATION_TECH = ["works_foreman", "standing_orders_binder"];

export const M4_TECH = [...GREEN_TECH, ...SYNTH_TECH, ...AUTOMATION_TECH];
