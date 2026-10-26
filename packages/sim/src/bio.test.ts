/** M3-T1: nutrient network, organoid racks, contamination, mutations, growths, corruption, path and endings, snapshot v5. */
import type { Balance, ContentDB, EventDef } from "@aitower/content";
import { describe, expect, it } from "vitest";
import type { SimEvent } from "./api";
import { corruptionStep } from "./bio/corruption";
import type { TickCtx } from "./core/context";
import { findById } from "./core/grid";
import { rackHazard } from "./reliability/reliabilityStep";
import { type SimImpl, SNAPSHOT_VERSION, simFromSnapshot } from "./sim";
import { balance, exec, facilityOf, makeContent, newSim, rowCells, run } from "./test/fixture";
import { count, giveRp, NO_OFFERS, pushOffer, QUIET_EVENTS, training } from "./test/m2b";
import { addBot, addFacility } from "./world/entities";
import { failRack } from "./reliability/reliabilityStep";
import { organoidBand } from "./thermal/rackThermal";

const BIO = balance.bio;
const PATHS = [
	{ id: "biotech" as const, name: "Biotech", description: "", available: true },
	{ id: "greentech" as const, name: "Greentech", description: "", available: false },
];

const bioBalance = (over: Partial<Balance> = {}): Partial<Balance> => ({
	...QUIET_EVENTS,
	...NO_OFFERS,
	ambientMeanC: 37,
	ambientSwingC: 0,
	thermal: { ...balance.thermal, rackDeltaC: 0, rackEase: 1 },
	bio: { ...BIO, decay: 0 },
	...over,
});

const idx = (sim: SimImpl, x: number, floor = 0): number => (floor - sim.state.floorMin) * sim.state.width + x;

/** A content set with the biotech paths; `tweak` may edit defs before the sim is built. */
function content(over: Partial<Balance> = {}, tweak?: (c: ContentDB) => void): ContentDB {
	const c = makeContent([], bioBalance(over));
	c.paths = PATHS;
	tweak?.(c);
	return c;
}

/** Floor 0 (power, nutrient pipe, grid tie, plant at x=40) and floor 1 (slab only). */
function lab(over: Partial<Balance> = {}, tweak?: (c: ContentDB) => void, pipe = true): SimImpl {
	const sim = newSim(content(over, tweak), "empty", 1);
	exec(sim, { type: "buildSlab", floor: 0, x0: 0, x1: 47 }, { type: "buildSlab", floor: 1, x0: 0, x1: 47 }, { type: "buildConduit", layer: "power", cells: rowCells(0, 0, 47) });
	if (pipe) exec(sim, { type: "buildConduit", layer: "nutrient", cells: rowCells(0, 0, 47) });
	exec(sim, { type: "place", defId: "grid_tie", floor: 0, x: 0 });
	if (pipe) exec(sim, { type: "place", defId: "nutrient_plant", floor: 0, x: 40 });
	return sim;
}

const place = (sim: SimImpl, defId: string, x: number, floor = 0): number => {
	exec(sim, { type: "place", defId, floor, x });
	return sim.state.facilities.at(-1)?.id ?? -1;
};
const setAir = (sim: SimImpl, t: number): void => {
	for (let x = 0; x < 48; x++) for (const fl of [0, 1]) sim.state.airTemp[idx(sim, x, fl)] = t;
};
const fview = (sim: SimImpl, id: number) => {
	const f = sim.view().facilities.find((v) => v.id === id);
	if (!f) throw new Error("no facility view");
	return f;
};
const sumField = (sim: SimImpl): number => sim.state.contamination.reduce((a, b) => a + b, 0);
const fill = (sim: SimImpl, x0: number, x1: number, v: number, floor = 0): void => {
	for (let x = x0; x <= x1; x++) sim.state.contamination[idx(sim, x, floor)] = v;
};

describe("nutrient layer", () => {
	it("is built, labelled, priced like coolant and demolished with a refund", () => {
		const sim = lab({}, undefined, false);
		const cash = sim.state.cash;
		exec(sim, { type: "buildConduit", layer: "nutrient", cells: [...rowCells(0, 2, 5), ...rowCells(0, 9, 11)] });
		expect(cash - sim.state.cash).toBeCloseTo(7 * 1500, 0); // plus a sliver of upkeep
		const v = sim.view();
		expect(v.nutrient[idx(sim, 3)]).toBe(1);
		expect(v.nutrientNetOf[idx(sim, 3)]).toBe(0);
		expect(v.nutrientNetOf[idx(sim, 10)]).toBe(1);
		expect(v.nutrientNetOf[idx(sim, 7)]).toBe(-1);
		const before = sim.state.cash;
		exec(sim, { type: "demolish", floor: 0, x: 5, layer: "nutrient" });
		expect(sim.state.cash - before).toBeCloseTo(750, 0);
		expect(sim.view().nutrient[idx(sim, 5)]).toBe(0);
		expect(sim.state.power[idx(sim, 5)]).toBe(1);
		// Without a layer, a tile with power and nutrient pipes loses both.
		exec(sim, { type: "demolish", floor: 0, x: 4 });
		expect(sim.state.nutrient[idx(sim, 4)]).toBe(0);
		expect(sim.state.power[idx(sim, 4)]).toBe(0);
	});

	it("needsNutrient placement checks the nutrient conduit", () => {
		const sim = lab({}, undefined, false);
		expect(sim.canPlace("needy_depot", 0, 5)).toEqual({ ok: false, reason: "needs a nutrient conduit under it" });
		exec(sim, { type: "buildConduit", layer: "nutrient", cells: rowCells(0, 4, 6) });
		expect(sim.canPlace("needy_depot", 0, 5).ok).toBe(true);
		expect(sim.submit({ type: "buildConduit", layer: "bogus" as "power", cells: [] }).ok).toBe(false);
	});

	it("satisfaction = min(1, supply/demand); consumers scale down; no net means noNutrient; supply is billed as upkeep", () => {
		const sim = lab({}, (c) => {
			const b = c.facilities.nutrient_plant.bio;
			if (b) b.nutrientCapacity = 0.3;
		});
		const a = place(sim, "organoid_rack", 10);
		const b = place(sim, "organoid_rack", 14);
		run(sim, 3);
		const net = sim.view().nutrientNets[0];
		expect(net.supply).toBeCloseTo(0.3, 6);
		expect(net.demand).toBeCloseTo(0.6, 6); // 2 racks × use 2 × idle load 0.15
		expect(net.satisfaction).toBeCloseTo(0.5, 6);
		const fa = fview(sim, a);
		expect(fa.nutrientNet).toBe(0);
		expect(fa.clock).toBeCloseTo(0.5, 5);
		expect(fview(sim, b).status).not.toBe("noNutrient");
		// A rack on floor 1 has no pipe: noNutrient, clock 0.
		exec(sim, { type: "buildConduit", layer: "power", cells: rowCells(1, 0, 47) });
		const c = place(sim, "organoid_rack", 20, 1);
		run(sim, 3);
		expect(fview(sim, c)).toMatchObject({ status: "noNutrient", nutrientNet: null, clock: 0 });
		// A dead plant (capacity 0) ⇒ satisfaction 0 ⇒ noNutrient.
		const plant = facilityOf(sim, "nutrient_plant");
		exec(sim, { type: "setEnabled", facilityId: plant.id, enabled: false });
		run(sim, 2);
		expect(fview(sim, a).status).toBe("noNutrient");
		expect(sim.view().nutrientNets[0].satisfaction).toBe(0);
		// Billing: 10 units supplied per tick × price.
		const mk = (price: number) => {
			const s = lab({ bio: { ...BIO, decay: 0, nutrientPrice: price } });
			const before = s.state.today.upkeep;
			s.step();
			return s.state.today.upkeep - before;
		};
		const p0 = mk(0);
		const p2 = mk(2);
		expect(p2 - p0).toBeCloseTo(10 * 2, 5);
	});
});

