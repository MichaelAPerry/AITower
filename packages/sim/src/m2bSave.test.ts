import type { EventDef } from "@aitower/content";
import { describe, expect, it } from "vitest";
import { type SimImpl, SNAPSHOT_VERSION, simFromSnapshot } from "./sim";
import { exec, newSim, run } from "./test/fixture";
import { addBot } from "./world/entities";
import { cmdSetClerk, farmContent, giveRp, pushOffer, training } from "./test/m2b";

// biome-ignore lint/suspicious/noExplicitAny: raw JSON surgery on saves
type Raw = Record<string, any>;

const scripted: EventDef = {
	id: "scr", category: "ministry", title: "t", body: "b", weight: 1, minTier: 1, cooldownDays: 0, scriptedDay: 1, advisor: "cass", recommended: "a",
	choices: [{ id: "a", label: "A", hint: "", outcome: "", effects: [] }],
};

const content = () =>
	farmContent(
		{
			economy: { slaPenaltyFactor: 1.5, maxOffers: 3, offerIntervalTicks: 120, offerExpiryTicks: 900 },
			audit: { periodDays: 2, cashShareByGrade: [0.05, 0.02, 0, -0.02, -0.05] },
			tax: { profitShare: 0.1 },
			events: { intervalTicks: 700, graceTicks: 600 },
		},
		[scripted, { ...scripted, id: "rnd", scriptedDay: undefined, weight: 3 }],
	);

/** A busy session: research the clerk, borrow, let the clerk work, run several audits. */
function play(seed: number, days: number, onDay?: (sim: SimImpl, day: number) => void): SimImpl {
	const sim = newSim(content(), "farm", seed);
	sim.step();
	giveRp(sim, 30);
	exec(sim, { type: "research", techId: "t_clerk" }, { type: "research", techId: "p_upkeep" }, { type: "takeLoan", amount: 500_000 });
	exec(sim, cmdSetClerk());
	for (let d = 0; d < days; d++) {
		for (let t = 0; t < 1440; t++) {
			for (const e of sim.step()) if (e.type === "decisionIssued") sim.submit({ type: "resolveDecision", decisionId: e.decisionId, choiceId: "a" });
		}
		onDay?.(sim, d);
	}
	return sim;
}

describe("determinism with research, clerk, loans, audits and scripted events", () => {
	it("same seed ⇒ same hash; different seed ⇒ different; the run actually exercised the features", () => {
		const a = play(7, 5);
		const b = play(7, 5);
		expect(a.hash()).toBe(b.hash());
		expect(play(8, 5).hash()).not.toBe(a.hash());
		expect(a.state.clerkAccepted).toBeGreaterThan(2);
		expect(a.state.reports.length).toBe(2);
		expect(a.state.stats.jobsCompleted).toBeGreaterThan(0);
		expect(a.state.today.fees + a.state.ledger.reduce((s, l) => s + l.fees, 0)).toBeGreaterThan(0);
		expect(a.state.scriptedIssued).toEqual(["scr"]);
		expect(a.state.stats.decisionsMade).toBeGreaterThan(0);
	});

	it("every day's save reloads to the identical hash and continues identically", () => {
		play(5, 5, (sim) => {
			const twin = simFromSnapshot(sim.content, JSON.parse(JSON.stringify(sim.snapshot()))) as SimImpl;
			expect(twin.hash()).toBe(sim.hash());
		});
		const a = play(5, 2);
		const twin = simFromSnapshot(a.content, JSON.parse(JSON.stringify(a.snapshot()))) as SimImpl;
		run(a, 2000);
		run(twin, 2000);
		expect(twin.hash()).toBe(a.hash());
		expect(twin.view().reports).toEqual(a.view().reports);
	});
});

