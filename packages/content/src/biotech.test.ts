import { describe, expect, it } from "vitest";
import { generateContract } from "./contracts";
import { loadContent, validateContent } from "./load";
import type { ContentDB } from "./schema";

const broken = (mutate: (db: ContentDB) => void): string => {
	const db = loadContent();
	mutate(db);
	return validateContent(db).join("\n");
};

describe("biotech content (bundled)", () => {
	const db = loadContent();
	const f = db.facilities;
	const bio = Object.values(f).filter((d) => d.category === "bio");
	const player = bio.filter((d) => !d.growth);
	const growths = bio.filter((d) => d.growth);

	it("loads and validates", () => {
		expect(validateContent(db)).toEqual([]);
	});

	it("has the eight biotech facilities, three of them hardware, and every one gated by wetware tech", () => {
		expect(player.map((d) => d.id).sort()).toEqual(["bioreactor", "culling_room", "dna_vault", "neural_pit", "nutrient_plant", "organoid_incubator", "quarantine_lock", "sterile_bay"]);
		expect(player.filter((d) => d.rack)).toHaveLength(3);
		const byId = new Map(db.tech.map((n) => [n.id, n]));
		for (const d of player) {
			const node = byId.get(d.tech as string);
			expect(node?.branch, d.id).toBe("wetware");
			expect(node?.minTier, d.id).toBeLessThanOrEqual(d.unlockTier);
			expect(node?.description, d.id).toContain(d.name);
		}
		expect(f.culling_room.bio?.cullsGrowths).toBe(true);
		expect(f.sterile_bay.bio?.cullsGrowths).toBeUndefined();
		expect(f.quarantine_lock.width).toBe(1);
		expect(f.bioreactor.power?.capacityKw).toBeGreaterThan(0);
	});

	it("organoids deliver about 3x the PFLOPS per kW of the best T4 rack, at 37 C +- 1", () => {
		const perKw = (id: string): number => (f[id].rack?.pflops ?? 0) / (f[id].rack?.powerKw ?? 1);
		const bestT4 = Math.max(...Object.values(f).filter((d) => d.rack && d.rack.cooling !== "bio" && d.unlockTier <= 4).map((d) => perKw(d.id)));
		for (const id of ["organoid_incubator", "neural_pit"]) {
			expect(perKw(id) / bestT4, id).toBeGreaterThan(2.8);
			expect(perKw(id) / bestT4, id).toBeLessThan(3.4);
			expect(f[id].rack?.bio).toMatchObject({ targetC: 37, toleranceC: 1 });
		}
		expect(f.dna_vault.rack?.storageTB).toBeGreaterThan(f.rack_storage2.rack?.storageTB as number);
	});

	it("incubators unlock at the Wetware Annex tier 3; the neural pit needs Clearance 5 and a path node", () => {
		expect(f.organoid_incubator.unlockTier).toBe(3);
		expect(f.nutrient_plant.unlockTier).toBe(3);
		expect(f.neural_pit.unlockTier).toBe(5);
		const node = db.tech.find((n) => n.id === f.neural_pit.tech);
		expect(node?.path).toBe("biotech");
		expect(db.tech.find((n) => n.id === "wetware_annex")?.minTier).toBe(3);
		expect(db.tech.filter((n) => n.branch === "wetware").length).toBeGreaterThanOrEqual(8);
		expect(db.tech.filter((n) => n.path).every((n) => n.minTier === 5 && n.branch === "wetware")).toBe(true);
	});

	it("has free, unreliable, unbuildable growths", () => {
		expect(growths.length).toBeGreaterThanOrEqual(2);
		for (const g of growths) {
			expect(g.tech).toBeUndefined();
			expect(g.cost).toBe(0);
			expect(g.upkeepPerDay).toBe(0);
			expect(g.width).toBe(1);
			expect(g.bio?.contamination).toBeGreaterThan(0);
			expect(g.rack?.failurePerDay).toBeGreaterThanOrEqual(0.4);
		}
		expect(growths.some((g) => (g.rack?.pflops ?? 0) > 0)).toBe(true);
		expect(growths.some((g) => (g.rack?.storageTB ?? 0) > 0)).toBe(true);
	});

	it("has four premium biotech clients that need organoid racks", () => {
		const cs = db.clients.filter((c) => c.needsBio);
		expect(cs).toHaveLength(4);
		const best = Math.max(...db.clients.filter((c) => !c.needsBio).map((c) => c.payMultiplier));
		for (const c of cs) {
			expect(c.payMultiplier, c.id).toBeGreaterThan(best);
			expect(c.minTier, c.id).toBeGreaterThanOrEqual(3);
			expect(c.needsLiquid).toBeUndefined();
		}
	});

	it("has Clearance 5 and the ascension rule", () => {
		const b = db.balance;
		expect(b.tiers.pflops).toHaveLength(5);
		expect(b.tiers.pflops[4]).toBeGreaterThan(b.tiers.pflops[3]);
		expect(b.loans.maxByTier).toHaveLength(5);
		expect(b.ascension.minTier).toBe(5);
	});

	it("offers biotech now and the other two paths as coming soon", () => {
		expect(db.paths.map((p) => [p.id, p.available])).toEqual([["biotech", true], ["greentech", false], ["synthetic", false]]);
		for (const p of db.paths) expect(p.description.length).toBeGreaterThan(60);
		expect(db.paths[1].description.toLowerCase()).toContain("coming soon");
	});

	it("has the three biotech endings of two or three paragraphs, with no gore words", () => {
		const bio = ["livingTower", "cleanTower", "absorbed"];
		expect(db.endings.map((e) => e.id).slice(0, 3)).toEqual(bio);
		for (const e of db.endings.filter((x) => bio.includes(x.id))) {
			const n = e.body.split("\n\n").length;
			expect(n, e.id).toBeGreaterThanOrEqual(2);
			expect(n, e.id).toBeLessThanOrEqual(3);
			expect(e.body, e.id).not.toMatch(/\b(blood|gore|corpse|flesh|scream|body|bodies|eyes|face)\b/i);
		}
	});

	it("has at least 10 horror memos escalating from 0.1 to 0.9 corruption, none before Clearance 3", () => {
		const h = db.events.filter((e) => e.category === "horror");
		expect(h.length).toBeGreaterThanOrEqual(10);
		const cs = h.map((e) => e.minCorruption as number);
		expect(Math.min(...cs)).toBe(0.1);
		expect(Math.max(...cs)).toBe(0.9);
		expect(cs.every((c) => c >= 0 && c <= 1)).toBe(true);
		expect(h.every((e) => e.minTier >= 3)).toBe(true);
		expect(h.some((e) => e.path === "biotech")).toBe(true);
		for (const e of h) expect(e.body + e.title, e.id).not.toMatch(/\b(blood|gore|corpse|scream|eyes?|faces?)\b/i);
	});

	it("has 8 biotech memos from tier 3 and 4 T1-T2 seed memos", () => {
		const ids = ["nutrient_spoilage", "contamination_audit", "incubator_drift", "cell_line_certificate", "wetware_grant", "asset_registration", "mutation_report", "biosafety_visit"];
		for (const id of ids) {
			const e = db.events.find((x) => x.id === id);
			expect(e?.minTier, id).toBeGreaterThanOrEqual(3);
			expect(["ministry", "operational"], id).toContain(e?.category);
		}
		const seeds = ["form_9b_brochure", "damp_patch", "smell_report", "lamp_phasing"].map((id) => db.events.find((x) => x.id === id));
		expect(seeds.every((e) => e && e.maxTier === 2 && e.minTier <= 2)).toBe(true);
		expect(seeds[0]?.title).toContain("Form 9-B");
	});

	it("balance: one unattended incubator contaminates noticeably within days; one Sterile Bay holds two incubators clean", () => {
		const { diffusion: D, decay } = db.balance.bio;
		const inc = f.organoid_incubator;
		const bay = f.sterile_bay.bio as { cleanRate: number; radius: number };
		const run = (cabinets: number, bays: number, days: number): number[] => {
			const W = 48;
			let c = new Array<number>(W).fill(0);
			for (let t = 0; t < days * 1440; t++) {
				const n = c.map((v, x) => v + D * ((c[x - 1] ?? v) - v) + D * ((c[x + 1] ?? v) - v));
				for (let k = 0; k < cabinets; k++) for (let x = (cabinets > 2 ? 16 : 20) + 2 * k; x < (cabinets > 2 ? 18 : 22) + 2 * k; x++) n[x] += inc.rack?.bio?.contamination ?? 0;
				for (let k = 0; k < bays; k++) for (let x = Math.max(0, 24 - bay.radius); x <= Math.min(W - 1, 24 + bay.radius); x++) n[x] = Math.max(0, n[x] - bay.cleanRate);
				c = n.map((v) => Math.min(1, Math.max(0, v * (1 - decay))));
			}
			return c;
		};
		expect(Math.max(...run(1, 0, 3))).toBeGreaterThan(0.25);
		expect(Math.max(...run(1, 0, 3))).toBeLessThan(db.balance.bio.mutationThreshold);
		expect(Math.max(...run(2, 0, 7))).toBeGreaterThan(db.balance.bio.growthThreshold);
		expect(Math.max(...run(2, 1, 7))).toBeLessThan(0.1);
		expect(Math.max(...run(4, 1, 7))).toBeGreaterThan(0.3);
	});

	it("endings balance: the three outcomes are ordered and reachable", () => {
		const e = db.balance.endings;
		expect(e.cleanTower.maxCorruption).toBeLessThan(e.livingTower.minCorruption);
		expect(e.livingTower.minCorruption).toBeLessThan(e.absorbed.corruption);
		const neuralPits = Math.ceil(e.livingTower.pflops / (f.neural_pit.rack?.pflops as number));
		expect(neuralPits).toBeLessThanOrEqual(5);
		expect(e.livingTower.pflops).toBeLessThanOrEqual(db.balance.tiers.pflops[4]);
	});
});