describe("organoid racks", () => {
	function bandRack() {
		const sim = lab();
		const id = place(sim, "organoid_rack", 10);
		return { sim, id };
	}
	/** Expected clock for a die temperature (target 37 ± 1, minClock 0.6). */
	const clockAt = (tempC: number): number => {
		const a = Math.abs(tempC - 37);
		return a <= 1 ? 1 : a >= 2 ? 0.6 : 1 - 0.4 * (a - 1);
	};
	/** The band rule itself, on a tissue temperature (the incubator's regulation is tested separately below). */
	const band = (t: number) => {
		const { sim, id } = bandRack();
		const f = sim.state.facilities.find((x) => x.id === id);
		if (!f) throw new Error("no rack");
		f.tempC = t;
		const events: SimEvent[] = [];
		organoidBand({ state: sim.state, content: sim.content, events }, f, { targetC: 37, toleranceC: 1 });
		return { f, events, sim };
	};

	it("full clock in the band, linear to minClock at ±2× tolerance, flat beyond, tooCold vs throttled", () => {
		const check = (t: number, state: "ok" | "hot" | "cold", lo: number, hi: number) => {
			const { f } = band(t);
			expect(f.tooCold).toBe(state === "cold");
			expect(f.throttled).toBe(state === "hot");
			expect(f.thermalClock).toBeCloseTo(clockAt(t), 3);
			expect(f.thermalClock).toBeGreaterThanOrEqual(lo);
			expect(f.thermalClock).toBeLessThanOrEqual(hi);
		};
		check(37, "ok", 1, 1);
		check(37.9, "ok", 1, 1);
		check(38.5, "hot", 0.7, 0.95); // a bit above the band: partly slowed
		check(35.5, "cold", 0.7, 0.85);
		check(34.9, "cold", 0.6, 0.6); // beyond 2× tolerance: flat at minClock
		check(34.5, "cold", 0.6, 0.6);
		check(39.6, "hot", 0.6, 0.6);
	});

	it("beyond ±3× the tissue fails (work order, repairable), too hot and too cold", () => {
		for (const t of [33.4, 40.6]) {
			const { f, events, sim } = band(t);
			expect(events).toContainEqual({ type: "componentFailed", facilityId: f.id });
			expect(f.failed).toBe(true);
			expect(sim.state.workOrders.map((w) => w.facilityId)).toEqual([f.id]);
		}
		expect(band(34.2).f.failed).toBe(false); // 2.8×: still alive
	});

	it("a new incubator warms up without dying, but a power cut in a cool room kills the tissue", () => {
		const sim = lab({}, undefined, true);
		const id = place(sim, "organoid_rack", 10);
		const f = sim.state.facilities.find((x) => x.id === id);
		if (!f) throw new Error("no rack");
		f.tempC = 15; // fresh from the crate, at room temperature
		let fails = 0;
		for (let i = 0; i < 60; i++) {
			setAir(sim, 15);
			fails += count(sim.step(), "componentFailed");
		}
		expect(fails).toBe(0);
		expect(f.tempC).toBeGreaterThan(36);
		f.enabled = false; // the plug is pulled
		for (let i = 0; i < 60 && !f.failed; i++) {
			setAir(sim, 15);
			sim.step();
		}
		f.enabled = true;
		setAir(sim, 15);
		sim.step();
		expect(f.failed).toBe(true);
	});

	it("a powered incubator holds 37 °C across ordinary room temperatures; unpowered, the tissue follows the air", () => {
		for (const air of [13, 25, 42.5]) {
			const { sim, id } = bandRack();
			for (let i = 0; i < 80; i++) {
				setAir(sim, air);
				sim.step();
			}
			const v = fview(sim, id);
			expect(v.tempC).toBeCloseTo(37, 1);
			expect(v.status).not.toBe("tooCold");
			expect(v.status).not.toBe("failed");
		}
		const { sim, id } = bandRack();
		const f = sim.state.facilities.find((x) => x.id === id);
		if (!f) throw new Error("no rack");
		f.enabled = false;
		for (let i = 0; i < 80; i++) {
			setAir(sim, 22);
			sim.step();
		}
		expect(fview(sim, id).tempC).toBeLessThan(25); // no regulation without power: the tissue cools with the room
	});

	it("needsBio contracts only use organoid racks; organoid racks also serve ordinary jobs; liquid jobs exclude them", () => {
		const sim = lab();
		place(sim, "rack_air_gpu", 20);
		run(sim, 3);
		const bio = pushOffer(sim, training({ needsBio: true, work: 5 }));
		const r = sim.submit({ type: "acceptContract", contractId: bio });
		expect(r.ok).toBe(false);
		expect(!r.ok && r.reason).toMatch(/organoid/);
		const org = place(sim, "organoid_rack", 10);
		run(sim, 3);
		expect(sim.submit({ type: "acceptContract", contractId: bio }).ok).toBe(true);
		run(sim, 3);
		const job = sim.view().jobs[0];
		expect(job.rackIds).toEqual([org]); // the air rack was passed over
		expect(sim.view().organoidPflops).toBeGreaterThan(0);
		// Ordinary job on a lab with only organoid racks.
		const sim2 = lab();
		place(sim2, "organoid_rack", 10);
		run(sim2, 3);
		expect(sim2.submit({ type: "acceptContract", contractId: pushOffer(sim2, training({ work: 5 })) }).ok).toBe(true);
		// Liquid job: organoid racks are not liquid-cooled.
		const liquid = sim2.submit({ type: "acceptContract", contractId: pushOffer(sim2, training({ work: 5, needsLiquid: true })) });
		expect(liquid.ok).toBe(false);
	});

	it("organoid PFLOPS follow nutrient satisfaction and are reported in the view", () => {
		const sim = lab({}, (c) => {
			const b = c.facilities.nutrient_plant.bio;
			if (b) b.nutrientCapacity = 1; // demand of one busy rack = 2
		});
		place(sim, "organoid_rack", 10);
		run(sim, 3);
		sim.submit({ type: "acceptContract", contractId: pushOffer(sim, training({ work: 500, durationTicks: 100_000, needsBio: true })) });
		run(sim, 4);
		const v = sim.view();
		expect(v.nutrientNets[0].satisfaction).toBeCloseTo(0.5, 6);
		expect(v.organoidPflops).toBeCloseTo(15, 3);
		expect(v.pflops).toBeCloseTo(15, 3);
	});
});

