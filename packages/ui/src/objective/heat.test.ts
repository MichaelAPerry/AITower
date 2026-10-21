import { loadContent } from "@aitower/content";
import type { FacilityView, SimView } from "@aitower/sim";
import { describe, expect, it } from "vitest";
import { suggestions } from "../assistant/suggest";
import { rackProblem } from "./diagnose";
import { HOT_CLEAR_TICKS, HOT_SUSTAIN_TICKS, initialHeatWatch, rackIsHot, watchHeat } from "./heat";

const content = loadContent();
const okC = content.balance.thermal.okC;
const rack = (status: string, tempC: number, id = 1): FacilityView => ({ id, defId: "rack_air_gpu", floor: 1, x: 3, status, enabled: true, tempC }) as unknown as FacilityView;
const view = (tick: number, ...fs: FacilityView[]): SimView => ({ tick, cash: 9e6, tier: 1, sandbox: false, memos: [], spareParts: 3, jobs: [], offers: [], bots: [], lifts: [], powerNets: [], techResearched: [], researchPoints: 0, standingLog: [], uptime: 1, uptimeTarget: 0.95, facilities: fs, coolantNets: [] }) as unknown as SimView;

describe("one definition of too hot", () => {
	it("agrees with the sim: throttling means above okC, and a hair above it is not yet hot", () => {
		expect(rackIsHot(rack("throttled", okC + 8), content)).toBe(true);
		expect(rackIsHot(rack("throttled", okC + 0.2), content)).toBe(false); // slowed by a fraction of a percent
		expect(rackIsHot(rack("ok", okC + 5), content)).toBe(false); // the sim says it is not throttled
		expect(rackIsHot(rack("ok", 40), content)).toBe(false);
	});
	it("a tripped rack that has cooled off is recovering, not hot", () => {
		expect(rackIsHot(rack("tripped", okC + 15), content)).toBe(true);
		expect(rackIsHot(rack("tripped", 55), content)).toBe(false);
		expect(rackProblem(view(1, rack("tripped", 55)), content, rack("tripped", 55))).toMatch(/cooled down/);
	});
	it("a rack that is cool now never fires the tip, even when its status is stale", () => {
		expect(suggestions(view(3000, rack("tripped", 50)), content).map((s) => s.id)).not.toContain("hot");
		expect(suggestions(view(3000, rack("throttled", 90)), content).map((s) => s.id)).toContain("hot");
	});
});

describe("heat debounce", () => {
	const run = (temps: (number | null)[]) => {
		let w = initialHeatWatch();
		const out: boolean[] = [];
		temps.forEach((t, i) => {
			w = watchHeat(w, view(100 + i, rack(t === null ? "ok" : "throttled", t ?? 40)), content);
			out.push(w.confirmed.has(1));
		});
		return out;
	};
	it("a short blip never confirms", () => {
		const hot = Array.from({ length: 8 }, () => okC + 9);
		const cool = Array.from({ length: 40 }, () => null);
		expect(run([...hot, ...cool]).some(Boolean)).toBe(false);
	});
	it("confirms after the heat has lasted, rides out a short dip, and clears once it stays gone", () => {
		const hot = (n: number) => Array.from({ length: n }, () => okC + 9);
		const gone = (n: number) => Array.from({ length: n }, () => null);
		const seq = run([...hot(HOT_SUSTAIN_TICKS + 1), ...gone(3), ...hot(2), ...gone(HOT_CLEAR_TICKS + 2)]);
		expect(seq[HOT_SUSTAIN_TICKS]).toBe(true);
		expect(seq[HOT_SUSTAIN_TICKS + 3]).toBe(true); // 3-tick dip: still confirmed
		expect(seq[seq.length - 1]).toBe(false);
	});
	it("a blip that is not confirmed stays out of the tips even though it is hot right now", () => {
		const w = watchHeat(initialHeatWatch(), view(5, rack("throttled", okC + 9)), content);
		expect(suggestions(view(5, rack("throttled", okC + 9)), content, w.confirmed).map((s) => s.id)).not.toContain("hot");
	});
});
