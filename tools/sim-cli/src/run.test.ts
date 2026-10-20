import { describe, expect, it } from "vitest";
import { loadContent } from "@aitower/content";
import { createSim, simFromSnapshot, TICKS_PER_DAY } from "@aitower/sim";
import { makeContent } from "../../../packages/sim/src/test/fixture";
import { allAutomation, AUTO_RESERVE, bestMemoChoice, formatTable, nextTech, PERMISSIVE_CLERK, runHeadless } from "./run";

describe("sim-cli runHeadless", () => {
	it("produces one row per day and a deterministic hash", () => {
		const a = runHeadless(makeContent(), "starter", 2, 5);
		const b = runHeadless(makeContent(), "starter", 2, 5);
		expect(a.rows).toHaveLength(2);
		expect(a.hash).toBe(b.hash);
		expect(a.rows[1].day).toBe(1);
		const table = formatTable(a.rows);
		expect(table.split("\n")).toHaveLength(4);
		expect(table).toContain("PUE");
	});

	it("real content: the starter run stays profitable and finite (seed 1, 15 days)", () => {
		const { rows } = runHeadless(loadContent(), "starter", 15, 1);
		expect(rows).toHaveLength(15);
		for (const r of rows) {
			expect(Number.isFinite(r.cash)).toBe(true);
			expect(Number.isFinite(r.pue)).toBe(true);
			expect(r.uptime).toBeGreaterThan(0.5);
		}
		expect(rows[14].cash).toBeGreaterThan(rows[0].cash);
	});

	it("real content: every day's save validates, reloads to the same hash and keeps running identically", () => {
		const content = loadContent();
		const a = createSim(content, "starter", 2);
		for (let day = 0; day < 4; day++) {
			for (let t = 0; t < TICKS_PER_DAY; t++) {
				for (const e of a.step()) if (e.type === "contractOffered") a.submit({ type: "acceptContract", contractId: e.contractId });
			}
			const b = simFromSnapshot(content, JSON.parse(JSON.stringify(a.snapshot())));
			expect(b.hash(), `day ${day}`).toBe(a.hash());
		}
		const b = simFromSnapshot(content, JSON.parse(JSON.stringify(a.snapshot())));
		for (let t = 0; t < 300; t++) {
			a.step();
			b.step();
		}
		expect(b.hash()).toBe(a.hash());
	});
});

describe("sim-cli memo policy", () => {
	it("bestMemoChoice picks the best direct cash outcome, then standing, then the first listed", () => {
		const c = makeContent();
		const choice = (id: string, effects: { type: "cash" | "standing"; amount: number }[]) => ({ id, label: id, hint: "", outcome: "", effects });
		c.events = [
			{
				id: "e",
				category: "ministry",
				title: "t",
				body: "b",
				weight: 1,
				minTier: 1,
				cooldownDays: 0,
				timeoutTicks: 100,
				defaultChoice: "x",
				choices: [choice("x", [{ type: "cash", amount: -10 }]), choice("y", [{ type: "cash", amount: 50 }, { type: "standing", amount: -5 }]), choice("z", [{ type: "cash", amount: 50 }, { type: "standing", amount: 1 }]), choice("w", [{ type: "cash", amount: 50 }, { type: "standing", amount: 1 }])],
			},
		];
		expect(bestMemoChoice(c, "e")).toBe("z");
		expect(bestMemoChoice(c, "nope")).toBeNull();
	});

	it("real content: memos arrive and are resolved by the auto-player; the run is deterministic and reports standing", () => {
		const a = runHeadless(loadContent(), "starter", 8, 3);
		const b = runHeadless(loadContent(), "starter", 8, 3);
		expect(a.hash).toBe(b.hash);
		expect(a.rows.at(-1)?.memos).toBeGreaterThan(3);
		for (const r of a.rows) {
			expect(r.standing).toBeGreaterThanOrEqual(0);
			expect(r.standing).toBeLessThanOrEqual(100);
		}
		expect(formatTable(a.rows)).toContain("standing");
		expect(formatTable(a.rows)).toContain("corruption");
		for (const r of a.rows) expect(r.corruption).toBe(0);
	});
});

