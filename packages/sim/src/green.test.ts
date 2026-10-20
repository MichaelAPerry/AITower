/** M4-T1: greentech and synthetic mechanics, scenarios, `earned` events, snapshot v6. */
import type { Balance, ContentDB, Scenario } from "@aitower/content";
import { describe, expect, it } from "vitest";
import type { SimEvent } from "./api";
import { endingsStep } from "./bio/path";
import type { TickCtx } from "./core/context";
import { GREEN_SMOOTHING } from "./core/constants";
import { changeStanding } from "./ministry/standing";
import { daylight } from "./green/weather";
import { type SimImpl, SNAPSHOT_VERSION, simFromSnapshot } from "./sim";
import { balance, exec, facilityOf, makeContent, newSim, run, scenario } from "./test/fixture";
import { acceptSpec, farmContent, inference, NO_OFFERS, QUIET_EVENTS, training } from "./test/m2b";

const BAL: Partial<Balance> = { ...QUIET_EVENTS, ...NO_OFFERS };
// biome-ignore lint/suspicious/noExplicitAny: raw snapshot JSON is edited freely in these tests
type Raw = Record<string, any>;
const RAW = 360; // day 0 starts at 06:00

/** Tick whose clock reads `h:00` on day `day`. */
const tickAt = (hour: number, day = 0): number => day * 1440 + ((hour * 60 - RAW + 1440) % 1440);

const sun = scenario("sun", {
	slabs: [[0, 0, 47]],
	conduits: [["power", 0, 0, 47]],
	facilities: [
		{ defId: "solar_array", floor: 0, x: 4 },
		{ defId: "rack_air_gpu", floor: 0, x: 20 },
	],
});
const breeze = scenario("breeze", { ...sun, facilities: [{ defId: "wind_turbine", floor: 0, x: 4 }, { defId: "rack_air_gpu", floor: 0, x: 20 }] });

function content(extra: Scenario[] = [], over: Partial<Balance> = {}, tweak?: (c: ContentDB) => void): ContentDB {
	const c = makeContent([sun, breeze, ...extra], { ...BAL, ...over });
	for (const id of ["rack_air_gpu", "rack_dlc_gpu", "rack_storage", "rack_top"]) if (c.facilities[id].rack) c.facilities[id].rack.failurePerDay = 0;
	tweak?.(c);
	return c;
}

const supply = (sim: SimImpl): number => sim.view().powerNets[0].supplyKw;
/** Jump the clock to `tick` (a test shortcut) and run one tick. */
function at(sim: SimImpl, tick: number): void {
	sim.state.tick = tick;
	sim.invalidateProjection();
	sim.step();
}

describe("daylight", () => {
	it("is 0 outside 06:00-20:00, peaks at 13:00 and is symmetric", () => {
		expect(daylight(0)).toBe(0);
		expect(daylight(5 * 60 + 59)).toBe(0);
		expect(daylight(6 * 60)).toBe(0);
		expect(daylight(20 * 60)).toBe(0);
		expect(daylight(23 * 60)).toBe(0);
		expect(daylight(13 * 60)).toBeCloseTo(1, 12);
		expect(daylight(9 * 60 + 30)).toBeCloseTo(daylight(16 * 60 + 30), 12);
		for (let m = 361; m < 1200; m += 7) {
			expect(daylight(m)).toBeGreaterThan(0);
			expect(daylight(m)).toBeLessThanOrEqual(1);
			expect(daylight(13 * 60)).toBeGreaterThanOrEqual(daylight(m));
		}
	});
});

describe("solar", () => {
	it("supplies capacity x daylight: full at 13:00, zero at night, scaled by a drought", () => {
		const sim = newSim(content(), "sun");
		at(sim, tickAt(13));
		expect(supply(sim)).toBeCloseTo(400, 6);
		at(sim, tickAt(9, 1));
		expect(supply(sim)).toBeCloseTo(400 * daylight(9 * 60), 6);
		at(sim, tickAt(22, 1));
		expect(supply(sim)).toBe(0);
		at(sim, tickAt(5, 2));
		expect(supply(sim)).toBe(0);
		// A drought pulls it to droughtFactor (0.1 in the fixture).
		sim.state.droughtUntil = tickAt(13, 3) + 100;
		at(sim, tickAt(13, 3));
		expect(supply(sim)).toBeCloseTo(40, 6);
		expect(sim.view().drought).toBe(true);
	});

	it("is dispatched first and free: it covers the load, the grid is untouched, PUE counts it, it costs nothing", () => {
		const both = scenario("sun_grid", { ...sun, facilities: [{ defId: "grid_tie", floor: 0, x: 0 }, { defId: "solar_array", floor: 0, x: 4 }, { defId: "rack_air_gpu", floor: 0, x: 20 }] });
		const sim = newSim(content([both]), "sun_grid");
		at(sim, tickAt(13));
		const v = sim.view();
		expect(v.powerNets[0].gridImportKw).toBe(0); // idle rack 6 kW << 400 kW of sun
		expect(v.totalKw).toBeCloseTo(v.itKw, 6); // green power counts toward facility power
		expect(sim.state.metrics.energyCost).toBe(0);
		expect(sim.state.metrics.greenKw).toBeCloseTo(v.totalKw, 6);
		// At night the grid takes over.
		at(sim, tickAt(23));
		expect(sim.view().powerNets[0].gridImportKw).toBeGreaterThan(0);
		expect(sim.state.metrics.greenKw).toBe(0);
	});

	it("needs a power conduit to be placed (it is a source on the power net)", () => {
		const sim = newSim(content(), "empty");
		exec(sim, { type: "buildSlab", floor: 0, x0: 0, x1: 10 });
		expect(sim.canBuild({ type: "place", defId: "solar_array", floor: 0, x: 0 }).ok).toBe(false);
		exec(sim, { type: "buildConduit", layer: "power", cells: [{ x: 1, floor: 0 }] });
		expect(sim.canBuild({ type: "place", defId: "solar_array", floor: 0, x: 0 }).ok).toBe(true);
	});
});

