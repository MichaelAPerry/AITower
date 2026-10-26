/** The three catalogues (docs/TREES.md): the tables as data, the rules as functions, and the new schema fields as validation. */
import { describe, expect, it } from "vitest";
import { access, catalogueGroup, effectiveTier, nodeTier, researchCommitBlock, upgradeCost, upgradesTo } from "./catalogue";
import { loadContent, validateContent } from "./load";
import type { AdvisorId, AscensionPath, ContentDB, FacilityDef } from "./schema";

const db = loadContent();
const f = db.facilities;
const ZERO: Record<AdvisorId, number> = { cass: 0, bea: 0, mel: 0, luci: 0 };
const broken = (mutate: (d: ContentDB) => void): string => {
	const d = loadContent();
	mutate(d);
	return validateContent(d).join("\n");
};

/**
 * Section 2 of docs/TREES.md. id, cost ($M), kW (rack draw or the item's own draw), PFLOPS, capacity (kW out, kW of cooling or nutrient),
 * width, Level, gating tech, seal Bio / Green.
 */
type Row = [id: string, costM: number, kw: number, pf: number, cap: number, width: number, level: number, tech: string | undefined, bio: number, green: number];
const SPEC: Row[] = [
	// Shared
	["rack_air_gpu", 0.4, 40, 20, 0, 2, 1, undefined, 0, 1],
	["rack_air_gpu2", 0.55, 55, 42, 0, 2, 2, "rear_door_drawings", 0, 1],
	["rack_infer", 1.1, 36, 95, 0, 2, 3, "inference_foundry", 0, 1],
	["rack_storage", 0.15, 12, 0, 0, 2, 1, undefined, 0, 0],
	["rack_storage2", 0.52, 30, 0, 0, 3, 2, "tape_silo", 0, 1],
	["crah_unit", 0.12, 40, 0, 180, 2, 1, undefined, 0, 2],
	["crah_rear_door", 0.21, 36, 0, 320, 2, 2, "rear_door_exchanger", 0, 2],
	["crah_hc", 0.48, 75, 0, 700, 4, 3, "high_capacity_air", 0, 3],
	["grid_tie", 0.25, 0, 0, 1500, 4, 1, undefined, 0, 8],
	["grid_tie_2", 0.52, 0, 0, 3500, 5, 2, "substation_licence", 0, 8],
	["grid_tie_3", 1.5, 0, 0, 9000, 8, 4, "feeder_treaty", 0, 10],
	["genset", 0.35, 0, 0, 800, 4, 1, undefined, 6, 20],
	["ups_battery", 0.3, 0, 0, 500, 3, 1, undefined, 3, 5],
	["ups_bank_big", 1.4, 0, 0, 2000, 5, 3, "accumulator_charter", 2, 6],
	// Synthetic: The Lattice
	["rack_dlc_gpu", 1.4, 120, 130, 0, 2, 2, "chilled_loop", 2, 2],
	["rack_dlc_gpu2", 2.15, 160, 230, 0, 2, 3, "cold_plate_gen3", 6, 3],
	["rack_dlc_gpu3", 4.0, 240, 420, 0, 2, 4, "manifold_blade", 8, 4],
	["rack_imm_gpu2", 4.8, 300, 560, 0, 3, 4, "two_phase_immersion", 16, 14],
	["rack_imm_gpu3", 6.5, 380, 800, 0, 3, 5, "immersion_vault", 18, 16],
	["rack_mind_lattice", 12.0, 520, 1400, 0, 3, 5, "mind_lattice_dossier", 24, 8],
	["cdu", 0.4, 4, 0, 400, 2, 2, "chilled_loop", 4, 2],
	["cdu_big", 1.3, 14, 0, 1600, 3, 3, "tower_hydraulics", 4, 3],
	["cdu_hall", 4.5, 40, 0, 6000, 5, 5, "immersion_vault", 5, 4],
	["chiller", 1.1, 6, 0, 600, 4, 2, "chilled_loop", 3, 10],
	["chiller_tower", 3.5, 22, 0, 2400, 6, 3, "tower_hydraulics", 0, 6],
	["cryo_core", 5.2, 25, 0, 3000, 6, 4, "cryo_core_dossier", 25, 15],
	["cryo_plant", 11.0, 50, 0, 8000, 8, 5, "cryo_plant", 30, 18],
	["genset_gas", 1.6, 0, 0, 3000, 6, 3, "gas_concession", 3, 12],
	["genset_cc", 9.0, 0, 0, 12000, 8, 5, "combined_cycle", 3, 25],
	["reactor_smr", 24.0, 0, 0, 10000, 8, 5, "reactor_licence", 4, 8],
	["grid_tie_4", 3.4, 0, 0, 20000, 10, 5, "grid_autonomy", 0, 14],
	["continuity_monitor", 1.8, 0, 0, 800, 3, 5, "continuity_form", 10, 4],
	["backup_vault", 1.6, 30, 0, 0, 3, 5, "backup_vault_charter", 8, 2],
	// Bio: The Flesh
	["rack_culture_s", 0.9, 8, 40, 0, 2, 3, "culture_bench", 0, 1],
	["nutrient_tank_s", 0.25, 2, 0, 6, 2, 3, "culture_bench", 0, 1],
	["organoid_incubator", 2.4, 24, 135, 0, 2, 3, "wetware_annex", -8, 0],
	["rack_organoid_2", 4.5, 45, 300, 0, 3, 4, "organoid_vats", -10, 0],
	["rack_organoid_3", 7.5, 70, 520, 0, 3, 5, "tissue_scaffolds", -11, 2],
	["neural_pit", 12.0, 110, 850, 0, 4, 5, "neural_pit_dossier", -12, 2],
	["perfusion_bath", 0.5, 4, 0, 60, 2, 3, "perfusion_baths", -2, 0],
	["perfusion_manifold", 1.6, 12, 0, 250, 3, 4, "perfusion_manifold", -3, 0],
	["vascular_plant", 5.5, 35, 0, 1000, 5, 5, "vascular_plant", -4, 0],
	["nutrient_plant", 1.1, 25, 0, 20, 3, 3, "wetware_annex", -6, 2],
	["nutrient_works", 3.2, 60, 0, 60, 4, 4, "nutrient_works", -8, 3],
	["bioreactor", 2.8, 20, 0, 500, 4, 4, "bioreactor_permit", -10, -4],
	["biogas_digester", 9.0, 40, 0, 2000, 6, 5, "biogas_digester", -12, -6],
	["dna_vault", 1.6, 8, 0, 0, 2, 4, "dna_archive_charter", -5, 0],
	// Green: The Garden
	["rack_neuromorphic", 0.8, 12, 50, 0, 2, 3, "inference_foundry", -1, -2],
	["rack_neuromorphic2", 2.1, 28, 150, 0, 2, 4, "event_array", -1, -3],
	["rack_photonic", 4.5, 40, 300, 0, 2, 5, "photonic_bench", 0, -4],
	["rack_photonic2", 8.0, 70, 600, 0, 3, 5, "photonic_mesh", 0, -5],
	["crah_econ", 0.35, 6, 0, 400, 3, 3, "economizer", 0, -2],
	["crah_adiabatic", 2.6, 20, 0, 1500, 4, 4, "adiabatic_cooling", 0, -3],
	["chiller_free", 7.2, 40, 0, 5000, 8, 5, "adiabatic_cooling", 0, -4],
	["heat_exchanger", 0.95, 25, 0, 0, 3, 3, "district_heat_accord", 0, -3],
	["heat_pipeline", 3.4, 70, 0, 0, 6, 5, "heat_pipeline_franchise", 0, -12],
	["solar_skin", 0.45, 0, 0, 150, 4, 3, "solar_charter", -1, -6],
	["wind_mast", 1.25, 0, 0, 300, 2, 4, "wind_permit", 0, -8],
	["solar_canopy", 1.1, 0, 0, 420, 8, 4, "canopy_array", -1, -10],
	["fuel_cell", 1.8, 0, 0, 1000, 4, 4, "hydrogen_cell", 0, -2],
	["ups_iron_air", 5.0, 0, 0, 1500, 6, 5, "iron_air_charter", 0, -6],
	["geothermal", 6.5, 0, 0, 2000, 4, 5, "geothermal_charter", 0, -14],
	["algae_facade", 0.48, 8, 0, 0, 4, 3, "algae_licence", -2, -8],
	["carbon_capture", 2.6, 60, 0, 0, 6, 5, "carbon_capture_dossier", 0, -14],
	// Signature builds
	["grid_tie_lucy", 1.1, 0, 0, 9000, 8, 3, undefined, 0, 16],
	["rack_organoid_3m", 7.5, 70, 600, 0, 3, 5, "tissue_scaffolds", -11, 2],
	["microgrid_bea", 1.9, 0, 0, 600, 4, 3, undefined, -1, -12],
	["ice_store", 1.2, 4, 0, 800, 3, 3, undefined, 0, 0],
	["cold_room", 2.0, 6, 0, 60, 4, 4, undefined, 0, 0],
];

