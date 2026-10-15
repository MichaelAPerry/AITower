import { describe, expect, it } from "vitest";
import { CONTRACT_TUNING, generateContract, pickClient } from "./contracts";
import { loadContent } from "./load";
import type { ContractGenContext, ContractSpec } from "./schema";

/** Small deterministic PRNG (mulberry32) for tests. */
function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const db = loadContent();
const gen = (seed: number, ctx: ContractGenContext, n = 200): ContractSpec[] => {
	const rng = mulberry32(seed);
	return Array.from({ length: n }, () => generateContract(rng, ctx, db));
};

describe("generateContract", () => {
	it("is deterministic for the same rng sequence", () => {
		const ctx = { tier: 2, capacityPflops: 160, day: 3 };
		expect(gen(42, ctx)).toEqual(gen(42, ctx));
		expect(gen(42, ctx)).not.toEqual(gen(43, ctx));
	});

	it("is exposed on the DB", () => {
		const rng = mulberry32(1);
		const c = db.generateContract(rng, { tier: 1, capacityPflops: 80, day: 0 }, db);
		expect(c.clientName.length).toBeGreaterThan(0);
	});

	it("produces well-formed contracts", () => {
		for (const c of gen(7, { tier: 4, capacityPflops: 500, day: 10 }, 500)) {
			expect(c.work).toBeGreaterThan(0);
			expect(c.durationTicks).toBeGreaterThanOrEqual(60);
			expect(Number.isInteger(c.durationTicks)).toBe(true);
			expect(c.payout).toBeGreaterThan(0);
			expect(c.penalty / c.payout).toBeGreaterThanOrEqual(0.24);
			expect(c.penalty / c.payout).toBeLessThanOrEqual(0.51);
			expect(c.checkpointTicks).toBeGreaterThanOrEqual(60);
			expect(c.checkpointTicks).toBeLessThanOrEqual(240);
			if (c.kind === "inference") {
				expect(c.storageTB).toBe(0);
				expect(c.sustainedPflops).toBe(c.work);
			} else {
				expect(c.storageTB).toBeGreaterThanOrEqual(200);
				expect(c.storageTB).toBeLessThanOrEqual(4000);
				expect(c.sustainedPflops).toBeUndefined();
			}
			const client = db.clients.find((k) => k.id === c.clientId)!;
			expect(client.kinds).toContain(c.kind);
			expect(c.needsLiquid).toBe(client.needsLiquid ?? false);
		}
	});

	it("sizes jobs relative to capacity", () => {
		const mean = (cs: ContractSpec[], kind: string) => {
			const xs = cs.filter((c) => c.kind === kind).map((c) => c.work);
			return xs.reduce((s, x) => s + x, 0) / xs.length;
		};
		const small = gen(5, { tier: 1, capacityPflops: 80, day: 0 }, 400);
		const big = gen(5, { tier: 1, capacityPflops: 160, day: 0 }, 400);
		for (const kind of ["training", "inference", "finetune"]) {
			expect(mean(big, kind) / mean(small, kind)).toBeCloseTo(2, 2);
		}
		// Training: 0.5–3 days of capacity; inference: 20–60 % of capacity.
		for (const c of small) {
			if (c.kind === "training") {
				const days = c.work / (80 * 24);
				expect(days).toBeGreaterThanOrEqual(0.49);
				expect(days).toBeLessThanOrEqual(3.01);
				// Feasible at full capacity with slack.
				expect(c.durationTicks / 60).toBeGreaterThan(c.work / 80);
			}
			if (c.kind === "inference") {
				expect(c.sustainedPflops! / 80).toBeGreaterThanOrEqual(0.19);
				expect(c.sustainedPflops! / 80).toBeLessThanOrEqual(0.61);
			}
		}
	});

	it("caps training size to what the per-job rack limit can deliver", () => {
		const huge = gen(9, { tier: 1, capacityPflops: 10_000, day: 0 }, 300).filter((c) => c.kind === "training");
		const cap = CONTRACT_TUNING.maxRacksPerTrainingJob * db.facilities.rack_air_gpu.rack!.pflops;
		for (const c of huge) expect(c.work).toBeLessThanOrEqual(cap * 3 * 24 + 1);
	});

	it("handles zero capacity", () => {
		for (const c of gen(3, { tier: 1, capacityPflops: 0, day: 0 }, 50)) expect(c.work).toBeGreaterThan(0);
	});

	it("gates clients by tier", () => {
		const t1 = new Set(gen(11, { tier: 1, capacityPflops: 100, day: 0 }, 500).map((c) => c.clientId));
		for (const id of t1) expect(db.clients.find((c) => c.id === id)!.minTier).toBe(1);
		expect(t1.size).toBe(db.clients.filter((c) => c.minTier === 1).length);
		const t4 = new Set(gen(11, { tier: 4, capacityPflops: 1000, day: 0 }, 1000).map((c) => c.clientId));
		expect(t4.size).toBe(db.clients.length);
		const liquid = gen(11, { tier: 1, capacityPflops: 100, day: 0 }, 500).filter((c) => c.needsLiquid);
		expect(liquid).toHaveLength(0);
	});

	it("pickClient honours weights", () => {
		const clients = [
			{ id: "a", name: "A", sector: "media" as const, weight: 1, kinds: ["inference" as const], minTier: 1, payMultiplier: 1 },
			{ id: "b", name: "B", sector: "media" as const, weight: 3, kinds: ["inference" as const], minTier: 1, payMultiplier: 1 },
		];
		const rng = mulberry32(99);
		let b = 0;
		for (let i = 0; i < 4000; i++) if (pickClient(rng, 1, clients).id === "b") b++;
		expect(b / 4000).toBeGreaterThan(0.7);
		expect(b / 4000).toBeLessThan(0.8);
	});
});
