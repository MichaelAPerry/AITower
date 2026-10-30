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
	"neuromorphic_bench",
	"wind_permit",
	"district_heat_accord",
	"algae_licence",
	"canopy_array",
	"heat_pipeline_franchise",
	"carbon_capture_dossier",
	"green_ledger",
	"photonic_bench",
];

export const SYNTH_TECH = ["cryo_core_dossier", "continuity_form", "backup_vault_charter", "mind_lattice_dossier", "continuity_doctrine"];

export const AUTOMATION_TECH = ["works_foreman", "standing_orders_binder"];

/** Tree restructure (balance audit 7b): shared L5 nodes, the second biotech nodes, culture media and the fleet bot. */
export const V2_TECH = ["culture_media", "fleet_command", "grid_autonomy", "immersion_vault", "authority_charter", "organoid_vats", "synaptic_mesh"];
export const V2_FACILITIES = ["grid_tie_4", "rack_organoid_2"];

export const M4_TECH = [...GREEN_TECH, ...SYNTH_TECH, ...AUTOMATION_TECH];

/** The three catalogues (docs/TREES.md): facilities and tech nodes that are new, so the older trunk tests set them aside. */
export const V3_FACILITIES = [
	"cdu_hall",
	"cryo_plant",
	"genset_cc",
	"reactor_smr",
	"rack_organoid_3",
	"perfusion_bath",
	"perfusion_manifold",
	"vascular_plant",
	"nutrient_works",
	"biogas_digester",
	"rack_neuromorphic2",
	"rack_photonic2",
	"crah_econ",
	"crah_adiabatic",
	"fuel_cell",
	"ups_iron_air",
	"geothermal",
	"grid_tie_lucy",
	"microgrid_bea",
	"ice_store",
	"cold_room",
	// reworked into the Green line (Level 5, adiabatic plant)
	"chiller_free",
	// the Synthetic special
	"consciousness_transfer",
];
export const V3_TECH = [
	"biogas_digester",
	"event_array",
	"hydrogen_cell",
	"iron_air_charter",
	"geothermal_charter",
	"photonic_mesh",
	"combined_cycle",
	"cryo_plant",
	"reactor_licence",
	"rate_card",
	"leaf_bolt",
	"ice_battery",
	"cold_room_spec",
	"transfer_protocol",
];
