import { describe, expect, it } from "vitest";
import { isWetware } from "./catalogue";
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
	const bio = Object.values(f).filter((d) => isWetware(d));
	const player = bio.filter((d) => !d.growth);
	const growths = bio.filter((d) => d.growth);

	it("loads and validates", () => {
		expect(validateContent(db)).toEqual([]);
	});

	it("has the twelve wetware facilities, five of them racks, each gated by wetware tech", () => {
		expect(player.map((d) => d.id).sort()).toEqual([
			"biogas_digester",
			"bioreactor",
			"culling_room",
			"dna_vault",
			"neural_pit",
			"nutrient_plant",
			"nutrient_works",
			"organoid_incubator",
			"quarantine_lock",
			"rack_organoid_2",
			"rack_organoid_3",
			"sterile_bay",
		]);
		expect(player.filter((d) => d.rack)).toHaveLength(5);
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

	it("organoids deliver at least 1.3x the PFLOPS per kW of the best non-bio rack, at 37 C +- 1", () => {
		const perKw = (id: string): number => (f[id].rack?.pflops ?? 0) / (f[id].rack?.powerKw ?? 1);
		// Against the shared and Synthetic racks: the Green line (neuromorphic, photonic) is the one that beats the Flesh on PFLOPS per kW.
		const bestT4 = Math.max(...Object.values(f).filter((d) => d.rack && d.rack.cooling !== "bio" && d.line !== "greentech" && d.unlockTier <= 4).map((d) => perKw(d.id)));
		for (const id of ["organoid_incubator", "neural_pit"]) {
			expect(perKw(id) / bestT4, id).toBeGreaterThan(1.3);
			expect(perKw(id) / bestT4, id).toBeLessThan(3.4);
			expect(f[id].rack?.bio).toMatchObject({ targetC: 37, toleranceC: 1 });
		}
		expect(f.dna_vault.rack?.storageTB).toBeGreaterThan(f.rack_storage2.rack?.storageTB as number);
	});

	it("incubators unlock at the Wetware Annex at Level 2, with the nutrient plant; the neural pit needs Clearance 5", () => {
		expect(f.organoid_incubator.unlockTier).toBe(2);
		expect(f.nutrient_plant.unlockTier).toBe(2);
		expect(f.neural_pit.unlockTier).toBe(5);
		expect(db.tech.find((n) => n.id === f.neural_pit.tech)?.minTier).toBe(5);
		expect(db.tech.find((n) => n.id === "wetware_annex")?.minTier).toBe(2);
		expect(db.tech.filter((n) => n.branch === "wetware").length).toBeGreaterThanOrEqual(8);
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

	it("has five Levels and opens the tree commitment at Level 3", () => {
		const b = db.balance;
		expect(b.tiers.pflops).toHaveLength(5);
		expect(b.tiers.pflops[4]).toBeGreaterThan(b.tiers.pflops[3]);
		expect(b.loans.maxByTier).toHaveLength(5);
		expect(b.ascension.minTier).toBe(3);
	});

	it("describes all three trees", () => {
		expect(db.paths.map((p) => p.id)).toEqual(["biotech", "greentech", "synthetic"]);
		for (const p of db.paths) {
			expect(p.description.length).toBeGreaterThan(200);
			expect(p.description.toLowerCase()).not.toContain("coming soon");
		}
	});

	it("has three Singularity endings, Absorbed and Bankrupt, of three to five paragraphs, with no gore words", () => {
		expect(db.endings.map((e) => e.id)).toEqual(["singularity", "flesh", "garden", "absorbed", "bankrupt"]);
		for (const e of db.endings) {
			const n = e.body.split("\n\n").length;
			expect(n, e.id).toBeGreaterThanOrEqual(3);
			expect(n, e.id).toBeLessThanOrEqual(5);
			expect(e.body, e.id).not.toMatch(/\b(blood|gore|corpse|scream)\b/i);
		}
	});

	it("each Singularity ending has its tree's art and an epilogue for every advisor", () => {
		const art = { singularity: "synthetic", flesh: "biotech", garden: "greentech" } as const;
		for (const [id, tree] of Object.entries(art)) {
			const e = db.endings.find((x) => x.id === id);
			expect(e?.backdrop, id).toBe(tree);
			expect(Object.keys(e?.epilogue ?? {}).sort(), id).toEqual(["bea", "cass", "luci", "mel"]);
		}
	});

	it("has at least 3 corruption-gated horror memos escalating from 0.1 to 0.9 corruption, none before Clearance 3", () => {
		// The greentech and synthetic horror memos are gated by path (they have no corruption score); see m4.test.ts.
		const h = db.events.filter((e) => e.category === "horror" && e.path !== "greentech" && e.path !== "synthetic");
		expect(h.length).toBeGreaterThanOrEqual(3);
		const cs = h.map((e) => e.minCorruption as number);
		expect(Math.min(...cs)).toBe(0.1);
		expect(Math.max(...cs)).toBe(0.9);
		expect(cs.every((c) => c >= 0 && c <= 1)).toBe(true);
		expect(h.every((e) => e.minTier >= 3)).toBe(true);
		for (const e of h) expect(e.body + e.title, e.id).not.toMatch(/\b(blood|gore|corpse|scream|eyes?|faces?)\b/i);
	});

	it("has a biotech memo from tier 3 and a T1-T2 wetware pilot seed memo", () => {
		const e = db.events.find((x) => x.id === "nutrient_spoilage");
		expect(e?.minTier).toBeGreaterThanOrEqual(3);
		expect(e?.choices.some((c) => c.effects.some((f) => f.type === "affinity" && f.path === "biotech"))).toBe(true);
		const seed = db.events.find((x) => x.id === "form_9b_brochure");
		expect(seed && seed.maxTier === 2 && seed.minTier <= 2).toBe(true);
		expect(seed?.title).toContain("Wetware");
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

	it("Absorbed sits at the top of the corruption scale", () => {
		expect(db.balance.endings.absorbed.corruption).toBeGreaterThan(0.9);
		expect(db.balance.endings.absorbed.corruption).toBeLessThanOrEqual(1);
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
		const best = Math.max(...Object.values(db.facilities).filter((d) => d.rack?.cooling === "bio" && !d.growth && d.unlockTier <= 4).map((d) => d.rack?.pflops ?? 0));
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
		expect(broken((db) => (db.facilities.sterile_bay.category = "rack"))).toMatch(/should be "cooling"/);
		expect(broken((db) => (db.facilities.organoid_incubator.category = "cooling"))).toMatch(/should be "rack"/);
		expect(broken((db) => (db.facilities.nutrient_plant.category = "power"))).toMatch(/should be "cooling"/);
		expect(broken((db) => (db.facilities.nutrient_plant.width = 1))).toMatch(/nutrient must be at least 2/);
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
		expect(broken((db) => { db.endings = db.endings.filter((e) => e.id !== "absorbed"); })).toMatch(/missing "absorbed"/);
		expect(broken((db) => (db.endings[0].body = ""))).toMatch(/body/);
		expect(broken((db) => (db.balance.ascension.minTier = 9))).toMatch(/minTier/);
		expect(broken((db) => (db.balance.bio.decay = 2))).toMatch(/decay/);
		expect(broken((db) => (db.balance.bio.diffusion = 0.4))).toMatch(/stable/);
		expect(broken((db) => (db.balance.bio.growthThreshold = 0.1))).toMatch(/growthThreshold/);
		expect(broken((db) => (db.balance.endings.absorbed.corruption = 0))).toMatch(/absorbed\.corruption/);
	});
});
