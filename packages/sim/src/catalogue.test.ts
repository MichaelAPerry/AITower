/** The three catalogues (docs/TREES.md): placement gating, upgrades, commit-gated research, the Foreman, snapshot v13, on the real content. */
import { type ContentDB, loadContent } from "@aitower/content";
import { describe, expect, it } from "vitest";
import type { SimCommand } from "./api";
import { TICKS_PER_DAY } from "./api";
import { type SimImpl, createSim, simFromSnapshot } from "./sim";
import { soulStep } from "./progression/soul";
import { REMOVED_FACILITIES, REMOVED_TECH } from "./snapshot/migrate";
import { addFacility } from "./world/entities";
import { exec } from "./test/fixture";

/** Real content with the random decisions and story scenes out of the way, so a test owns the decision slot. */
const quiet = (edit?: (c: ContentDB) => void): ContentDB => {
	const c = loadContent();
	c.events = c.events.filter((e) => e.category !== "story");
	c.balance.events.graceTicks = 1e9;
	edit?.(c);
	return c;
};
const start = (c = quiet()): SimImpl => {
	const s = createSim(c, "starter", 1) as SimImpl;
	s.state.cash = 1e9;
	return s;
};
const research = (s: SimImpl, ...ids: string[]): void => {
	for (const id of ids) if (!s.state.techResearched.includes(id)) s.state.techResearched.push(id);
	s.invalidateProjection();
};
const level = (s: SimImpl, tier: number): void => {
	s.state.tier = tier;
	s.invalidateProjection();
};
const can = (s: SimImpl, defId: string, floor: number, x: number): string | null => {
	const r = s.canBuild({ type: "place", defId, floor, x });
	return r.ok ? null : r.reason;
};
/** The floor-1 slab of the starter lot runs x 4..43 with power; the first free run past the racks starts at 18. */
const FREE = 20;

