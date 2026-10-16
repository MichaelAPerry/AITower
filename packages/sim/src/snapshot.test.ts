import { afterEach, describe, expect, it } from "vitest";
import type { SimCommand, SimSnapshot } from "./api";
import { SNAPSHOT_VERSION, type SimImpl, simFromSnapshot } from "./sim";
import { migrations } from "./snapshot/migrate";
import { exec, makeContent, newSim, rowCells } from "./test/fixture";

// biome-ignore lint/suspicious/noExplicitAny: test helper over untyped JSON
type Json = Record<string, any>;

const content = () => makeContent();

/** A busy mid-game snapshot as plain JSON (what localStorage would hold). */
function savedJson(ticks = 600): SimSnapshot {
	const c = makeContent();
	for (const id of ["rack_air_gpu", "rack_storage"]) {
		const r = c.facilities[id].rack;
		if (r) r.failurePerDay = 3;
	}
	const sim = newSim(c, "starter", 5);
	for (let i = 0; i < ticks; i++) {
		for (const e of sim.step()) if (e.type === "contractOffered") sim.submit({ type: "acceptContract", contractId: e.contractId });
	}
	sim.submit({ type: "buyParts", count: 1 });
	return JSON.parse(JSON.stringify(sim.snapshot())) as SimSnapshot;
}

const load = (snap: unknown) => simFromSnapshot(content(), snap as SimSnapshot);
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function expectInvalid(mutate: (snap: Json) => void, reason: RegExp | string): void {
	const snap = clone(savedJson(200)) as unknown as Json;
	mutate(snap);
	let error: unknown;
	try {
		load(snap);
	} catch (e) {
		error = e;
	}
	expect(error, "should have thrown").toBeInstanceOf(Error);
	expect((error as Error).message).toMatch(/^Invalid save: /);
	expect((error as Error).message).toMatch(reason);
}

