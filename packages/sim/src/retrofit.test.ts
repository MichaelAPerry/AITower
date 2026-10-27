/** Retrofit (docs/REFRAME.md): a rack becomes the next rung of a tree, in place, for the new cost less half of the old one. */
import { type ContentDB, loadContent } from "@aitower/content";
import { describe, expect, it } from "vitest";
import type { SimCommand } from "./api";
import { type SimImpl, createSim } from "./sim";
import { exec } from "./test/fixture";

/** Real content with the random decisions and story scenes out of the way. */
const quiet = (): ContentDB => {
	const c = loadContent();
	c.events = c.events.filter((e) => e.category !== "story");
	c.balance.events.graceTicks = 1e9;
	return c;
};
const start = (): SimImpl => {
	const s = createSim(quiet(), "starter", 1) as SimImpl;
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
/** Lay a conduit under tiles by hand (the tests are about retrofitting, not piping). */
const pipe = (s: SimImpl, layer: "coolant" | "nutrient", floor: number, x0: number, x1: number): void => {
	const grid = layer === "coolant" ? s.state.coolant : s.state.nutrient;
	for (let x = x0; x <= x1; x++) grid[(floor - s.state.floorMin) * s.state.width + x] = 1;
	s.state.netsDirty = true;
	s.invalidateProjection();
};
const rack = (s: SimImpl, defId: string, x?: number) => s.state.facilities.find((f) => f.defId === defId && (x === undefined || f.x === x)) as NonNullable<SimImpl["state"]["facilities"][number]>;
const retro = (id: number, tree: "synthetic" | "biotech" | "greentech"): SimCommand => ({ type: "retrofit", facilityId: id, tree });

/** A tower ready for the Lattice: Level 2, chilled loop researched, pipe under the first rack. */
const lattice = (): { s: SimImpl; id: number } => {
	const s = start();
	level(s, 2);
	research(s, "chilled_loop", "desk_fan_standard");
	const f = rack(s, "rack_air_gpu", 6);
	pipe(s, "coolant", 1, 6, 7);
	return { s, id: f.id };
};

describe("retrofit", () => {
	it("turns a base rack into rung 1 in place: same tile, new cost less half of the old, scars like a placement", () => {
		const { s, id } = lattice();
		const old = rack(s, "rack_air_gpu", 6);
		const before = s.state.cash;
		const scar = { ...s.state.sealScar };
		const ev = exec(s, retro(id, "synthetic"));
		const cost = 1_400_000 - 0.5 * 400_000;
		expect(ev).toContainEqual({ type: "built", what: "facility", floor: 1, x: 6 });
		expect(ev.some((e) => e.type === "retrofitted" && e.tree === "synthetic" && e.rung === 1)).toBe(true);
		expect(before - s.state.cash).toBeGreaterThanOrEqual(cost);
		expect(before - s.state.cash).toBeLessThan(cost + 20_000); // within a tick's upkeep
		expect(s.state.facilities.some((f) => f.id === old.id)).toBe(false);
		const nf = rack(s, "rack_dlc_gpu", 6);
		expect(nf.floor).toBe(1);
		expect(s.state.sealScar.biotech).toBe(scar.biotech + 2); // LC-2: +2 / +2
		expect(s.state.sealScar.greentech).toBe(scar.greentech + 2);
	});

	it("a tree rack only advances within its tree; another branch starts again at rung 1", () => {
		const { s, id } = lattice();
		exec(s, retro(id, "synthetic"));
		let f = rack(s, "rack_dlc_gpu", 6);
		// Rung 2 of the same tree: needs Level 3 and its research.
		level(s, 3);
		research(s, "cold_plate_gen3", "rear_door_drawings", "batch_cards");
		const c = s.canBuild(retro(f.id, "synthetic"));
		expect(c.ok).toBe(true);
		const cash = s.state.cash;
		exec(s, retro(f.id, "synthetic"));
		f = rack(s, "rack_dlc_gpu2", 6);
		expect(cash - s.state.cash).toBeGreaterThanOrEqual(2_150_000 - 0.5 * 1_400_000);
		// Switching to Bio: back to rung 1 of the Flesh, priced as if the old rack were a plain AC-1.
		level(s, 2);
		research(s, "wetware_annex", "culture_media");
		pipe(s, "nutrient", 1, 6, 7);
		const sw = s.canBuild(retro(f.id, "biotech"));
		expect(sw).toEqual({ ok: true });
		const cash2 = s.state.cash;
		exec(s, retro(f.id, "biotech"));
		expect(cash2 - s.state.cash).toBeGreaterThanOrEqual(2_400_000 - 0.5 * 400_000);
		expect(rack(s, "organoid_incubator", 6)).toBeDefined();
	});

	it("the top rung and things that are not racks cannot be retrofitted", () => {
		const s = start();
		level(s, 5);
		const storage = rack(s, "rack_storage");
		expect(s.canBuild(retro(storage.id, "synthetic"))).toMatchObject({ ok: false, reason: expect.stringMatching(/not a rack that can be retrofitted/) });
		const top = rack(s, "rack_air_gpu", 8);
		top.defId = "rack_mind_lattice";
		s.invalidateProjection();
		expect(s.canBuild(retro(top.id, "synthetic"))).toMatchObject({ ok: false, reason: expect.stringMatching(/last rung of The Lattice/) });
		expect(s.canBuild(retro(99999, "synthetic"))).toEqual({ ok: false, reason: "no such facility" });
		expect(s.canBuild({ type: "retrofit", facilityId: top.id, tree: "nope" } as never)).toMatchObject({ ok: false });
	});

	it("is refused with the plain reason: Level, research, the pipe under it, a closed tree, funds", () => {
		const s = start();
		const f = rack(s, "rack_air_gpu", 6);
		expect(s.canBuild(retro(f.id, "synthetic"))).toEqual({ ok: false, reason: "requires tier 2" });
		level(s, 2);
		expect(s.canBuild(retro(f.id, "synthetic"))).toEqual({ ok: false, reason: `requires research: ${s.content.tech.find((t) => t.id === "chilled_loop")?.name}` });
		research(s, "chilled_loop", "desk_fan_standard");
		expect(s.canBuild(retro(f.id, "synthetic"))).toMatchObject({ ok: false, reason: expect.stringMatching(/coolant conduit under it/) });
		pipe(s, "coolant", 1, 6, 7);
		expect(s.canBuild(retro(f.id, "synthetic"))).toEqual({ ok: true });
		s.state.cash = 100_000;
		s.invalidateProjection();
		expect(s.canBuild(retro(f.id, "synthetic"))).toMatchObject({ ok: false, reason: expect.stringMatching(/insufficient funds/) });
		// Green runs on air: no pipe needed, only its research.
		s.state.cash = 1e9;
		research(s, "batch_cards", "neuromorphic_bench");
		expect(s.canBuild(retro(f.id, "greentech"))).toEqual({ ok: true });
		// Seal 100 closes the tree: no new retrofits to it.
		s.state.sealResidue.greentech = 200;
		s.invalidateProjection();
		expect(s.canBuild(retro(f.id, "greentech"))).toEqual({ ok: false, reason: "The Garden is closed: its seal reached 100" });
		// A closed tree does not stop the others.
		expect(s.canBuild(retro(f.id, "synthetic"))).toEqual({ ok: true });
	});

	it("tree racks cannot be placed from scratch: they come from retrofits", () => {
		const s = start();
		level(s, 5);
		research(s, "chilled_loop", "desk_fan_standard");
		const r = s.canBuild({ type: "place", defId: "rack_dlc_gpu", floor: 1, x: 20 });
		expect(r).toMatchObject({ ok: false, reason: expect.stringMatching(/retrofitting a rack/) });
	});

	it("no commit and no bond gates: retrofit to any tree needs only Level, research, site and cash", () => {
		const s = start();
		s.state.bonds = { cass: 0, bea: 0, mel: 0, luci: 0 };
		level(s, 2);
		research(s, "batch_cards", "neuromorphic_bench");
		const f = rack(s, "rack_air_gpu", 6);
		expect(s.canBuild(retro(f.id, "greentech"))).toEqual({ ok: true });
		expect(s.state.bonds.bea).toBe(0);
		exec(s, retro(f.id, "greentech"));
		expect(s.state.bonds.bea).toBe(0); // no bond reward either
	});

	it("a wider rung takes a free tile beside it (right first), and is refused when boxed in", () => {
		const s = start();
		level(s, 3);
		research(s, "wetware_annex", "culture_media", "desk_fan_standard", "organoid_vats");
		pipe(s, "nutrient", 1, 6, 20);
		// The lot: racks at x 6, 8, 10, 12, an air handler at 14. OC-1 keeps 2 tiles; OC-2 needs 3.
		exec(s, retro(rack(s, "rack_air_gpu", 12).id, "biotech"));
		exec(s, retro(rack(s, "rack_air_gpu", 10).id, "biotech"));
		const middle = rack(s, "organoid_incubator", 10);
		// Boxed in by the rack on its left and the OC-1 on its right: it cannot grow to 3 tiles.
		expect(s.canBuild(retro(middle.id, "biotech"))).toMatchObject({ ok: false, reason: expect.stringMatching(/does not fit here/) });
		// The OC-1 at x 12 has the air handler on its right. Take that away and it grows to the right.
		const edge = rack(s, "organoid_incubator", 12);
		expect(s.canBuild(retro(edge.id, "biotech"))).toMatchObject({ ok: false });
		exec(s, { type: "demolish", floor: 1, x: 14 });
		exec(s, retro(edge.id, "biotech"));
		const grown = rack(s, "rack_organoid_2");
		expect(grown.width).toBe(3);
		expect(grown.x).toBe(12);
	});

	it("is deterministic: the same orders give the same state hash", () => {
		const run = (): string => {
			const { s, id } = lattice();
			exec(s, retro(id, "synthetic"));
			for (let t = 0; t < 300; t++) s.step();
			return s.hash();
		};
		expect(run()).toBe(run());
	});

	it("rejects a malformed command without throwing", () => {
		const s = start();
		const bad = [{ type: "retrofit" }, { type: "retrofit", facilityId: "x", tree: "synthetic" }, { type: "retrofit", facilityId: 1 }, { type: "retrofit", facilityId: 1, tree: 7 }];
		for (const c of bad) expect(s.submit(c as unknown as SimCommand).ok).toBe(false);
	});

	it("a rack in the middle of a job is released cleanly: the job goes on with the other racks or stalls, nothing breaks", () => {
		const { s, id } = lattice();
		for (let t = 0; t < 60; t++) {
			for (const e of s.step()) if (e.type === "contractOffered") s.submit({ type: "acceptContract", contractId: e.contractId });
		}
		exec(s, retro(id, "synthetic"));
		for (let t = 0; t < 1200; t++) s.step();
		expect(s.state.facilities.filter((f) => f.id === id)).toHaveLength(0);
		expect(s.state.gameOver).toBeNull();
	});
});