describe("contamination field", () => {
	it("diffusion conserves the total (sideways and across floors) and flows slabFactor-weaker between floors", () => {
		const sim = lab();
		fill(sim, 20, 20, 1);
		const k = BIO.diffusion;
		sim.step();
		const c = sim.state.contamination;
		expect(c[idx(sim, 19)]).toBeCloseTo(k, 6);
		expect(c[idx(sim, 21)]).toBeCloseTo(k, 6);
		expect(c[idx(sim, 20, 1)]).toBeCloseTo(k * BIO.slabFactor, 6);
		expect(c[idx(sim, 20)]).toBeCloseTo(1 - 2 * k - k * BIO.slabFactor, 6);
		expect(sumField(sim)).toBeCloseTo(1, 5);
		run(sim, 300);
		expect(sumField(sim)).toBeCloseTo(1, 4);
		for (const v of c) expect(v).toBeGreaterThanOrEqual(0);
		expect(sim.view().contamination).toBe(sim.state.contamination);
	});

	it("decays by the decay fraction per tick and flushes to zero", () => {
		const sim = lab({ bio: { ...BIO, decay: 0.01 } });
		fill(sim, 20, 20, 1);
		run(sim, 10);
		expect(sumField(sim)).toBeCloseTo(0.99 ** 10, 4);
		const quiet = lab({ bio: { ...BIO, decay: 0.2 } });
		fill(quiet, 20, 20, 1);
		run(quiet, 400);
		expect(sumField(quiet)).toBe(0);
	});

	it("cells without slab hold and pass nothing", () => {
		const sim = lab();
		sim.state.contamination[idx(sim, 5, 5)] = 1; // floor 5 has no slab
		fill(sim, 0, 0, 1);
		sim.step();
		expect(sim.state.contamination[idx(sim, 5, 5)]).toBe(0);
		expect(sumField(sim)).toBeCloseTo(1, 5);
	});

	it("a quarantine cell passes only quarantineLeak of the diffusion", () => {
		const sim = lab();
		place(sim, "quarantine_lock", 20);
		fill(sim, 19, 19, 1);
		sim.step();
		const c = sim.state.contamination;
		expect(c[idx(sim, 18)]).toBeCloseTo(BIO.diffusion, 6);
		expect(c[idx(sim, 20)]).toBeCloseTo(BIO.diffusion * BIO.quarantineLeak, 6);
		const far = (withLock: boolean): number => {
			const s = lab({ bio: { ...BIO, decay: 0, slabFactor: 0 } }); // no way around through floor 1
			if (withLock) place(s, "quarantine_lock", 20);
			fill(s, 10, 10, 1);
			run(s, 300);
			let beyond = 0;
			for (let x = 21; x < 48; x++) beyond += s.state.contamination[idx(s, x)];
			return beyond;
		};
		expect(far(true)).toBeLessThan(far(false) * 0.2);
		// A disabled lock is open.
		const open = lab();
		const q = place(open, "quarantine_lock", 20);
		exec(open, { type: "setEnabled", facilityId: q, enabled: false });
		fill(open, 19, 19, 1);
		open.step();
		expect(open.state.contamination[idx(open, 20)]).toBeCloseTo(BIO.diffusion, 5);
	});

	it("sources: organoid racks × load, bioreactors while nutrients flow; the view reports the facility's max", () => {
		const sim = lab();
		const o = place(sim, "organoid_rack", 10);
		sim.step();
		// idle load 0.15 × 0.002 per cell (then a little diffusion)
		expect(sim.state.contamination[idx(sim, 10)]).toBeGreaterThan(0.0002);
		expect(sim.state.contamination[idx(sim, 10)]).toBeLessThan(0.0008);
		expect(fview(sim, o).contamination).toBeCloseTo(Math.max(sim.state.contamination[idx(sim, 10)], sim.state.contamination[idx(sim, 11)]), 8);
		const r = lab();
		place(r, "bioreactor", 10);
		run(r, 3);
		expect(r.state.contamination[idx(r, 10)]).toBeGreaterThan(0.02); // 3 ticks × 0.01
		const off = lab({}, undefined, false); // no nutrient net: the reactor does not run, so it does not emit
		place(off, "bioreactor", 10);
		run(off, 3);
		expect(sumField(off)).toBe(0);
	});

	it("sterilizers remove cleanRate × power from cells within radius on their floor; irreversible scales them down", () => {
		const mk = () => {
			const s = lab();
			place(s, "sterile_bay", 10);
			for (let x = 0; x < 48; x++) fill(s, x, x, 0.5);
			fill(s, 0, 47, 0.5, 1);
			return s;
		};
		const sim = mk();
		sim.step();
		const c = sim.state.contamination;
		expect(c[idx(sim, 10)]).toBeCloseTo(0.49, 4);
		expect(c[idx(sim, 6)]).toBeCloseTo(0.49, 4);
		expect(c[idx(sim, 15)]).toBeCloseTo(0.49, 4);
		expect(c[idx(sim, 30)]).toBeCloseTo(0.5, 4);
		expect(c[idx(sim, 10, 1)]).toBeCloseTo(0.5, 2); // other floor untouched
		const irr = mk();
		irr.state.irreversible = true;
		irr.step();
		expect(irr.state.contamination[idx(irr, 10)]).toBeCloseTo(0.5 - 0.01 * BIO.irreversibleCleanFactor, 4);
		const bay = facilityOf(sim, "sterile_bay");
		exec(sim, { type: "setEnabled", facilityId: bay.id, enabled: false });
		const before = sim.state.contamination[idx(sim, 10)];
		sim.step();
		expect(sim.state.contamination[idx(sim, 10)]).toBeGreaterThan(before - 0.002); // cleaning would take 0.01
	});

	it("rack failure hazard ×(1 + k·c) and bots slow down (floored at 0.3)", () => {
		const sim = lab();
		const id = place(sim, "organoid_rack", 10);
		const f = findById(sim.state.facilities, id);
		if (!f) throw new Error("rack");
		sim.content.facilities.organoid_rack.rack!.failurePerDay = 1;
		expect(rackHazard(sim.content, f, 1, 0.5) / rackHazard(sim.content, f, 1, 0)).toBeCloseTo(1 + BIO.hazardPerContamination * 0.5, 8);
		const walk = (c: number, k: number): number => {
			const s = lab({ bio: { ...BIO, decay: 0, botSlowPerContamination: k } });
			const ch = place(s, "bot_charger", 44, 0);
			const bot = addBot(s.state, "rover", 0, 10, ch);
			fill(s, 0, 47, c);
			fill(s, 0, 47, c, 1);
			run(s, 21); // the first tick only sets the goal
			return bot.x - 10;
		};
		expect(walk(0, 0.5)).toBeCloseTo(5, 5);
		expect(walk(0.5, 0.5)).toBeCloseTo(5 * 0.75, 5);
		expect(walk(1, 2)).toBeCloseTo(5 * 0.3, 5);
	});

	it("crossing irreversibleShare sets the sticky flag once and quarterly audits stop", () => {
		const over = { audit: { ...balance.audit, periodDays: 2 } };
		const sim = lab(over);
		const total = 48;
		fill(sim, 0, Math.ceil(total * BIO.irreversibleShare) - 1, 0.6); // exactly at the share (row 0; row 1 is also built: 96 cells)
		fill(sim, 0, 47, 0.6, 1);
		const ev = sim.step();
		expect(ev.filter((e) => e.type === "contaminationIrreversible")).toHaveLength(1);
		expect(sim.view().irreversible).toBe(true);
		sim.state.contamination.fill(0);
		expect(count(run(sim, 5), "contaminationIrreversible")).toBe(0);
		expect(sim.view().irreversible).toBe(true);
		expect(sim.view().contaminatedShare).toBe(0);
		const evs = run(sim, 2 * 1440);
		expect(count(evs, "quarterReport")).toBe(0);
		expect(sim.view().reports).toHaveLength(0);
		// Control: without the flag the audit is filed.
		const control = lab(over);
		expect(count(run(control, 2 * 1440 + 10), "quarterReport")).toBe(1);
		// Below the share: no flag.
		const calm = lab();
		fill(calm, 0, 5, 0.9);
		calm.step();
		expect(calm.view().irreversible).toBe(false);
		expect(calm.view().contaminatedShare).toBeCloseTo(6 / 96, 3);
	});
});

