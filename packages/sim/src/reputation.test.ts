/** M5b: fair, explained reputation (daily scaling, standing log, uptime target) and the bigger lot. */
import { loadContent } from "@aitower/content";
import { describe, expect, it } from "vitest";
import { changeStanding, dailyDelta } from "./ministry/standing";
import { createSim } from "./index";
import { type SimImpl, simFromSnapshot } from "./sim";
import { failRack } from "./reliability/reliabilityStep";
import { newSim, run } from "./test/fixture";
import { acceptSpec, farmContent, training } from "./test/m2b";
import type { SimEvent } from "./api";

describe("daily reputation", () => {
	const st = loadContent().balance.standing;

	it("meeting the target is +1; a near miss -1; a big miss -3; in between it scales", () => {
		expect(dailyDelta(st, 0.95, 0.95)).toBe(1);
		expect(dailyDelta(st, 0.99, 0.95)).toBe(1);
		expect(dailyDelta(st, 0.94, 0.95)).toBe(-1);
		expect(dailyDelta(st, 0.92, 0.95)).toBe(-2);
		expect(dailyDelta(st, 0.9, 0.95)).toBe(-3);
		expect(dailyDelta(st, 0.2, 0.95)).toBe(-3);
	});

	it("shipped numbers: targets 0/.93/.95/.96/.97, a failed job costs 2", () => {
		const b = loadContent().balance;
		expect(b.tiers.uptime).toEqual([0, 0.93, 0.95, 0.96, 0.97]);
		expect(b.standing.jobFailed).toBe(-2);
		expect(st.dailyNearMiss).toBe(-1);
	});
});

describe("standing log", () => {
	const content = () => farmContent();

	it("records daily uptime, job and audit-free changes with a cause, and the view exposes the target", () => {
		const sim = newSim(content(), "farm", 1);
		expect(sim.view().standingLog).toEqual([]);
		expect(sim.view().uptimeTarget).toBe(0);
		acceptSpec(sim, training());
		run(sim, 1440);
		const log = sim.view().standingLog;
		expect(log.map((e) => e.cause)).toEqual(["job", "daily-uptime"]);
		expect(log[0]).toMatchObject({ delta: 1, detail: expect.stringContaining("finished") });
		expect(log[1]).toMatchObject({ delta: 1, detail: expect.stringContaining("met") });
		expect(log[1].tick).toBeGreaterThan(log[0].tick);
	});

	it("a missed daily target is logged with the numbers", () => {
		const sim = newSim(farmContent({ tiers: { pflops: [0, 1e9], uptime: [0, 0.95], reward: [0, 0] } }), "farm", 1);
		sim.state.tier = 2;
		expect(sim.view().uptimeTarget).toBe(0.95);
		for (const f of sim.state.facilities) if (f.defId.startsWith("rack_")) failRack(sim.state, f, []);
		run(sim, 1440);
		expect(sim.view().standingLog.at(-1)).toMatchObject({ cause: "daily-uptime", delta: -3, detail: expect.stringMatching(/fell short of the 95\.0% target/) });
	});

	it("keeps only the last 20, skips zero changes, survives a save, and a save without a log loads empty", () => {
		const c = content();
		const sim = newSim(c, "farm", 1);
		const ev: SimEvent[] = [];
		for (let i = 0; i < 30; i++) changeStanding(sim.state, i % 2 ? 1 : -1, ev, "job", `n${i}`);
		changeStanding(sim.state, 0, ev, "job", "nothing");
		const log = sim.view().standingLog;
		expect(log).toHaveLength(20);
		expect(log[0].detail).toBe("n10");
		expect(log.at(-1)?.detail).toBe("n29");
		const snap = JSON.parse(JSON.stringify(sim.snapshot()));
		expect((simFromSnapshot(c, snap) as SimImpl).view().standingLog).toEqual(log);
		snap.state.standingLog = undefined;
		expect((simFromSnapshot(c, snap) as SimImpl).view().standingLog).toEqual([]);
	});
});

describe("the bigger lot", () => {
	it("every scenario is at least 40 floors up and 5 down; the sandbox is larger", () => {
		const c = loadContent();
		for (const s of Object.values(c.scenarios)) {
			expect(s.floorMax).toBeGreaterThanOrEqual(40);
			expect(s.floorMin).toBeLessThanOrEqual(-5);
		}
		expect(c.scenarios.sandbox.floorMax).toBeGreaterThan(c.scenarios.starter.floorMax);
	});

	it("the starter lot is -5..40 and accepts slab on its top and bottom floors", () => {
		const sim = createSim(loadContent(), "starter", 1);
		const v = sim.view();
		expect([v.floorMin, v.floorMax]).toEqual([-5, 40]);
		expect(v.slab.length).toBe(v.width * 46);
		const reasonAt = (floor: number): string => {
			const r = sim.canBuild({ type: "buildSlab", floor, x0: 0, x1: 1 });
			return r.ok ? "" : r.reason;
		};
		expect(reasonAt(-5)).toBe(""); // basement 5 is inside the lot
		expect(reasonAt(40)).toMatch(/no slab below/); // inside the lot, just not stacked yet
		expect(reasonAt(41)).not.toMatch(/no slab below/); // outside
	});
});