describe("wind", () => {
	it("is capacity x a seeded hourly value in 0.2..1, constant within an hour, varying between hours, deterministic per seed", () => {
		const series = (seed: number): number[] => {
			const sim = newSim(content(), "breeze", seed);
			const out: number[] = [];
			for (let t = 0; t < 60 * 24; t++) {
				sim.step();
				out.push(supply(sim));
			}
			return out;
		};
		const a = series(1);
		for (const kw of a) {
			expect(kw).toBeGreaterThanOrEqual(300 * 0.2 - 1e-9);
			expect(kw).toBeLessThanOrEqual(300 + 1e-9);
		}
		for (let h = 0; h < 24; h++) {
			const block = a.slice(h * 60, h * 60 + 60);
			expect(new Set(block).size).toBe(1);
		}
		expect(new Set(a).size).toBeGreaterThan(10);
		expect(series(1)).toEqual(a);
		expect(series(2)).not.toEqual(a);
	});

	it("is pulled down by a drought, and blows at night", () => {
		const sim = newSim(content(), "breeze");
		at(sim, tickAt(2, 1)); // 02:00
		const calm = supply(sim);
		expect(calm).toBeGreaterThanOrEqual(60 - 1e-9);
		expect(calm).toBeGreaterThan(0);
		sim.state.droughtUntil = sim.state.tick + 500;
		const w = sim.state.wind;
		sim.step();
		expect(supply(sim)).toBeCloseTo(300 * w * 0.1, 6);
	});
});

describe("drought", () => {
	const droughtyBalance = (chance: number, hours: number): Partial<Balance> => ({ green: { ...balance.green, droughtChancePerDay: chance, droughtHours: hours, droughtFactor: 0.25 } });
	const timeline = (sim: SimImpl, ticks: number): { tick: number; type: string }[] => {
		const out: { tick: number; type: string }[] = [];
		for (let i = 0; i < ticks; i++) {
			const tick = sim.state.tick;
			for (const e of sim.step()) if (e.type === "droughtStarted" || e.type === "droughtEnded") out.push({ tick, type: e.type });
		}
		return out;
	};

	it("is rolled daily at the start of the day: a certain roll starts one, which lasts droughtHours and ends with an event", () => {
		const sim = newSim(content([], droughtyBalance(1, 2)), "breeze");
		const t = timeline(sim, 1440 + 200);
		expect(t).toEqual([
			{ tick: 0, type: "droughtStarted" },
			{ tick: 120, type: "droughtEnded" },
			{ tick: 1440, type: "droughtStarted" },
			{ tick: 1560, type: "droughtEnded" },
		]);
	});

	it("view.drought follows it, and the output shows it", () => {
		const sim = newSim(content([], droughtyBalance(1, 2)), "breeze");
		sim.step();
		expect(sim.view().drought).toBe(true);
		expect(supply(sim)).toBeLessThanOrEqual(300 * 0.25 + 1e-9);
		run(sim, 125);
		expect(sim.view().drought).toBe(false);
		expect(supply(sim)).toBeGreaterThan(300 * 0.2 - 1e-9);
	});

	it("never starts with chance 0, and never stacks on a running one", () => {
		expect(timeline(newSim(content([], droughtyBalance(0, 5)), "breeze"), 4000)).toEqual([]);
		const long = timeline(newSim(content([], droughtyBalance(1, 40)), "breeze"), 2 * 1440 - 1);
		// Day 2 rolls (tick 1440) while it is still running: no second start, no early end.
		expect(long).toEqual([
			{ tick: 0, type: "droughtStarted" },
			{ tick: 2400, type: "droughtEnded" },
		]);
	});

	it("uses its own random stream: the other streams, and therefore offers and failures, do not depend on the weather", () => {
		const a = newSim(content([], droughtyBalance(0, 5)), "breeze", 3);
		const b = newSim(content([], droughtyBalance(1, 5)), "breeze", 3);
		run(a, 3000);
		run(b, 3000);
		expect(a.state.rng.contracts).toBe(b.state.rng.contracts);
		expect(a.state.rng.reliability).toBe(b.state.rng.reliability);
		expect(a.state.rng.events).toBe(b.state.rng.events);
		expect(a.state.rng.weather).toBe(b.state.rng.weather); // always the same draws, whatever they decide
	});
});