const capOf = (d: FacilityDef): number => d.power?.capacityKw ?? d.cooling?.capacityKw ?? d.bio?.nutrientCapacity ?? 0;
const kwOf = (d: FacilityDef): number => (d.rack ? d.rack.powerKw + d.facilityKw : d.facilityKw);

describe("the catalogue tables (docs/TREES.md section 2)", () => {
	it("every row of the tables is in the data: cost, kW, PFLOPS, capacity, width, Level, research and seal", () => {
		for (const [id, costM, kw, pf, cap, width, level, tech, bio, green] of SPEC) {
			const d = f[id];
			expect(d, id).toBeDefined();
			expect(d.cost, `${id} cost`).toBe(Math.round(costM * 1e6));
			if (kw > 0 || d.rack) expect(kwOf(d), `${id} kW`).toBe(kw);
			expect(d.rack?.pflops ?? 0, `${id} PF`).toBe(pf);
			expect(capOf(d), `${id} capacity`).toBe(cap);
			expect(d.width, `${id} width`).toBe(width);
			expect(d.unlockTier, `${id} level`).toBe(level);
			expect(d.tech, `${id} tech`).toBe(tech);
			expect(d.seal?.biotech ?? 0, `${id} bio seal`).toBe(bio);
			expect(d.seal?.greentech ?? 0, `${id} green seal`).toBe(green);
		}
	});

	it("removed ids are gone and every new id exists (section 6)", () => {
		for (const id of ["rack_air_gpu3", "rack_imm_gpu"]) expect(f[id], id).toBeUndefined();
		for (const id of ["hot_aisle", "dielectric_handbook", "ministry_liaison", "procurement_committee"]) expect(db.tech.some((n) => n.id === id), id).toBe(false);
		const newFacilities = ["rack_culture_s", "nutrient_tank_s", "crah_econ", "cdu_hall", "cryo_plant", "genset_cc", "reactor_smr", "rack_organoid_3", "perfusion_bath", "perfusion_manifold", "vascular_plant", "nutrient_works", "biogas_digester", "rack_neuromorphic2", "rack_photonic2", "crah_adiabatic", "fuel_cell", "ups_iron_air", "geothermal", "grid_tie_lucy", "rack_organoid_3m", "microgrid_bea", "ice_store"];
		for (const id of newFacilities) expect(f[id], id).toBeDefined();
		const newTech = ["culture_bench", "perfusion_baths", "perfusion_manifold", "vascular_plant", "biogas_digester", "nutrient_works", "economizer", "event_array", "photonic_mesh", "hydrogen_cell", "geothermal_charter", "iron_air_charter", "cryo_plant", "combined_cycle", "reactor_licence"];
		for (const id of newTech) expect(db.tech.some((n) => n.id === id), id).toBe(true);
		expect(db.tech.find((n) => n.id === "grand_concordat")?.name).toBe("Open Door");
		expect(db.tech.find((n) => n.id === "authority_charter")?.name).toBe("Research Charter");
	});

	it("tech nodes: the new RP costs and Levels of section 1.2, and the Specialist nodes need the commit", () => {
		const node = (id: string) => db.tech.find((n) => n.id === id);
		const tbl: [string, number, number][] = [
			["culture_bench", 2400, 3],
			["perfusion_baths", 6000, 3],
			["nutrient_works", 12000, 4],
			["perfusion_manifold", 14000, 4],
			["vascular_plant", 28000, 5],
			["biogas_digester", 30000, 5],
			["economizer", 2200, 3],
			["hydrogen_cell", 14000, 4],
			["iron_air_charter", 28000, 5],
			["geothermal_charter", 30000, 5],
			["combined_cycle", 24000, 5],
			["cryo_plant", 30000, 5],
			["reactor_licence", 40000, 5],
			["organoid_vats", 18000, 4],
		];
		for (const [id, cost, tier] of tbl) {
			expect(node(id)?.cost, `${id} RP`).toBe(cost);
			expect(node(id)?.minTier, `${id} Level`).toBe(tier);
		}
		for (const id of ["wetware_annex", "perfusion_baths", "nutrient_works", "perfusion_manifold", "vascular_plant", "biogas_digester", "organoid_vats", "tissue_scaffolds", "neural_pit_dossier", "sterile_protocols", "bioreactor_permit"]) expect(node(id)?.requiresCommit, id).toBe("biotech");
		for (const id of ["wind_permit", "canopy_array", "event_array", "hydrogen_cell", "iron_air_charter", "geothermal_charter", "photonic_bench", "photonic_mesh", "adiabatic_cooling", "green_ledger"]) expect(node(id)?.requiresCommit, id).toBe("greentech");
		for (const id of ["culture_media", "culture_bench", "solar_charter", "economizer", "district_heat_accord", "cryo_plant", "combined_cycle", "reactor_licence", "chilled_loop"]) expect(node(id)?.requiresCommit, id).toBeUndefined();
	});
});

