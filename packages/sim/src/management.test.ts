import { describe, expect, it } from "vitest";
import type { CommandResult, SimEvent } from "./api";
import { auditScore, gradeFor } from "./economy/audit";
import type { SimImpl } from "./sim";
import { exec, newSim, run } from "./test/fixture";
import { acceptSpec, cmdSetClerk, count, farmContent, giveRp, grant, inference, policy, pushOffer, runCollect, training } from "./test/m2b";

const reason = (r: CommandResult): string => (r.ok ? "" : r.reason);

describe("Contracts Clerk", () => {
	it("is locked until a node with the feature is researched; default policy is off", () => {
		const sim = newSim(farmContent(), "farm");
		expect(sim.view().clerk).toEqual({ unlocked: false, policy: { enabled: false, kinds: ["training", "finetune", "inference"], minPayPerPflopHour: 0, maxPenalty: 0, allowLiquid: true }, acceptedTotal: 0 });
		expect(reason(sim.submit(cmdSetClerk()))).toMatch(/locked/);
		giveRp(sim, 10);
		exec(sim, { type: "research", techId: "t_clerk" });
		expect(sim.view().clerk.unlocked).toBe(true);
		expect(sim.submit(cmdSetClerk({ minPayPerPflopHour: 3 })).ok).toBe(true);
		exec(sim);
		expect(sim.view().clerk.policy).toMatchObject({ enabled: true, minPayPerPflopHour: 3 });
	});

	it("validates the policy", () => {
		const sim = newSim(farmContent(), "farm");
		grant(sim, "t_clerk");
		const p = policy();
		const bad = (over: Record<string, unknown>) => sim.submit({ type: "setClerk", policy: { ...p, ...over } } as never);
		expect(reason(bad({ kinds: [] }))).toMatch(/at least one/);
		expect(reason(bad({ kinds: ["training", "mining"] }))).toMatch(/unknown job kind 'mining'/);
		expect(reason(bad({ kinds: [5] }))).toMatch(/unknown job kind/);
		expect(reason(bad({ minPayPerPflopHour: -1 }))).toMatch(/≥ 0/);
		expect(reason(bad({ maxPenalty: -5 }))).toMatch(/≥ 0/);
		expect(bad({ minPayPerPflopHour: Number.NaN }).ok).toBe(false);
		expect(bad({ maxPenalty: Number.POSITIVE_INFINITY }).ok).toBe(false);
		expect(bad({ kinds: "training" }).ok).toBe(false);
		expect(bad({ enabled: "yes" }).ok).toBe(false);
		expect(sim.submit({ type: "setClerk" } as never).ok).toBe(false);
		expect(sim.submit({ type: "setClerk", policy: null } as never).ok).toBe(false);
		expect(bad({ kinds: ["inference", "inference"] }).ok).toBe(true);
		exec(sim);
		expect(sim.state.clerkPolicy.kinds).toEqual(["inference"]);
	});

	const clerkSim = (over = {}, ...extra: string[]) => {
		const sim = newSim(farmContent(), "farm");
		sim.step(); // power solved
		grant(sim, "t_clerk", ...extra);
		exec(sim, cmdSetClerk(over));
		return sim;
	};

	it("accepts at most one offer per tick, oldest first, through the acceptContract path", () => {
		const sim = clerkSim();
		const ids = [1, 2, 3].map(() => pushOffer(sim, inference({ sustainedPflops: 20, work: 20 })));
		const accepted: number[] = [];
		for (let i = 0; i < 4; i++) {
			const events = sim.step();
			const ca = events.filter((e) => e.type === "clerkAccepted");
			expect(ca.length).toBeLessThanOrEqual(1);
			for (const e of ca) {
				if (e.type !== "clerkAccepted") continue;
				accepted.push(e.contractId);
				expect(events.filter((x) => x.type === "jobStarted")).toHaveLength(1);
				expect(sim.state.jobs.find((j) => j.id === e.jobId)?.clerk).toBe(true);
			}
		}
		expect(accepted).toEqual(ids);
		expect(sim.view().clerk.acceptedTotal).toBe(3);
		expect(sim.state.offers).toHaveLength(0);
	});

	it("matches every rule: kind, pay rate, penalty cap, liquid; skips offers that cannot start", () => {
		const sim = clerkSim({ kinds: ["training"], minPayPerPflopHour: 100, maxPenalty: 50_000, allowLiquid: false });
		const wrongKind = pushOffer(sim, inference());
		const cheap = pushOffer(sim, training({ payout: 40 * 99 })); // 99 $/PF-h < 100
		const harsh = pushOffer(sim, training({ penalty: 50_001 }));
		const liquid = pushOffer(sim, training({ needsLiquid: true }));
		const tooBig = pushOffer(sim, training({ work: 1e6, durationTicks: 100 })); // cannot finish in time
		const good = pushOffer(sim, training({ payout: 40 * 100, penalty: 50_000 })); // boundaries are inclusive
		const events = sim.step();
		expect(events).toContainEqual({ type: "clerkAccepted", contractId: good, jobId: expect.any(Number) });
		expect(sim.state.offers.map((o) => o.id)).toEqual([wrongKind, cheap, harsh, liquid, tooBig]);
	});

	it("maxPenalty 0 means no limit, disabled does nothing, inference pay rate uses PFLOPS × hours", () => {
		const off = clerkSim({ enabled: false });
		pushOffer(off, training());
		expect(count(runCollect(off, 5), "clerkAccepted")).toBe(0);
		const sim = clerkSim({ maxPenalty: 0 });
		pushOffer(sim, training({ penalty: 1e9 }));
		expect(count(sim.step(), "clerkAccepted")).toBe(1);
		// inference: 720_000 / (20 PF × 12 h) = 3000 $/PF-h
		const s2 = clerkSim({ minPayPerPflopHour: 3000.5 });
		const o = pushOffer(s2, inference());
		expect(count(s2.step(), "clerkAccepted")).toBe(0);
		expect(s2.state.offers.map((x) => x.id)).toEqual([o]);
	});

	it("also accepts offers generated that very tick", () => {
		const c = farmContent({ economy: { slaPenaltyFactor: 1.5, maxOffers: 4, offerIntervalTicks: 5, offerExpiryTicks: 1000 } });
		const sim = newSim(c, "farm", 2);
		sim.step();
		grant(sim, "t_clerk");
		exec(sim, cmdSetClerk());
		const events = runCollect(sim, 60);
		expect(count(events, "clerkAccepted")).toBeGreaterThan(0);
		expect(count(events, "clerkAccepted")).toBe(sim.state.clerkAccepted);
	});

	it("withholds feeShare of every payment: revenue stays gross, fees go to cash and today.fees", () => {
		const sim = clerkSim();
		const cash0 = sim.state.cash;
		const revenue0 = sim.state.today.revenue;
		const costs = () => sim.state.today.energy + sim.state.today.upkeep + sim.state.today.construction + sim.state.today.penalties;
		const c0 = costs();
		pushOffer(sim, training({ work: 40, payout: 100_000 }));
		let done = false;
		for (let t = 0; t < 300 && !done; t++) done = sim.step().some((e) => e.type === "jobCompleted");
		expect(done).toBe(true);
		expect(sim.state.today.revenue - revenue0).toBeCloseTo(100_000, 6); // gross
		expect(sim.state.today.fees).toBeCloseTo(5_000, 6); // 5 % of every payment: checkpoints and the balance
		expect(sim.state.cash).toBeCloseTo(cash0 + 100_000 - 5_000 - (costs() - c0), 4);
		// A manually accepted job pays no fee.
		const manual = newSim(farmContent(), "farm");
		acceptSpec(manual, training({ work: 40, payout: 100_000 }));
		for (let t = 0; t < 300; t++) manual.step();
		expect(manual.state.today.fees).toBe(0);
		expect(manual.state.today.revenue).toBeCloseTo(100_000, 6);
	});

	it("inference streams are taxed per tick too", () => {
		const sim = clerkSim();
		pushOffer(sim, inference({ payout: 720_000, durationTicks: 720 }));
		run(sim, 100);
		expect(sim.state.today.fees).toBeCloseTo(sim.state.today.revenue * 0.05, 6);
		expect(sim.state.today.fees).toBeGreaterThan(0);
	});
});

