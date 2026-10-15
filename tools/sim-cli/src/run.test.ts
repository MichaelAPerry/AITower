import { describe, expect, it } from "vitest";
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
});