describe("who may place what", () => {
	it("a Synthetic item opens on the default path, and closes to new building once the player commits to Bio or Green", () => {
		const s = start();
		research(s, "chilled_loop", "desk_fan_standard");
		s.state.sealScar.biotech = 0;
		// Coolant plant: the loop must exist for a liquid rack; check the line rule on a rack that needs none by using the chiller's gate instead.
		level(s, 3);
		expect(can(s, "rack_dlc_gpu", 1, FREE)).toMatch(/coolant/); // allowed in principle: only the site is missing
		s.state.path = "greentech";
		expect(can(s, "rack_dlc_gpu", 1, FREE)).toMatch(/belongs to The Lattice, closed to new building once you commit to The Garden/);
		s.state.path = "synthetic";
		expect(can(s, "rack_dlc_gpu", 1, FREE)).toMatch(/coolant/);
	});

	it("Specialist items need the commit to their tree, Starter items only the research", () => {
		const s = start();
		level(s, 3);
		research(s, "inference_foundry", "event_array", "culture_media", "culture_bench", "wetware_annex");
		// The Starter Neuromorphic Rack (NM-1) is open to the default path.
		expect(can(s, "rack_neuromorphic", 1, FREE)).toBeNull();
		// The Specialist NM-2 and the Bio line are not, until the commit.
		level(s, 4);
		expect(can(s, "rack_neuromorphic2", 1, FREE)).toBe("Commit to The Garden");
		s.state.path = "greentech";
		expect(can(s, "rack_neuromorphic2", 1, FREE)).toBeNull();
		expect(can(s, "organoid_incubator", 1, FREE)).toBe("Commit to The Flesh"); // wrong tree
		// Bio starters stay open to everyone.
		expect(can(s, "rack_culture_s", 1, FREE)).toMatch(/nutrient conduit/); // allowed in principle: the pipe is missing
	});

	it("a Starter set pays its champion one bond point, once, and never scars its own tree", () => {
		const s = start();
		level(s, 3);
		research(s, "inference_foundry", "culture_media", "culture_bench", "economizer", "solar_charter", "desk_fan_standard");
		const mel = s.state.bonds.mel;
		const bea = s.state.bonds.bea;
		const scar = { ...s.state.sealScar };
		exec(s, { type: "place", defId: "rack_neuromorphic", floor: 1, x: FREE });
		exec(s, { type: "place", defId: "rack_neuromorphic", floor: 1, x: FREE + 2 });
		expect(s.state.bonds.bea).toBe(bea + 1); // once, not twice
		expect(s.state.bonds.mel).toBe(mel);
		// NM-1 scars neither tree (-1 / -2).
		expect(s.state.sealScar).toEqual(scar);
		expect(s.state.bondGiven).toEqual(["starter:greentech"]);
	});

	it("a Signature build needs the bond; the first one placed pays +1", () => {
		const s = start();
		level(s, 3);
		s.state.bonds.luci = 39;
		expect(can(s, "grid_tie_lucy", 0, 36)).toBe("needs Luci's bond 40");
		s.state.bonds.luci = 40;
		expect(can(s, "grid_tie_lucy", 0, 36)).toBeNull();
		exec(s, { type: "place", defId: "grid_tie_lucy", floor: 0, x: 36 });
		expect(s.state.bonds.luci).toBe(41);
		expect(s.state.sealScar.greentech).toBeGreaterThanOrEqual(14 + 16); // the catch
		// Mel's Cortex needs her bond 70 and the commit.
		research(s, "tissue_scaffolds");
		level(s, 5);
		s.state.bonds.mel = 70;
		expect(can(s, "rack_organoid_3m", 1, FREE)).toBe("Commit to The Flesh");
		s.state.bonds.mel = 69;
		s.state.path = "biotech";
		expect(can(s, "rack_organoid_3m", 1, FREE)).toBe("needs Mel's bond 70");
	});

	it("Mel's bond 40 lets an uncommitted player keep two OC-1 cabinets, no more", () => {
		const s = start();
		level(s, 3);
		expect(can(s, "organoid_incubator", 1, FREE)).toBe("Commit to The Flesh");
		s.state.bonds.mel = 40;
		// The preview waives the commit and its research; only the site is checked now.
		expect(can(s, "organoid_incubator", 1, FREE)).toMatch(/nutrient conduit/);
		for (let k = 0; k < 2; k++) {
			s.state.facilities.push({ ...s.state.facilities[0], id: 9000 + k, defId: "organoid_incubator" });
		}
		s.invalidateProjection();
		expect(can(s, "organoid_incubator", 1, FREE)).toBe("Commit to The Flesh (the 2 preview units are built)");
	});

	it("Early Lattice and Early Garden: Luci's and Bea's bond 60 open the Level 5 racks at Level 4", () => {
		const s = start();
		level(s, 4);
		research(s, "cryo_core_dossier");
		expect(can(s, "rack_mind_lattice", 1, FREE)).toBe("requires tier 5");
		s.state.bonds.luci = 60;
		research(s, "tower_hydraulics", "manifold_blade", "chilled_loop", "cold_plate_gen3", "rear_door_drawings", "desk_fan_standard", "batch_cards");
		research(s, "mind_lattice_dossier"); // researched here by hand; the bond lowers its Level too (see below)
		expect(can(s, "rack_mind_lattice", 1, FREE)).toMatch(/coolant/); // the Level gate is open
		const node = s.content.tech.find((t) => t.id === "mind_lattice_dossier");
		expect(node?.earlyTier).toEqual({ who: "luci", min: 60, tier: 4 });
	});

	it("roof, exterior-wall and basement sites", () => {
		const s = start();
		level(s, 5);
		research(s, "solar_charter", "canopy_array", "geothermal_charter");
		s.state.path = "greentech";
		// PV walls: only at the edge of a floor.
		expect(can(s, "solar_skin", 1, FREE)).toMatch(/exterior wall/);
		expect(can(s, "solar_skin", 1, 40)).toBeNull();
		// The canopy: only on the roof (nothing built above). The starter's top floor is floor 1.
		expect(can(s, "solar_canopy", 1, 34)).toBeNull();
		s.submit({ type: "buildSlab", floor: 2, x0: 4, x1: 43 });
		s.flush();
		expect(can(s, "solar_canopy", 1, 34)).toMatch(/roof/);
		expect(can(s, "solar_canopy", 2, 34)).toMatch(/power conduit/); // the new top floor is the roof (it still needs its conduit)
		// The geothermal well: basement only.
		expect(can(s, "geothermal", 0, 10)).toMatch(/basement/);
		expect(can(s, "geothermal", -1, 10)).not.toBe("must go in a basement");
	});
});