describe("snapshot validation", () => {
	const base = savedJson();

	it("accepts a genuine save and round-trips the hash", () => {
		const a = load(base) as SimImpl;
		const b = load(a.snapshot()) as SimImpl;
		expect(b.hash()).toBe(a.hash());
		expect(base.version).toBe(SNAPSHOT_VERSION);
		expect(a.state.pending).toHaveLength(1);
	});

	it("rejects bad versions", () => {
		expectInvalid((s) => (s.version = 999), /newer than this game supports/);
		expectInvalid((s) => (s.version = "1"), /bad version/);
		expectInvalid((s) => (s.version = 1.5), /bad version/);
		expectInvalid((s) => (s.version = -1), /bad version/);
		expectInvalid((s) => delete s.version, /bad version/);
	});

	it("rejects missing or non-object snapshots", () => {
		for (const junk of [null, undefined, 5, "save", []]) expect(() => load(junk), String(junk)).toThrow(/^Invalid save: /);
		expectInvalid((s) => delete s.state, /missing state/);
		expectInvalid((s) => (s.state = [1, 2]), /missing state/);
	});

	it("rejects unknown scenarios", () => {
		expectInvalid((s) => (s.scenarioId = "atlantis"), /unknown scenario 'atlantis'/);
		expectInvalid((s) => (s.scenarioId = "constructor"), /unknown scenario/);
		expectInvalid((s) => (s.state.scenarioId = "empty"), /different scenario/);
	});

	it("rejects truncated typed arrays", () => {
		for (const key of ["slab", "power", "coolant", "facilityAt", "liftAt", "airTemp", "powerNetOf", "coolantNetOf"]) {
			expectInvalid((s) => (s.state[key].v = s.state[key].v.slice(0, 10)), new RegExp(`${key} has length 10`));
		}
		expectInvalid((s) => (s.state.metrics.ringItKwh.v = s.state.metrics.ringItKwh.v.slice(0, 10)), /ringItKwh has length 10/);
		expectInvalid((s) => (s.state.slab = [0, 1]), /slab must be a Uint8Array/);
		expectInvalid((s) => (s.state.airTemp.$ta = "Float64Array"), /airTemp must be a Float32Array/);
	});

	it("rejects unknown def ids", () => {
		expectInvalid((s) => (s.state.facilities[0].defId = "removed_thing"), /unknown def 'removed_thing'/);
		expectInvalid((s) => (s.state.facilities[0].defId = "constructor"), /unknown def/);
		expectInvalid((s) => (s.state.bots[0].defId = "ghost"), /unknown bot def 'ghost'/);
	});

	it("rejects out-of-bounds entities", () => {
		expectInvalid((s) => (s.state.facilities[0].x = 500), /out of bounds/);
		expectInvalid((s) => (s.state.facilities[0].floor = -50), /out of bounds/);
		expectInvalid((s) => (s.state.lifts[0].floorMax = 999), /out of bounds/);
		expectInvalid((s) => (s.state.bots[0].x = -3), /out of bounds/);
		expectInvalid((s) => (s.state.bots[0].floor = 77), /out of bounds/);
		expectInvalid((s) => (s.state.facilities[0].width = 7), /does not match def/);
	});

	it("rejects grid layers that disagree with the entity lists", () => {
		expectInvalid((s) => (s.state.facilityAt.v[s.state.facilityAt.v.findIndex((v: number) => v >= 0)] = -1), /facilityAt does not match/);
		expectInvalid((s) => (s.state.facilityAt.v[0] = 3), /facilityAt has cells that no facility covers/);
		expectInvalid((s) => (s.state.liftAt.v[0] = 1), /liftAt has cells that no lift covers/);
		expectInvalid((s) => (s.state.powerNetOf.v[0] = 9999), /powerNetOf\[0\] is out of range/);
	});

	it("rejects dangling references", () => {
		expectInvalid((s) => (s.state.bots[0].homeId = 999), /homeId 999 does not exist/);
		expectInvalid((s) => (s.state.bots[0].workOrderId = 999), /unknown work order 999/);
		expectInvalid((s) => s.state.workOrders.push({ id: 90, facilityId: 999, botId: -1, createdAt: 0, attempts: 0, retryAt: 0, retryRev: 0 }), /targets unknown facility 999/);
		expectInvalid((s) => s.state.workOrders.push({ id: 90, facilityId: 1, botId: 42, createdAt: 0, attempts: 0, retryAt: 0, retryRev: 0 }), /unknown bot 42/);
		expectInvalid((s) => (s.state.facilities[0].jobId = 4242), /unknown job 4242/);
		expectInvalid((s) => (s.state.lifts[0].riders = [77]), /carries unknown bot 77/);
		expectInvalid((s) => (s.state.facilities[0].powerNet = 99), /powerNet is out of range/);
	});

	it("rejects job racks that do not exist", () => {
		const snap = clone(savedJson(900)) as unknown as Json;
		const job = snap.state.jobs.find((j: Json) => j.rackIds.length > 0) ?? snap.state.jobs[0];
		expect(job, "scenario should have produced a job").toBeDefined();
		job.rackIds = [9999];
		expect(() => load(snap)).toThrow(/Invalid save: jobs\[\d+\] uses unknown rack 9999/);
	});

	it("rejects non-finite and mistyped numbers", () => {
		expectInvalid((s) => (s.state.cash = null), /cash must be a finite number/); // NaN becomes null in JSON
		expectInvalid((s) => (s.state.airTemp.v[3] = Number.POSITIVE_INFINITY), /non-numeric entry at 3/); // parses as Infinity
		expectInvalid((s) => (s.state.cash = "lots"), /cash must be a finite number/);
		expectInvalid((s) => (s.state.tick = 1.5), /tick must be an integer/);
		expectInvalid((s) => (s.state.tick = -4), /tick is negative/);
		expectInvalid((s) => (s.state.facilities[0].tempC = null), /tempC must be a finite number/);
		expectInvalid((s) => (s.state.airTemp.v[3] = null), /typed array 'Float32Array' has a non-numeric entry at 3/);
		expectInvalid((s) => (s.state.bots[0].battery = "full"), /battery must be a finite number/);
		expectInvalid((s) => (s.state.history.push({ tick: 0, pue: null, itKw: 0, totalKw: 0, pflops: 0, cash: 0, maxRackC: 0 })), /pue must be a finite number/);
		expectInvalid((s) => (s.state.width = 0), /grid dimensions/);
		expectInvalid((s) => (s.state.width = 5_000_000), /too large|has length/);
		expectInvalid((s) => (s.state.tier = 0), /tier must be at least 1/);
	});

	it("rejects broken ids and enumerations", () => {
		expectInvalid((s) => (s.state.nextId.facility = 1), /not below the next id/);
		expectInvalid((s) => s.state.facilities.reverse(), /strictly ascending/);
		expectInvalid((s) => (s.state.bots[0].task = "dance"), /task 'dance' is invalid/);
		expectInvalid((s) => (s.state.bots[0].leg = "fly"), /leg 'fly' is invalid/);
		expectInvalid((s) => (s.state.lifts[0].dir = 3), /dir is invalid/);
		expectInvalid((s) => (s.state.facilities[0].gensetMode = 9), /gensetMode is invalid/);
		expectInvalid((s) => (s.state.facilities = "many"), /facilities must be an array/);
		expectInvalid((s) => (s.state.metrics = null), /metrics is not an object/);
	});

	it("rejects hostile typed-array payloads and __proto__ keys", () => {
		expectInvalid((s) => (s.state.slab = { $ta: "Uint8Array", v: "abc" }), /typed array 'Uint8Array' has no data/);
		expectInvalid((s) => (s.state.slab = { $ta: "Uint8Array", v: s.state.slab.v.map(() => "x") }), /non-numeric entry at 0/);
		expectInvalid((s) => (s.state.rng = JSON.parse('{"__proto__": {"polluted": true}, "contracts": 1, "reliability": 2}')), /forbidden key/);
		expect(({} as Json).polluted).toBeUndefined();
	});

	it("never constructs a sim from a failed load (nothing half-built)", () => {
		const snap = clone(savedJson(100)) as unknown as Json;
		snap.state.facilities[0].defId = "removed_thing";
		let sim: unknown;
		try {
			sim = load(snap);
		} catch {
			sim = undefined;
		}
		expect(sim).toBeUndefined();
	});

	it("drops malformed queued commands instead of refusing the save", () => {
		const snap = clone(base) as unknown as Json;
		snap.state.pending.push({ type: "buildConduit", layer: "power", cells: [null] }, null, { type: "nope" });
		const sim = load(snap) as SimImpl;
		expect(sim.state.pending).toHaveLength(1); // the genuine buyParts survived
		expect(() => sim.step()).not.toThrow();
	});

	it("a save can keep running: states from a busy game always load, every 40 ticks", () => {
		const c = makeContent();
		for (const id of ["rack_air_gpu", "rack_storage"]) {
			const r = c.facilities[id].rack;
			if (r) r.failurePerDay = 6;
		}
		const sim = newSim(c, "starter", 8);
		const script: SimCommand[][] = [
			[{ type: "buildSlab", floor: 2, x0: 4, x1: 30 }, { type: "buildConduit", layer: "power", cells: rowCells(2, 4, 30) }],
			[{ type: "place", defId: "rack_air_gpu", floor: 2, x: 6 }, { type: "place", defId: "crah_unit", floor: 2, x: 9 }, { type: "buyParts", count: 5 }],
		];
		for (const cmds of script) for (const cmd of cmds) sim.submit(cmd);
		for (let t = 0; t < 2 * 1440; t++) {
			for (const e of sim.step()) {
				if (e.type === "contractOffered") sim.submit({ type: "acceptContract", contractId: e.contractId });
			}
			if (t === 700) sim.submit({ type: "demolish", floor: 2, x: 9 });
			if (t % 40 === 0) {
				const twin = simFromSnapshot(c, JSON.parse(JSON.stringify(sim.snapshot()))) as SimImpl;
				expect(twin.hash(), `tick ${t}`).toBe(sim.hash());
			}
		}
	});
});

