import { describe, expect, it } from "vitest";
import { moneyFlow, pueExplain, reputationTrend, reputationWhy, uptimeVerdict } from "./insights";

const day = { day: 0, revenue: 6000, energy: 600, upkeep: 600, construction: 9999, penalties: 0 } as never;

describe("insights", () => {
	it("splits money in and out per hour and leaves construction out", () => {
		const f = moneyFlow({ tick: 600, day: 0, ledger: [day] });
		expect(f.inPerHour).toBeCloseTo(600);
		expect(f.outPerHour).toBeCloseTo(120);
		expect(f.headline).toBe("You are making about $480 an hour.");
		expect(moneyFlow({ tick: 0, day: 0, ledger: [] }).netPerHour).toBeNull();
	});

	it("compares uptime with the Level target", () => {
		const facilities = [{}] as never;
		expect(uptimeVerdict({ uptime: 0.97, uptimeTarget: 0.95, facilities }).ok).toBe(true);
		const low = uptimeVerdict({ uptime: 0.9, uptimeTarget: 0.95, facilities });
		expect(low).toMatchObject({ ok: false, tone: "bad", headline: "Uptime 90.0% · target 95%" });
		expect(uptimeVerdict({ uptime: 1, uptimeTarget: 0, facilities }).target).toBeNull();
	});

	it("lists why reputation moved, newest first, in plain words", () => {
		const standingLog = [
			{ tick: 100, delta: 2, cause: "job", detail: "Finished A" },
			{ tick: 700, delta: -4, cause: "daily-uptime", detail: "Uptime 91% vs target 95%" },
		] as never;
		const rows = reputationWhy({ standingLog });
		expect(rows.map((r) => r.deltaText)).toEqual(["−4", "+2"]);
		expect(rows[0].cause).toBe("Daily uptime check");
		expect(reputationTrend({ standingLog, tick: 800 })).toMatchObject({ delta: -2, tone: "warn" });
		expect(reputationTrend({ standingLog: [], tick: 800 }).text).toMatch(/Steady/);
	});

	it("explains PUE with the player's number", () => {
		expect(pueExplain(1.35)).toContain("$0.35");
	});
});
