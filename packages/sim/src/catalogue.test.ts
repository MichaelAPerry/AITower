/** The catalogue (docs/TREES.md, docs/REFRAME.md): placement sites, upgrades of support items, research without commits, the Foreman, snapshot v15, on the real content. */
import { type ContentDB, loadContent, isRetrofitOnly } from "@aitower/content";
import { describe, expect, it } from "vitest";
import type { SimCommand } from "./api";
import { TICKS_PER_DAY } from "./api";
import { type SimImpl, createSim, SNAPSHOT_VERSION, simFromSnapshot } from "./sim";
import { REMOVED_TECH_V15, SOLD_FACILITIES, SWAPPED_FACILITIES } from "./snapshot/migrate";
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
	it("Level and research are the only gates: no commit, no bond, no path", () => {
		const s = start();
		s.state.bonds = { cass: 0, bea: 0, mel: 0, luci: 0 };
		expect(can(s, "grid_tie_lucy", 0, 36)).toBe("requires tier 3");
		level(s, 3);
		expect(can(s, "grid_tie_lucy", 0, 36)).toMatch(/requires research: /);
		research(s, "substation_licence", "offpeak_petition", "rate_card");
		expect(can(s, "grid_tie_lucy", 0, 36)).toBeNull();
		exec(s, { type: "place", defId: "grid_tie_lucy", floor: 0, x: 36 });
		expect(s.state.bonds.luci).toBe(0); // no bond reward for building it
		expect(s.state.sealScar.greentech).toBeGreaterThanOrEqual(10 + 16); // the catch
	});

	it("roof, exterior-wall and basement sites", () => {
		const s = start();
		level(s, 5);
		research(s, "neuromorphic_bench", "canopy_array", "geothermal_charter");
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

describe("research has no commit", () => {
	it("the Bio, Green and Synthetic nodes are all open to Level, prerequisites and points alone", () => {
		const s = start();
		level(s, 3);
		s.state.researchPoints = 1e6;
		research(s, "culture_media", "desk_fan_standard", "batch_cards", "chilled_loop");
		for (const id of ["wetware_annex", "neuromorphic_bench"]) {
			expect(s.submit({ type: "research", techId: id }), id).toEqual({ ok: true });
			s.step();
		}
		expect(s.submit({ type: "research", techId: "event_array" })).toEqual({ ok: true });
	});

	it("an advisor's bond does not open nodes early any more", () => {
		const s = start();
		level(s, 4);
		s.state.researchPoints = 1e6;
		s.state.bonds.luci = 100;
		research(s, "tower_hydraulics", "manifold_blade", "chilled_loop", "cold_plate_gen3", "rear_door_drawings", "desk_fan_standard", "batch_cards");
		expect(s.submit({ type: "research", techId: "cryo_core_dossier" })).toEqual({ ok: true });
		s.step();
		expect(s.submit({ type: "research", techId: "mind_lattice_dossier" })).toEqual({ ok: false, reason: "requires Clearance 5" });
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

	it("never carries a rack to a tree rack: that is the retrofit's job", () => {
		const s = start();
		level(s, 5);
		research(s, "chilled_loop", "desk_fan_standard", "batch_cards", "rear_door_drawings", "inference_foundry");
		const ac3 = rackAt(s, "rack_air_gpu") as NonNullable<ReturnType<typeof rackAt>>;
		expect(s.submit({ type: "upgradeFacility", facilityId: ac3.id, defId: "rack_dlc_gpu" })).toMatchObject({ ok: false });
		for (const d of Object.values(s.content.facilities)) if (isRetrofitOnly(d)) expect(d.upgradesFrom, d.id).toBeUndefined();
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

	it("rejects a malformed command without throwing", () => {
		const s = start();
		const bad = [{ type: "upgradeFacility" }, { type: "upgradeFacility", facilityId: "x" }, { type: "upgradeFacility", facilityId: 1, defId: 7 }];
		for (const c of bad) expect(s.submit(c as unknown as SimCommand).ok).toBe(false);
	});
});

describe("the Foreman builds base racks and retrofits toward Synthetic", () => {
	/** A tower with the Foreman on (a small reserve), work coming in (the harness accepts every offer) and bots and parts on. */
	const foremanRun = (research_: string[], days: number, seed: number, tier = 4): { s: SimImpl; placed: string[]; ev: string[]; c: ContentDB } => {
		const c = quiet((x) => {
			x.balance.events.intervalTicks = 1e9;
		});
		const s = createSim(c, "starter", seed) as SimImpl;
		s.state.cash = 80_000_000;
		s.state.tier = tier;
		research(s, "contracts_clerk", "works_foreman", "standing_orders_binder", ...research_);
		const p = structuredClone(s.view().automation.policy);
		p.foreman.enabled = true;
		p.foreman.reserve = 0;
		p.parts.enabled = true;
		p.bots = { enabled: true, racksPerBot: 6, maxBots: 8 };
		exec(s, { type: "setAutomation", policy: p });
		const placed: string[] = [];
		const ev: string[] = [];
		for (let t = 0; t < days * TICKS_PER_DAY; t++) {
			for (const e of s.step()) {
				if (e.type === "contractOffered") s.submit({ type: "acceptContract", contractId: e.contractId });
				if (e.type === "autoBuilt") placed.push(s.state.facilities.find((f) => f.id === e.facilityId)?.defId ?? "");
				if (e.type === "retrofitted") ev.push(`${e.tree}:${e.rung}`);
			}
		}
		return { s, placed, ev, c };
	};
	const tech = ["desk_fan_standard", "batch_cards", "rear_door_drawings", "inference_foundry", "high_capacity_air", "rear_door_exchanger", "substation_licence", "gas_concession"];

	it("grows a tower with base racks, and never places a tree rack from scratch", { timeout: 60_000 }, () => {
		const { s, placed, c } = foremanRun(tech, 8, 3);
		expect(placed.length).toBeGreaterThan(6);
		for (const id of placed) expect(isRetrofitOnly(c.facilities[id]), id).toBe(false);
		const racks = s.state.facilities.filter((f) => c.facilities[f.defId].kind === "rack" && c.facilities[f.defId].rack?.pflops).length;
		expect(racks).toBeGreaterThan(4); // the starter's four plus what it grew
	});

	it("retrofits toward Synthetic where the next rung is open and the coolant pipe is under the rack, and only there", { timeout: 60_000 }, () => {
		const c = quiet((x) => {
			x.balance.events.intervalTicks = 1e9;
		});
		const s = createSim(c, "starter", 3) as SimImpl;
		s.state.cash = 80_000_000;
		s.state.tier = 3;
		research(s, "contracts_clerk", "works_foreman", "standing_orders_binder", ...tech, "chilled_loop");
		// Piped floor with a loop that has room: a chiller and a CDU beside the racks.
		for (let x = 4; x <= 43; x++) s.state.coolant[(1 - s.state.floorMin) * s.state.width + x] = 1;
		for (let x = 4; x <= 43; x++) s.state.coolant[(0 - s.state.floorMin) * s.state.width + x] = 1;
		s.state.netsDirty = true;
		addFacility(s.state, s.content, "chiller", 0, 30);
		addFacility(s.state, s.content, "cdu", 0, 36);
		s.invalidateProjection();
		const p = structuredClone(s.view().automation.policy);
		p.foreman.enabled = true;
		p.foreman.reserve = 0;
		exec(s, { type: "setAutomation", policy: p });
		const rungs: string[] = [];
		for (let t = 0; t < 6 * TICKS_PER_DAY; t++) {
			for (const e of s.step()) {
				if (e.type === "contractOffered") s.submit({ type: "acceptContract", contractId: e.contractId });
				if (e.type === "retrofitted") rungs.push(`${e.tree}:${e.rung}`);
			}
		}
		expect(rungs.length).toBeGreaterThan(0);
		for (const r of rungs) expect(r.startsWith("synthetic:"), r).toBe(true);
		expect(s.state.facilities.some((f) => f.defId === "rack_dlc_gpu")).toBe(true);
	});

	it("without a pipe under any rack it keeps growing with base racks and retrofits nothing", { timeout: 60_000 }, () => {
		const { ev } = foremanRun([...tech, "chilled_loop"], 6, 5, 3);
		expect(ev).toEqual([]);
	});
});

describe("snapshot v15", () => {
	/** Put an old-shaped facility on the lot: `defId` and `width` as an older save held them. */
	const inject = (s: SimImpl, defId: string, floor: number, x: number, width: number): ReturnType<typeof addFacility> => {
		const f = addFacility(s.state, s.content, "rack_air_gpu", floor, x);
		for (let k = 0; k < Math.max(width, f.width); k++) s.state.facilityAt[(floor - s.state.floorMin) * s.state.width + x + k] = k < width ? f.id : -1;
		f.defId = defId;
		f.width = width;
		return f;
	};
	/** The save as a v14 game wrote it: with the commit, dating and bond state the reframe drops. */
	const save = (s: SimImpl): { version: number; state: Record<string, unknown> } => {
		const snap = JSON.parse(JSON.stringify(s.snapshot())) as { version: number; state: Record<string, unknown> };
		snap.version = 14;
		Object.assign(snap.state, { path: "greentech", route: "bea", sealedOut: ["biotech"], bondGiven: ["starter:greentech"], flags: ["intro_dunno"], afterHoursDay: 3, afterSeen: ["ah_cass_1"], gifted: ["bea:solar_skin"], inbox: [], messageDay: 2, messageSeen: ["m1"] });
		return snap;
	};

	it("drops the commit, the route and all the dating state, and keeps the points, the seals and the bonds", () => {
		const c = loadContent();
		const s = createSim(c, "starter", 2) as SimImpl;
		s.state.sp.greentech = 321;
		s.state.sealResidue.biotech = 7;
		s.state.bonds.mel = 66;
		const loaded = simFromSnapshot(c, save(s) as never) as SimImpl;
		expect(loaded.snapshot().version).toBe(SNAPSHOT_VERSION);
		for (const k of ["path", "route", "sealedOut", "bondGiven", "flags", "afterHoursDay", "afterSeen", "gifted", "inbox", "messageDay", "messageSeen"]) expect(k in loaded.state, k).toBe(false);
		expect(loaded.state.sp.greentech).toBe(321);
		expect(loaded.state.sealResidue.biotech).toBe(7);
		expect(loaded.state.bonds.mel).toBe(66);
		for (let t = 0; t < 100; t++) loaded.step();
	});

	it("maps the cut racks to the nearest rung on the same tiles and sells the Nutrient Tank back", () => {
		const c = loadContent();
		const s = createSim(c, "starter", 2) as SimImpl;
		s.state.cash = 1_000_000;
		inject(s, "rack_culture_s", 1, 20, 2); // OC-0 -> OC-1
		inject(s, "rack_imm_gpu2", 1, 24, 3); // IM-2 -> LC-4 (two tiles: the third is freed)
		inject(s, "rack_imm_gpu3", 1, 28, 3); // IM-3 -> ML-1
		inject(s, "rack_organoid_3m", 1, 32, 3); // Mel's Cortex -> OC-3
		const tank = inject(s, "nutrient_tank_s", 1, 36, 2);
		const loaded = simFromSnapshot(c, save(s) as never) as SimImpl;
		const ids = loaded.state.facilities.map((f) => f.defId);
		for (const gone of Object.keys(SWAPPED_FACILITIES).concat(Object.keys(SOLD_FACILITIES))) expect(ids, gone).not.toContain(gone);
		const at = (x: number) => loaded.state.facilities.find((f) => f.floor === 1 && f.x === x);
		expect(at(20)?.defId).toBe("organoid_incubator");
		expect(at(24)?.defId).toBe("rack_dlc_gpu3");
		expect(at(24)?.width).toBe(2);
		expect(loaded.state.facilityAt[(1 - loaded.state.floorMin) * loaded.state.width + 26]).toBe(-1);
		expect(at(28)?.defId).toBe("rack_mind_lattice");
		expect(at(32)?.defId).toBe("rack_organoid_3");
		expect(at(36)).toBeUndefined();
		expect(loaded.state.facilityAt[(1 - loaded.state.floorMin) * loaded.state.width + 36]).toBe(-1);
		expect(loaded.state.facilities.some((f) => f.id === tank.id)).toBe(false);
		expect(loaded.state.cash).toBeGreaterThanOrEqual(1_000_000 + SOLD_FACILITIES.nutrient_tank_s - 1);
		for (let t = 0; t < 200; t++) loaded.step();
	});

	it("refunds the research nodes that folded into their rung", () => {
		const c = loadContent();
		const s = createSim(c, "starter", 2) as SimImpl;
		s.state.techResearched.push("culture_bench", "economizer", "wetware_annex");
		const rp = s.state.researchPoints;
		const loaded = simFromSnapshot(c, save(s) as never) as SimImpl;
		expect(loaded.state.techResearched).not.toContain("culture_bench");
		expect(loaded.state.techResearched).not.toContain("economizer");
		expect(loaded.state.techResearched).toContain("wetware_annex");
		expect(loaded.state.researchPoints).toBeCloseTo(rp + REMOVED_TECH_V15.culture_bench + REMOVED_TECH_V15.economizer, 5);
	});

	it("a current save round-trips and hashes the same after load", () => {
		const c = loadContent();
		const s = createSim(c, "starter", 4) as SimImpl;
		for (let t = 0; t < 120; t++) s.step();
		const back = simFromSnapshot(c, JSON.parse(JSON.stringify(s.snapshot()))) as SimImpl;
		expect(back.hash()).toBe(s.hash());
	});
});