describe("heat exporter", () => {
	const hx = scenario("hx", {
		slabs: [[0, 0, 47]],
		conduits: [["power", 0, 0, 47]],
		facilities: [
			{ defId: "grid_tie", floor: 0, x: 0 },
			{ defId: "heat_exchanger", floor: 0, x: 20 },
		],
	});
	const plain = scenario("hx0", { ...hx, facilities: [{ defId: "grid_tie", floor: 0, x: 0 }] });
	const hot: Partial<Balance> = { ambientMeanC: 30, ambientSwingC: 0 };

	it("removes up to exportKw from warm air within its radius and sells it at heatPrice per kWh", () => {
		const sim = newSim(content([hx, plain], hot), "hx");
		const twin = newSim(content([hx, plain], hot), "hx0");
		let sold = 0;
		for (let t = 0; t < 120; t++) {
			sim.step();
			twin.step();
			const f = facilityOf(sim, "heat_exchanger");
			expect(f.heatKw).toBeLessThanOrEqual(100 + 1e-9);
			sold += (f.heatKw / 60) * 3;
			expect(sim.state.metrics.heatExportKw).toBeCloseTo(f.heatKw, 9);
		}
		expect(facilityOf(sim, "heat_exchanger").heatKw).toBeGreaterThan(0);
		expect(sold).toBeGreaterThan(0);
		expect(sim.state.today.revenue).toBeCloseTo(sold, 6);
		expect(twin.state.today.revenue).toBe(0);
		const cell = (s: SimImpl, x: number) => s.state.airTemp[(0 - s.state.floorMin) * s.state.width + x];
		const drop = (x: number) => cell(twin, x) - cell(sim, x);
		expect(drop(22)).toBeGreaterThan(1); // inside the radius: clearly cooler
		expect(drop(46)).toBeLessThan(drop(22) / 20); // far out of reach: only diffusion gets there
		expect(sim.view().facilities.find((f) => f.defId === "heat_exchanger")?.heatKw).toBeGreaterThan(0);
	});

	it("does nothing when disabled or unpowered, and scales with power satisfaction", () => {
		const off = newSim(content([hx], hot), "hx");
		const f = facilityOf(off, "heat_exchanger");
		exec(off, { type: "setEnabled", facilityId: f.id, enabled: false });
		run(off, 50);
		expect(off.state.today.revenue).toBe(0);
		expect(f.heatKw).toBe(0);
		// A powered exchanger (10 kW) on a 6 kW tie: satisfaction 0.6 -> at most 60 kW exported.
		const tweak = (c: ContentDB) => {
			c.facilities.heat_exchanger.facilityKw = 10;
			c.facilities.grid_tie.power = { capacityKw: 6 };
		};
		const weak = newSim(content([hx], hot, tweak), "hx");
		run(weak, 3);
		const g = facilityOf(weak, "heat_exchanger");
		expect(g.sat).toBeCloseTo(0.6, 9);
		expect(g.heatKw).toBeCloseTo(60, 6); // a lot of warm air to take, so the satisfaction cap is what binds
		// No source at all: satisfaction 0, nothing exported.
		const dead = scenario("hxdead", { ...hx, facilities: [{ defId: "heat_exchanger", floor: 0, x: 20 }] });
		const none = newSim(content([dead], hot, tweak), "hxdead");
		run(none, 5);
		expect(facilityOf(none, "heat_exchanger").heatKw).toBe(0);
		expect(none.state.today.revenue).toBe(0);
	});
});