describe("snapshot v4", () => {
	it("migrates a v3 save with sane defaults, including the ledger fields on every stored day, and keeps running", () => {
		const sim = newSim(content(), "farm", 4);
		addBot(sim.state, "rover", 0, 5, -1);
		run(sim, 3 * 1440);
		pushOffer(sim, training());
		const snap = JSON.parse(JSON.stringify(sim.snapshot())) as { version: number; state: Raw };
		expect(snap.version).toBe(SNAPSHOT_VERSION);
		snap.version = 3;
		const s = snap.state;
		for (const k of ["researchPoints", "techResearched", "clerkPolicy", "clerkAccepted", "loanPrincipal", "reports", "audit", "stats", "scriptedIssued"]) delete s[k];
		for (const d of [...s.ledger, s.today]) for (const k of ["taxes", "interest", "fees"]) delete d[k];
		for (const j of s.jobs) delete j.clerk;
		for (const b of s.bots) delete b.parts;
		s.bots.forEach((b: Raw) => {
			b.carrying = true;
		});
		expect(s.ledger.length).toBeGreaterThan(2);
		const old = simFromSnapshot(sim.content, snap as never) as SimImpl;
		expect(old.state).toMatchObject({
			researchPoints: 0,
			techResearched: [],
			clerkPolicy: { enabled: false, kinds: ["training", "finetune", "inference"], minPayPerPflopHour: 0, maxPenalty: 0, allowLiquid: true },
			clerkAccepted: 0,
			loanPrincipal: 0,
			reports: [],
			scriptedIssued: [],
		});
		for (const d of [...old.state.ledger, old.state.today]) expect(d).toMatchObject({ taxes: 0, interest: 0, fees: 0 });
		expect(old.state.bots).toHaveLength(1);
		expect(old.state.bots[0].parts).toBe(1);
		expect(old.state.stats).toEqual({ revenue: 0, pflopHours: 0, jobsCompleted: 0, jobsFailed: 0, peakPflops: 0, facilitiesBuilt: 0, componentFailures: 0, repairs: 0, decisionsMade: 0, researchPointsEarned: 0 });
		expect(old.view().loan).toMatchObject({ principal: 0, max: 2_000_000 });
		expect(old.snapshot().version).toBe(SNAPSHOT_VERSION);
		run(old, 3 * 1440); // reaches an audit
		expect(old.state.reports.length).toBeGreaterThan(0);
		expect(() => simFromSnapshot(old.content, JSON.parse(JSON.stringify(old.snapshot())))).not.toThrow();
	});

	describe("validation", () => {
		const sim = play(5, 2);
		addBot(sim.state, "rover", 0, 5, -1);
		const json = JSON.stringify(sim.snapshot());
		const base = () => JSON.parse(json) as { version: number; state: Raw };
		const bad = (mutate: (s: Raw) => void, re: RegExp) => {
			const snap = base();
			mutate(snap.state);
			expect(() => simFromSnapshot(content(), snap as never)).toThrow(re);
		};
		it("accepts the untouched snapshot", () => {
			expect(() => simFromSnapshot(content(), base() as never)).not.toThrow();
		});
		it("rejects bad research, clerk, loan, audit and stats state", () => {
			bad((s) => { s.techResearched.push(s.techResearched[0]); }, /^Invalid save: .*repeats/);
			bad((s) => { s.techResearched = [7]; }, /^Invalid save: techResearched\[0\]/);
			bad((s) => { s.researchPoints = -1; }, /^Invalid save: researchPoints/);
			bad((s) => { delete s.researchPoints; }, /^Invalid save: state\.researchPoints/);
			bad((s) => { s.loanPrincipal = -5; }, /^Invalid save: loanPrincipal/);
			bad((s) => { s.clerkPolicy.kinds = []; }, /^Invalid save: clerkPolicy\.kinds/);
			bad((s) => { s.clerkPolicy.kinds = ["mining"]; }, /^Invalid save: clerkPolicy\.kinds/);
			bad((s) => { s.clerkPolicy.maxPenalty = -1; }, /^Invalid save: clerkPolicy/);
			bad((s) => { s.clerkPolicy.enabled = 1; }, /^Invalid save: clerkPolicy\.enabled/);
			bad((s) => { s.reports[0].grade = "Z"; }, /^Invalid save: reports\[0\]\.grade/);
			bad((s) => { s.reports = new Array(9).fill(s.reports[0]); }, /^Invalid save: reports/);
			bad((s) => { delete s.reports[0].remark; }, /^Invalid save: reports\[0\]\.remark/);
			bad((s) => { s.audit.days = [{ day: 1 }]; }, /^Invalid save: audit\.days\[0\]/);
			bad((s) => { delete s.audit; }, /^Invalid save: audit/);
			bad((s) => { delete s.stats.repairs; }, /^Invalid save: stats\.repairs/);
			bad((s) => { s.stats.revenue = Number.NaN; }, /^Invalid save: /);
			bad((s) => { s.scriptedIssued = [1]; }, /^Invalid save: scriptedIssued/);
			bad((s) => { delete s.ledger[0].taxes; }, /^Invalid save: ledger\[0\]\.taxes/);
			bad((s) => { delete s.today.fees; }, /^Invalid save: today\.fees/);
			bad((s) => { delete s.jobs[0].clerk; }, /^Invalid save: jobs\[0\]\.clerk/);
			bad((s) => { delete s.bots[0].parts; }, /^Invalid save: bots\[0\]\.parts/);
		});
	});
});

describe("hostile commands for the new types", () => {
	it("never throw and are refused", () => {
		const sim = newSim(content(), "farm");
		sim.state.techResearched.push("t_clerk");
		sim.invalidateProjection();
		const cyc: Raw = { enabled: true, allowLiquid: true, minPayPerPflopHour: 0, maxPenalty: 0 };
		cyc.kinds = [cyc];
		const junk: unknown[] = [
			{ type: "setClerk", policy: cyc },
			{ type: "setClerk", policy: { ...cyc, kinds: new Array(1e6).fill("training") } },
			{ type: "setClerk", policy: { ...cyc, kinds: ["training"], minPayPerPflopHour: "1" } },
			{ type: "setClerk", policy: [] },
			{ type: "setClerk", policy: { ...cyc, kinds: ["__proto__"] } },
			{ type: "takeLoan" },
			{ type: "takeLoan", amount: "5" },
			{ type: "takeLoan", amount: Number.POSITIVE_INFINITY },
			{ type: "repayLoan", amount: null },
			{ type: "research", techId: undefined },
		];
		for (const j of junk) expect(sim.submit(j as never).ok).toBe(false);
		expect(sim.state.pending).toHaveLength(0);
	});
});