describe("groups, tiers and the unlock rules", () => {
	it("Starter, Specialist, Synthetic, Shared and Signature are told apart from the data", () => {
		const starters = Object.values(f).filter((d) => d.tier === "starter").map((d) => d.id).sort();
		expect(starters).toEqual(["crah_econ", "heat_exchanger", "nutrient_tank_s", "rack_culture_s", "rack_neuromorphic", "solar_skin"]);
		expect(catalogueGroup(f.organoid_incubator)).toBe("specialist");
		expect(catalogueGroup(f.rack_dlc_gpu)).toBe("synthetic");
		expect(catalogueGroup(f.rack_air_gpu)).toBe("shared");
		expect(catalogueGroup(f.cold_room)).toBe("signature");
		for (const d of Object.values(f)) {
			if (d.growth) continue;
			// A Bio or Green line item is a Starter, a Specialist or a signature build.
			if (d.line === "biotech" || d.line === "greentech") expect(d.tier !== undefined || d.unlock?.bond !== undefined, d.id).toBe(true);
			// A Starter never scars its own tree.
			if (d.tier === "starter" && d.line) expect(d.seal?.[d.line as "biotech" | "greentech"] ?? 0, d.id).toBeLessThanOrEqual(0);
		}
	});

	it("access: Synthetic closes on the commit, Specialist needs it, Starter is always open, Signature needs the bond", () => {
		const ctx = (path: AscensionPath | null, bonds: Partial<Record<AdvisorId, number>> = {}) => ({ path, tier: 5, bonds: { ...ZERO, ...bonds } });
		expect(access(f.rack_dlc_gpu, ctx(null)).block).toBeNull();
		expect(access(f.rack_dlc_gpu, ctx("synthetic")).block).toBeNull();
		expect(access(f.rack_dlc_gpu, ctx("greentech")).block?.kind).toBe("closed");
		expect(access(f.rack_neuromorphic2, ctx(null)).block?.short).toBe("Commit to The Garden");
		expect(access(f.rack_neuromorphic2, ctx("biotech")).block?.short).toBe("Commit to The Garden");
		expect(access(f.rack_neuromorphic2, ctx("greentech")).block).toBeNull();
		for (const p of [null, "biotech", "greentech", "synthetic"] as const) expect(access(f.rack_neuromorphic, ctx(p)).block, `starter on ${p}`).toBeNull();
		expect(access(f.microgrid_bea, ctx(null)).block?.short).toBe("Bea's bond 40");
		expect(access(f.microgrid_bea, ctx(null, { bea: 40 })).block).toBeNull();
		expect(access(f.rack_organoid_3m, ctx("biotech", { mel: 69 })).block?.short).toBe("Mel's bond 70");
		expect(access(f.rack_organoid_3m, ctx(null, { mel: 70 })).block?.short).toBe("Commit to The Flesh");
		expect(access(f.rack_organoid_3m, ctx("biotech", { mel: 70 })).block).toBeNull();
		// A tree that rejected the player stays shut.
		expect(access(f.organoid_incubator, { ...ctx(null), sealedOut: ["biotech"] }).block?.kind).toBe("closed");
	});

	it("the bond opens Early Lattice and Early Garden a Level sooner, for the item and its research", () => {
		expect(effectiveTier(f.rack_mind_lattice, { bonds: { ...ZERO, luci: 59 } })).toBe(5);
		expect(effectiveTier(f.rack_mind_lattice, { bonds: { ...ZERO, luci: 60 } })).toBe(4);
		expect(effectiveTier(f.rack_photonic, { bonds: { ...ZERO, bea: 60 } })).toBe(4);
		const n = db.tech.find((t) => t.id === "photonic_bench");
		expect(n && nodeTier(n, { ...ZERO, bea: 60 })).toBe(4);
		expect(n && nodeTier(n, ZERO)).toBe(5);
		expect(n && researchCommitBlock(n, null)).toBe("Commit to The Garden to research");
		expect(n && researchCommitBlock(n, "greentech")).toBeNull();
	});

	it("an upgrade costs the new item less half of the old one, and every chain only goes up", () => {
		expect(upgradeCost(f.rack_air_gpu, f.rack_air_gpu2)).toBe(550_000 - 200_000);
		expect(upgradeCost(f.rack_dlc_gpu3, f.rack_imm_gpu2)).toBe(4_800_000 - 2_000_000);
		expect(upgradeCost(f.rack_organoid_2, f.rack_culture_s)).toBe(0); // never negative
		expect(upgradesTo(db, "genset").map((d) => d.id)).toEqual(["fuel_cell", "genset_gas"]);
		for (const d of Object.values(f)) {
			if (!d.upgradesFrom) continue;
			const from = f[d.upgradesFrom];
			expect(from, d.id).toBeDefined();
			expect(from.unlockTier, `${d.id} from ${from.id}`).toBeLessThanOrEqual(d.unlockTier);
			expect(d.cost, `${d.id} costs more than ${from.id}`).toBeGreaterThanOrEqual(from.cost * 0.5);
		}
	});
});

