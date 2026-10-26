/** Regressions for the playtest bugs listed in HANDOFF.md (Foreman stalls, docks unused, dockless bots, liquid racks and air handlers). */
import { loadContent } from "@aitower/content";
import { describe, expect, it } from "vitest";
import { expandDown, expandUp } from "./automation/expand";
import type { TickCtx } from "./core/context";
import { cellIdx } from "./core/grid";
import { type SimImpl, createSim } from "./sim";
import { addBot, addFacility, findChargerWithSpace, removeFacility } from "./world/entities";

const quiet = () => {
	const c = loadContent();
	c.events = c.events.filter((e) => e.category !== "story");
	return c;
};
const sim = (): SimImpl => createSim(quiet(), "starter", 1) as SimImpl;
const ctx = (s: SimImpl): TickCtx => ({ state: s.state, content: s.content, events: [], scratch: (s as unknown as { scratch: TickCtx["scratch"] }).scratch });
const always = () => true;

describe("Foreman expansion", () => {
	it("adds a floor over the top one, powers it end to end and extends the lift to it", () => {
		const s = sim();
		s.state.cash = 1e9;
		const top = 1;
		expect(expandUp(ctx(s), always)).toBe(`Added floor ${top + 1}`);
		for (let x = 4; x <= 43; x++) {
			const i = cellIdx(s.state, x, top + 1);
			expect(s.state.slab[i], `slab x=${x}`).toBe(1);
			expect(s.state.power[i], `power x=${x}`).toBe(1);
		}
		expect(s.state.lifts.some((l) => l.floorMin <= top + 1 && top + 1 <= l.floorMax)).toBe(true);
	});

	it("digs a basement for power the same way, and respects the reserve", () => {
		const s = sim();
		s.state.cash = 1e9;
		expect(expandDown(ctx(s), always)).toBe("Dug basement -2");
		expect(s.state.lifts.some((l) => l.floorMin <= -2)).toBe(true);
		const poor = sim();
		expect(expandUp(ctx(poor), () => false)).toBeNull();
	});
});

describe("bots and docks", () => {
	it("new bots go to the dock with the most free places", () => {
		const s = sim();
		const first = s.state.facilities.find((f) => f.defId === "bot_charger");
		expect(first).toBeDefined();
		s.state.cash = 1e9;
		expect(s.submit({ type: "place", defId: "bot_charger", floor: 1, x: 30 })).toEqual({ ok: true });
		s.step();
		const second = s.state.facilities.find((f) => f.defId === "bot_charger" && f.id !== first?.id);
		// The first dock already holds the starting bot, so the empty one wins.
		expect(findChargerWithSpace(s.state, s.content)).toBe(second?.id);
	});

	it("a bot whose dock is demolished with no other dock is sold back at half price", () => {
		const s = sim();
		const dock = s.state.facilities.find((f) => f.defId === "bot_charger");
		if (!dock) throw new Error("no dock");
		const bots = s.state.bots.length;
		const cash = s.state.cash;
		removeFacility(s.state, s.content, dock);
		expect(bots).toBe(1);
		expect(s.state.bots).toHaveLength(0);
		expect(s.state.cash).toBeGreaterThan(cash);
	});

	it("a fresh repair goes to the nearest idle bot, not the first dock's", () => {
		const s = sim();
		const far = addBot(s.state, "rover", 0, 2, s.state.bots[0].homeId);
		const near = s.state.bots[0];
		const rack = s.state.facilities.find((f) => f.defId === "rack_air_gpu");
		if (!rack) throw new Error("no rack");
		// Put the starting bot right under the rack and the new (lower-priority id) one far away; both idle.
		near.floor = rack.floor;
		near.x = rack.x;
		far.floor = 0;
		far.x = 2;
		s.state.workOrders.push({ id: s.state.nextId.workOrder++, facilityId: rack.id, botId: -1, createdAt: s.state.tick, attempts: 0, retryAt: 0, retryRev: 0 });
		s.step();
		const wo = s.state.workOrders.at(-1);
		expect(wo?.botId).toBe(near.id);
	});
});

describe("liquid racks and air handlers", () => {
	it("a liquid rack with no coolant is not handed an air handler", () => {
		const c = quiet();
		const s = createSim(c, "starter", 1) as SimImpl;
		s.state.cash = 1e9;
		s.state.techResearched.push("chilled_loop", "works_foreman");
		s.state.tier = 2;
		s.invalidateProjection();
		const r = addFacility(s.state, s.content, "rack_dlc_gpu", 1, 20);
		r.tempC = 99;
		r.noCoolant = true;
		const crahs = s.state.facilities.filter((f) => f.defId.startsWith("crah")).length;
		s.state.automation.foreman = { ...s.state.automation.foreman, enabled: true, cooling: true, power: false, racks: false, reserve: 0 };
		for (let i = 0; i < 60; i++) {
			r.tempC = 99;
			r.noCoolant = true;
			s.step();
		}
		expect(s.state.facilities.filter((f) => f.defId.startsWith("crah")).length).toBe(crahs);
	});
});
