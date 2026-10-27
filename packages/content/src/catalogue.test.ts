/** The reframe (docs/REFRAME.md): four rungs per tree as data, the retrofit rules as functions, and the new schema fields as validation. */
import { describe, expect, it } from "vitest";
import { isBaseRack, isRetrofittable, isRetrofitOnly, retrofitCost, retrofitTarget, SWITCH_BASE_ID, treeLadder, treeOf, TREES, upgradeCost, upgradesTo } from "./catalogue";
import { loadContent, validateContent } from "./load";
import type { AscensionPath, ContentDB, FacilityDef } from "./schema";

const db = loadContent();
const f = db.facilities;
const broken = (mutate: (d: ContentDB) => void): string => {
	const d = loadContent();
	mutate(d);
	return validateContent(d).join("\n");
};

/**
 * id, cost ($M), kW (rack draw or the item's own draw), PFLOPS, capacity (kW out, kW of cooling or nutrient), width, Level,
 * gating tech, seal Bio / Green. Numbers are TREES.md section 2 with the REFRAME.md Levels and research gates.
 */
type Row = [id: string, costM: number, kw: number, pf: number, cap: number, width: number, level: number, tech: string | undefined, bio: number, green: number];
const SPEC: Row[] = [
	// Base racks and shared plant
	["rack_air_gpu", 0.4, 40, 20, 0, 2, 1, undefined, 0, 0],
	["rack_air_gpu2", 0.55, 55, 42, 0, 2, 2, "rear_door_drawings", 0, 0],
	["rack_infer", 1.1, 36, 95, 0, 2, 3, "inference_foundry", 0, 0],
	["rack_storage", 0.15, 12, 0, 0, 2, 1, undefined, 0, 0],
	["rack_storage2", 0.52, 30, 0, 0, 3, 2, "tape_silo", 0, 1],
	["crah_unit", 0.12, 40, 0, 180, 2, 1, undefined, 0, 2],
	["grid_tie", 0.25, 0, 0, 1500, 4, 1, undefined, 0, 8],
	["genset", 0.35, 0, 0, 800, 4, 1, undefined, 6, 20],
	// Synthetic: The Lattice
	["rack_dlc_gpu", 1.4, 120, 130, 0, 2, 2, "chilled_loop", 2, 2],
	["rack_dlc_gpu2", 2.15, 160, 230, 0, 2, 3, "cold_plate_gen3", 6, 3],
	["rack_dlc_gpu3", 4.0, 240, 420, 0, 2, 4, "manifold_blade", 8, 4],
	["rack_mind_lattice", 12.0, 520, 1400, 0, 3, 5, "mind_lattice_dossier", 24, 8],
	["cdu", 0.4, 4, 0, 400, 2, 2, "chilled_loop", 4, 2],
	["chiller", 1.1, 6, 0, 600, 4, 2, "chilled_loop", 3, 10],
	["cdu_big", 1.3, 14, 0, 1600, 3, 3, "tower_hydraulics", 4, 3],
	["chiller_tower", 3.5, 22, 0, 2400, 6, 3, "tower_hydraulics", 0, 6],
	["genset_gas", 1.6, 0, 0, 3000, 6, 3, "gas_concession", 3, 12],
	["cryo_core", 5.2, 25, 0, 3000, 6, 4, "cryo_core_dossier", 25, 15],
	["cdu_hall", 4.5, 40, 0, 6000, 5, 5, "immersion_vault", 5, 4],
	["cryo_plant", 11.0, 50, 0, 8000, 8, 5, "cryo_plant", 30, 18],
	["genset_cc", 9.0, 0, 0, 12000, 8, 5, "combined_cycle", 3, 25],
	["reactor_smr", 24.0, 0, 0, 10000, 8, 5, "reactor_licence", 4, 8],
	["grid_tie_4", 3.4, 0, 0, 20000, 10, 5, "grid_autonomy", 0, 14],
	// Bio: The Flesh
	["organoid_incubator", 2.4, 24, 135, 0, 2, 2, "wetware_annex", -8, 0],
	["rack_organoid_2", 4.5, 45, 300, 0, 3, 3, "organoid_vats", -10, 0],
	["rack_organoid_3", 7.5, 70, 520, 0, 3, 4, "tissue_scaffolds", -11, 2],
	["neural_pit", 12.0, 110, 850, 0, 4, 5, "neural_pit_dossier", -12, 2],
	["perfusion_bath", 0.5, 4, 0, 60, 2, 2, "wetware_annex", -2, 0],
	["nutrient_plant", 1.1, 25, 0, 20, 3, 2, "wetware_annex", -6, 2],
	["perfusion_manifold", 1.6, 12, 0, 250, 3, 3, "organoid_vats", -3, 0],
	["nutrient_works", 3.2, 60, 0, 60, 4, 4, "tissue_scaffolds", -8, 3],
	["bioreactor", 2.8, 20, 0, 500, 4, 4, "bioreactor_permit", -10, -4],
	["vascular_plant", 5.5, 35, 0, 1000, 5, 5, "neural_pit_dossier", -4, 0],
	["biogas_digester", 9.0, 40, 0, 2000, 6, 5, "biogas_digester", -12, -6],
	// Green: The Garden
	["rack_neuromorphic", 0.8, 12, 50, 0, 2, 2, "neuromorphic_bench", -1, -2],
	["rack_neuromorphic2", 2.1, 28, 150, 0, 2, 3, "event_array", -1, -3],
	["rack_photonic", 4.5, 40, 300, 0, 2, 4, "photonic_bench", 0, -4],
	["rack_photonic2", 8.0, 70, 600, 0, 3, 5, "photonic_mesh", 0, -5],
	["crah_econ", 0.35, 6, 0, 400, 3, 2, "neuromorphic_bench", 0, -2],
	["solar_skin", 0.45, 0, 0, 150, 4, 2, "neuromorphic_bench", -1, -6],
	["crah_adiabatic", 2.6, 20, 0, 1500, 4, 3, "event_array", 0, -3],
	["wind_mast", 1.25, 0, 0, 300, 2, 4, "wind_permit", 0, -8],
	["solar_canopy", 1.1, 0, 0, 420, 8, 4, "canopy_array", -1, -10],
	["fuel_cell", 1.8, 0, 0, 1000, 4, 4, "hydrogen_cell", 0, -2],
	["chiller_free", 7.2, 40, 0, 5000, 8, 5, "photonic_mesh", 0, -4],
	["ups_iron_air", 5.0, 0, 0, 1500, 6, 5, "iron_air_charter", 0, -6],
	["geothermal", 6.5, 0, 0, 2000, 4, 5, "geothermal_charter", 0, -14],
	// Advisor support builds: normal research items now
	["grid_tie_lucy", 1.1, 0, 0, 9000, 8, 3, "rate_card", 0, 16],
	["microgrid_bea", 1.9, 0, 0, 600, 4, 3, "leaf_bolt", -1, -12],
	["ice_store", 1.2, 4, 0, 800, 3, 3, "ice_battery", 0, 0],
	["cold_room", 2.0, 6, 0, 60, 4, 4, "cold_room_spec", 0, 0],
];

