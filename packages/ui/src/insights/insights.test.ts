import { describe, expect, it } from "vitest";
import { moneyFlow, pueExplain, uptimeVerdict } from "./insights";

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

	it("explains PUE with the player's number", () => {
		expect(pueExplain(1.35)).toContain("$0.35");
	});
});