describe("sim-cli research policy", () => {
	it("nextTech: the clerk first, then the cheapest open node; locked nodes are skipped", () => {
		const c = makeContent();
		const sim = createSim(c, "starter", 1);
		const v = sim.view();
		expect(nextTech(c, v)).toBe("t_clerk");
		const done = { ...v, techResearched: ["t_clerk"], clerk: { ...v.clerk, unlocked: true } };
		// Open nodes now: perks and gating nodes (cost 1 first); t_tier2 needs Clearance 2.
		const next = nextTech(c, done);
		expect(next).not.toBe("t_tier2");
		expect(c.tech.find((t) => t.id === next)?.cost).toBe(1);
		const all = { ...done, techResearched: c.tech.map((t) => t.id) };
		expect(nextTech(c, all)).toBeNull();
	});

	it("the auto-player researches, switches the clerk on, never borrows, and reports RP / techs / taxes", () => {
		const c = makeContent();
		c.balance.research.pointsPerJob = 50;
		const { rows } = runHeadless(c, "starter", 6, 2);
		expect(rows.at(-1)?.techs).toBeGreaterThan(1);
		const sim = createSim(c, "starter", 2);
		expect(PERMISSIVE_CLERK.enabled).toBe(true);
		expect(sim.view().loan.principal).toBe(0);
		const table = formatTable(rows);
		expect(table).toContain("RP");
		expect(table).toContain("techs");
		expect(table).toContain("taxes");
		expect(table.split("\n")[0].split(/\s+/)).toContain("taxes");
	});
});

const foremanNode = { id: "foreman", name: "Foreman", description: "Builds for you.", branch: "administration" as const, minTier: 1, cost: 30, requires: [], effects: [{ type: "feature" as const, feature: "foreman" as const }] };

describe("sim-cli --auto", () => {
	it("nextTech: with auto the Foreman's node follows the clerk's; without it the Foreman is ignored", () => {
		const c = makeContent();
		const v = createSim(c, "starter", 1).view();
		expect(nextTech(c, v, true)).toBe("t_clerk");
		const done = { ...v, techResearched: ["t_clerk"], clerk: { ...v.clerk, unlocked: true } };
		expect(nextTech(c, done, true)).toBe("t_foreman");
		expect(nextTech(c, done, false)).not.toBe("t_foreman");
		const both = { ...done, techResearched: ["t_clerk", "t_foreman"], automation: { ...done.automation, foremanUnlocked: true } };
		expect(nextTech(c, both, true)).not.toBe("t_foreman");
	});

	it("allAutomation switches every order on and keeps the documented limits", () => {
		const a = allAutomation(true);
		expect([a.research.enabled, a.parts.enabled, a.bots.enabled, a.foreman.enabled]).toEqual([true, true, true, true]);
		expect(a.foreman.reserve).toBe(AUTO_RESERVE);
		expect(allAutomation(false).foreman.enabled).toBe(false);
	});

	it("is deterministic, researches the Foreman, and lets the standing orders build (fixture content)", { timeout: 60_000 }, () => {
		const make = () => {
			const c = makeContent();
			c.balance.research.pointsPerJob = 200;
			return c;
		};
		const a = runHeadless(make(), "starter", 6, 4, true);
		const b = runHeadless(make(), "starter", 6, 4, true);
		expect(a.hash).toBe(b.hash);
		expect(a.auto).toEqual(b.auto);
		expect(a.auto.parts + a.auto.bots + a.auto.built).toBeGreaterThan(0);
		expect(formatTable(a.rows, true).split("\n")[0]).toContain("built");
		expect(formatTable(a.rows)).not.toContain("built");
		const manual = runHeadless(make(), "starter", 6, 4, false);
		expect(manual.auto).toEqual({ built: 0, parts: 0, bots: 0 });
		expect(manual.hash).not.toBe(a.hash);
	});

	it("real content with a Foreman node: a 30-day starter run grows and stays solvent", { timeout: 120_000 }, () => {
		const c = loadContent();
		c.tech.push(foremanNode);
		const { rows, auto } = runHeadless(c, "starter", 30, 1, true);
		expect(rows).toHaveLength(30);
		for (const r of rows) {
			expect(Number.isFinite(r.cash)).toBe(true);
			expect(r.cash).toBeGreaterThan(0);
			expect(r.gameOver).toBeNull();
		}
		expect(auto.built).toBeGreaterThan(5);
		expect(rows[29].racks).toBeGreaterThan(rows[0].racks + 5);
		expect(rows[29].pflops).toBeGreaterThan(rows[0].pflops * 3);
		expect(rows[29].tier).toBeGreaterThanOrEqual(2);
		expect(rows[29].built).toBe(auto.built);
	});

	it("real content as shipped (no Foreman node yet): --auto still runs; parts and research are automated, nothing is built", { timeout: 60_000 }, () => {
		const { rows, auto } = runHeadless(loadContent(), "starter", 6, 1, true);
		expect(auto.built).toBe(0);
		expect(rows.at(-1)?.techs).toBeGreaterThan(0);
	});
});