const capOf = (d: FacilityDef): number => d.power?.capacityKw ?? d.cooling?.capacityKw ?? d.bio?.nutrientCapacity ?? 0;
const kwOf = (d: FacilityDef): number => (d.rack ? d.rack.powerKw + d.facilityKw : d.facilityKw);
const node = (id: string) => db.tech.find((n) => n.id === id);

describe("the catalogue tables", () => {
	it("every row is in the data: cost, kW, PFLOPS, capacity, width, Level, research and seal", () => {
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

	it("the cut items are gone: OC-0, NT-1, IM-2, IM-3, Mel's Cortex, and their research", () => {
		for (const id of ["rack_culture_s", "nutrient_tank_s", "rack_imm_gpu2", "rack_imm_gpu3", "rack_organoid_3m", "rack_imm_gpu", "rack_air_gpu3"]) expect(f[id], id).toBeUndefined();
		for (const id of ["culture_bench", "two_phase_immersion", "perfusion_baths", "solar_charter", "economizer"]) expect(node(id), id).toBeUndefined();
	});

	it("no commit, bond, starter or specialist fields remain anywhere", () => {
		for (const d of Object.values(f)) {
			expect((d as { unlock?: unknown }).unlock, d.id).toBeUndefined();
			expect((d as { tier?: unknown }).tier, d.id).toBeUndefined();
		}
		for (const n of db.tech) {
			expect((n as { requiresCommit?: unknown }).requiresCommit, n.id).toBeUndefined();
			expect((n as { earlyTier?: unknown }).earlyTier, n.id).toBeUndefined();
		}
	});

	it("the advisors' support builds each come with a research node, and the signature cooling stays buildable", () => {
		for (const [id, tech] of [["grid_tie_lucy", "rate_card"], ["microgrid_bea", "leaf_bolt"], ["ice_store", "ice_battery"], ["cold_room", "cold_room_spec"]]) {
			expect(f[id].tech).toBe(tech);
			expect(node(tech), tech).toBeDefined();
		}
	});
});

describe("four rungs per tree", () => {
	const RUNG_RACKS: Record<AscensionPath, string[]> = {
		synthetic: ["rack_dlc_gpu", "rack_dlc_gpu2", "rack_dlc_gpu3", "rack_mind_lattice"],
		biotech: ["organoid_incubator", "rack_organoid_2", "rack_organoid_3", "neural_pit"],
		greentech: ["rack_neuromorphic", "rack_neuromorphic2", "rack_photonic", "rack_photonic2"],
	};

	for (const tree of TREES) {
		it(`${tree}: rungs 1-4 open at Levels 2-5 with one research node each, and are retrofit-only`, () => {
			const ladder = treeLadder(db, tree);
			expect(ladder.map((d) => d.id)).toEqual(RUNG_RACKS[tree]);
			ladder.forEach((d, i) => {
				expect(d.rung).toBe(i + 1);
				expect(d.unlockTier, d.id).toBe(i + 2);
				expect(d.line).toBe(tree);
				expect(treeOf(d)).toBe(tree);
				expect(isRetrofitOnly(d)).toBe(true);
				expect(d.upgradesFrom, d.id).toBeUndefined();
				expect(node(d.tech as string)?.minTier, `${d.id} node Level`).toBe(i + 2);
			});
			// Research gets dearer, rung by rung.
			const costs = ladder.map((d) => node(d.tech as string)?.cost ?? 0);
			expect([...costs].sort((a, b) => a - b)).toEqual(costs);
			// Each rack pays more compute than the last.
			const pf = ladder.map((d) => d.rack?.pflops ?? 0);
			expect([...pf].sort((a, b) => a - b)).toEqual(pf);
		});
	}

	it("Synthetic research is the cheapest; Bio and Green cost about twice as much", () => {
		const cost = (tree: AscensionPath, rung: number): number => node(f[RUNG_RACKS[tree][rung - 1]].tech as string)?.cost ?? 0;
		for (let r = 1; r <= 4; r++) {
			expect(cost("synthetic", r), `rung ${r}`).toBeLessThan(cost("biotech", r));
			expect(cost("synthetic", r), `rung ${r}`).toBeLessThan(cost("greentech", r));
		}
		const total = (tree: AscensionPath): number => [1, 2, 3, 4].reduce((s, r) => s + cost(tree, r), 0);
		expect(total("biotech") / total("synthetic")).toBeGreaterThan(1.5);
		expect(total("greentech") / total("synthetic")).toBeGreaterThan(1.5);
	});

	it("base racks are AC-1, AC-3 and IA-1 and nothing else", () => {
		const base = Object.values(f).filter(isBaseRack).map((d) => d.id).sort();
		expect(base).toEqual(["rack_air_gpu", "rack_air_gpu2", "rack_infer"]);
		for (const id of base) expect(treeOf(f[id])).toBeNull();
		expect(isRetrofittable(f.rack_storage)).toBe(false);
		expect(isRetrofittable(f.growth_mass)).toBe(false);
	});

	it("each rung also opens its tree's matching cooling and power at that Level", () => {
		const need: Record<string, number> = {
			cdu: 2, chiller: 2, chiller_tower: 3, genset_gas: 3, cryo_core: 4, cryo_plant: 5, // Synthetic: CDU, chillers, gas
			perfusion_bath: 2, nutrient_plant: 2, bioreactor: 4, // Bio: perfusion baths, nutrient plant, bioreactor
			crah_econ: 2, solar_skin: 2, crah_adiabatic: 3, wind_mast: 4, ups_iron_air: 5, geothermal: 5, // Green
		};
		for (const [id, level] of Object.entries(need)) expect(f[id].unlockTier, id).toBe(level);
	});
});

describe("retrofit targets and prices", () => {
	it("a base rack goes to rung 1 of any tree; a tree rack goes down its own tree; another tree starts again at rung 1", () => {
		const t = (from: string, tree: AscensionPath) => retrofitTarget(db, f[from], tree);
		expect(t("rack_air_gpu", "synthetic")?.to.id).toBe("rack_dlc_gpu");
		expect(t("rack_air_gpu2", "biotech")?.to.id).toBe("organoid_incubator");
		expect(t("rack_infer", "greentech")?.to.id).toBe("rack_neuromorphic");
		expect(t("rack_dlc_gpu", "synthetic")?.to.id).toBe("rack_dlc_gpu2");
		expect(t("rack_dlc_gpu3", "synthetic")?.to.id).toBe("rack_mind_lattice");
		expect(t("rack_mind_lattice", "synthetic")).toBeNull();
		expect(t("neural_pit", "biotech")).toBeNull();
		// A tree rack can only advance within its tree: other branches start again.
		expect(t("rack_dlc_gpu2", "greentech")).toMatchObject({ switching: true });
		expect(t("rack_dlc_gpu2", "greentech")?.to.id).toBe("rack_neuromorphic");
		expect(t("rack_air_gpu", "synthetic")?.switching).toBe(false);
		// Nothing else is a rack to retrofit.
		expect(t("rack_storage", "synthetic")).toBeNull();
		expect(t("chiller", "synthetic")).toBeNull();
	});

	it("cost is the new rack minus 50% of the old one, never below 0", () => {
		expect(retrofitCost(db, f.rack_air_gpu, f.rack_dlc_gpu)).toBe(1_400_000 - 200_000);
		expect(retrofitCost(db, f.rack_infer, f.organoid_incubator)).toBe(2_400_000 - 550_000);
		expect(retrofitCost(db, f.rack_dlc_gpu, f.rack_dlc_gpu2)).toBe(2_150_000 - 700_000);
		expect(retrofitCost(db, f.rack_dlc_gpu3, f.rack_mind_lattice)).toBe(12_000_000 - 2_000_000);
		expect(retrofitCost(db, f.rack_mind_lattice, f.rack_neuromorphic)).toBeGreaterThan(0);
	});

	it("switching trees gets no refund trick: the old rack counts as a plain AC-1", () => {
		const base = f[SWITCH_BASE_ID].cost;
		expect(retrofitCost(db, f.rack_mind_lattice, f.rack_neuromorphic)).toBe(f.rack_neuromorphic.cost - 0.5 * base);
		expect(retrofitCost(db, f.neural_pit, f.rack_dlc_gpu)).toBe(f.rack_dlc_gpu.cost - 0.5 * base);
		// Going back to the same tree later is no cheaper than starting from a base rack.
		expect(retrofitCost(db, f.rack_photonic2, f.rack_dlc_gpu)).toBe(retrofitCost(db, f.rack_air_gpu, f.rack_dlc_gpu));
	});

	it("support items still upgrade in place at new cost minus half the old", () => {
		expect(upgradeCost(f.rack_air_gpu, f.rack_air_gpu2)).toBe(550_000 - 200_000);
		expect(upgradesTo(db, "genset").map((d) => d.id)).toEqual(["fuel_cell", "genset_gas"]);
		// Racks retrofit, they do not upgrade: no rung rack is listed as an upgrade target.
		expect(upgradesTo(db, "rack_air_gpu2").map((d) => d.id)).toEqual(["rack_infer"]);
		for (const d of Object.values(f)) {
			if (!d.upgradesFrom) continue;
			const from = f[d.upgradesFrom];
			expect(from, d.id).toBeDefined();
			expect(from.unlockTier, `${d.id} from ${from.id}`).toBeLessThanOrEqual(d.unlockTier);
		}
	});
});

describe("validation", () => {
	it("the shipped content is valid", () => {
		expect(validateContent(db)).toEqual([]);
	});
	it("rejects bad rung data", () => {
		expect(broken((d) => (d.facilities.rack_dlc_gpu2.rung = 1))).toMatch(/is already rung 1/);
		expect(broken((d) => (d.facilities.rack_dlc_gpu2.rung = 3))).toMatch(/rung 3 opens at Level 4/);
		expect(broken((d) => (d.facilities.rack_dlc_gpu.rung = 9))).toMatch(/rung/);
		expect(broken((d) => (d.facilities.rack_dlc_gpu.upgradesFrom = "rack_air_gpu2"))).toMatch(/retrofitted, not upgraded/);
		expect(broken((d) => delete d.facilities.rack_photonic2.rung)).toMatch(/needs a rung|no rack at rung 4/);
		expect(broken((d) => delete d.facilities.rack_dlc_gpu.tech)).toMatch(/needs its research node/);
		expect(broken((d) => (d.facilities.rack_air_gpu2.upgradesFrom = "nope"))).toMatch(/unknown facility "nope"/);
		expect(broken((d) => (d.facilities.rack_air_gpu.upgradesFrom = "rack_air_gpu"))).toMatch(/upgrades itself/);
		expect(broken((d) => (d.facilities.solar_skin.placement = { needsPower: true, roofOnly: true, basementOnly: true }))).toMatch(/cannot be both roofOnly and basementOnly/);
		expect(broken((d) => ((d.facilities.perfusion_bath.cooling as { holdC?: number }).holdC = 0))).toMatch(/holdC/);
	});
	it("requires the Green floor and the tree weights in the Soul balance", () => {
		expect(broken((d) => ((d.balance.soul as { greenFloor?: number }).greenFloor = Number.NaN))).toMatch(/greenFloor/);
		expect(broken((d) => (d.balance.soul.spWeights.biotech = 0))).toMatch(/spWeights\.biotech/);
	});
});