describe("each tree's line is complete from Level 1 to 5", () => {
	/** Items a player on `path` may place, ignoring bonds (Signature builds are rewards, not part of the line). */
	const reachable = (path: AscensionPath | null): FacilityDef[] =>
		Object.values(f).filter((d) => !d.growth && !d.retired && !d.unlock?.bond && access(d, { path, tier: 5, bonds: ZERO }).block === null);
	const compute = (d: FacilityDef): boolean => !!d.rack && d.rack.pflops > 0;
	const cooling = (d: FacilityDef): boolean => (d.kind === "crah" || d.kind === "chiller" || d.kind === "cdu") && !d.cooling?.failureFactor;
	const power = (d: FacilityDef): boolean => d.kind === "grid_tie" || d.kind === "genset" || d.kind === "ups" || d.kind === "solar" || d.kind === "wind" || d.kind === "bioreactor";
	const trees: [string, AscensionPath | null][] = [
		["Synthetic", null],
		["Bio", "biotech"],
		["Green", "greentech"],
	];

	for (const [name, path] of trees) {
		it(`${name}: compute, cooling and power each have an item at every Level, and every upgrade source is on the line`, () => {
			const items = reachable(path);
			const ids = new Set(items.map((d) => d.id));
			for (const [label, pick] of [["compute", compute], ["cooling", cooling], ["power", power]] as const) {
				for (let level = 1; level <= 5; level++) {
					const here = items.filter((d) => pick(d) && d.unlockTier === level);
					expect(here.length, `${name} ${label} at Level ${level}`).toBeGreaterThan(0);
				}
			}
			for (const d of items) if (d.upgradesFrom) expect(ids.has(d.upgradesFrom), `${name}: ${d.id} upgrades from ${d.upgradesFrom}`).toBe(true);
			// The line's end items exist: its best rack and best cooling plant.
			const best = items.filter(compute).sort((a, b) => (b.rack?.pflops ?? 0) - (a.rack?.pflops ?? 0))[0];
			expect(best.unlockTier, `${name} best rack ${best.id}`).toBe(5);
		});

		it(`${name}: all the research its items need can be done on that path (no node asks for another tree's commit)`, () => {
			const byId = new Map(db.tech.map((n) => [n.id, n]));
			const seen = new Set<string>();
			const need = (id: string): void => {
				if (seen.has(id)) return;
				seen.add(id);
				const n = byId.get(id);
				expect(n, id).toBeDefined();
				if (!n) return;
				expect(n.requiresCommit === undefined || n.requiresCommit === path, `${name}: ${id} needs ${n.requiresCommit}`).toBe(true);
				for (const r of n.requires) need(r);
			};
			for (const d of reachable(path)) if (d.tech) need(d.tech);
		});
	}

	it("Synthetic is the default: its line needs no commit, no bond and no starter", () => {
		const syn = reachable(null).filter((d) => d.line === "synthetic");
		expect(syn.length).toBeGreaterThan(12);
		for (const d of syn) expect(d.tier, d.id).toBeUndefined();
	});
});