describe("loans", () => {
	const mk = () => newSim(farmContent(), "farm");

	it("takeLoan: limit by tier, cash up, not revenue, event and view", () => {
		const sim = mk();
		expect(reason(sim.submit({ type: "takeLoan", amount: 0 }))).toMatch(/positive/);
		expect(reason(sim.submit({ type: "takeLoan", amount: -5 }))).toMatch(/positive/);
		expect(sim.submit({ type: "takeLoan", amount: Number.NaN }).ok).toBe(false);
		expect(reason(sim.submit({ type: "takeLoan", amount: 2_000_001 }))).toMatch(/credit limit of \$2,000,000/);
		const cash0 = sim.state.cash;
		expect(sim.submit({ type: "takeLoan", amount: 1_500_000 }).ok).toBe(true);
		expect(reason(sim.submit({ type: "takeLoan", amount: 500_001 }))).toMatch(/\$500,000 available/); // queue-aware
		const events = sim.step();
		expect(events).toContainEqual({ type: "loanTaken", amount: 1_500_000 });
		expect(sim.state.cash).toBeGreaterThan(cash0 + 1_400_000);
		expect(sim.state.stats.revenue).toBe(0);
		expect(sim.state.today.revenue).toBe(0);
		expect(sim.view().loan).toEqual({ principal: 1_500_000, max: 2_000_000, dailyRate: 0.004 });
		exec(sim, { type: "takeLoan", amount: 500_000 }); // exactly the limit
		expect(sim.state.loanPrincipal).toBe(2_000_000);
		sim.state.tier = 2;
		expect(sim.view().loan.max).toBe(6_000_000);
	});

	it("repayLoan pays min(amount, principal); refuses without cash, without a loan, or a non-positive amount", () => {
		const sim = mk();
		expect(reason(sim.submit({ type: "repayLoan", amount: 10 }))).toMatch(/no loan/);
		exec(sim, { type: "takeLoan", amount: 1_000_000 });
		expect(reason(sim.submit({ type: "repayLoan", amount: 0 }))).toMatch(/positive/);
		const cash0 = sim.state.cash;
		let events = exec(sim, { type: "repayLoan", amount: 400_000 });
		expect(events).toContainEqual({ type: "loanRepaid", amount: 400_000 });
		expect(sim.state.loanPrincipal).toBe(600_000);
		expect(sim.state.cash).toBeLessThan(cash0 - 399_000);
		events = exec(sim, { type: "repayLoan", amount: 9_999_999 });
		expect(events).toContainEqual({ type: "loanRepaid", amount: 600_000 });
		expect(sim.state.loanPrincipal).toBe(0);
		exec(sim, { type: "takeLoan", amount: 1_000 });
		sim.state.cash = 500;
		sim.invalidateProjection();
		expect(reason(sim.submit({ type: "repayLoan", amount: 600 }))).toMatch(/insufficient funds/);
		expect(sim.submit({ type: "repayLoan", amount: 100 }).ok).toBe(true);
	});

	it("interest is charged at midnight to the day being closed", () => {
		const sim = mk();
		exec(sim, { type: "takeLoan", amount: 1_000_000 });
		run(sim, 1440 - 1);
		const e = sim.state.ledger[0];
		expect(e.interest).toBeCloseTo(4_000, 6);
		expect(sim.state.ledger).toHaveLength(1);
		expect(sim.state.today.interest).toBe(0);
	});
});