describe("mutations", () => {
	function exposed(over: Partial<Balance["bio"]> = {}) {
		const sim = lab({ bio: { ...BIO, decay: 0, mutationExposureTicks: 10, ...over } });
		const ch = place(sim, "bot_charger", 44, 0);
		const home = facilityOf(sim, "bot_charger");
		void home;
		const b1 = addBot(sim.state, "rover", 0, 45, ch); // parked at the charger's dock tile
		const b2 = addBot(sim.state, "rover", 0, 45, ch);
		return { sim, b1, b2 };
	}

	it("a bot mutates once after mutationExposureTicks on contaminated cells; the trait is deterministic", () => {
		const { sim, b1, b2 } = exposed();
		const events: SimEvent[] = [];
		for (let i = 0; i < 30; i++) {
			fill(sim, 44, 46, 0.9);
			events.push(...sim.step());
		}
		const muts = events.filter((e) => e.type === "botMutated");
		expect(muts).toHaveLength(2);
		expect(b1.trait).not.toBeNull();
		expect(b2.trait).not.toBe(b1.trait);
		expect(sim.view().bots.map((b) => b.trait).sort()).toEqual(["fleshed", "tendriled"]);
		const twin = exposed().sim;
		for (let i = 0; i < 30; i++) {
			fill(twin, 44, 46, 0.9);
			twin.step();
		}
		expect(twin.view().bots.map((b) => b.trait)).toEqual(sim.view().bots.map((b) => b.trait));
	});

	it("below the threshold nothing happens, and exposure accumulates rather than resetting", () => {
		const { sim, b1 } = exposed();
		for (let i = 0; i < 40; i++) {
			fill(sim, 44, 46, 0.3);
			sim.step();
		}
		expect(b1.trait).toBeNull();
		for (let i = 0; i < 6; i++) {
			fill(sim, 44, 46, 0.9);
			sim.step();
		}
		fill(sim, 44, 46, 0);
		run(sim, 10);
		expect(b1.trait).toBeNull();
		expect(b1.exposure).toBe(6);
		for (let i = 0; i < 4; i++) {
			fill(sim, 44, 46, 0.9);
			sim.step();
		}
		expect(b1.trait).not.toBeNull();
	});

	/** Failed racks, a depot with parts, and a charger on floor 0; returns the sim and the bot. */
	function repairLab(trait: "fleshed" | "tendriled" | null, defId = "rover", racks = 1, rackFloor = 0) {
		const sim = lab();
		exec(sim, { type: "buildConduit", layer: "power", cells: rowCells(1, 0, 47) });
		const ch = place(sim, "bot_charger", 26);
		place(sim, "parts_depot", 29);
		exec(sim, { type: "buyParts", count: 3 });
		const ids: number[] = [];
		for (let i = 0; i < racks; i++) ids.push(place(sim, "rack_air_gpu", 4 + i * 3, rackFloor));
		const bot = addBot(sim.state, defId, 0, 27, ch);
		bot.trait = trait;
		for (const id of ids) {
			const f = findById(sim.state.facilities, id);
			if (f) failRack(sim.state, f, []);
		}
		return { sim, bot, ids };
	}
	const untilRepaired = (sim: SimImpl, max = 600): number => {
		for (let i = 1; i <= max; i++) if (sim.step().some((e) => e.type === "repaired")) return i;
		return -1;
	};

	it("fleshed: repairs in 0.6× the ticks and leaves +0.2 contamination where it repairs", () => {
		const plain = untilRepaired(repairLab(null).sim);
		const { sim } = repairLab("fleshed");
		const fast = untilRepaired(sim);
		expect(plain).toBeGreaterThan(0);
		expect(plain - fast).toBeGreaterThanOrEqual(11); // repairTicks 30 → 18
		expect(plain - fast).toBeLessThanOrEqual(13);
		expect(sim.state.contamination[idx(sim, 5)]).toBeGreaterThan(0.15); // service tile of the rack at x=4 (w2)
		const clean = repairLab(null);
		untilRepaired(clean.sim);
		expect(sumField(clean.sim)).toBe(0);
	});

	it("tendriled: carries +2 parts per trip, and never leaves its floor (no lifts, no flying)", () => {
		const maxParts = (trait: "tendriled" | null): number => {
			const { sim, bot } = repairLab(trait, "rover", 3);
			let m = 0;
			for (let i = 0; i < 300; i++) {
				sim.step();
				m = Math.max(m, bot.parts);
			}
			return m;
		};
		expect(maxParts(null)).toBe(1);
		expect(maxParts("tendriled")).toBe(3);
		// A drone flies to floor 1 for the control; the tendriled one takes no order there.
		expect(untilRepaired(repairLab(null, "drone", 1, 1).sim, 800)).toBeGreaterThan(0);
		expect(untilRepaired(repairLab("tendriled", "drone", 1, 1).sim, 800)).toBe(-1);
		// On its own floor it works.
		expect(untilRepaired(repairLab("tendriled", "rover", 1, 0).sim, 800)).toBeGreaterThan(0);
	});
});

