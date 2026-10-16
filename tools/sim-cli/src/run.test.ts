import { describe, expect, it } from "vitest";
import { loadContent } from "@aitower/content";
import { createSim, simFromSnapshot, TICKS_PER_DAY } from "@aitower/sim";
import { makeContent } from "../../../packages/sim/src/test/fixture";
import { formatTable, runHeadless } from "./run";

describe("sim-cli runHeadless", () => {
	it("produces one row per day and a deterministic hash", () => {
		const a = runHeadless(makeContent(), "starter", 2, 5);
		const b = runHeadless(makeContent(), "starter", 2, 5);
		expect(a.rows).toHaveLength(2);
		expect(a.hash).toBe(b.hash);
		expect(a.rows[1].day).toBe(1);
		const table = formatTable(a.rows);
		expect(table.split("\n")).toHaveLength(4);
		expect(table).toContain("PUE");
	});

	it("real content: the starter run stays profitable and finite (seed 1, 15 days)", () => {
		const { rows } = runHeadless(loadContent(), "starter", 15, 1);
		expect(rows).toHaveLength(15);
		for (const r of rows) {
			expect(Number.isFinite(r.cash)).toBe(true);
			expect(Number.isFinite(r.pue)).toBe(true);
			expect(r.uptime).toBeGreaterThan(0.5);
		}
		expect(rows[14].cash).toBeGreaterThan(rows[0].cash);
	});

	it("real content: every day's save validates, reloads to the same hash and keeps running identically", () => {
		const content = loadContent();
		const a = createSim(content, "starter", 2);
		for (let day = 0; day < 4; day++) {
			for (let t = 0; t < TICKS_PER_DAY; t++) {
				for (const e of a.step()) if (e.type === "contractOffered") a.submit({ type: "acceptContract", contractId: e.contractId });
			}
			const b = simFromSnapshot(content, JSON.parse(JSON.stringify(a.snapshot())));
			expect(b.hash(), `day ${day}`).toBe(a.hash());
		}
		const b = simFromSnapshot(content, JSON.parse(JSON.stringify(a.snapshot())));
		for (let t = 0; t < 300; t++) {
			a.step();
			b.step();
		}
		expect(b.hash()).toBe(a.hash());
	});
});