describe("carbon capture", () => {
	const cc = scenario("cc", {
		slabs: [[0, 0, 47]],
		conduits: [["power", 0, 0, 47]],
		facilities: [
			{ defId: "grid_tie", floor: 0, x: 0 },
			{ defId: "carbon_facade", floor: 0, x: 10 },
			{ defId: "carbon_facade", floor: 0, x: 14 },
		],
	});
	const dayRevenue = (sim: SimImpl): number => sim.view().ledger[0].revenue;

	it("pays creditsPerDay x creditPrice per powered, enabled facility at the end of the day", () => {
		const sim = newSim(content([cc]), "cc");
		run(sim, 1439);
		expect(sim.state.today.revenue).toBe(0); // nothing before the day closes
		run(sim, 1);
		expect(dayRevenue(sim)).toBeCloseTo(2 * 10 * 40, 9);
		run(sim, 1440);
		expect(sim.view().ledger[1].revenue).toBeCloseTo(800, 9);
	});

	it("skips a disabled one and an unpowered one", () => {
		const sim = newSim(content([cc]), "cc");
		exec(sim, { type: "setEnabled", facilityId: facilityOf(sim, "carbon_facade").id, enabled: false });
		run(sim, 1439);
		expect(dayRevenue(sim)).toBeCloseTo(400, 9);
		const dark = scenario("ccdark", { ...cc, facilities: [{ defId: "carbon_facade", floor: 0, x: 10 }] });
		const s2 = newSim(content([dark]), "ccdark");
		run(s2, 1440);
		expect(dayRevenue(s2)).toBe(0);
	});

	it("counts toward the day's levy and audit like any revenue (stats.revenue)", () => {
		const sim = newSim(content([cc]), "cc");
		run(sim, 1440);
		expect(sim.state.stats.revenue).toBeCloseTo(800, 9);
	});
});

describe("greenScore", () => {
	const fillRings = (sim: SimImpl, total: number, green: number, it: number, heat: number): void => {
		const m = sim.state.metrics;
		m.ringTotalKwh.fill(total / 60);
		m.ringGreenKwh.fill(green / 60);
		m.ringItKwh.fill(it / 60);
		m.ringHeatKwh.fill(heat / 60);
	};

	it("moves toward 0.7 x green share + 0.3 x min(1, heat / IT energy) of the last 24 h", () => {
		const sim = newSim(content(), "empty");
		fillRings(sim, 2, 1, 1, 0.5); // green share 0.5, heat share 0.5 -> target 0.5
		sim.step();
		expect(sim.state.greenScore).toBeCloseTo(0.5 * GREEN_SMOOTHING, 3);
		const s2 = newSim(content(), "empty");
		fillRings(s2, 2, 1, 1, 5); // heat share capped at 1 -> 0.35 + 0.3
		s2.step();
		expect(s2.state.greenScore).toBeCloseTo(0.65 * GREEN_SMOOTHING, 3);
		const s3 = newSim(content(), "empty");
		fillRings(s3, 2, 2, 1, 0); // all green, no heat -> 0.7
		s3.step();
		expect(s3.state.greenScore).toBeCloseTo(0.7 * GREEN_SMOOTHING, 3);
		const s4 = newSim(content(), "empty");
		fillRings(s4, 0, 0, 0, 0); // no energy at all -> 0
		s4.step();
		expect(s4.state.greenScore).toBe(0);
	});

	it("is smoothed (a share of the gap per tick), converges, and stays in 0..1", () => {
		const sim = newSim(content(), "empty");
		sim.state.greenScore = 1;
		fillRings(sim, 1, 0, 1, 0);
		sim.step();
		expect(sim.state.greenScore).toBeCloseTo(1 - GREEN_SMOOTHING, 3);
		for (let i = 0; i < 600; i++) {
			fillRings(sim, 1, 0, 1, 0);
			sim.step();
		}
		expect(sim.state.greenScore).toBeLessThan(0.01);
		expect(sim.state.greenScore).toBeGreaterThanOrEqual(0);
	});

	it("a solar farm raises it, a grid-only tower leaves it at 0; the view reports it", () => {
		const sunny = newSim(content(), "sun");
		run(sunny, 1440);
		const v = sunny.view();
		expect(v.greenScore).toBeGreaterThan(0.1);
		expect(v.greenScore).toBeLessThanOrEqual(1);
		const grey = newSim(content(), "starter");
		run(grey, 600);
		expect(grey.view().greenScore).toBe(0);
	});

	it("is pathScore for the greentech path; corruption for biotech, or with no path", () => {
		const sim = newSim(content(), "empty");
		sim.state.greenScore = 0.4;
		sim.state.refinement = 0.7;
		sim.state.corruption = 0.2;
		expect(sim.view().pathScore).toBe(0.2); // no path yet
		sim.state.path = "biotech";
		expect(sim.view().pathScore).toBe(0.2);
		sim.state.path = "greentech";
		expect(sim.view().pathScore).toBe(0.4);
		sim.state.path = "synthetic";
		expect(sim.view().pathScore).toBe(0.7);
	});
});