describe("growths", () => {
	const growthContent = (chance = 24) => ({ bio: { ...BIO, decay: 0, growthChancePerDay: chance } });

	it("sprout on empty slab at or above growthThreshold, hourly, with an event; marked grown", () => {
		const sim = lab(growthContent());
		fill(sim, 30, 31, 1);
		fill(sim, 5, 5, 0.69); // below the threshold
		sim.state.tick = 59;
		const events = run(sim, 2); // ticks 59 and 60: the roll happens on the hour
		const sprouted = events.filter((e) => e.type === "growthSprouted");
		expect(sprouted).toHaveLength(1);
		const f = facilityOf(sim, "growth_mass");
		expect(f).toMatchObject({ grown: true, x: 30, floor: 0 });
		expect(sprouted[0]).toEqual({ type: "growthSprouted", facilityId: f.id });
		const v = fview(sim, f.id);
		expect(v.grown).toBe(true);
		expect(sim.state.facilities.filter((x) => x.grown)).toHaveLength(1);
		// Only on the hour: nothing sprouts at tick 1..59 even with new qualifying cells.
		fill(sim, 12, 13, 1);
		expect(count(run(sim, 50), "growthSprouted")).toBe(0);
		run(sim, 8); // tick 119; the hour at tick 120 is next
		fill(sim, 12, 13, 1);
		expect(count(run(sim, 2), "growthSprouted")).toBe(1);
	});

	it("never on built cells, lifts, or without growth defs / chance; uses its own rng stream", () => {
		const sim = lab(growthContent());
		const o = place(sim, "organoid_rack", 10);
		void o;
		fill(sim, 10, 11, 1);
		const rngBefore = { ...sim.state.rng };
		sim.state.tick = 59;
		run(sim, 2); // tick 60 rolls, but every qualifying cell is occupied
		expect(sim.state.facilities.some((f) => f.grown)).toBe(false);
		expect(sim.state.rng.growth).toBe(rngBefore.growth);
		const none = lab(growthContent(0));
		fill(none, 20, 21, 1);
		run(none, 5);
		expect(none.state.facilities.some((f) => f.grown)).toBe(false);
		const only = lab(growthContent(24));
		fill(only, 20, 21, 1);
		only.state.tick = 59;
		const { contracts, reliability, events, growth } = only.state.rng;
		run(only, 2);
		expect(only.state.facilities.some((f) => f.grown)).toBe(true);
		expect(only.state.rng).toMatchObject({ contracts, reliability, events });
		expect(only.state.rng.growth).not.toBe(growth);
	});

	it("work without conduits, free, self-heal after a failure (no work order), emit contamination", () => {
		const sim = lab(growthContent(0), (c) => {
			const r = c.facilities.growth_mass.rack;
			if (r) r.failurePerDay = 0;
		});
		const f = addFacility(sim.state, sim.content, "growth_mass", 1, 20); // floor 1: no power, no pipe
		run(sim, 3);
		expect(fview(sim, f.id)).toMatchObject({ status: "idle", powerNet: null, nutrientNet: null, clock: 1 });
		sim.submit({ type: "acceptContract", contractId: pushOffer(sim, training({ work: 50, durationTicks: 100_000 })) });
		run(sim, 3);
		expect(sim.view().organoidPflops).toBeCloseTo(5, 5);
		expect(fview(sim, f.id).status).toBe("ok");
		expect(sim.state.contamination[idx(sim, 20, 1)]).toBeGreaterThan(0.01);
		expect(fview(sim, f.id).powerKw).toBe(0);
		expect(sim.content.facilities.growth_mass).toMatchObject({ cost: 0, upkeepPerDay: 0 });
		// Failure and return.
		sim.content.facilities.growth_mass.rack!.failurePerDay = 1440;
		const ev = sim.step();
		expect(ev).toContainEqual({ type: "componentFailed", facilityId: f.id });
		expect(fview(sim, f.id).status).toBe("failed");
		sim.content.facilities.growth_mass.rack!.failurePerDay = 0;
		run(sim, 170);
		expect(fview(sim, f.id).status).toBe("failed");
		const back = run(sim, 15);
		expect(back).toContainEqual({ type: "rackRecovered", facilityId: f.id });
		expect(fview(sim, f.id).status).not.toBe("failed");
		expect(sim.view().workOrders).toHaveLength(0);
	});

	it("cannot be built, demolish refunds nothing", () => {
		const sim = lab(growthContent(0));
		const r = sim.canPlace("growth_mass", 0, 20);
		expect(r.ok).toBe(false);
		const twin = lab(growthContent(0));
		const f = addFacility(sim.state, sim.content, "growth_mass", 0, 20);
		addFacility(twin.state, twin.content, "growth_mass", 0, 20);
		sim.invalidateProjection();
		twin.invalidateProjection();
		const ev = exec(sim, { type: "demolish", floor: 0, x: 20 });
		twin.step();
		expect(sim.state.facilities.some((x) => x.id === f.id)).toBe(false);
		expect(sim.state.cash).toBe(twin.state.cash); // no refund
		expect(count(ev, "demolished")).toBe(1);
	});

	it("a powered culling room removes growths in reach once a day, at 03:00", () => {
		const sim = lab(growthContent(0));
		addFacility(sim.state, sim.content, "growth_mass", 0, 14);
		addFacility(sim.state, sim.content, "growth_mass", 0, 30);
		place(sim, "culling_room", 10);
		sim.state.tick = 1259;
		expect(count(sim.step(), "demolished")).toBe(0);
		expect(sim.state.facilities.filter((f) => f.grown)).toHaveLength(2);
		const ev = sim.step(); // tick 1260 = 03:00
		expect(ev.filter((e) => e.type === "demolished")).toEqual([{ type: "demolished", floor: 0, x: 14 }]);
		expect(sim.state.facilities.filter((f) => f.grown).map((f) => f.x)).toEqual([30]);
		const off = lab(growthContent(0));
		addFacility(off.state, off.content, "growth_mass", 0, 14);
		const room = place(off, "culling_room", 10);
		exec(off, { type: "setEnabled", facilityId: room, enabled: false });
		off.state.tick = 1259;
		run(off, 3);
		expect(off.state.facilities.some((f) => f.grown)).toBe(true);
	});
});