describe("research behind the commit", () => {
	it("a Specialist node cannot be researched before the commit and says what to do; a Starter node can", () => {
		const s = start();
		level(s, 3);
		s.state.researchPoints = 1e6;
		research(s, "culture_media", "desk_fan_standard");
		expect(s.submit({ type: "research", techId: "culture_bench" })).toEqual({ ok: true });
		s.step();
		const blocked = s.submit({ type: "research", techId: "wetware_annex" });
		expect(blocked).toEqual({ ok: false, reason: "Commit to The Flesh to research" });
		s.state.path = "greentech";
		expect(s.submit({ type: "research", techId: "wetware_annex" })).toEqual({ ok: false, reason: "Commit to The Flesh to research" });
		s.state.path = "biotech";
		s.invalidateProjection();
		s.step();
		expect(s.submit({ type: "research", techId: "wetware_annex" })).toEqual({ ok: true });
	});

	it("the Synthetic nodes need no commit, and the bond opens two nodes a Level early", () => {
		const s = start();
		level(s, 4);
		s.state.researchPoints = 1e6;
		research(s, "tower_hydraulics", "manifold_blade", "chilled_loop", "cold_plate_gen3", "rear_door_drawings", "desk_fan_standard", "batch_cards");
		expect(s.submit({ type: "research", techId: "cryo_core_dossier" })).toEqual({ ok: true });
		expect(s.submit({ type: "research", techId: "mind_lattice_dossier" })).toEqual({ ok: false, reason: "requires Clearance 5" });
		s.state.bonds.luci = 60;
		s.invalidateProjection();
		s.step();
		research(s, "cryo_core_dossier");
		expect(s.submit({ type: "research", techId: "mind_lattice_dossier" })).toEqual({ ok: true });
	});
});