describe("levy", () => {
	/** Run one full day with a rich inference contract (and optionally a loan). */
	function day(share: number, loan = 0): { sim: SimImpl; d: SimEvent[] } {
		const sim = newSim(farmContent({ tax: { profitShare: share } }), "farm");
		if (loan > 0) exec(sim, { type: "takeLoan", amount: loan });
		acceptSpec(sim, inference({ payout: 7_200_000, durationTicks: 720 }));
		const d = runCollect(sim, 1440 - sim.state.tick);
		return { sim, d };
	}
	const profit = (l: { revenue: number; energy: number; upkeep: number; construction: number; penalties: number; interest: number; fees: number }) =>
		l.revenue - (l.energy + l.upkeep + l.construction + l.penalties + l.interest + l.fees);

	it("charges profitShare × profit on the closed day, after interest", () => {
		const { sim } = day(0.25, 2_000_000);
		const l = sim.state.ledger[0];
		expect(l.interest).toBeCloseTo(8_000, 6);
		expect(profit(l)).toBeGreaterThan(0);
		expect(l.taxes).toBeCloseTo(0.25 * profit(l), 6);
		// Ordering: the levy saw the interest.
		expect(l.taxes).toBeLessThan(0.25 * (profit(l) + l.interest) - 1);
		expect(sim.state.today.taxes).toBe(0);
	});

	it("is not charged on a loss, and cash reflects every charge", () => {
		const sim = newSim(farmContent({ tax: { profitShare: 0.5 } }), "farm");
		run(sim, 1440);
		const l = sim.state.ledger[0];
		expect(profit(l)).toBeLessThan(0);
		expect(l.taxes).toBe(0);
		const { sim: rich } = day(0.5);
		const r = rich.state.ledger[0];
		expect(r.taxes).toBeGreaterThan(0);
		expect(rich.state.cash).toBeCloseTo(50_000_000 + r.revenue - (r.energy + r.upkeep + r.construction + r.penalties + r.taxes + r.interest + r.fees) + rich.state.today.revenue - (rich.state.today.energy + rich.state.today.upkeep), 3);
	});

	it("the view ledger carries the new fields", () => {
		const { sim } = day(0.1);
		const v = sim.view();
		for (const l of v.ledger) expect(l).toMatchObject({ taxes: expect.any(Number), interest: expect.any(Number), fees: expect.any(Number) });
	});
});