describe("snapshot validation on a big busy tower", () => {
	it("every sampled state of the 60×64 tower is a valid, hash-identical save", async () => {
		const { towerContent } = await import("./test/tower");
		const c = towerContent();
		const sim = newSim(c, "tower", 11);
		for (let t = 1; t <= 900; t++) {
			if (t % 150 === 0) sim.submit({ type: "buyParts", count: 15 });
			for (const e of sim.step()) if (e.type === "contractOffered") sim.submit({ type: "acceptContract", contractId: e.contractId });
			if (t % 150 === 75) {
				const twin = simFromSnapshot(c, JSON.parse(JSON.stringify(sim.snapshot()))) as SimImpl;
				expect(twin.hash(), `tick ${t}`).toBe(sim.hash());
			}
		}
	});
});

describe("snapshot migrations", () => {
	afterEach(() => {
		delete migrations[0];
	});

	it("is at version 2 and a v1 save (before bot routing fields) migrates", () => {
		expect(SNAPSHOT_VERSION).toBe(2);
		const snap = clone(savedJson()) as unknown as Json;
		// Rewrite as a genuine v1 save: no topologyRev, no routing fields.
		snap.version = 1;
		delete snap.state.topologyRev;
		for (const b of snap.state.bots) for (const k of ["exitFloor", "stuck", "retryAt", "fails", "routeRev"]) delete b[k];
		for (const w of snap.state.workOrders) for (const k of ["attempts", "retryAt"]) delete w[k];
		const sim = load(snap) as SimImpl;
		expect(sim.state.topologyRev).toBe(0);
		expect(sim.state.bots[0]).toMatchObject({ stuck: 0, retryAt: 0, fails: 0, routeRev: 0, exitFloor: sim.state.bots[0].floor });
		for (let i = 0; i < 300; i++) sim.step();
	});

	it("a riding v1 bot keeps its destination as exit floor", () => {
		const snap = clone(savedJson()) as unknown as Json;
		snap.version = 1;
		const bot = snap.state.bots[0];
		bot.leg = "ride";
		bot.goalFloor = 1;
		bot.floor = 0.5;
		delete bot.exitFloor;
		const migrated = load({ ...snap, state: { ...snap.state, lifts: snap.state.lifts.map((l: Json) => ({ ...l, riders: [bot.id] })) } }) as SimImpl;
		expect(migrated.state.bots[0].exitFloor).toBe(1);
	});

	it("an old version without a registered migration is rejected cleanly", () => {
		const snap = clone(savedJson()) as unknown as Json;
		snap.version = 0;
		expect(() => load(snap)).toThrow("Invalid save: no migration from version 0");
	});

	it("a registered migration for a fake v0 is applied, then the chain continues to the current version", () => {
		const snap = clone(savedJson()) as unknown as Json;
		snap.version = 0;
		// Fake v0 stored cash under another name and the current layout has no such thing.
		snap.state.money = snap.state.cash;
		delete snap.state.cash;
		migrations[0] = (s) => {
			s.cash = s.money;
			delete s.money;
			return s;
		};
		const sim = load(snap) as SimImpl;
		expect(sim.state.cash).toBe(snap.state.money);
		expect(sim.snapshot().version).toBe(SNAPSHOT_VERSION);
		migrations[0] = () => null as never;
		expect(() => load(snap)).toThrow(/Invalid save: migration from version 0 failed/);
	});

	it("a migration that throws is reported as an invalid save", () => {
		const snap = clone(savedJson()) as unknown as Json;
		snap.version = 0;
		migrations[0] = () => {
			throw new Error("kaboom");
		};
		expect(() => load(snap)).toThrow("Invalid save: migration failed");
	});
});

describe("snapshot basics (kept)", () => {
	it("exec-driven sim snapshot round-trips", () => {
		const sim = newSim(content(), "starter", 3);
		exec(sim, { type: "buyParts", count: 2 });
		const copy = simFromSnapshot(content(), JSON.parse(JSON.stringify(sim.snapshot()))) as SimImpl;
		expect(copy.hash()).toBe(sim.hash());
	});
});