describe("upgradeFacility", () => {
	const rackAt = (s: SimImpl, defId: string) => s.state.facilities.find((f) => f.defId === defId);

	it("swaps in place for the new cost less half of the old one, and keeps the tile", () => {
		const s = start();
		level(s, 2);
		research(s, "batch_cards", "rear_door_drawings", "desk_fan_standard");
		const old = rackAt(s, "rack_air_gpu");
		expect(old).toBeDefined();
		const { x, floor, id } = old as NonNullable<typeof old>;
		const before = s.state.cash;
		const cost = s.content.facilities.rack_air_gpu2.cost - 0.5 * s.content.facilities.rack_air_gpu.cost;
		expect(cost).toBe(550_000 - 200_000);
		const ev = exec(s, { type: "upgradeFacility", facilityId: id });
		expect(ev).toContainEqual({ type: "built", what: "facility", floor, x });
		expect(s.state.cash).toBeCloseTo(before - cost, -2); // within a tick's upkeep
		expect(s.state.facilities.some((f) => f.id === id)).toBe(false);
		expect(s.state.facilities.find((f) => f.defId === "rack_air_gpu2" && f.x === x && f.floor === floor)).toBeDefined();
	});

	it("is refused for lack of research, Level, an upgrade path or funds, with the plain reason", () => {
		const s = start();
		const old = rackAt(s, "rack_air_gpu") as NonNullable<ReturnType<typeof rackAt>>;
		expect(s.submit({ type: "upgradeFacility", facilityId: old.id })).toEqual({ ok: false, reason: "requires tier 2" });
		level(s, 2);
		expect(s.submit({ type: "upgradeFacility", facilityId: old.id })).toEqual({ ok: false, reason: `requires research: ${s.content.tech.find((t) => t.id === "rear_door_drawings")?.name}` });
		research(s, "batch_cards", "rear_door_drawings", "desk_fan_standard");
		expect(s.submit({ type: "upgradeFacility", facilityId: old.id, defId: "rack_infer" })).toMatchObject({ ok: false });
		const storage = rackAt(s, "rack_storage") as NonNullable<ReturnType<typeof rackAt>>;
		expect(s.submit({ type: "upgradeFacility", facilityId: storage.id })).toMatchObject({ ok: false, reason: expect.stringMatching(/requires/) });
		expect(s.submit({ type: "upgradeFacility", facilityId: 99999 })).toEqual({ ok: false, reason: "no such facility" });
		s.state.cash = 100_000;
		s.invalidateProjection();
		expect(s.submit({ type: "upgradeFacility", facilityId: old.id })).toMatchObject({ ok: false, reason: expect.stringMatching(/insufficient funds/) });
	});

	it("a wider item takes the free tile beside it (right first, then left) and is refused when boxed in", () => {
		const s = start();
		level(s, 3);
		research(s, "batch_cards", "rear_door_drawings", "desk_fan_standard", "inference_foundry");
		// AC-3 (2 wide) -> IA-1 (2 wide) keeps its tiles; to test growth use the Battery Bank (3) -> Battery Hall (5).
		research(s, "accumulator_charter", "flywheel_patent", "surge_memo");
		exec(s, { type: "place", defId: "ups_battery", floor: 0, x: 2 });
		const ups = rackAt(s, "ups_battery") as NonNullable<ReturnType<typeof rackAt>>;
		const r = s.submit({ type: "upgradeFacility", facilityId: ups.id });
		expect(r.ok).toBe(true);
		s.step();
		const hall = rackAt(s, "ups_bank_big") as NonNullable<ReturnType<typeof rackAt>>;
		expect(hall.width).toBe(5);
		expect(hall.x).toBe(2); // grew to the right
		// Boxed in: a hall hard against another facility on both sides cannot grow.
		exec(s, { type: "place", defId: "ups_battery", floor: 0, x: 10 });
		exec(s, { type: "place", defId: "parts_depot", floor: 0, x: 13 });
		exec(s, { type: "place", defId: "bot_charger", floor: 0, x: 8 });
		const boxed = s.state.facilities.filter((f) => f.defId === "ups_battery").at(-1) as NonNullable<ReturnType<typeof rackAt>>;
		expect(s.submit({ type: "upgradeFacility", facilityId: boxed.id })).toMatchObject({ ok: false, reason: expect.stringMatching(/does not fit here/) });
	});

	it("a Specialist upgrade needs the commit, and the upgrade scars the new item like a placement", () => {
		const s = start();
		level(s, 4);
		research(s, "inference_foundry", "event_array");
		exec(s, { type: "place", defId: "rack_neuromorphic", floor: 1, x: FREE });
		const nm1 = rackAt(s, "rack_neuromorphic") as NonNullable<ReturnType<typeof rackAt>>;
		expect(s.submit({ type: "upgradeFacility", facilityId: nm1.id })).toEqual({ ok: false, reason: "Commit to The Garden" });
		s.state.path = "greentech";
		s.invalidateProjection();
		const scar = s.state.sealScar.greentech;
		expect(exec(s, { type: "upgradeFacility", facilityId: nm1.id })).toBeDefined();
		expect(rackAt(s, "rack_neuromorphic2")).toBeDefined();
		expect(s.state.sealScar.greentech).toBe(scar); // NM-2 is -1 / -3: it cleans, never scars
	});

	it("is deterministic: the same orders give the same state hash", () => {
		const run = (): string => {
			const s = start();
			level(s, 2);
			research(s, "batch_cards", "rear_door_drawings", "desk_fan_standard");
			const old = rackAt(s, "rack_air_gpu") as NonNullable<ReturnType<typeof rackAt>>;
			exec(s, { type: "upgradeFacility", facilityId: old.id });
			for (let t = 0; t < 300; t++) s.step();
			return s.hash();
		};
		expect(run()).toBe(run());
	});

	it("rejects a malformed command without throwing", () => {
		const s = start();
		const bad = [{ type: "upgradeFacility" }, { type: "upgradeFacility", facilityId: "x" }, { type: "upgradeFacility", facilityId: 1, defId: 7 }];
		for (const c of bad) expect(s.submit(c as unknown as SimCommand).ok).toBe(false);
	});
});

