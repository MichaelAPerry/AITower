import type { QuarterReport } from "@aitower/sim";
import { describe, expect, it } from "vitest";
import { AUDIT_QUIPS, pickQuip, quipKind, quipMood } from "./auditQuips";

const rep = (o: Partial<QuarterReport> = {}): QuarterReport => ({ quarter: 1, fromDay: 0, toDay: 6, revenue: 10, costs: 5, uptime: 0.99, pue: 1.4, jobsCompleted: 3, jobsFailed: 0, penalties: 0, grade: "B", cashDelta: 0, remark: "", ...o });

describe("audit quips", () => {
	it("has 8 to 12 short quips in all", () => {
		const all = Object.values(AUDIT_QUIPS).flat();
		expect(all.length).toBeGreaterThanOrEqual(8);
		expect(all.length).toBeLessThanOrEqual(12);
		for (const q of all) expect(q.length).toBeLessThanOrEqual(90);
	});
	it("picks by grade", () => {
		expect(quipKind(rep({ grade: "A" }))).toBe("passed");
		expect(quipKind(rep({ grade: "C" }))).toBe("warning");
		expect(quipKind(rep({ grade: "D" }))).toBe("failed");
		expect(quipKind(rep({ grade: "E" }))).toBe("failed");
	});
	it("picks by the worst finding when the grade is not an A", () => {
		expect(quipKind(rep({ grade: "C", jobsFailed: 2 }))).toBe("failedJobs");
		expect(quipKind(rep({ grade: "C", penalties: 5 }))).toBe("penalties");
		expect(quipKind(rep({ grade: "C", uptime: 0.9 }))).toBe("lowUptime");
		expect(quipKind(rep({ grade: "B", pue: 2 }))).toBe("hotHall");
		expect(quipKind(rep({ grade: "C", revenue: 1, costs: 9 }))).toBe("loss");
		expect(quipKind(rep({ grade: "A", jobsFailed: 2 }))).toBe("passed");
	});
	it("is deterministic and always from the pool", () => {
		for (let q = 1; q < 6; q++) {
			const r = rep({ quarter: q, grade: "E" });
			expect(pickQuip(r)).toBe(pickQuip(r));
			expect(AUDIT_QUIPS.failed).toContain(pickQuip(r));
		}
		expect(pickQuip(rep({ quarter: 1, grade: "A" }))).not.toBe(pickQuip(rep({ quarter: 2, grade: "A" })));
	});
	it("Luci's mood follows the grade", () => {
		expect(quipMood(rep({ grade: "A" }))).toBe("pleased");
		expect(quipMood(rep({ grade: "C" }))).toBe("neutral");
		expect(quipMood(rep({ grade: "E" }))).toBe("displeased");
	});
});