describe("refinement", () => {
	const lab = scenario("lab", {
		slabs: [[0, 0, 47]],
		conduits: [["power", 0, 0, 47]],
		facilities: [
			{ defId: "grid_tie", floor: 0, x: 0 },
			{ defId: "crah_unit", floor: 0, x: 4 },
			{ defId: "rack_top", floor: 0, x: 8 },
			{ defId: "rack_air_gpu", floor: 0, x: 10 },
		],
	});

	it("is uptime x the share of delivered compute on racks from clearance 4", () => {
		const sim = newSim(content([lab]), "lab");
		expect(sim.view().refinement).toBe(0);
		acceptSpec(sim, training({ work: 5000, durationTicks: 100_000 }));
		run(sim, 30);
		const top = facilityOf(sim, "rack_top");
		const air = facilityOf(sim, "rack_air_gpu");
		expect(top.pflops).toBeGreaterThan(0);
		expect(air.pflops).toBeGreaterThan(0);
		const v = sim.view();
		expect(v.refinement).toBeCloseTo(v.uptime * (top.pflops / (top.pflops + air.pflops)), 9);
		expect(v.refinement).toBeGreaterThan(0.5);
		expect(v.refinement).toBeLessThan(1);
	});

	it("is 0 when no compute is delivered, and 1 x uptime when only top-tier racks deliver", () => {
		const idle = newSim(content([lab]), "lab");
		run(idle, 20);
		expect(idle.view().refinement).toBe(0);
		const only = scenario("labtop", { ...lab, facilities: lab.facilities.filter((f) => f.defId !== "rack_air_gpu") });
		const sim = newSim(content([only]), "labtop");
		acceptSpec(sim, training({ work: 5000, durationTicks: 100_000 }));
		run(sim, 20);
		const v = sim.view();
		expect(v.pflops).toBeGreaterThan(0);
		expect(v.refinement).toBeCloseTo(v.uptime, 9);
	});

	it("drops with uptime", () => {
		const sim = newSim(content([lab]), "lab");
		acceptSpec(sim, training({ work: 5000, durationTicks: 100_000 }));
		run(sim, 30);
		const full = sim.view().refinement;
		sim.state.metrics.ringRunning.fill(0.5);
		sim.state.metrics.ringShouldRun.fill(1);
		sim.step();
		const v = sim.view();
		expect(v.uptime).toBeCloseTo(0.5, 2);
		expect(v.refinement).toBeLessThan(full * 0.6);
		const top = facilityOf(sim, "rack_top").pflops;
		const air = facilityOf(sim, "rack_air_gpu").pflops;
		expect(v.refinement).toBeCloseTo(v.uptime * (top / (top + air)), 9);
	});
});

describe("endings greenExemplar and millionMinds", () => {
	const E = { greenExemplar: { minScore: 0.6, pflops: 10, days: 2 }, millionMinds: { minScore: 0.7, pflops: 10, days: 3 } };
	const ctxOf = (sim: SimImpl): TickCtx & { events: SimEvent[] } => ({ state: sim.state, content: sim.content, events: [], scratch: undefined as never });
	const day = (sim: SimImpl): SimEvent[] => {
		const ctx = ctxOf(sim);
		endingsStep(ctx);
		return ctx.events;
	};
	const setup = (path: "greentech" | "synthetic" | null) => {
		const sim = newSim(content([], { endings: { ...balance.endings, ...E } }), "empty");
		sim.state.path = path;
		sim.state.metrics.pflops = 50;
		return sim;
	};

	it("greenExemplar: path greentech, score and PFLOPS held for N consecutive daily checks", () => {
		const sim = setup("greentech");
		sim.state.greenScore = 0.9;
		expect(day(sim)).toEqual([]);
		expect(sim.state.endingDays.greenExemplar).toBe(1);
		expect(sim.view().endingProgress).toEqual({ ending: "greenExemplar", days: 1, needed: 2 });
		sim.state.greenScore = 0.3; // a bad day resets the count
		day(sim);
		expect(sim.state.endingDays.greenExemplar).toBe(0);
		sim.state.greenScore = 0.9;
		day(sim);
		expect(sim.state.gameOver).toBeNull();
		const ev = day(sim);
		expect(ev).toContainEqual({ type: "gameOver", kind: "victory", ending: "greenExemplar" });
		expect(sim.state.gameOver).toMatchObject({ kind: "victory", ending: "greenExemplar" });
	});

	it("needs the PFLOPS too, and the right path", () => {
		const low = setup("greentech");
		low.state.greenScore = 1;
		low.state.metrics.pflops = 9.9;
		day(low);
		expect(low.state.endingDays.greenExemplar).toBe(0);
		const wrong = setup("synthetic");
		wrong.state.greenScore = 1;
		day(wrong);
		expect(wrong.state.endingDays.greenExemplar).toBe(0);
		const none = setup(null);
		none.state.greenScore = 1;
		none.state.refinement = 1;
		day(none);
		expect(none.state.endingDays).toMatchObject({ greenExemplar: 0, millionMinds: 0 });
		expect(none.view().endingProgress).toBeNull();
	});

	it("millionMinds: path synthetic, refinement and PFLOPS held for N days", () => {
		const sim = setup("synthetic");
		sim.state.refinement = 0.8;
		day(sim);
		day(sim);
		expect(sim.state.gameOver).toBeNull();
		expect(sim.view().endingProgress).toEqual({ ending: "millionMinds", days: 2, needed: 3 });
		const ev = day(sim);
		expect(ev).toContainEqual({ type: "gameOver", kind: "victory", ending: "millionMinds" });
		const low = setup("synthetic");
		low.state.refinement = 0.69;
		day(low);
		expect(low.state.endingDays.millionMinds).toBe(0);
	});

	it("skips an ending whose balance entry is absent", () => {
		const sim = newSim(content([], { endings: { ...balance.endings } }), "empty");
		sim.state.path = "greentech";
		sim.state.greenScore = 1;
		sim.state.metrics.pflops = 1e9;
		for (let i = 0; i < 5; i++) day(sim);
		expect(sim.state.endingDays.greenExemplar).toBe(0);
		expect(sim.state.gameOver).toBeNull();
		expect(sim.view().endingProgress).toBeNull();
		sim.state.path = "synthetic";
		sim.state.refinement = 1;
		for (let i = 0; i < 5; i++) day(sim);
		expect(sim.state.endingDays.millionMinds).toBe(0);
		expect(sim.state.gameOver).toBeNull();
	});

	it("runs from the real day-end step (progressionStep)", () => {
		const sim = newSim(content([], { endings: { ...balance.endings, greenExemplar: { minScore: 0, pflops: 0, days: 1 } } }), "empty");
		sim.state.path = "greentech";
		run(sim, 1440);
		expect(sim.state.gameOver).toMatchObject({ kind: "victory", ending: "greenExemplar" });
	});
});