describe("Starter racks and the Singularity points", () => {
	/** SP that a lone rack of `defId`, delivering 100 PFLOPS, adds to each tree in one hourly step at the given path. */
	const sp = (defId: string, path: "biotech" | "greentech" | "synthetic" | null): Record<string, number> => {
		const s = start(quiet());
		s.state.facilities = s.state.facilities.filter((f) => s.content.facilities[f.defId].kind !== "rack");
		s.state.path = path;
		s.state.greenScore = 1;
		s.state.sealScar = { biotech: 0, greentech: 0 };
		s.state.sealResidue = { biotech: 0, greentech: 0 };
		const f = addFacility(s.state, s.content, defId, 1, 30);
		f.pflops = 100;
		s.state.tick = 0; // 06:00, an hourly sample
		s.state.sp = { synthetic: 0, biotech: 0, greentech: 0 };
		soulStep({ state: s.state, content: s.content, events: [], scratch: undefined as never });
		return { ...s.state.sp };
	};

	it("a Starter rack scores 1 to Synthetic and 0.5 to its own tree after the commit, nothing to the other tree", () => {
		const k = loadContent().balance.soul.spPerPflopHour;
		const green = sp("rack_neuromorphic", "greentech");
		expect(green.synthetic).toBeCloseTo(100 * k, 9);
		expect(green.greentech).toBeCloseTo(100 * 0.5 * k, 4); // x (1 - seal)
		const bio = sp("rack_culture_s", "biotech");
		expect(bio.synthetic).toBeCloseTo(100 * k, 9);
		expect(bio.biotech).toBeCloseTo(100 * 0.5 * k, 4);
		// A Bio starter does not feed a Green tower, and a shared rack still feeds Green at its table weight.
		expect(sp("rack_culture_s", "greentech").greentech).toBe(0);
		expect(sp("rack_air_gpu", "greentech").greentech).toBeCloseTo(100 * 0.5 * k, 4);
		// Before the commit only the Lattice counts.
		const none = sp("rack_neuromorphic", null);
		expect(none.greentech).toBe(0);
		expect(none.synthetic).toBeCloseTo(100 * k, 9);
	});

	it("the Green line feeds the Lattice nothing and a Synthetic rack counts at the Synthetic weight", () => {
		const k = loadContent().balance.soul.spPerPflopHour;
		const w = loadContent().balance.soul.spWeights;
		expect(sp("rack_neuromorphic2", "synthetic").synthetic).toBe(0);
		expect(sp("rack_dlc_gpu", "synthetic").synthetic).toBeCloseTo(100 * (w.synthetic.synthetic ?? 0) * k, 9);
	});
});