describe("organoid contracts", () => {
	const db = loadContent();
	const mk = (seed: number): (() => number) => {
		let a = seed;
		return () => {
			a = (a + 0x6d2b79f5) >>> 0;
			let t = Math.imul(a ^ (a >>> 15), a | 1);
			t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	};
	it("marks needsBio and sizes them for a few organoid racks", () => {
		const rng = mk(5);
		const out = Array.from({ length: 800 }, () => generateContract(rng, { tier: 4, capacityPflops: 5000, day: 20 }, db));
		const bioJobs = out.filter((c) => db.clients.find((k) => k.id === c.clientId)?.needsBio);
		expect(bioJobs.length).toBeGreaterThan(40);
		const best = db.facilities.organoid_incubator.rack?.pflops as number;
		for (const c of bioJobs) {
			expect(c.needsBio).toBe(true);
			if (c.kind === "inference") expect(c.sustainedPflops).toBeLessThanOrEqual(4 * best * 0.6 + 0.1);
			else expect(c.work).toBeLessThanOrEqual(4 * best * 3 * 24 + 1);
		}
		for (const c of out) if (!db.clients.find((k) => k.id === c.clientId)?.needsBio) expect(c.needsBio).toBeUndefined();
	});
});

describe("validateContent: M3 rules", () => {
	it("checks facility kinds, specs and categories", () => {
		expect(broken((db) => delete db.facilities.bioreactor.bio)).toMatch(/requires a "bio" spec/);
		expect(broken((db) => delete db.facilities.bioreactor.power)).toMatch(/requires a "power" spec/);
		expect(broken((db) => delete db.facilities.nutrient_plant.bio)).toMatch(/requires a "bio" spec/);
		expect(broken((db) => (db.facilities.quarantine_lock.bio = { contamination: 1 }))).toMatch(/unexpected "bio" spec/);
		expect(broken((db) => (db.facilities.sterile_bay.category = "cooling"))).toMatch(/category/);
		expect(broken((db) => (db.facilities.organoid_incubator.category = "rack"))).toMatch(/should be "bio"/);
		expect(broken((db) => (db.facilities.nutrient_plant.width = 2))).toMatch(/nutrient must be at least 3/);
		expect(broken((db) => (db.facilities.bioreactor.width = 3))).toMatch(/bioreactor must be at least 4/);
	});

	it("checks bio, organoid and nutrient specs", () => {
		expect(broken((db) => delete db.facilities.organoid_incubator.rack!.bio)).toMatch(/organoid spec/);
		expect(broken((db) => (db.facilities.organoid_incubator.rack!.bio!.toleranceC = 0))).toMatch(/toleranceC/);
		expect(broken((db) => (db.facilities.organoid_incubator.rack!.bio!.nutrientUse = 0))).toMatch(/nutrientUse/);
		expect(broken((db) => (db.facilities.organoid_incubator.rack!.liquidFraction = 0.5))).toMatch(/liquidFraction/);
		expect(broken((db) => (db.facilities.rack_air_gpu.rack!.bio = { targetC: 37, toleranceC: 1, nutrientUse: 1, contamination: 0.1 }))).toMatch(/only cooling "bio"/);
		expect(broken((db) => (db.facilities.sterile_bay.bio!.cleanRate = 0))).toMatch(/cleanRate/);
		expect(broken((db) => (db.facilities.nutrient_plant.bio!.nutrientCapacity = 0))).toMatch(/nutrientCapacity/);
		expect(broken((db) => (db.facilities.bioreactor.bio!.nutrientUse = 0))).toMatch(/nutrientUse/);
		expect(broken((db) => delete db.facilities.organoid_incubator.placement!.needsNutrient)).toMatch(/nutrient pipe/);
		expect(broken((db) => (db.facilities.crah_unit.placement!.needsNutrient = true))).toMatch(/only wetware/);
		expect(broken((db) => (db.facilities.culling_room.bio!.cullsGrowths = "yes" as never))).toMatch(/cullsGrowths/);
	});

	it("checks growths and wetware gating", () => {
		expect(broken((db) => (db.facilities.growth_mass.tech = "wetware_annex"))).toMatch(/never researched/);
		expect(broken((db) => (db.facilities.growth_mass.cost = 5))).toMatch(/free/);
		expect(broken((db) => (db.facilities.growth_mass.bio!.contamination = 0))).toMatch(/contamination/);
		expect(broken((db) => delete db.facilities.sterile_bay.tech)).toMatch(/gated behind wetware/);
		expect(broken((db) => (db.facilities.sterile_bay.tech = "chilled_loop"))).toMatch(/"wetware" tech node/);
	});

	it("keeps nutrient out of scenarios", () => {
		expect(broken((db) => db.scenarios.starter.facilities.push({ defId: "nutrient_plant", floor: 1, x: 40 }))).toMatch(/no nutrient conduits/);
		expect(broken((db) => db.scenarios.starter.facilities.push({ defId: "growth_mass", floor: 1, x: 40 }))).toMatch(/growths cannot be pre-placed/);
	});

	it("checks tech and event paths and corruption gates", () => {
		expect(broken((db) => (db.tech[0].path = "nope" as never))).toMatch(/unknown path/);
		const e = (db: ContentDB) => db.events.find((x) => x.id === "h_early_lift")!;
		expect(broken((db) => (e(db).minCorruption = 1.5))).toMatch(/minCorruption/);
		expect(broken((db) => (e(db).minCorruption = -0.1))).toMatch(/minCorruption/);
		expect(broken((db) => delete e(db).minCorruption)).toMatch(/corruption-gated/);
		expect(broken((db) => (e(db).path = "nope" as never))).toMatch(/unknown path/);
	});

	it("checks clients, paths, endings and balance", () => {
		expect(broken((db) => (db.clients.find((c) => c.needsBio)!.needsLiquid = true))).toMatch(/mutually exclusive/);
		expect(broken((db) => db.paths.pop())).toMatch(/missing "synthetic"/);
		expect(broken((db) => { for (const p of db.paths) p.available = false; })).toMatch(/at least one path/);
		expect(broken((db) => { db.endings = db.endings.filter((e) => e.id !== "absorbed"); })).toMatch(/missing "absorbed"/);
		expect(broken((db) => (db.endings[0].body = ""))).toMatch(/body/);
		expect(broken((db) => (db.balance.ascension.minTier = 9))).toMatch(/minTier/);
		expect(broken((db) => (db.balance.bio.decay = 2))).toMatch(/decay/);
		expect(broken((db) => (db.balance.bio.diffusion = 0.4))).toMatch(/stable/);
		expect(broken((db) => (db.balance.bio.growthThreshold = 0.1))).toMatch(/growthThreshold/);
		expect(broken((db) => (db.balance.endings.livingTower.days = 0))).toMatch(/days/);
		expect(broken((db) => (db.balance.endings.cleanTower.maxCorruption = 0.9))).toMatch(/cleanTower\.maxCorruption must be below/);
		expect(broken((db) => (db.balance.endings.absorbed.corruption = 0.5))).toMatch(/absorbed\.corruption must be above/);
	});
});
