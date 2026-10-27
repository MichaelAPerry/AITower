import { describe, expect, it } from "vitest";
import { loadContent, validateContent } from "./load";
import { AUTOMATION_TECH, GREEN_TECH, M4_FACILITIES, M4_TECH, SYNTH_TECH } from "./m4ids";
import type { ContentDB } from "./schema";

const broken = (mutate: (db: ContentDB) => void): string => {
	const db = loadContent();
	mutate(db);
	return validateContent(db).join("\n");
};

const GORE = /\b(blood|gore|corpse|flesh|scream|body|bodies|eyes?|faces?)\b/i;

describe("M4 content (bundled)", () => {
	const db = loadContent();
	const f = db.facilities;
	const byTech = new Map(db.tech.map((n) => [n.id, n]));

	it("loads and validates", () => {
		expect(validateContent(db)).toEqual([]);
		for (const id of M4_FACILITIES) expect(f[id], id).toBeDefined();
		for (const id of M4_TECH) expect(byTech.get(id), id).toBeDefined();
	});

	describe("Greentech facilities", () => {
		const kinds = (k: string) => Object.values(f).filter((d) => d.kind === k);

		it("has about 8 facilities covering solar, wind, heat export, carbon and green racks", () => {
			const green = ["solar_skin", "solar_canopy", "wind_mast", "heat_exchanger", "heat_pipeline", "algae_facade", "carbon_capture", "rack_neuromorphic", "rack_photonic"];
			expect(green).toHaveLength(9);
			expect(kinds("solar").map((d) => d.id).sort()).toEqual(["microgrid_bea", "solar_canopy", "solar_skin"]);
			expect(kinds("wind").map((d) => d.id)).toEqual(["wind_mast"]);
			expect(kinds("heat_export").map((d) => d.id).sort()).toEqual(["heat_exchanger", "heat_pipeline"]);
			expect(kinds("carbon").map((d) => d.id).sort()).toEqual(["algae_facade", "carbon_capture"]);
		});

		it("solar and wind are power sources that sit on a power conduit", () => {
			for (const d of [...kinds("solar"), ...kinds("wind")]) {
				expect(d.category, d.id).toBe("power");
				expect(d.power?.capacityKw, d.id).toBeGreaterThan(0);
				expect(d.placement?.needsPower, d.id).toBe(true);
				expect(d.green, d.id).toBeUndefined();
			}
			expect(f.solar_canopy.power!.capacityKw).toBeGreaterThan(f.solar_skin.power!.capacityKw);
		});

		it("heat exporters and carbon plants have a green spec, the bigger one earning more", () => {
			for (const d of kinds("heat_export")) {
				expect(d.green?.exportKw, d.id).toBeGreaterThan(0);
				expect(d.green?.radius, d.id).toBeGreaterThan(0);
				expect(d.power, d.id).toBeUndefined();
			}
			for (const d of kinds("carbon")) expect(d.green?.creditsPerDay, d.id).toBeGreaterThan(0);
			expect(f.heat_pipeline.green!.exportKw).toBeGreaterThan(f.heat_exchanger.green!.exportKw as number);
			expect(f.carbon_capture.green!.creditsPerDay).toBeGreaterThan(f.algae_facade.green!.creditsPerDay as number);
		});

		it("respects the native art widths", () => {
			for (const d of kinds("solar")) expect(d.width, d.id).toBeGreaterThanOrEqual(2);
			for (const d of kinds("wind")) expect(d.width, d.id).toBeGreaterThanOrEqual(1);
			for (const d of kinds("heat_export")) expect(d.width, d.id).toBeGreaterThanOrEqual(2);
			for (const d of kinds("carbon")) expect(d.width, d.id).toBeGreaterThanOrEqual(2);
		});

		it("every plant pays for itself within a few months at the balance prices", () => {
			const b = db.balance;
			const energy = b.energyPrice;
			// Average output per day: solar ~37% of peak (a 14 h sine), wind ~60% (hourly draw 0.2..1).
			const solarAvg = (kw: number): number => kw * 0.37 * 24 * energy;
			const windAvg = (kw: number): number => kw * 0.6 * 24 * energy;
			for (const id of ["solar_skin", "solar_canopy"]) expect(f[id].cost / solarAvg(f[id].power!.capacityKw), id).toBeLessThan(120);
			expect(f.wind_mast.cost / windAvg(f.wind_mast.power!.capacityKw)).toBeLessThan(120);
			for (const id of ["heat_exchanger", "heat_pipeline"]) {
				const net = f[id].green!.exportKw! * 24 * b.green.heatPrice - f[id].facilityKw * 24 * energy;
				expect(f[id].cost / net, id).toBeLessThan(120);
				expect(net, id).toBeGreaterThan(0);
			}
			for (const id of ["algae_facade", "carbon_capture"]) {
				const net = f[id].green!.creditsPerDay! * b.green.creditPrice - f[id].facilityKw * 24 * energy;
				expect(f[id].cost / net, id).toBeLessThan(120);
				expect(net, id).toBeGreaterThan(0);
			}
		});

		it("the green racks draw very little power per PFLOPS and stay air-cooled", () => {
			const perKw = (id: string): number => f[id].rack!.pflops / f[id].rack!.powerKw;
			for (const id of ["rack_neuromorphic", "rack_photonic"]) {
				expect(f[id].rack!.cooling, id).toBe("air");
				expect(f[id].category, id).toBe("rack");
			}
			// Neuromorphic stays below the organoid lead of M3; photonic is the efficiency record of the trunk.
			expect(perKw("rack_neuromorphic")).toBeGreaterThan(1.5);
			expect(perKw("rack_photonic")).toBeGreaterThan(5);
			expect(perKw("rack_photonic")).toBeLessThan(perKw("organoid_incubator") * 2.4);
			expect(f.rack_photonic.rack!.powerKw).toBeLessThanOrEqual(40);
		});
	});

	describe("Synthetic Mind facilities", () => {
		it("has four facilities that reuse existing kinds; the mind lattice is a rack", () => {
			expect(f.cryo_core.kind).toBe("chiller");
			expect(f.cryo_core.cooling!.capacityKw).toBeGreaterThan(f.chiller_free.cooling!.capacityKw * 0.5);
			expect(f.cryo_core.cooling!.cop).toBeGreaterThan(f.chiller_free.cooling!.cop as number);
			expect(f.rack_mind_lattice.kind).toBe("rack");
			expect(f.rack_mind_lattice.rack!.pflops).toBeGreaterThan(f.rack_dlc_gpu3.rack!.pflops);
			expect(f.rack_mind_lattice.placement?.needsCoolant).toBe(true);
			expect(f.continuity_monitor.kind).toBe("ups");
			expect(f.backup_vault.kind).toBe("rack");
			expect(f.backup_vault.rack!.pflops).toBe(0);
			expect(f.backup_vault.rack!.storageTB).toBeGreaterThan(f.dna_vault.rack!.storageTB);
		});

		it("the lattice cabinet stays below the throttle point at nominal cooling", () => {
			const t = db.balance.thermal;
			const r = f.rack_mind_lattice.rack!;
			expect((1 - r.liquidFraction) * 20 + r.liquidFraction * t.coolantSupplyC + t.rackDeltaC).toBeLessThan(t.okC);
		});
	});

	describe("research", () => {
		const perDay = (pf: number): number => pf * 24 * db.balance.research.pointsPerPflopHour + 6 * db.balance.research.pointsPerJob;
		const typical: Record<number, number> = { 2: perDay(240), 3: perDay(800), 4: perDay(1500), 5: perDay(3000) };
		const days = (id: string): number => byTech.get(id)!.cost / typical[byTech.get(id)!.minTier];

		it("gates every new facility behind a node of the same or a lower tier whose description names it", () => {
			for (const id of M4_FACILITIES) {
				const node = byTech.get(f[id].tech as string);
				expect(node, id).toBeDefined();
				expect(node!.minTier, id).toBeLessThanOrEqual(f[id].unlockTier);
				expect(node!.description, id).toContain(f[id].name);
			}
		});

		it("has a Greentech branch of about 8 nodes, none of them behind a commit", () => {
			expect(GREEN_TECH.length).toBeGreaterThanOrEqual(8);
			const path = GREEN_TECH.filter((id) => byTech.get(id)?.path === "greentech");
			expect(path.length).toBeGreaterThanOrEqual(6);
			for (const id of GREEN_TECH) expect((byTech.get(id) as { requiresCommit?: unknown }).requiresCommit, id).toBeUndefined();
			for (const id of ["neuromorphic_bench", "canopy_array", "heat_pipeline_franchise", "carbon_capture_dossier", "photonic_bench"]) expect(byTech.get(id)?.path, id).toBe("greentech");
		});

		it("has 5 Synthetic nodes, all T4 or T5, tagged Synthetic and open to anyone", () => {
			expect(SYNTH_TECH).toHaveLength(5);
			for (const id of SYNTH_TECH) {
				expect(byTech.get(id)!.path, id).toBe("synthetic");
				expect(byTech.get(id)!.minTier, id).toBeGreaterThanOrEqual(4);
			}
			// + Combined-Cycle, Cryo Plant and Reactor Licence (docs/TREES.md).
			expect(db.tech.filter((n) => n.path === "synthetic")).toHaveLength(8);
		});

		it("Level-3 nodes take 1-3 days of typical output and the rest 2.5-8 days", () => {
			for (const id of M4_TECH) {
				const n = byTech.get(id)!;
				if (AUTOMATION_TECH.includes(id)) continue;
				if (n.minTier === 3) {
					expect(days(id), id).toBeGreaterThanOrEqual(1);
					expect(days(id), id).toBeLessThanOrEqual(3);
				} else {
					expect(days(id), id).toBeGreaterThanOrEqual(2.5);
					expect(days(id), id).toBeLessThanOrEqual(8);
				}
			}
		});

		it("the Works Foreman is a tier-1 administration node (so a fully automated run can reach Clearance 2) that switches on the foreman", () => {
			const n = byTech.get("works_foreman")!;
			expect(n.name).toBe("Works Foreman");
			expect(n.branch).toBe("administration");
			expect(n.minTier).toBe(1);
			expect(n.effects).toEqual([{ type: "feature", feature: "foreman" }]);
			expect(n.cost).toBe(1200);
			expect(n.requires).toEqual(["contracts_clerk"]);
			expect(n.description).toContain(`${db.balance.automation.foremanPerHour} facility per game-hour`);
			expect(n.path).toBeUndefined();
		});

		it("path-gated perks are modest and their descriptions state the real numbers", () => {
			for (const id of ["green_ledger", "mind_lattice_dossier", "continuity_doctrine", "standing_orders_binder"]) {
				const n = byTech.get(id)!;
				for (const e of n.effects) {
					if (e.type !== "perk") continue;
					expect(e.factor, id).toBeGreaterThanOrEqual(0.8);
					expect(e.factor, id).toBeLessThanOrEqual(1.15);
					expect(n.description, id).toContain(`${Math.round(Math.abs(e.factor - 1) * 100)}%`);
				}
			}
		});
	});

	describe("paths, clients and endings", () => {
		it("offers all three paths with strong descriptions", () => {
			const g = db.paths.find((p) => p.id === "greentech")!;
			const s = db.paths.find((p) => p.id === "synthetic")!;
			expect(g.description).toMatch(/green score/);
			expect(s.description).toMatch(/cheapest/i);
		});

		it("adds two climate clients", () => {
			const ids = ["dunkelflaute_service", "carbon_ledger_consortium"];
			for (const id of ids) {
				const c = db.clients.find((x) => x.id === id)!;
				expect(c.sector, id).toBe("climate");
				expect(c.minTier, id).toBeGreaterThanOrEqual(3);
			}
		});

		it("has real two- or three-paragraph endings for the two new paths, with no gore", () => {
			for (const id of ["garden", "singularity"]) {
				const e = db.endings.find((x) => x.id === id)!;
				expect(e.body, id).not.toMatch(/placeholder/i);
				const n = e.body.split("\n\n").length;
				expect(n, id).toBeGreaterThanOrEqual(2);
				expect(n, id).toBeLessThanOrEqual(3);
				expect(e.body, id).not.toMatch(GORE);
			}
		});
	});

	describe("events", () => {
		const green = db.events.filter((e) => e.path === "greentech");
		const synth = db.events.filter((e) => e.path === "synthetic");

		it("has greentech memos including a Dunkelflaute warning and a heat-export tariff memo", () => {
			const ids = ["dunkelflaute_warning", "heat_tariff_revision", "carbon_credit_audit"];
			for (const id of ids) expect(db.events.find((e) => e.id === id)?.minTier, id).toBeGreaterThanOrEqual(3);
			expect(db.events.find((e) => e.id === "dunkelflaute_warning")?.category).toBe("environmental");
			expect(db.events.filter((e) => /^heat_tariff_/.test(e.id)).length).toBeGreaterThanOrEqual(1);
		});

		it("has two quiet fungal memos on the greentech path and two identity memos on the synthetic path", () => {
			expect(green).toHaveLength(2);
			expect(synth).toHaveLength(2);
			for (const e of [...green, ...synth]) {
				expect(e.category, e.id).toBe("horror");
				expect(e.minTier, e.id).toBe(5);
				expect(e.minCorruption, e.id).toBeUndefined(); // their paths have their own scores, not corruption
				expect(e.body + e.title, e.id).not.toMatch(GORE);
			}
			expect(green.some((e) => /mycelium/i.test(e.title))).toBe(true);
			expect(synth.some((e) => /audit/i.test(e.title))).toBe(true);
			expect(synth.some((e) => /Backup/i.test(e.title))).toBe(true);
		});
	});

	describe("scenarios", () => {
		it("has the brownfield tower: a bigger half-built lot, low cash, Clearance 2, one tired air handler", () => {
			const s = db.scenarios.brownfield;
			const starter = db.scenarios.starter;
			expect(s.description?.length).toBeGreaterThan(60);
			expect(s.startTier).toBe(2);
			expect(s.startingCash).toBeLessThan(db.balance.startingCash / 4);
			expect(s.sandbox).toBeUndefined();
			expect(s.slabs.length).toBeGreaterThan(starter.slabs.length);
			expect(Math.max(...s.slabs.map(([floor]) => floor))).toBeGreaterThan(Math.max(...starter.slabs.map(([floor]) => floor)));
			// Overloaded: more air cabinets than the starter, still on a single air handler.
			const racks = (id: string): number => db.scenarios[id].facilities.filter((p) => f[p.defId].rack?.cooling === "air" && f[p.defId].rack!.pflops > 0).length;
			expect(racks("brownfield")).toBeGreaterThan(racks("starter"));
			expect(s.facilities.filter((p) => f[p.defId].kind === "crah")).toHaveLength(1);
		});

		it("has the sandbox: large cash, Clearance 5, no failure states", () => {
			const s = db.scenarios.sandbox;
			expect(s.sandbox).toBe(true);
			expect(s.startTier).toBe(5);
			expect(s.startingCash).toBeGreaterThanOrEqual(100_000_000);
			expect(s.description?.length).toBeGreaterThan(60);
		});

		it("leaves the starter scenario untouched", () => {
			const s = db.scenarios.starter;
			expect(s.startTier).toBeUndefined();
			expect(s.startingCash).toBeUndefined();
			expect(s.sandbox).toBeUndefined();
		});
	});

	describe("balance", () => {
		it("tunes the green economy: heat sells below electricity, drought is rare and short", () => {
			const g = db.balance.green;
			expect(g.heatPrice).toBeLessThan(db.balance.energyPrice);
			expect(g.heatPrice).toBeGreaterThan(0);
			expect(g.droughtChancePerDay).toBeGreaterThan(0.02);
			expect(g.droughtChancePerDay).toBeLessThanOrEqual(0.1);
			expect(g.droughtFactor).toBeLessThanOrEqual(0.2);
			expect(g.droughtHours).toBeGreaterThanOrEqual(8);
			expect(g.droughtHours).toBeLessThanOrEqual(24);
		});

		it("tunes the Foreman and the parts batch", () => {
			expect(db.balance.automation.partsBatch).toBeGreaterThanOrEqual(1);
			expect(db.balance.automation.partsBatch).toBeLessThanOrEqual(10);
			expect(db.balance.automation.foremanPerHour).toBeGreaterThanOrEqual(1);
		});

		it("tunes the Soul: each tree has a weight, Green is slow without clean power", () => {
			const so = db.balance.soul;
			for (const w of Object.values(so.spWeights)) expect(w).toBeGreaterThan(0);
			expect(so.spWeights.greentech).toBeGreaterThan(so.spWeights.synthetic);
			expect(so.spWeights.synthetic).toBeGreaterThan(so.spWeights.biotech);
			expect(so.greenFloor).toBeLessThanOrEqual(0.2);
			expect(so.bondEpilogue).toBe(60);
			// A Level-5 tower of 3000 PF of Synthetic racks reaches the Lattice within about a week.
			const days = so.spTarget / (3000 * so.spWeights.synthetic * so.spPerPflopHour * 24);
			expect(days).toBeGreaterThan(3);
			expect(days).toBeLessThan(12);
		});
	});
});