describe("scenarios", () => {
	const custom = scenario("custom", { startingCash: 123_456, startTier: 3, sandbox: true });
	const plain = scenario("plain", {});

	it("applies startingCash, startTier and sandbox; defaults otherwise", () => {
		const c = content([custom, plain]);
		const s = newSim(c, "custom");
		expect(s.state.cash).toBe(123_456);
		expect(s.view().tier).toBe(3);
		expect(s.view().sandbox).toBe(true);
		const p = newSim(c, "plain");
		expect(p.state.cash).toBe(balance.startingCash);
		expect(p.view().tier).toBe(1);
		expect(p.view().sandbox).toBe(false);
		const zero = newSim(content([scenario("zero", { startingCash: 0 })]), "zero");
		expect(zero.state.cash).toBe(0);
	});

	it("clamps startTier to the tier table", () => {
		expect(newSim(content([scenario("hi", { startTier: 99 })]), "hi").view().tier).toBe(4);
		expect(newSim(content([scenario("lo", { startTier: -2 })]), "lo").view().tier).toBe(1);
	});

	it("sandbox: no bankruptcy; a normal scenario goes bankrupt after a day in the red", () => {
		const broke = scenario("broke", { startingCash: -5000, sandbox: true });
		const real = scenario("brokeReal", { startingCash: -5000 });
		const c = content([broke, real]);
		const sb = newSim(c, "broke");
		run(sb, 3 * 1440);
		expect(sb.view().bankrupt).toBe(false);
		expect(sb.view().gameOver).toBeNull();
		const rl = newSim(c, "brokeReal");
		run(rl, 2 * 1440);
		expect(rl.view().bankrupt).toBe(true);
		expect(rl.view().gameOver?.kind).toBe("bankrupt");
	});

	it("sandbox: standing can hit 0 without a shutdown; elsewhere it ends the game", () => {
		const c = content([custom, plain]);
		const sb = newSim(c, "custom");
		const ev: SimEvent[] = [];
		changeStanding(sb.state, -1000, ev, "memo", "test");
		expect(sb.state.standing).toBe(0);
		expect(sb.state.gameOver).toBeNull();
		const normal = newSim(c, "plain");
		changeStanding(normal.state, -1000, ev, "memo", "test");
		expect(normal.state.gameOver?.kind).toBe("shutdown");
	});

	it("sandbox follows the scenario, not the save", () => {
		const c = content([custom]);
		const sim = newSim(c, "custom");
		run(sim, 5);
		const snap = JSON.parse(JSON.stringify(sim.snapshot()));
		expect((simFromSnapshot(c, snap) as SimImpl).view().sandbox).toBe(true);
		const c2 = content([scenario("custom", { sandbox: false })]);
		expect((simFromSnapshot(c2, snap) as SimImpl).view().sandbox).toBe(false);
	});
});