describe("corruption", () => {
	const ctxOf = (sim: SimImpl) => ({ state: sim.state, content: sim.content, events: [], scratch: undefined }) as unknown as TickCtx;
	const setup = () => {
		const sim = lab(growthContent());
		for (let i = 0; i < 10; i++) addFacility(sim.state, sim.content, "growth_mass", 1, i * 2);
		sim.state.contaminatedShare = 0.2; // ÷ irreversibleShare 0.4 = 0.5
		sim.state.metrics.pflops = 10;
		sim.state.metrics.organoidPflops = 5; // 0.5
		return sim;
	};
	function growthContent() {
		return {};
	}

	it("moves toward 0.5·share/irr + 0.3·organoid share + 0.2·min(1, growths/20) at +0.1/day and −0.02/day, per tick", () => {
		const sim = setup();
		const target = 0.5 * 0.5 + 0.3 * 0.5 + 0.2 * 0.5; // 0.5
		corruptionStep(ctxOf(sim));
		expect(sim.state.corruption).toBeCloseTo(0.1 / 1440, 10);
		sim.state.corruption = target - 0.00001;
		corruptionStep(ctxOf(sim));
		expect(sim.state.corruption).toBeCloseTo(target, 10); // never overshoots
		sim.state.corruption = 0.9;
		corruptionStep(ctxOf(sim));
		expect(sim.state.corruption).toBeCloseTo(0.9 - 0.02 / 1440, 10);
		sim.state.corruption = target + 0.000001;
		corruptionStep(ctxOf(sim));
		expect(sim.state.corruption).toBeCloseTo(target, 10);
		// Capped at 1, and zero organoid share when nothing is delivered.
		sim.state.contaminatedShare = 1;
		sim.state.corruption = 1;
		corruptionStep(ctxOf(sim));
		expect(sim.state.corruption).toBe(1);
		sim.state.metrics.pflops = 0;
		sim.state.contaminatedShare = 0;
		sim.state.corruption = 0.3;
		corruptionStep(ctxOf(sim));
		expect(sim.state.corruption).toBeCloseTo(0.3 - 0.02 / 1440, 10); // target 0.1 (growths only)
	});

	it("the running sim rises over a day while organoids deliver, and the view reports it", () => {
		const sim = lab();
		place(sim, "organoid_rack", 10);
		run(sim, 3);
		sim.submit({ type: "acceptContract", contractId: pushOffer(sim, training({ work: 100_000, durationTicks: 1_000_000, needsBio: true })) });
		run(sim, 1000);
		expect(sim.view().corruption).toBeGreaterThan(0.06);
		expect(sim.view().corruption).toBeLessThanOrEqual(0.3 + 1e-9);
		expect(sim.view().corruption).toBeCloseTo((0.1 * 996) / 1440, 2);
	});
});