describe("validateContent: M4 rules", () => {
	it("checks the green spec of heat exporters and carbon plants", () => {
		expect(broken((db) => delete db.facilities.heat_exchanger.green)).toMatch(/requires a "green" spec/);
		expect(broken((db) => (db.facilities.heat_exchanger.green!.exportKw = 0))).toMatch(/exportKw/);
		expect(broken((db) => (db.facilities.heat_pipeline.green!.radius = 0))).toMatch(/radius/);
		expect(broken((db) => (db.facilities.algae_facade.green!.creditsPerDay = 0))).toMatch(/creditsPerDay/);
		expect(broken((db) => (db.facilities.algae_facade.green!.creditsPerDay = -1))).toMatch(/creditsPerDay/);
		expect(broken((db) => (db.facilities.solar_skin.green = { exportKw: 10 }))).toMatch(/unexpected "green" spec/);
	});

	it("checks the power spec of solar and wind", () => {
		expect(broken((db) => delete db.facilities.solar_skin.power)).toMatch(/requires a "power" spec/);
		expect(broken((db) => (db.facilities.wind_mast.power!.capacityKw = 0))).toMatch(/capacityKw/);
		expect(broken((db) => (db.facilities.wind_mast.placement!.needsPower = false))).toMatch(/must sit on a power conduit/);
		expect(broken((db) => (db.facilities.solar_skin.placement!.needsPower = false))).toMatch(/must sit on a power conduit/);
		expect(broken((db) => (db.facilities.solar_skin.category = "cooling"))).toMatch(/category/);
	});

	it("checks the native art widths of the new kinds", () => {
		expect(broken((db) => (db.facilities.solar_skin.width = 1))).toMatch(/solar must be at least 2 tiles/);
		expect(broken((db) => (db.facilities.heat_exchanger.width = 1))).toMatch(/heat_export must be at least 2 tiles/);
		expect(broken((db) => (db.facilities.algae_facade.width = 1))).toMatch(/carbon must be at least 2 tiles/);
		expect(broken((db) => (db.facilities.wind_mast.width = 0))).toMatch(/width/);
		expect(broken((db) => (db.facilities.wind_mast.width = 1))).toBe("");
	});

	it("accepts the foreman feature and rejects unknown ones", () => {
		expect(broken(() => undefined)).toBe("");
		expect(broken((db) => (db.tech.find((n) => n.id === "works_foreman")!.effects = [{ type: "feature", feature: "bogus" as never }]))).toMatch(/unknown feature "bogus"/);
	});

	it("checks scenario fields", () => {
		expect(broken((db) => (db.scenarios.brownfield.startTier = 0))).toMatch(/startTier/);
		expect(broken((db) => (db.scenarios.brownfield.startTier = 6))).toMatch(/startTier/);
		expect(broken((db) => (db.scenarios.brownfield.startTier = 2.5))).toMatch(/startTier/);
		expect(broken((db) => (db.scenarios.brownfield.startingCash = -1))).toMatch(/startingCash/);
		expect(broken((db) => (db.scenarios.sandbox.sandbox = "yes" as never))).toMatch(/sandbox/);
		expect(broken((db) => (db.scenarios.sandbox.description = ""))).toMatch(/description/);
		expect(broken((db) => (db.scenarios.brownfield.facilities[0].x = 54))).toMatch(/brownfield/);
	});

	it("checks the green and automation balance", () => {
		expect(broken((db) => (db.balance.green.heatPrice = -1))).toMatch(/heatPrice/);
		expect(broken((db) => (db.balance.green.creditPrice = -1))).toMatch(/creditPrice/);
		expect(broken((db) => (db.balance.green.droughtChancePerDay = 2))).toMatch(/droughtChancePerDay/);
		expect(broken((db) => (db.balance.green.droughtFactor = 1.5))).toMatch(/droughtFactor/);
		expect(broken((db) => (db.balance.green.droughtHours = 0))).toMatch(/droughtHours/);
		expect(broken((db) => (db.balance.automation.partsBatch = 0))).toMatch(/partsBatch/);
		expect(broken((db) => (db.balance.automation.foremanPerHour = 1.5))).toMatch(/foremanPerHour/);
		expect(broken((db) => delete (db.balance as { green?: unknown }).green)).toMatch(/balance.green: missing/);
		expect(broken((db) => delete (db.balance as { automation?: unknown }).automation)).toMatch(/balance.automation: missing/);
	});

	it("checks the Soul balance", () => {
		expect(broken((db) => (db.balance.soul.spTarget = 0))).toMatch(/spTarget/);
		expect(broken((db) => (db.balance.soul.bondEpilogue = 120))).toMatch(/bondEpilogue/);
		expect(broken((db) => delete (db.balance.soul.spWeights as Partial<typeof db.balance.soul.spWeights>).greentech)).toMatch(/spWeights.greentech/);
		expect(broken((db) => delete (db.balance as { soul?: unknown }).soul)).toMatch(/balance.soul: missing/);
	});

	it("gates horror memos by corruption except on the greentech and synthetic paths", () => {
		expect(broken((db) => delete db.events.find((e) => e.id === "h_early_lift")!.minCorruption)).toMatch(/corruption-gated/);
		expect(broken((db) => delete db.events.find((e) => e.id === "h_headcount")!.minCorruption)).toMatch(/corruption-gated/);
		expect(broken((db) => (db.events.find((e) => e.id === "g_mycelium_ducts")!.path = undefined))).toMatch(/corruption-gated/);
		expect(broken((db) => (db.events.find((e) => e.id === "g_mycelium_ducts")!.path = "biotech"))).toMatch(/corruption-gated/);
	});

	it("requires every Singularity ending to have text", () => {
		expect(broken((db) => (db.endings = db.endings.filter((e) => e.id !== "singularity")))).toMatch(/missing "singularity"/);
		expect(broken((db) => (db.endings.find((e) => e.id === "garden")!.body = ""))).toMatch(/garden/);
	});
});
