import { describe, expect, it } from "vitest";
import type { TickCtx } from "./core/context";
import { closeAuditDay, STREAK_UPTIME } from "./economy/audit";
import { migrateState, migrations, SNAPSHOT_VERSION } from "./snapshot/migrate";
import { makeContent, newSim } from "./test/fixture";

/** Drive `closeAuditDay` directly with a chosen day of samples. */
function closeDay(opts: { mean?: number; pflops?: number; irreversible?: boolean; streak?: number; noSamples?: boolean; metricsUptime?: number }): number {
	const sim = newSim(makeContent());
	const s = sim.state;
	s.uptimeStreak = opts.streak ?? 0;
	s.irreversible = opts.irreversible ?? false;
	s.metrics.pflops = opts.pflops ?? 10;
	s.metrics.uptime = opts.metricsUptime ?? 1;
	s.audit.samples = opts.noSamples ? 0 : 4;
	s.audit.uptimeSum = (opts.mean ?? 1) * 4;
	closeAuditDay({ state: s, content: makeContent(), events: [] } as unknown as TickCtx, 1);
	return s.uptimeStreak;
}

describe("uptimeStreak update rule (closeAuditDay)", () => {
	it("counts a day at exactly 99% and not just below", () => {
		expect(STREAK_UPTIME).toBe(0.99);
		expect(closeDay({ mean: 0.99, streak: 4 })).toBe(5);
		expect(closeDay({ mean: 0.9899, streak: 4 })).toBe(0);
	});
	it("resets to 0 on a miss and starts again", () => {
		expect(closeDay({ mean: 0.5, streak: 19 })).toBe(0);
		expect(closeDay({ mean: 1, streak: 0 })).toBe(1);
	});
	it("needs pflops above 0 (uptime is exactly 1 when nothing is meant to run)", () => {
		expect(closeDay({ mean: 1, pflops: 0, streak: 7 })).toBe(0);
	});
	it("uses the metrics uptime when the day has no samples", () => {
		expect(closeDay({ noSamples: true, metricsUptime: 1, streak: 1 })).toBe(2);
		expect(closeDay({ noSamples: true, metricsUptime: 0.9, streak: 1 })).toBe(0);
	});
	it("still counts once the tower is irreversible (before the early return)", () => {
		expect(closeDay({ mean: 1, streak: 2, irreversible: true })).toBe(3);
		expect(closeDay({ mean: 0.2, streak: 2, irreversible: true })).toBe(0);
	});
});

describe("snapshot v16 migration", () => {
	it("is version 16 and the v15 step defaults the streak to 0", () => {
		expect(SNAPSHOT_VERSION).toBe(16);
		expect(migrations[15]({ cash: 1 })).toEqual({ cash: 1, uptimeStreak: 0 });
		expect(migrations[15]({ uptimeStreak: 7 }).uptimeStreak).toBe(7);
		expect(migrations[15]({ uptimeStreak: -3 }).uptimeStreak).toBe(0);
		expect(migrations[15]({ uptimeStreak: "x" }).uptimeStreak).toBe(0);
		expect(migrateState({ a: 1 }, 15)).toMatchObject({ uptimeStreak: 0 });
	});
});