describe("choosePath and gates", () => {
	it("rejects below the minimum tier, unknown or unavailable paths and a second choice; emits pathChosen", () => {
		const sim = lab();
		const early = sim.submit({ type: "choosePath", path: "biotech" });
		expect(early).toEqual({ ok: false, reason: "requires Level 5" });
		sim.state.tier = 5;
		sim.invalidateProjection();
		expect(sim.submit({ type: "choosePath", path: "nope" as "biotech" }).ok).toBe(false);
		const soon = sim.submit({ type: "choosePath", path: "greentech" });
		expect(!soon.ok && soon.reason).toMatch(/not available/);
		expect(sim.submit({ type: "choosePath", path: "synthetic" }).ok).toBe(false); // not in content.paths
		expect(sim.submit({ type: "choosePath", path: 3 as unknown as "biotech" }).ok).toBe(false);
		expect(sim.view().path).toBeNull();
		const ev = exec(sim, { type: "choosePath", path: "biotech" });
		expect(ev).toContainEqual({ type: "pathChosen", path: "biotech" });
		expect(sim.view().path).toBe("biotech");
		const again = sim.submit({ type: "choosePath", path: "biotech" });
		expect(again.ok).toBe(false);
		expect(sim.canBuild({ type: "choosePath", path: "greentech" }).ok).toBe(false);
	});

	it("a path tech node cannot be researched before its path is chosen", () => {
		const sim = lab({}, (c) => {
			c.tech.push({ id: "bio_t", name: "Bio Tech", description: "", branch: "wetware", minTier: 1, cost: 1, requires: [], effects: [], requiresCommit: "biotech" });
		});
		giveRp(sim, 10);
		const r = sim.submit({ type: "research", techId: "bio_t" });
		expect(!r.ok && r.reason).toMatch(/Commit to The Flesh/);
		sim.state.tier = 5;
		sim.invalidateProjection();
		exec(sim, { type: "choosePath", path: "biotech" });
		expect(sim.submit({ type: "research", techId: "bio_t" }).ok).toBe(true);
	});

	it("events honour path and minCorruption", () => {
		const ev = (id: string, extra: Partial<EventDef>): EventDef => ({
			id, category: "horror", title: id, body: "", weight: 1, minTier: 1, cooldownDays: 0, advisor: "cass", recommended: "a",
			choices: [{ id: "a", label: "A", hint: "", outcome: "", effects: [] }], ...extra,
		});
		const mk = () => lab({ events: { intervalTicks: 20, graceTicks: 0 } }, (c) => {
			c.events = [ev("plain", {}), ev("pathy", { path: "biotech" }), ev("dark", { minCorruption: 0.5 })];
		});
		const issued = (sim: SimImpl, n = 1440 * 8): Set<string> => {
			const s = new Set<string>();
			for (let i = 0; i < n; i++)
				for (const e of sim.step())
					if (e.type === "decisionIssued") {
						s.add(e.eventId);
						sim.submit({ type: "resolveDecision", decisionId: e.decisionId, choiceId: "a" }); // one open at a time
					}
			return s;
		};
		const a = mk();
		a.state.corruption = 0.4;
		expect([...issued(a)]).toEqual(["plain"]);
		const b = mk();
		b.state.tier = 5;
		exec(b, { type: "choosePath", path: "biotech" });
		b.state.corruption = 0.6;
		const got = issued(b, 1440 * 25);
		expect(got.has("pathy")).toBe(true);
		expect(got.has("dark")).toBe(true);
	});
});

describe("endings", () => {
	const E = { absorbed: { corruption: 0.5 } };
	const biotech = (over: Partial<Balance> = {}, corruption = 0.9, tier = 1): SimImpl => {
		const sim = lab({ endings: E, ...over });
		sim.state.path = "biotech";
		sim.state.tier = tier;
		sim.state.corruption = corruption;
		sim.invalidateProjection();
		return sim;
	};
	const dayEnd = (sim: SimImpl): SimEvent[] => {
		const out: SimEvent[] = [];
		while ((sim.state.tick + 1) % 1440 !== 0) out.push(...sim.step());
		out.push(...sim.step());
		return out;
	};

	it("absorbed: tier ≥ minTier and corruption ≥ threshold ⇒ final gameOver absorbed, on any path", () => {
		const lowTier = biotech({}, 1, 4);
		dayEnd(lowTier);
		expect(lowTier.view().gameOver?.kind).not.toBe("absorbed");
		const sim = biotech({}, 1, 5);
		sim.state.path = null;
		const ev = dayEnd(sim);
		expect(ev).toContainEqual({ type: "gameOver", kind: "absorbed", ending: "absorbed" });
		expect(sim.view().gameOver).toEqual({ kind: "absorbed", tick: 1439, ending: "absorbed" });
		expect(count(run(sim, 2 * 1440), "gameOver")).toBe(0);
	});

	it("reaching the top tier never sets victory", () => {
		const sim = lab({ tiers: { pflops: [0, 1], uptime: [0, 0], reward: [0, 0] } });
		sim.state.path = null;
		run(sim, 2 * 1440);
		expect(sim.view().gameOver).toBeNull();
	});
});

describe("bioreactor power", () => {
	it("supplies power first (capacity × nutrient satisfaction), counts in totalKw, and sits idle without nutrients", () => {
		const sim = lab({}, (c) => {
			const b = c.facilities.nutrient_plant.bio;
			if (b) b.nutrientCapacity = 2; // reactor wants 4 ⇒ satisfaction 0.5
		});
		place(sim, "rack_air_gpu", 20);
		place(sim, "bioreactor", 10);
		run(sim, 5);
		const v = sim.view();
		expect(v.nutrientNets[0].satisfaction).toBeCloseTo(0.5, 6);
		expect(v.powerNets[0].supplyKw).toBeCloseTo(1500 + 100, 3);
		expect(v.powerNets[0].gridImportKw).toBeCloseTo(0, 3); // the reactor covers the idle rack's 6 kW
		expect(v.totalKw).toBeCloseTo(6, 3);
		expect(v.pue).toBeGreaterThanOrEqual(1 - 1e-9);
		const lone = lab({}, undefined, false);
		place(lone, "bioreactor", 10);
		run(lone, 3);
		expect(lone.view().powerNets[0].supplyKw).toBeCloseTo(1500, 3);
		expect(facilityOf(lone, "bioreactor").noNutrient).toBe(true);
		expect(lone.view().facilities.find((f) => f.defId === "bioreactor")?.status).toBe("noNutrient");
	});
});