describe("quarterly audit", () => {
	it("grade table and boundaries", () => {
		for (const [score, g] of [[100, "A"], [90, "A"], [89, "B"], [75, "B"], [74, "C"], [55, "C"], [54, "D"], [35, "D"], [34, "E"], [0, "E"]] as const) expect(gradeFor(score)).toBe(g);
		const ok = { uptime: 1, uptimeTarget: 0.95, pue: 1.2, jobsFailed: 0, revenue: 1000, penalties: 0, profit: 10 };
		expect(auditScore(ok)).toBe(100);
		expect(auditScore({ ...ok, uptime: 0.94 })).toBe(70);
		expect(auditScore({ ...ok, uptime: 0.95 })).toBe(100); // target met
		expect(auditScore({ ...ok, jobsFailed: 2 })).toBe(80);
		expect(auditScore({ ...ok, jobsFailed: 9 })).toBe(60); // capped at 40
		expect(auditScore({ ...ok, penalties: 100 })).toBe(100); // exactly 10 % is fine
		expect(auditScore({ ...ok, penalties: 100.01 })).toBe(80);
		expect(auditScore({ ...ok, pue: 1.6 })).toBe(100);
		expect(auditScore({ ...ok, pue: 1.61 })).toBe(90);
		expect(auditScore({ ...ok, profit: -1 })).toBe(80);
		expect(auditScore({ uptime: 0, uptimeTarget: 1, pue: 2, jobsFailed: 5, revenue: 10, penalties: 5, profit: -5 })).toBe(100 - 30 - 40 - 20 - 10 - 20);
	});

	const auditContent = (period: number, over = {}) => farmContent({ audit: { periodDays: period, standingByGrade: [4, 2, 0, -3, -6], cashShareByGrade: [0.05, 0.02, 0, -0.02, -0.05] }, ...over });

	it("files a report at the midnight closing day k·period − 1: figures, effects, event, remark", () => {
		const sim = newSim(auditContent(2), "farm");
		acceptSpec(sim, inference({ payout: 7_200_000, durationTicks: 720 })); // profit > 0
		const upt: number[] = [];
		const pue: number[] = [];
		const events: SimEvent[] = [];
		const standing0 = sim.state.standing;
		for (let t = sim.state.tick; t < 2 * 1440; t++) {
			events.push(...sim.step());
			if (t < 2 * 1440 - 1) {
				upt.push(sim.state.metrics.uptime);
				pue.push(sim.state.metrics.pue);
			}
		}
		const first = events.findIndex((e) => e.type === "quarterReport");
		expect(first).toBeGreaterThan(-1);
		expect(sim.state.tick).toBe(2 * 1440);
		expect(sim.state.reports).toHaveLength(1);
		const r = sim.view().reports[0];
		expect(r).toMatchObject({ quarter: 1, fromDay: 0, toDay: 1, jobsCompleted: 1, jobsFailed: 0, grade: "A", cashDelta: expect.any(Number) });
		expect(events[first]).toEqual({ type: "quarterReport", quarter: 1, grade: "A" });
		const l = sim.state.ledger;
		expect(r.revenue).toBeGreaterThan(7_180_000); // the first tick has no racks allocated yet
		expect(r.revenue).toBeLessThanOrEqual(7_200_000);
		expect(r.cashDelta).toBeCloseTo(0.05 * r.revenue, 6);
		expect(l[0].revenue + l[1].revenue).toBeCloseTo(r.revenue + r.cashDelta, 3); // a grant counts as revenue
		expect(r.costs).toBeCloseTo(l[0].energy + l[0].upkeep + l[1].energy + l[1].upkeep, 6);
		expect(r.penalties).toBe(0);
		expect(r.uptime).toBeCloseTo(upt.reduce((a, b) => a + b, 0) / upt.length, 2);
		expect(r.pue).toBeCloseTo(pue.reduce((a, b) => a + b, 0) / pue.length, 2); // (the test misses the two ticks spent accepting the job)
		expect(r.standingDelta).toBe(4);
		expect(events).toContainEqual({ type: "standingChanged", standing: expect.any(Number), delta: 4 });
		expect(sim.state.standing).toBeGreaterThanOrEqual(standing0 + 4 - 5); // includes daily / job standing changes
		expect(r.remark.length).toBeGreaterThan(20);
		// The next report is filed two days later only.
		const more = runCollect(sim, 2 * 1440 - 1);
		expect(count(more, "quarterReport")).toBe(0);
		expect(count(runCollect(sim, 1), "quarterReport")).toBe(1);
		expect(sim.state.reports.map((x) => x.quarter)).toEqual([1, 2]);
	});

	it("an idle loss-making farm grades C (100 − 20 loss − 10 PUE 1.62); one failed job at a profit sits exactly on the A boundary, two make it a B", () => {
		const idle = newSim(auditContent(1), "farm");
		run(idle, 1440);
		expect(idle.state.reports[0]).toMatchObject({ grade: "C", standingDelta: 0, cashDelta: 0 });
		expect(Object.is(idle.state.reports[0].cashDelta, 0)).toBe(true);
		const withFailures = (n: number) => {
			const sim = newSim(auditContent(1), "farm");
			acceptSpec(sim, inference({ payout: 7_200_000, durationTicks: 720 }));
			for (let i = 0; i < n; i++) {
				const id = pushOffer(sim, training({ work: 1, penalty: 100 }));
				exec(sim, { type: "acceptContract", contractId: id });
				const job = sim.state.jobs.at(-1);
				if (!job) throw new Error("no job");
				exec(sim, { type: "cancelJob", jobId: job.id });
			}
			run(sim, 1440 - sim.state.tick);
			return sim.state.reports[0];
		};
		expect(withFailures(1)).toMatchObject({ jobsFailed: 1, grade: "A" });
		expect(withFailures(2)).toMatchObject({ jobsFailed: 2, grade: "B" });
	});

	it("an E applies the fine as penalties and the standing hit", () => {
		const sim = newSim(auditContent(1, { tiers: { pflops: [0, 1e9], uptime: [1.1, 1], reward: [0, 0] } }), "farm");
		acceptSpec(sim, inference({ payout: 400_000, durationTicks: 720 }));
		for (let i = 0; i < 3; i++) {
			const id = pushOffer(sim, training({ work: 1, penalty: 30_000 }));
			exec(sim, { type: "acceptContract", contractId: id });
			const job = sim.state.jobs.at(-1);
			if (job) exec(sim, { type: "cancelJob", jobId: job.id });
		}
		run(sim, 1440 - sim.state.tick);
		const r = sim.state.reports[0];
		expect(r.grade).toBe("E"); // 100 − 30 (uptime) − 30 (3 failures) − 20 (penalties > 10 % of revenue)
		expect(r.standingDelta).toBe(-6);
		expect(r.cashDelta).toBeCloseTo(-0.05 * r.revenue, 6);
		expect(sim.state.ledger[0].penalties).toBeCloseTo(90_000 + 0.05 * r.revenue, 6); // the fine counts as penalties
		expect(r.penalties).toBeCloseTo(90_000, 6); // …but is not part of the graded quarter
	});

	it("keeps the last 8 reports", () => {
		const sim = newSim(auditContent(1), "empty");
		run(sim, 11 * 1440);
		expect(sim.view().reports.map((r) => r.quarter)).toEqual([4, 5, 6, 7, 8, 9, 10, 11]);
	});

	it("loan interest, the levy and clerk fees count as costs", () => {
		const sim = newSim(auditContent(1, { tax: { profitShare: 0.2 } }), "farm");
		exec(sim, { type: "takeLoan", amount: 1_000_000 });
		acceptSpec(sim, inference({ payout: 7_200_000, durationTicks: 720 }));
		run(sim, 1440 - sim.state.tick);
		const l = sim.state.ledger[0];
		expect(sim.state.reports[0].costs).toBeCloseTo(l.energy + l.upkeep + l.construction + l.penalties + l.taxes + l.interest + l.fees, 6);
		expect(l.taxes).toBeGreaterThan(0);
	});
});

