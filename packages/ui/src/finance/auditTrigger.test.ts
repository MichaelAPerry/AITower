import type { QuarterReport, SimEvent } from "@aitower/sim";
import { describe, expect, it } from "vitest";
import { auditToShow, createLogCursor } from "./auditTrigger";

const rep = (quarter: number): QuarterReport => ({ quarter, fromDay: 0, toDay: 6, revenue: 1, costs: 1, uptime: 1, pue: 1.4, jobsCompleted: 0, jobsFailed: 0, penalties: 0, grade: "B", standingDelta: 0, cashDelta: 0, remark: "" });
const q = (tick: number, quarter: number) => ({ tick, event: { type: "quarterReport", quarter, grade: "B" } as SimEvent });
const other = (tick: number) => ({ tick, event: { type: "newDay", day: 1 } as SimEvent });

describe("auditToShow", () => {
	it("entries present on the first look never pop a sheet", () => {
		const cur = createLogCursor();
		expect(auditToShow(cur, [q(100, 1)], [rep(1)])).toBeNull();
		expect(auditToShow(cur, [q(100, 1)], [rep(1)])).toBeNull();
	});
	it("a quarterReport that arrives later pops its report, once", () => {
		const cur = createLogCursor();
		const log = [other(10)];
		auditToShow(cur, log, []);
		log.push(other(20), q(30, 2));
		expect(auditToShow(cur, log, [rep(1), rep(2)])?.quarter).toBe(2);
		expect(auditToShow(cur, log, [rep(1), rep(2)])).toBeNull();
	});
	it("an event on the same tick as the last one seen still counts", () => {
		const cur = createLogCursor();
		const log = [other(50)];
		auditToShow(cur, log, []);
		log.push(q(50, 3));
		expect(auditToShow(cur, log, [rep(3)])?.quarter).toBe(3);
	});
	it("other events do not pop it", () => {
		const cur = createLogCursor();
		const log = [other(1)];
		auditToShow(cur, log, []);
		log.push(other(2), other(3));
		expect(auditToShow(cur, log, [rep(1)])).toBeNull();
	});
	it("a tick going backwards (load or new game) resets the cursor without popping", () => {
		const cur = createLogCursor();
		auditToShow(cur, [other(5000)], []);
		expect(auditToShow(cur, [q(10, 1)], [rep(1)])).toBeNull();
		const log = [q(10, 1), q(20, 2)];
		expect(auditToShow(cur, log, [rep(1), rep(2)])?.quarter).toBe(2);
	});
	it("falls back to the newest report when the event's quarter is not in the view", () => {
		const cur = createLogCursor();
		auditToShow(cur, [other(1)], []);
		expect(auditToShow(cur, [other(1), q(2, 9)], [rep(4)])?.quarter).toBe(4);
		const cur2 = createLogCursor();
		auditToShow(cur2, [other(1)], []);
		expect(auditToShow(cur2, [other(1), q(2, 9)], [])).toBeNull();
	});
	it("an empty log is fine", () => {
		const cur = createLogCursor();
		expect(auditToShow(cur, [], [])).toBeNull();
		expect(auditToShow(cur, [q(1, 1)], [rep(1)])?.quarter).toBe(1);
	});
});
