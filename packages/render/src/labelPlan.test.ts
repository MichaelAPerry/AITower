import type { FacilityStatus } from "@aitower/sim";
import { describe, expect, it } from "vitest";
import { fitName, hits, planTags, statusWord, type TagFacility } from "./labelPlan";

const ALL: FacilityStatus[] = ["ok", "idle", "disabled", "unpowered", "brownout", "noCoolant", "noNutrient", "tooCold", "throttled", "tripped", "failed"];
const fac = (id: number, x: number, o: Partial<TagFacility> = {}): TagFacility => ({ id, defId: "rack", floor: 0, x, width: 2, status: "ok", enabled: true, ...o });
const name = (d: string): string | undefined => (d === "rack" ? "GPU rack" : d === "crac" ? "Cooler" : undefined);

describe("statusWord", () => {
	it("is null only for ok; everything else gets a short word", () => {
		for (const s of ALL) {
			const w = statusWord(s);
			if (s === "ok") expect(w).toBeNull();
			else expect(w?.word.length).toBeGreaterThan(0);
		}
	});
	it("names the usual suspects", () => {
		expect(statusWord("unpowered")?.word).toBe("NO POWER");
		expect(statusWord("throttled")?.word).toBe("HOT");
		expect(statusWord("failed")?.word).toBe("BROKEN");
		expect(statusWord("idle")?.word).toBe("IDLE");
		expect(statusWord("ok", false)?.word).toBe("OFF");
	});
});

describe("planTags", () => {
	it("one name tag per run of the same type, centred on the run", () => {
		const t = planTags([fac(1, 0), fac(2, 2), fac(3, 4)], name);
		expect(t).toEqual([{ text: "GPU rack", tone: "name", cx: 3, floor: 0 }]);
	});
	it("a gap, another floor or another type starts a new run", () => {
		const t = planTags([fac(1, 0), fac(2, 3), fac(3, 0, { floor: 1 }), fac(4, 9, { defId: "crac", floor: 2 })], name);
		expect(t.map((x) => x.text).sort()).toEqual(["Cooler", "GPU rack", "GPU rack", "GPU rack"]);
	});
	it("a status word replaces the name tag of its run", () => {
		const t = planTags([fac(1, 0), fac(2, 2, { status: "unpowered" })], name);
		expect(t).toEqual([{ text: "NO POWER", tone: "fault", cx: 3, floor: 0 }]);
		// a whole run sharing a word collapses to one tag
		const all = planTags([fac(1, 0, { status: "unpowered" }), fac(2, 2, { status: "unpowered" }), fac(3, 4, { status: "unpowered" })], name);
		expect(all).toEqual([{ text: "NO POWER", tone: "fault", cx: 3, floor: 0 }]);
	});
	it("drops a name tag that would overlap a neighbour, never a status word", () => {
		const long = (d: string): string => (d === "rack" ? "Air-cooled GPU rack" : "Row air handler AH-320");
		const t = planTags([fac(1, 0, { width: 4 }), fac(2, 4, { defId: "crac", width: 4 })], long);
		expect(t.map((x) => x.text)).toEqual(["Air-cooled GPU rack"]);
		const w = planTags([fac(1, 0, { width: 4 }), fac(2, 4, { status: "unpowered", defId: "crac", width: 4 })], name);
		expect(w.map((x) => x.text).sort()).toEqual(["GPU rack", "NO POWER"]);
	});
	it("quiet words ride on the name instead of adding a tag", () => {
		const t = planTags([fac(1, 0, { status: "idle" }), fac(2, 2, { status: "idle" })], name);
		expect(t).toEqual([{ text: "GPU rack · IDLE", tone: "name", cx: 2, floor: 0 }]);
		expect(planTags([fac(1, 0, { status: "idle" }), fac(2, 2)], name)[0].text).toBe("GPU rack");
	});
	it("skips unknown types and does not depend on input order", () => {
		expect(planTags([fac(1, 0, { defId: "mystery" })], name)).toEqual([]);
		expect(planTags([fac(2, 2), fac(1, 0)], name)).toEqual(planTags([fac(1, 0), fac(2, 2)], name));
	});
	it("fits long names to the width", () => {
		expect(fitName("Liquid-cooled GPU rack", 2).length).toBeLessThanOrEqual(12);
		expect(fitName("Short", 1)).toBe("Short");
	});
});

describe("hits", () => {
	it("tests a padded rect", () => {
		const r = { x: 10, y: 10, w: 10, h: 10 };
		expect(hits(15, 15, r)).toBe(true);
		expect(hits(8, 15, r)).toBe(true);
		expect(hits(5, 15, r)).toBe(false);
	});
});
