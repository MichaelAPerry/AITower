import { describe, expect, it } from "vitest";
import type { CommandResult, SimCommand } from "./api";
import { type SimImpl, simFromSnapshot } from "./sim";
import { makeContent, newSim } from "./test/fixture";

/** Small seeded PRNG for the test itself (mulberry32). */
function rng(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const JUNK: unknown[] = [null, undefined, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1, 1e9, 2 ** 53, -0.5, 0.5, "x", "", {}, [], [null], true, false, () => 1];
const DEFS = ["rack_air_gpu", "rack_dlc_gpu", "rack_storage", "crah_unit", "chiller", "cdu", "grid_tie", "genset", "ups_battery", "parts_depot", "bot_charger", "tier2_thing", "nope", "constructor", "__proto__", ""];
const TYPES = ["buildSlab", "place", "buildConduit", "buildLift", "demolish", "setEnabled", "acceptContract", "declineContract", "cancelJob", "buyParts", "buyBot", "resolveMemo", "resolveMemo"];

function makeFuzzer(seed: number) {
	const r = rng(seed);
	const int = (lo: number, hi: number): number => lo + Math.floor(r() * (hi - lo + 1));
	const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
	const floor = (): number => int(-3, 11);
	const x = (): number => int(-2, 49);
	const cells = (): unknown[] => {
		const n = int(0, 12);
		const out: unknown[] = [];
		const f = floor();
		const x0 = x();
		for (let i = 0; i < n; i++) out.push(r() < 0.05 ? pick(JUNK) : r() < 0.1 ? { x: x(), floor: floor() } : { x: x0 + i, floor: f });
		return out;
	};
	const valid = (): Record<string, unknown> => {
		const type = pick(TYPES);
		switch (type) {
			case "buildSlab": {
				const a = x();
				return { type, floor: int(0, 3), x0: a, x1: a + int(0, 12) };
			}
			case "place":
				return { type, defId: pick(DEFS), floor: int(0, 3), x: x() };
			case "buildConduit":
				return { type, layer: pick(["power", "coolant", "steam"]), cells: cells() };
			case "buildLift":
				return { type, x: x(), floorMin: int(-1, 2), floorMax: int(0, 5) };
			case "demolish":
				return { type, floor: int(-1, 3), x: x(), layer: pick([undefined, "power", "coolant", "gas"]) };
			case "setEnabled":
				return { type, facilityId: int(0, 12), enabled: r() < 0.5 };
			case "acceptContract":
			case "declineContract":
				return { type, contractId: int(0, 8) };
			case "cancelJob":
				return { type, jobId: int(0, 8) };
			case "buyParts":
				return { type, count: int(-1, 6) };
			case "resolveMemo":
				return { type, memoId: int(0, 12), choiceId: pick(["a", "b", "c", "__proto__", "constructor", ""]) };
			default:
				return { type, defId: pick(["rover", "nope", "__proto__"]) };
		}
	};
	const mangle = (c: Record<string, unknown>): unknown => {
		const keys = Object.keys(c);
		const m = r();
		if (m < 0.25) return pick(JUNK);
		if (m < 0.45) {
			delete c[pick(keys)];
			return c;
		}
		if (m < 0.8) {
			c[pick(keys)] = pick(JUNK);
			return c;
		}
		if (m < 0.9) {
			c.type = pick([...JUNK, "BUILDSLAB", "toString", "hasOwnProperty"]);
			return c;
		}
		if (c.type === "buildConduit") c.cells = pick([[pick(JUNK)], new Array(int(0, 50)).fill(null), "abc", { length: 3 }]);
		return c;
	};
	return { next: (): unknown => (r() < 0.5 ? valid() : mangle(valid())), r };
}

/** Runs the fuzz script; returns the final hash and summary stats. */
function runFuzz(seed: number, total: number): { hash: string; accepted: number; rejected: number; memosResolved: number } {
	const content = makeContent();
	for (const id of ["rack_air_gpu", "rack_storage"]) {
		const rk = content.facilities[id].rack;
		if (rk) rk.failurePerDay = 4;
	}
	// Memos every ~8 ticks that expire quickly, so the fuzzer's resolveMemo commands hit open, expiring and gone memos.
	content.events = [
		{ id: "fa", category: "ministry", title: "A", body: "a", weight: 1, minTier: 1, cooldownDays: 0, timeoutTicks: 12, defaultChoice: "a", choices: [
			{ id: "a", label: "A", hint: "", outcome: "", effects: [{ type: "cash", amount: -1000 }, { type: "failRacks", count: 1 }] },
			{ id: "b", label: "B", hint: "", outcome: "", effects: [{ type: "standing", amount: 3 }, { type: "ambient", deltaC: 4, durationTicks: 90 }, { type: "spareParts", count: -2 }] },
		] },
		{ id: "fb", category: "environmental", title: "B", body: "b", weight: 1, minTier: 1, cooldownDays: 0, timeoutTicks: 30, defaultChoice: "b", choices: [
			{ id: "a", label: "A", hint: "", outcome: "", effects: [{ type: "gridCap", factor: 0.5, durationTicks: 50 }, { type: "payout", factor: 1.5, durationTicks: 200 }] },
			{ id: "b", label: "B", hint: "", outcome: "", effects: [{ type: "energyPrice", factor: 2, durationTicks: 100 }, { type: "failureRate", factor: 2, durationTicks: 100 }, { type: "standing", amount: -2 }] },
			{ id: "c", label: "C", hint: "", outcome: "", effects: [{ type: "cash", amount: 5000 }, { type: "spareParts", count: 3 }] },
		] },
	];
	content.balance.events = { intervalTicks: 8, maxOpen: 3, graceTicks: 0 };
	const sim = newSim(content, "starter", seed) as SimImpl;
	const fz = makeFuzzer(seed);
	let accepted = 0;
	let rejected = 0;
	let memosResolved = 0;
	for (let i = 0; i < total; i++) {
		const cmd = fz.next() as SimCommand;
		let peek: CommandResult | undefined;
		let res: CommandResult | undefined;
		expect(() => {
			peek = sim.canBuild(cmd);
			res = sim.submit(cmd);
		}, `command #${i}`).not.toThrow();
		expect(typeof res?.ok).toBe("boolean");
		if (res && !res.ok) expect(res.reason.length).toBeGreaterThan(0);
		// canBuild is exactly the validation submit performs (both queue-aware).
		expect(peek).toEqual(res);
		if (res?.ok) accepted++;
		else rejected++;
		if (i % 20 === 19) {
			let events: ReturnType<SimImpl["step"]> = [];
			expect(() => {
				for (let k = 0; k < 1 + (i % 3); k++) {
					events = sim.step();
					memosResolved += events.filter((e) => e.type === "memoResolved").length;
				}
			}).not.toThrow();
			// The only rejections allowed at apply time are for commands submit() also refused (none), so step() agrees with submit().
			expect(events.filter((e) => e.type === "commandRejected")).toHaveLength(0);
			if (i % 200 === 199) {
				// The live state must always be a loadable save and numerically sane.
				expect(Number.isFinite(sim.state.cash)).toBe(true);
				expect(sim.state.standing).toBeGreaterThanOrEqual(0);
				expect(sim.state.standing).toBeLessThanOrEqual(100);
				expect(() => simFromSnapshot(content, JSON.parse(JSON.stringify(sim.snapshot())))).not.toThrow();
			}
		}
	}
	for (let k = 0; k < 50; k++) sim.step();
	return { hash: sim.hash(), accepted, rejected, memosResolved };
}

describe("command fuzz", () => {
	it("2,000 random valid and malformed commands never throw, agree with canBuild, and keep the sim runnable", () => {
		const out = runFuzz(1234, 2000);
		expect(out.accepted).toBeGreaterThan(100);
		expect(out.rejected).toBeGreaterThan(100);
		expect(out.memosResolved).toBeGreaterThan(10);
	});

	it("is deterministic: the same seed produces the same final state", () => {
		expect(runFuzz(99, 600).hash).toBe(runFuzz(99, 600).hash);
		expect(runFuzz(99, 600).hash).not.toBe(runFuzz(100, 600).hash);
	});
});