describe("validation of the new schema fields", () => {
	it("the shipped content is valid", () => {
		expect(validateContent(db)).toEqual([]);
	});
	it("rejects bad catalogue fields", () => {
		expect(broken((d) => ((d.facilities.rack_air_gpu as { tier?: string }).tier = "elite"))).toMatch(/tier/);
		expect(broken((d) => delete d.facilities.rack_neuromorphic.tier)).toMatch(/must be a "starter" or a "specialist"/);
		expect(broken((d) => (d.facilities.rack_neuromorphic.unlock = { commit: "greentech" }))).toMatch(/a starter is open to anyone/);
		expect(broken((d) => (d.facilities.rack_air_gpu2.upgradesFrom = "nope"))).toMatch(/unknown facility "nope"/);
		expect(broken((d) => (d.facilities.rack_air_gpu.upgradesFrom = "rack_air_gpu"))).toMatch(/upgrades itself/);
		expect(broken((d) => (d.facilities.rack_air_gpu.upgradesFrom = "rack_infer"))).toMatch(/opens at Level 3, after rack_air_gpu/);
		expect(broken((d) => (d.facilities.rack_air_gpu2.upgradesFrom = "rack_infer"))).toMatch(/upgrade loop|opens at Level/);
		expect(broken((d) => (d.facilities.grid_tie_lucy.unlock = { bond: { who: "nobody" as AdvisorId, min: 40 } }))).toMatch(/unknown advisor/);
		expect(broken((d) => (d.facilities.grid_tie_lucy.unlock = { bond: { who: "luci", min: 0 } }))).toMatch(/unlock\.bond\.min/);
		expect(broken((d) => (d.facilities.rack_mind_lattice.unlock = { early: { who: "luci", min: 60, tier: 6 } }))).toMatch(/unlock\.early\.tier/);
		expect(broken((d) => (d.facilities.solar_skin.placement = { needsPower: true, roofOnly: true, basementOnly: true }))).toMatch(/cannot be both roofOnly and basementOnly/);
		expect(broken((d) => ((d.facilities.solar_skin.placement as { exteriorOnly?: unknown }).exteriorOnly = "yes"))).toMatch(/exteriorOnly: expected a boolean/);
		expect(broken((d) => ((d.facilities.perfusion_bath.cooling as { holdC?: number }).holdC = 0))).toMatch(/holdC/);
		expect(broken((d) => (d.facilities.crah_econ.cooling = { capacityKw: 400, radius: 6, freeAir: { fullBelowC: 27, hotC: 18, hotFactor: 0.4 } }))).toMatch(/hotC must be above fullBelowC/);
		expect(broken((d) => (d.facilities.chiller.cooling = { capacityKw: 600, cop: 5, bioOnly: true }))).toMatch(/for air handlers/);
	});
	it("rejects bad tech fields", () => {
		const node = (d: ContentDB, id: string) => d.tech.find((n) => n.id === id) as ContentDB["tech"][number];
		expect(broken((d) => ((node(d, "wetware_annex") as { requiresCommit?: string }).requiresCommit = "synthetic"))).toMatch(/requiresCommit/);
		expect(broken((d) => { node(d, "culture_bench").requiresCommit = "biotech"; node(d, "culture_bench").minTier = 1; })).toMatch(/cannot come before the commit/);
		expect(broken((d) => (node(d, "photonic_bench").earlyTier = { who: "bea", min: 60, tier: 6 }))).toMatch(/earlyTier\.tier/);
		expect(broken((d) => (node(d, "photonic_bench").earlyTier = { who: "zed" as AdvisorId, min: 60, tier: 4 }))).toMatch(/earlyTier\.who/);
	});
	it("requires a Starter weight in the Soul balance", () => {
		expect(broken((d) => ((d.balance.soul as { starterWeight?: number }).starterWeight = Number.NaN))).toMatch(/starterWeight/);
	});
});