describe("the Foreman builds only what the player may place", () => {
	/** A tower with the Foreman on (a small reserve), work coming in (the harness accepts every offer) and bots and parts on. */
	const foremanRun = (path: "greentech" | "biotech" | null, research: string[], days: number, seed: number): { s: SimImpl; placed: string[]; c: ContentDB } => {
		const c = quiet((x) => {
			x.balance.events.intervalTicks = 1e9;
		});
		const s = createSim(c, "starter", seed) as SimImpl;
		s.state.cash = 80_000_000;
		s.state.tier = path === null ? 4 : 5;
		s.state.path = path;
		s.state.bonds.mel = 100;
		s.state.bonds.bea = 100;
		research_(s, ["contracts_clerk", "works_foreman", "standing_orders_binder", ...research]);
		const p = structuredClone(s.view().automation.policy);
		p.foreman.enabled = true;
		p.foreman.reserve = 0;
		p.parts.enabled = true;
		p.bots = { enabled: true, racksPerBot: 6, maxBots: 8 };
		exec(s, { type: "setAutomation", policy: p });
		const placed: string[] = [];
		for (let t = 0; t < days * TICKS_PER_DAY; t++) {
			for (const e of s.step()) {
				if (e.type === "contractOffered") s.submit({ type: "acceptContract", contractId: e.contractId });
				if (e.type === "autoBuilt") placed.push(s.state.facilities.find((f) => f.id === e.facilityId)?.defId ?? "");
			}
		}
		return { s, placed, c };
	};
	const research_ = (s: SimImpl, ids: string[]): void => research(s, ...ids);

	it("grows a Synthetic tower on the default path, and never places a Bio or Green Specialist", () => {
		const { s, placed, c } = foremanRun(null, ["desk_fan_standard", "batch_cards", "rear_door_drawings", "inference_foundry", "culture_media", "culture_bench", "solar_charter", "economizer", "high_capacity_air", "rear_door_exchanger", "substation_licence", "gas_concession"], 8, 3);
		expect(placed.length).toBeGreaterThan(6);
		for (const id of placed) expect(c.facilities[id].tier === "specialist", id).toBe(false);
		const racks = s.state.facilities.filter((f) => c.facilities[f.defId].kind === "rack" && c.facilities[f.defId].rack?.pflops).length;
		expect(racks).toBeGreaterThan(4); // the starter's four plus what it grew
	});

	it("a committed Green tower never gets the Synthetic line from the Foreman, and a committed Bio tower never the Green one", () => {
		const all = ["desk_fan_standard", "batch_cards", "rear_door_drawings", "chilled_loop", "tower_hydraulics", "cold_plate_gen3", "manifold_blade", "inference_foundry", "gas_concession", "substation_licence", "high_capacity_air", "rear_door_exchanger", "event_array", "economizer", "solar_charter", "canopy_array", "culture_media", "culture_bench", "wetware_annex"];
		for (const path of ["greentech", "biotech"] as const) {
			const { placed, c } = foremanRun(path, all, 6, 5);
			expect(placed.length, path).toBeGreaterThan(3);
			for (const id of placed) {
				const d = c.facilities[id];
				expect(d.line === "synthetic", `${path}: ${id}`).toBe(false);
				if (path === "biotech") expect(d.line === "greentech" && d.tier !== "starter", `${path}: ${id}`).toBe(false);
				if (path === "greentech") expect(d.line === "biotech" && d.tier !== "starter", `${path}: ${id}`).toBe(false);
			}
		}
	});
});

