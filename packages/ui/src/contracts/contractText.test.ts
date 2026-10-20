import { describe, expect, it } from "vitest";
import { clockText, fitText, pickSelection } from "./contractText";

describe("contract text", () => {
	it("writes the game clock from 06:00", () => {
		expect(clockText(0)).toBe("Day 0, 06:00");
		expect(clockText(1100)).toBe("Day 0, 00:20");
		expect(clockText(1440 + 60)).toBe("Day 1, 07:00");
	});

	it("says in plain words whether a job fits", () => {
		expect(fitText({ ok: true }).text).toBe("Fits your idle racks ✓");
		expect(fitText({ ok: false, reason: "no idle racks" })).toEqual({ ok: false, text: "Can't start yet: no idle racks" });
	});

	it("keeps a valid pick, else the job we were sent to, else the offer that fits, else anything", () => {
		const offers = [{ id: 1 }, { id: 2 }];
		const jobs = [{ id: 9 }];
		expect(pickSelection({ kind: "offer", id: 1 }, null, offers, jobs, 2)).toEqual({ kind: "offer", id: 1 });
		expect(pickSelection({ kind: "offer", id: 5 }, null, offers, jobs, 2)).toEqual({ kind: "offer", id: 2 });
		expect(pickSelection(null, 9, offers, jobs, 2)).toEqual({ kind: "job", id: 9 });
		expect(pickSelection(null, null, offers, jobs, undefined)).toEqual({ kind: "offer", id: 1 });
		expect(pickSelection(null, null, [], jobs, undefined)).toEqual({ kind: "job", id: 9 });
		expect(pickSelection(null, null, [], [], undefined)).toBeNull();
	});
});