describe("snapshot v5", () => {
	const busy = (seed = 3): SimImpl => {
		const sim = newSim(content({ bio: { ...BIO, decay: 0.0005, growthChancePerDay: 24, mutationExposureTicks: 50 } }), "empty", seed);
		exec(sim, { type: "buildSlab", floor: 0, x0: 0, x1: 47 }, { type: "buildConduit", layer: "power", cells: rowCells(0, 0, 47) }, { type: "buildConduit", layer: "nutrient", cells: rowCells(0, 0, 47) });
		exec(sim, { type: "place", defId: "grid_tie", floor: 0, x: 0 }, { type: "place", defId: "nutrient_plant", floor: 0, x: 40 });
		exec(sim, { type: "place", defId: "organoid_rack", floor: 0, x: 10 }, { type: "place", defId: "bioreactor", floor: 0, x: 14 }, { type: "place", defId: "bot_charger", floor: 0, x: 30 });
		addBot(sim.state, "rover", 0, 12, facilityOf(sim, "bot_charger").id);
		sim.state.path = null;
		return sim;
	};

	it("is deterministic per seed and sensitive to it; a mid-run save continues identically", () => {
		const go = (seed: number) => {
			const s = busy(seed);
			run(s, 2000);
			return s;
		};
		const a = go(3);
		expect(go(3).hash()).toBe(a.hash());
		expect(go(4).hash()).not.toBe(a.hash());
		expect(sumField(a)).toBeGreaterThan(0);
		const twin = simFromSnapshot(a.content, JSON.parse(JSON.stringify(a.snapshot()))) as SimImpl;
		expect(twin.hash()).toBe(a.hash());
		run(a, 1500);
		run(twin, 1500);
		expect(twin.hash()).toBe(a.hash());
		expect(twin.view().contamination).toEqual(a.view().contamination);
	});

	it("migrates a v4 save (new layers/fields absent) to the same state and keeps running identically", () => {
		const sim = busy();
		run(sim, 300);
		const snap = JSON.parse(JSON.stringify(sim.snapshot())) as { version: number; state: Record<string, any> };
		expect(snap.version).toBe(SNAPSHOT_VERSION);
		const s = snap.state;
		snap.version = 4;
		for (const k of ["nutrient", "nutrientNetOf", "contamination", "nutrientNetCount", "nutrientNets", "contaminatedShare", "irreversible", "corruption", "path", "sp", "sealScar", "sealResidue", "bonds", "objected", "sealedOut", "bondGiven"]) delete s[k];
		delete s.rng.growth;
		delete s.metrics.organoidPflops;
		for (const f of s.facilities) for (const k of ["nutrientNet", "nutrientSat", "noNutrient", "tooCold", "grown", "recoverAt"]) delete f[k];
		for (const b of s.bots) for (const k of ["trait", "exposure"]) delete b[k];
		const loaded = simFromSnapshot(sim.content, snap as never) as SimImpl;
		expect(loaded.state.path).toBeNull();
		expect(loaded.state.nutrient.length).toBe(loaded.state.slab.length);
		expect(loaded.state.rng.growth).toBe(sim.state.rng.growth); // mixSeed(seed, 4), same as at creation
		expect(loaded.snapshot().version).toBe(SNAPSHOT_VERSION);
		// The save predates the nutrient pipe, so the pipe is gone; only compare what is common after re-adding it.
		expect(loaded.state.bots[0]).toMatchObject({ trait: null, exposure: 0 });
		run(loaded, 200);
		expect(loaded.view().corruption).toBeGreaterThanOrEqual(0);
	});

	it("an old save of a fresh world hashes identically after migration", () => {
		const sim = newSim(content(), "empty", 9);
		exec(sim, { type: "buildSlab", floor: 0, x0: 0, x1: 20 });
		addBot(sim.state, "rover", 0, 3, -1);
		run(sim, 50);
		const snap = JSON.parse(JSON.stringify(sim.snapshot())) as { version: number; state: Record<string, any> };
		const s = snap.state;
		snap.version = 4;
		for (const k of ["nutrient", "nutrientNetOf", "contamination", "nutrientNetCount", "nutrientNets", "contaminatedShare", "irreversible", "corruption", "path", "sp", "sealScar", "sealResidue", "bonds", "objected", "sealedOut", "bondGiven"]) delete s[k];
		delete s.rng.growth;
		delete s.metrics.organoidPflops;
		for (const f of s.facilities) for (const k of ["nutrientNet", "nutrientSat", "noNutrient", "tooCold", "grown", "recoverAt"]) delete f[k];
		for (const b of s.bots) for (const k of ["trait", "exposure"]) delete b[k];
		const loaded = simFromSnapshot(sim.content, snap as never) as SimImpl;
		expect(loaded.hash()).toBe(sim.hash());
		run(sim, 400);
		run(loaded, 400);
		expect(loaded.hash()).toBe(sim.hash());
	});

	it("rejects invalid v5 data", () => {
		const base = JSON.parse(JSON.stringify(busy().snapshot())) as { state: Record<string, any> };
		const bad = (edit: (s: Record<string, any>) => void): string => {
			const c = JSON.parse(JSON.stringify(base));
			edit(c.state);
			try {
				simFromSnapshot(content(), c);
				return "";
			} catch (e) {
				return (e as Error).message;
			}
		};
		expect(bad((s) => (s.contamination.v[3] = 2))).toMatch(/^Invalid save:.*contamination/);
		expect(bad((s) => (s.corruption = 1.5))).toMatch(/^Invalid save:.*corruption/);
		expect(bad((s) => (s.path = "nope"))).toMatch(/^Invalid save:.*path/);
		expect(bad((s) => (s.bots[0].trait = "winged"))).toMatch(/^Invalid save:.*trait/);
		expect(bad((s) => (s.nutrientNetOf.v[0] = 99))).toMatch(/^Invalid save:.*nutrientNetOf/);
		expect(bad((s) => (s.gameOver = { kind: "victory", tick: 1, ending: "nope" }))).toMatch(/^Invalid save:.*ending/);
		expect(bad((s) => (s.facilities[0].nutrientNet = 50))).toMatch(/^Invalid save:.*nutrientNet/);
		expect(bad(() => {})).toBe("");
		expect(bad((s) => (s.gameOver = { kind: "absorbed", tick: 1, ending: "absorbed" }))).toBe("");
	});
});