describe("snapshot v13", () => {
	/** Put an old-shaped facility on the lot: `defId` and `width` as an older save held them. */
	const inject = (s: SimImpl, defId: string, floor: number, x: number, width: number): ReturnType<typeof addFacility> => {
		const f = addFacility(s.state, s.content, "rack_air_gpu", floor, x);
		for (let k = 0; k < Math.max(width, f.width); k++) s.state.facilityAt[(floor - s.state.floorMin) * s.state.width + x + k] = k < width ? f.id : -1;
		f.defId = defId;
		f.width = width;
		return f;
	};
	const save = (s: SimImpl): { version: number; state: Record<string, unknown> } => {
		const snap = JSON.parse(JSON.stringify(s.snapshot())) as { version: number; state: Record<string, unknown> };
		snap.version = 12;
		delete snap.state.bondGiven;
		return snap;
	};

	it("maps removed facility ids, refunds removed research and keeps scars", () => {
		const c = loadContent();
		const s = createSim(c, "starter", 2) as SimImpl;
		inject(s, "rack_air_gpu3", 1, 30, 2); // the retired AC-4
		inject(s, "rack_imm_gpu", 1, 34, 3); // the cut IM-1
		s.state.techResearched.push("hot_aisle", "ministry_liaison", "wetware_annex");
		const rp = s.state.researchPoints;
		const scar = { ...s.state.sealScar };
		const loaded = simFromSnapshot(c, save(s) as never) as SimImpl;
		expect(loaded.snapshot().version).toBeGreaterThanOrEqual(13);
		const ids = loaded.state.facilities.map((f) => f.defId);
		expect(ids).not.toContain("rack_air_gpu3");
		expect(ids).not.toContain("rack_imm_gpu");
		expect(ids).toContain(REMOVED_FACILITIES.rack_air_gpu3);
		expect(ids).toContain(REMOVED_FACILITIES.rack_imm_gpu);
		expect(loaded.state.techResearched).not.toContain("hot_aisle");
		expect(loaded.state.techResearched).not.toContain("ministry_liaison");
		expect(loaded.state.techResearched).toContain("culture_bench"); // granted with the Annex that now comes after it
		expect(loaded.state.researchPoints).toBeCloseTo(rp + REMOVED_TECH.hot_aisle + REMOVED_TECH.ministry_liaison, 5);
		expect(loaded.state.sealScar).toEqual(scar); // scars and residue are left alone
		expect(loaded.state.bondGiven).toEqual([]);
		for (let t = 0; t < 200; t++) loaded.step();
	});

	it("refits the Vault Immersion Tank to three tiles and the Mind Lattice to three, or sells it back when boxed in", () => {
		const c = loadContent();
		const s = createSim(c, "starter", 2) as SimImpl;
		s.state.cash = 1_000_000;
		const tank = inject(s, "rack_imm_gpu3", 1, 30, 4);
		const roomy = inject(s, "rack_mind_lattice", 1, 20, 2); // x 22 is free: it widens
		const boxed = inject(s, "rack_mind_lattice", 1, 38, 2);
		inject(s, "rack_storage", 1, 40, 2); // ...x 40 is taken: it cannot
		const loaded = simFromSnapshot(c, save(s) as never) as SimImpl;
		const at = (f: { floor: number; x: number }, k = 0): number => loaded.state.facilityAt[(f.floor - loaded.state.floorMin) * loaded.state.width + f.x + k];
		const t = loaded.state.facilities.find((f) => f.id === tank.id);
		expect(t?.width).toBe(3);
		expect(at(tank, 3)).toBe(-1); // the fourth tile is free again
		const r = loaded.state.facilities.find((f) => f.id === roomy.id);
		expect(r?.width).toBe(3);
		expect(at(roomy, 2)).toBe(roomy.id);
		expect(loaded.state.facilities.some((f) => f.id === boxed.id)).toBe(false);
		expect(at(boxed, 0)).toBe(-1);
		expect(loaded.state.cash).toBeGreaterThanOrEqual(1_000_000 + 8_000_000 - 1);
		for (let t2 = 0; t2 < 100; t2++) loaded.step();
	});

	it("a current save round-trips with bondGiven and hashes the same after load", () => {
		const c = loadContent();
		const s = createSim(c, "starter", 4) as SimImpl;
		s.state.bondGiven.push("starter:biotech");
		for (let t = 0; t < 120; t++) s.step();
		const back = simFromSnapshot(c, JSON.parse(JSON.stringify(s.snapshot()))) as SimImpl;
		expect(back.hash()).toBe(s.hash());
		expect(back.state.bondGiven).toEqual(["starter:biotech"]);
	});
});