describe("earned events", () => {
	const spec = (over = {}) => training({ work: 200, durationTicks: 5000, payout: 100_000, checkpointTicks: 30, ...over });
	const collect = (sim: SimImpl, ticks: number): { tick: number; jobId: number; amount: number }[] => {
		const out: { tick: number; jobId: number; amount: number }[] = [];
		for (let i = 0; i < ticks; i++) {
			const tick = sim.state.tick;
			for (const e of sim.step()) if (e.type === "earned") out.push({ tick, jobId: e.jobId, amount: e.amount });
		}
		return out;
	};

	it("training: each checkpoint payment and the completion balance, summing to the payout", () => {
		const sim = newSim(farmContent(), "farm");
		const id = acceptSpec(sim, spec());
		const ev = collect(sim, 500);
		expect(sim.state.jobs.find((j) => j.id === id)?.status).toBe("completed");
		expect(ev.length).toBeGreaterThanOrEqual(2);
		expect(ev.every((e) => e.jobId === id && e.amount > 0)).toBe(true);
		expect(ev.reduce((a, e) => a + e.amount, 0)).toBeCloseTo(100_000, 6);
		expect(sim.state.stats.revenue).toBeCloseTo(100_000, 6);
	});

	it("inference: revenue summed per job per game-hour (plus the remainder when it ends)", () => {
		const sim = newSim(farmContent(), "farm");
		const id = acceptSpec(sim, inference({ work: 20, sustainedPflops: 20, durationTicks: 300, payout: 3000 })); // 10 $/tick
		const ev = collect(sim, 400);
		expect(sim.state.jobs.find((j) => j.id === id)?.status).toBe("completed");
		for (const e of ev.slice(0, -1)) expect(e.tick % 60).toBe(0); // only on the hour...
		expect(ev.length).toBeLessThanOrEqual(7); // ...so about 5 hourly events, not 300 per-tick ones
		expect(ev.length).toBeGreaterThanOrEqual(4);
		for (const e of ev) expect(e.amount).toBeLessThanOrEqual(600 + 1e-6);
		// The job streams from the tick after it was allocated; the events add up to exactly what it earned.
		const earned = sim.state.jobs.find((j) => j.id === id)?.earned ?? 0;
		expect(earned).toBeGreaterThan(2900);
		expect(ev.reduce((a, e) => a + e.amount, 0)).toBeCloseTo(earned, 6);
	});

	it("a cancelled inference job reports what it had earned since the last hour", () => {
		const sim = newSim(farmContent(), "farm");
		const id = acceptSpec(sim, inference({ durationTicks: 3000, payout: 30_000 }));
		const first = collect(sim, 100);
		const reported = first.reduce((a, e) => a + e.amount, 0);
		const earned = sim.state.jobs.find((j) => j.id === id)?.earned ?? 0;
		expect(earned).toBeGreaterThan(reported);
		sim.submit({ type: "cancelJob", jobId: id });
		const after = collect(sim, 1);
		expect(after).toHaveLength(1);
		expect(reported + after[0].amount).toBeCloseTo(earned, 6);
		expect(collect(sim, 130)).toEqual([]); // nothing further from a dead job
	});

	it("no earned event for an hour without revenue", () => {
		const sim = newSim(farmContent(), "farm");
		expect(collect(sim, 200)).toEqual([]);
	});
});

