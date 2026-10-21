import { loadContent } from "@aitower/content";
import type { SimView } from "@aitower/sim";
import { describe, expect, it } from "vitest";
import { recommendedIds, suggestions } from "./suggest";

const content = loadContent();
const rack = (id: number, status = "ok", extra: Record<string, unknown> = {}) => ({ id, defId: "rack_air_gpu", floor: 1, x: id * 3, status, enabled: true, tempC: 40, ...extra });
function view(p: Partial<Record<keyof SimView, unknown>> = {}): SimView {
	return {
		tick: 3000,
		cash: 5_000_000,
		tier: 1,
		sandbox: false,
		spareParts: 3,
		jobs: [],
		offers: [],
		bots: [],
		lifts: [],
		powerNets: [],
		techResearched: [],
		researchPoints: 0,
		standingLog: [],
		uptime: 1,
		uptimeTarget: 0.95,
		facilities: [rack(1), rack(2)],
		...p,
	} as unknown as SimView;
}
const ids = (v: SimView) => suggestions(v, content).map((s) => s.id);

describe("suggestions", () => {
	it("a healthy tower has nothing to say", () => {
		expect(ids(view({ facilities: [rack(1, "idle")] }))).toEqual([]);
	});
	it("hot racks → air handler, focused on the rack", () => {
		const s = suggestions(view({ facilities: [rack(1, "throttled", { tempC: 86 })] }), content)[0];
		expect(s.id).toBe("hot");
		expect(s.action).toMatchObject({ kind: "build", defId: "crah_unit", focus: { x: 3, floor: 1 } });
		expect(s.recommend).toEqual(["crah_unit"]);
	});
	it("power short → generator; uptime below target → battery; no backup → battery", () => {
		expect(suggestions(view({ powerNets: [{ satisfaction: 0.6 }] }), content)[0]).toMatchObject({ id: "power", action: { defId: "genset" } });
		expect(suggestions(view({ uptime: 0.8 }), content).find((s) => s.id === "uptime")?.action).toMatchObject({ defId: "ups_battery" });
		const three = [rack(1), rack(2), rack(3)];
		expect(ids(view({ tick: 100, facilities: three }))).not.toContain("backup");
		expect(suggestions(view({ facilities: three }), content).find((s) => s.id === "backup")?.action).toMatchObject({ defId: "ups_battery" });
		const withBackup = [...three, { id: 9, defId: "ups_battery", floor: 1, x: 0, status: "ok", enabled: true, tempC: 20 }];
		expect(ids(view({ facilities: withBackup }))).not.toContain("backup");
	});
	it("uptime is not judged before a day has passed", () => {
		expect(ids(view({ tick: 100, uptime: 0.1 }))).not.toContain("uptime");
	});
	it("idle racks with an offer → contracts", () => {
		const s = suggestions(view({ facilities: [rack(1, "idle")], offers: [{ id: 1 }] }), content).find((x) => x.id === "idle");
		expect(s?.action).toMatchObject({ kind: "drawer", drawer: "contracts" });
	});
	it("broken racks with no parts → supplies; with parts, silent", () => {
		expect(suggestions(view({ spareParts: 0, facilities: [rack(1, "failed")] }), content)[0]).toMatchObject({ id: "parts", action: { kind: "supplies" } });
		expect(ids(view({ spareParts: 2, facilities: [rack(1, "failed")] }))).not.toContain("parts");
	});
	it("reputation falling → the latest cause, and the right panel", () => {
		const log = [{ tick: 2900, delta: -3, cause: "daily-uptime", detail: "Uptime 91.2% vs target 95%" }];
		const s = suggestions(view({ standingLog: log }), content).find((x) => x.id === "reputation");
		expect(s?.text).toMatch(/Uptime 91\.2%/);
		expect(s?.action).toMatchObject({ drawer: "insights" });
		// old losses and gains are ignored
		expect(ids(view({ standingLog: [{ tick: 10, delta: -3, cause: "job", detail: "x" }] }))).not.toContain("reputation");
		expect(ids(view({ standingLog: [{ tick: 2900, delta: 2, cause: "job", detail: "x" }] }))).not.toContain("reputation");
	});
	it("cash running low → slow down, but never in a sandbox", () => {
		expect(ids(view({ cash: 1000 }))).toContain("cash");
		expect(ids(view({ cash: 1000, sandbox: true }))).not.toContain("cash");
	});
	it("a rack on a floor with no lift → lift tool", () => {
		const f = { ...rack(1), floor: 3 };
		const anchor = { id: 7, defId: "bot_charger", floor: 1, x: 0, status: "ok", enabled: true, tempC: 20 };
		expect(suggestions(view({ facilities: [f, anchor] }), content).find((s) => s.id === "lift")?.action).toMatchObject({ kind: "lift" });
	});
	it("nothing researched but points to spend → research", () => {
		const s = suggestions(view({ researchPoints: 1e6 }), content).find((x) => x.id === "research");
		expect(s?.action.kind).toBe("research");
	});
	it("close to the next level → build more compute", () => {
		const need = content.balance.tiers.pflops[1];
		const per = content.facilities.rack_air_gpu.rack?.pflops ?? 20;
		const n = Math.ceil((need * 0.7) / per);
		const s = suggestions(view({ facilities: Array.from({ length: n }, (_, i) => rack(i + 1, "idle")) }), content).find((x) => x.id === "level");
		expect(s?.action).toMatchObject({ kind: "build" });
	});
	it("problems rank before nice-to-haves, and recommendations follow the ranking", () => {
		const list = suggestions(view({ facilities: [rack(1, "throttled", { tempC: 86 }), rack(2, "idle")], offers: [{ id: 1 }], uptime: 0.5 }), content);
		expect(list[0].id).toBe("hot");
		expect(recommendedIds(list)).toEqual(["crah_unit", "ups_battery"]);
	});
	it("each suggestion has an owner advisor and a Handbook link; the hot-rack text leads with the number", () => {
		const list = suggestions(view({ facilities: [rack(1, "throttled", { tempC: 86 })], powerNets: [{ satisfaction: 0.6 }] }), content);
		for (const s of list) expect(["cass", "bea", "mel", "lucien"]).toContain(s.advisor);
		const hot = list.find((s) => s.id === "hot");
		expect(hot?.advisor).toBe("cass");
		expect(hot?.text).toMatch(/^86 °C in a rack/);
		expect(hot?.links[0].entry).toBe("ch:heat");
		expect(list.find((s) => s.id === "power")?.advisor).toBe("bea");
	});
});