describe("lifetime stats", () => {
	it("tracks revenue, PF-hours, jobs, peak, builds, failures, repairs, memos and RP", () => {
		const sim = newSim(farmContent(), "farm");
		expect(sim.view().stats).toEqual({ revenue: 0, pflopHours: 0, jobsCompleted: 0, jobsFailed: 0, peakPflops: 0, facilitiesBuilt: 0, componentFailures: 0, repairs: 0, memosAnswered: 0, researchPointsEarned: 0 });
		exec(sim, { type: "buildSlab", floor: 1, x0: 0, x1: 20 });
		sim.submit({ type: "place", defId: "tier2_thing", floor: 0, x: 40 }); // tier 2: refused, not counted
		sim.state.tier = 2;
		sim.invalidateProjection();
		exec(sim, { type: "place", defId: "tier2_thing", floor: 0, x: 40 });
		expect(sim.state.stats.facilitiesBuilt).toBe(1);
		const j1 = acceptSpec(sim, training({ work: 40 }));
		run(sim, 100);
		const done = sim.state.jobs.find((j) => j.id === j1);
		expect(done?.status).toBe("completed");
		const id = pushOffer(sim, training({ work: 1000, penalty: 10 }));
		exec(sim, { type: "acceptContract", contractId: id });
		exec(sim, { type: "cancelJob", jobId: sim.state.jobs.at(-1)?.id ?? 0 });
		const s = sim.view().stats;
		expect(s).toMatchObject({ jobsCompleted: 1, jobsFailed: 1 });
		expect(s.revenue).toBeCloseTo(100_000, 3);
		expect(s.pflopHours).toBeGreaterThanOrEqual(40 - 1e-6);
		expect(s.peakPflops).toBeCloseTo(80, 6);
		expect(s.researchPointsEarned).toBeGreaterThan(5);
	});
});