describe("snapshot v6", () => {
	const base = (): SimImpl => newSim(content(), "sun", 7);
	const strip = (snap: { version: number; state: Raw }): void => {
		snap.version = 5;
		const s = snap.state;
		for (const k of ["automation", "wind", "droughtUntil", "greenScore", "refinement", "sandbox"]) delete s[k];
		delete s.endingDays.greenExemplar;
		delete s.endingDays.millionMinds;
		delete s.rng.weather;
		for (const k of ["ringGreenKwh", "ringHeatKwh", "greenKw", "heatExportKw"]) delete s.metrics[k];
		for (const j of s.jobs) delete j.unreported;
	};

	it("is version 7", () => {
		expect(SNAPSHOT_VERSION).toBe(7);
		expect(base().snapshot().version).toBe(7);
	});

	it("round-trips weather, scores and the policy exactly", () => {
		const sim = base();
		run(sim, 700);
		sim.state.automation.parts = { enabled: true, keep: 11 };
		sim.state.droughtUntil = sim.state.tick + 40;
		const twin = simFromSnapshot(sim.content, JSON.parse(JSON.stringify(sim.snapshot()))) as SimImpl;
		expect(twin.hash()).toBe(sim.hash());
		expect(twin.state.wind).toBe(sim.state.wind);
		expect(twin.view().drought).toBe(true);
		run(sim, 900);
		run(twin, 900);
		expect(twin.hash()).toBe(sim.hash());
	});

	it("migrates a v5 save of a fresh world to the identical state and keeps running identically", () => {
		const sim = base();
		const snap = JSON.parse(JSON.stringify(sim.snapshot())) as { version: number; state: Raw };
		strip(snap);
		const loaded = simFromSnapshot(sim.content, snap as never) as SimImpl;
		expect(loaded.snapshot().version).toBe(7);
		expect(loaded.hash()).toBe(sim.hash());
		expect(loaded.view().automation.policy.foreman.reserve).toBe(1_000_000);
		run(sim, 1500);
		run(loaded, 1500);
		expect(loaded.hash()).toBe(sim.hash());
	});

	it("migrates a v5 save from mid-run: defaults, a valid state, and it keeps stepping", () => {
		const sim = newSim(farmContent(), "farm", 4);
		acceptSpec(sim, inference());
		run(sim, 300);
		const snap = JSON.parse(JSON.stringify(sim.snapshot())) as { version: number; state: Raw };
		strip(snap);
		const loaded = simFromSnapshot(sim.content, snap as never) as SimImpl;
		expect(loaded.state.automation).toEqual(newSim(farmContent(), "farm").state.automation);
		expect(loaded.state.rng.weather).toBe(newSim(farmContent(), "farm", 4).state.rng.weather);
		expect(loaded.state.metrics.ringGreenKwh).toHaveLength(1440);
		expect(loaded.state.jobs.every((j) => j.unreported === 0)).toBe(true);
		run(loaded, 500);
		expect(loaded.view().cash).toBeGreaterThan(0);
	});

	it("rejects invalid v6 data", () => {
		const good = JSON.parse(JSON.stringify(base().snapshot())) as { state: Raw };
		const bad = (edit: (s: Raw) => void): string => {
			const c = JSON.parse(JSON.stringify(good));
			edit(c.state);
			try {
				simFromSnapshot(content(), c);
				return "";
			} catch (e) {
				return (e as Error).message;
			}
		};
		expect(bad(() => {})).toBe("");
		expect(bad((s) => (s.wind = 2))).toMatch(/^Invalid save:.*wind/);
		expect(bad((s) => (s.greenScore = -0.1))).toMatch(/^Invalid save:.*greenScore/);
		expect(bad((s) => (s.refinement = 3))).toMatch(/^Invalid save:.*refinement/);
		expect(bad((s) => (s.droughtUntil = -5))).toMatch(/^Invalid save:.*droughtUntil/);
		expect(bad((s) => (s.sandbox = "yes"))).toMatch(/^Invalid save:.*sandbox/);
		expect(bad((s) => (s.automation.parts.keep = -1))).toMatch(/^Invalid save:.*automation/);
		expect(bad((s) => (s.automation.research.branches = ["nope"]))).toMatch(/^Invalid save:.*automation/);
		expect(bad((s) => (s.automation = null))).toMatch(/^Invalid save:.*automation/);
		expect(bad((s) => (s.endingDays.millionMinds = -1))).toMatch(/^Invalid save:.*endingDays/);
		expect(bad((s) => delete s.rng.weather)).toMatch(/^Invalid save:.*rng/);
		expect(bad((s) => (s.metrics.ringGreenKwh.v = [1, 2]))).toMatch(/^Invalid save:/);
		expect(bad((s) => (s.gameOver = { kind: "victory", tick: 1, ending: "millionMinds" }))).toBe("");
	});
});

describe("a green and synthetic run is deterministic", () => {
	it("hashes equal for the same seed (3 days of sun, wind, drought, heat export, carbon), differ across seeds", () => {
		const full = scenario("full", {
			slabs: [[0, 0, 47]],
			conduits: [["power", 0, 0, 47]],
			facilities: [
				{ defId: "grid_tie", floor: 0, x: 0 },
				{ defId: "solar_array", floor: 0, x: 4 },
				{ defId: "wind_turbine", floor: 0, x: 8 },
				{ defId: "heat_exchanger", floor: 0, x: 24 },
				{ defId: "carbon_facade", floor: 0, x: 30 },
				{ defId: "rack_air_gpu", floor: 0, x: 20 },
				{ defId: "rack_top", floor: 0, x: 22 },
				{ defId: "crah_unit", floor: 0, x: 14 },
			],
		});
		const go = (seed: number) => {
			const sim = newSim(content([full], { green: { ...balance.green, droughtChancePerDay: 0.5 }, economy: { slaPenaltyFactor: 1.5, maxOffers: 4, offerIntervalTicks: 60, offerExpiryTicks: 720 } }), "full", seed);
			for (let t = 0; t < 3 * 1440; t++) {
				for (const e of sim.step()) if (e.type === "contractOffered") sim.submit({ type: "acceptContract", contractId: e.contractId });
			}
			return sim;
		};
		const a = go(5);
		expect(go(5).hash()).toBe(a.hash());
		expect(go(6).hash()).not.toBe(a.hash());
		expect(a.view().greenScore).toBeGreaterThan(0);
		const twin = simFromSnapshot(a.content, JSON.parse(JSON.stringify(a.snapshot()))) as SimImpl;
		run(a, 800);
		run(twin, 800);
		expect(twin.hash()).toBe(a.hash());
	});
});
