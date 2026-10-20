import { describe, expect, it } from "vitest";
import { loadContent, validateContent } from "./load";
import type { ContentDB } from "./schema";

const REQUIRED_FACILITIES = [
	"rack_air_gpu",
	"rack_dlc_gpu",
	"rack_storage",
	"crah_unit",
	"chiller",
	"cdu",
	"grid_tie",
	"genset",
	"ups_battery",
	"parts_depot",
	"bot_charger",
];

describe("loadContent", () => {
	it("loads and validates the bundled content", () => {
		const db = loadContent();
		expect(validateContent(db)).toEqual([]);
		for (const id of REQUIRED_FACILITIES) expect(db.facilities[id]?.id).toBe(id);
		expect(db.bots.rover).toBeDefined();
		expect(db.scenarios.starter).toBeDefined();
		expect(db.clients.length).toBeGreaterThanOrEqual(12);
		expect(typeof db.generateContract).toBe("function");
	});

	it("returns independent copies", () => {
		const a = loadContent();
		a.facilities.rack_air_gpu.cost = 1;
		a.balance.energyPriceByHour.pop();
		const b = loadContent();
		expect(b.facilities.rack_air_gpu.cost).toBe(400000);
		expect(b.balance.energyPriceByHour).toHaveLength(24);
	});

	it("has the specified starter layout", () => {
		const s = loadContent().scenarios.starter;
		expect(s.width).toBe(48);
		expect([s.floorMin, s.floorMax]).toEqual([-5, 40]);
		expect(s.lifts).toEqual([{ x: 24, floorMin: -1, floorMax: 1 }]);
		const racks = s.facilities.filter((f) => f.defId === "rack_air_gpu");
		expect(racks.map((r) => r.x)).toEqual([6, 8, 10, 12]);
		expect(racks.every((r) => r.floor === 1)).toBe(true);
		expect(s.facilities).toContainEqual({ defId: "grid_tie", floor: -1, x: 6 });
	});

	it("matches the economy guard-rails", () => {
		const db = loadContent();
		const b = db.balance;
		const avg = b.energyPriceByHour.reduce((s, m) => s + m, 0) / 24;
		expect(avg).toBeGreaterThan(0.95);
		expect(avg).toBeLessThan(1.1);
		// Night cheaper than the evening peak.
		expect(Math.max(...b.energyPriceByHour.slice(0, 5))).toBeLessThan(Math.min(...b.energyPriceByHour.slice(17, 21)));
		// DLC racks give more PFLOPS per kW than air racks.
		const air = db.facilities.rack_air_gpu.rack!;
		const dlc = db.facilities.rack_dlc_gpu.rack!;
		expect(dlc.pflops / dlc.powerKw).toBeGreaterThan(air.pflops / air.powerKw);
		expect(db.facilities.chiller.cost + db.facilities.cdu.cost).toBe(1_500_000);
	});
});

describe("validateContent", () => {
	const broken = (mutate: (db: ContentDB) => void): string[] => {
		const db = loadContent();
		mutate(db);
		return validateContent(db);
	};

	it("flags id/key mismatches and missing specs", () => {
		expect(broken((db) => (db.facilities.chiller.id = "nope")).join()).toMatch(/does not match key/);
		expect(broken((db) => delete db.facilities.genset.power).join()).toMatch(/requires a "power" spec/);
		expect(broken((db) => (db.facilities.cdu.category = "rack")).join()).toMatch(/category/);
	});

	it("flags facilities narrower than their kind's art", () => {
		expect(broken((db) => (db.facilities.chiller.width = 3)).join()).toMatch(/chiller must be at least 4 tiles wide/);
		expect(broken((db) => (db.facilities.cdu.width = 1)).join()).toMatch(/cdu must be at least 2 tiles wide/);
	});

	it("flags bad numbers and array lengths", () => {
		expect(broken((db) => (db.facilities.rack_air_gpu.rack!.powerKw = -1)).join()).toMatch(/powerKw/);
		expect(broken((db) => db.balance.energyPriceByHour.push(1)).join()).toMatch(/24 entries/);
		expect(broken((db) => db.balance.tiers.reward.pop()).join()).toMatch(/differ in length/);
		expect(broken((db) => (db.balance.thermal.okC = 99)).join()).toMatch(/okC < throttleC/);
	});

	it("flags duplicate clients", () => {
		expect(broken((db) => db.clients.push({ ...db.clients[0] })).join()).toMatch(/duplicate id/);
	});

	it("flags scenario placement problems", () => {
		const s = (db: ContentDB) => db.scenarios.starter;
		expect(broken((db) => s(db).facilities.push({ defId: "ghost", floor: 0, x: 0 })).join()).toMatch(/unknown facility/);
		expect(broken((db) => s(db).facilities.push({ defId: "crah_unit", floor: 1, x: 7 })).join()).toMatch(/overlaps facilities/);
		expect(broken((db) => s(db).facilities.push({ defId: "cdu", floor: 0, x: 23 })).join()).toMatch(/lift shaft/);
		expect(broken((db) => s(db).facilities.push({ defId: "rack_storage", floor: 0, x: 47 })).join()).toMatch(/does not fit/);
		expect(broken((db) => s(db).facilities.push({ defId: "grid_tie", floor: 1, x: 30 })).join()).toMatch(/maxFloor/);
		expect(broken((db) => s(db).facilities.push({ defId: "rack_dlc_gpu", floor: 0, x: 10 })).join()).toMatch(/coolant conduit/);
		expect(broken((db) => s(db).slabs.push([3, 4, 6])).join()).toMatch(/no support/);
	});
});
