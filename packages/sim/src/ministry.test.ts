import type { Balance, ContractSpec, EventChoice, EventDef, EventEffect } from "@aitower/content";
import { describe, expect, it } from "vitest";
import type { SimEvent } from "./api";
import { createRng } from "./core/rng";
import { ambientAt } from "./core/time";
import { modFactor } from "./ministry/modifiers";
import { failRack } from "./reliability/reliabilityStep";
import { type SimImpl, SNAPSHOT_VERSION, simFromSnapshot } from "./sim";
import { exec, facilityOf, makeContent, newSim, run, scenario } from "./test/fixture";

// biome-ignore lint/suspicious/noExplicitAny: raw JSON surgery on saves
type Raw = Record<string, any>;

// ── helpers ──────────────────────────────────────────────────────────────

const choice = (id: string, effects: EventEffect[] = []): EventChoice => ({ id, label: id.toUpperCase(), hint: `hint ${id}`, outcome: `outcome ${id}`, effects });

const ev = (id: string, over: Partial<EventDef> = {}): EventDef => ({
	id,
	category: "ministry",
	advisor: "cass",
	recommended: "a",
	title: `Title ${id}`,
	body: `Body ${id}`,
	weight: 1,
	minTier: 1,
	cooldownDays: 0,
	choices: [choice("a"), choice("b")],
	...over,
});

const QUIET: Partial<Balance> = { events: { intervalTicks: 1_000_000_000, graceTicks: 1_000_000_000 } };
const eventsBalance = (intervalTicks: number, graceTicks: number): Partial<Balance> => ({ events: { intervalTicks, graceTicks } });

const farm = scenario("farm", {
	slabs: [[0, 0, 47]],
	conduits: [["power", 0, 0, 47]],
	facilities: [
		{ defId: "grid_tie", floor: 0, x: 0 },
		{ defId: "rack_air_gpu", floor: 0, x: 6 },
		{ defId: "rack_air_gpu", floor: 0, x: 8 },
		{ defId: "rack_air_gpu", floor: 0, x: 10 },
		{ defId: "rack_air_gpu", floor: 0, x: 12 },
		{ defId: "crah_unit", floor: 0, x: 14 },
		{ defId: "crah_unit", floor: 0, x: 4 },
		{ defId: "rack_storage", floor: 0, x: 20 },
		{ defId: "parts_depot", floor: 0, x: 24 },
	],
	spareParts: 4,
});

function contentWith(events: EventDef[], bal: Partial<Balance> = QUIET, scenarios = [farm]) {
	const c = makeContent(scenarios, bal);
	c.events = events;
	return c;
}

/** Put an open decision into the state (bypasses the roll, replacing any pending one) and return its id. */
function inject(sim: SimImpl, eventId: string): number {
	const id = sim.state.nextId.decision++;
	sim.state.decision = { id, eventId, issuedAt: sim.state.tick, deferred: false, hiddenUntil: 0 };
	sim.invalidateProjection();
	return id;
}

const resolve = (sim: SimImpl, decisionId: number, choiceId: string): SimEvent[] => exec(sim, { type: "resolveDecision", decisionId, choiceId });

/** Inject + resolve one choice of a one-off event in the same tick; returns that tick's events. */
function applyEffects(sim: SimImpl, effects: EventEffect[]): SimEvent[] {
	const def = sim.content.events.find((e) => e.id === "fx");
	if (def) def.choices[0].effects = effects;
	return resolve(sim, inject(sim, "fx"), "a");
}

const fxContent = (bal: Partial<Balance> = QUIET, scenarios = [farm]) => contentWith([ev("fx", { choices: [choice("a"), choice("b")] })], bal, scenarios);

/** Step until `pred` matches an event (or give up). */
function until(sim: SimImpl, pred: (e: SimEvent) => boolean, max = 20_000): SimEvent {
	for (let i = 0; i < max; i++) for (const e of sim.step()) if (pred(e)) return e;
	throw new Error("event never happened");
}

const count = (events: SimEvent[], type: SimEvent["type"]): number => events.filter((e) => e.type === type).length;

/** Collect (tick, eventId) of every decision issued in `ticks` steps. */
function issueLog(sim: SimImpl, ticks: number, onIssue: ((id: number) => void) | null = (id) => void sim.submit({ type: "resolveDecision", decisionId: id, choiceId: "a" })): { tick: number; eventId: string; decisionId: number }[] {
	const out: { tick: number; eventId: string; decisionId: number }[] = [];
	for (let i = 0; i < ticks; i++) {
		const t = sim.state.tick;
		for (const e of sim.step())
			if (e.type === "decisionIssued") {
				out.push({ tick: t, eventId: e.eventId, decisionId: e.decisionId });
				onIssue?.(e.decisionId); // default: a quick player answers at once; null leaves it pending
			}
	}
	return out;
}

// ── issuing ───────────────────────────────────────────────────────────────

describe("decision cadence", () => {
	it("never before graceTicks; at most one per game day; spaced by the jittered interval", () => {
		const sim = newSim(contentWith([ev("x")], eventsBalance(3600, 1440)), "empty", 4);
		const log = issueLog(sim, 1440 * 120);
		expect(log.length).toBeGreaterThan(20);
		expect(log[0].tick).toBeGreaterThanOrEqual(1440);
		const days = log.map((l) => Math.floor(l.tick / 1440));
		expect(new Set(days).size).toBe(days.length); // one per day, never two on the same day
		const gaps = log.slice(1).map((l, i) => l.tick - log[i].tick);
		for (const g of gaps) expect(g).toBeGreaterThanOrEqual(1); // the day cap shifts rolls to the next midnight
		expect(new Set(gaps).size).toBeGreaterThan(5); // jitter, not a fixed period
	}, 30_000);

	it("only one decision exists at a time: it stays pending (no timeout) until answered, then the next may roll", () => {
		const events = Array.from({ length: 8 }, (_, i) => ev(`e${i}`));
		const sim = newSim(contentWith(events, eventsBalance(100, 0)), "empty", 2);
		const log = issueLog(sim, 1440 * 10, null);
		expect(log).toHaveLength(1); // nothing else while the first waits, however long
		expect(sim.state.decision?.id).toBe(log[0].decisionId);
		resolve(sim, log[0].decisionId, "a");
		run(sim, 1440 * 2);
		expect(sim.state.decision).not.toBeNull(); // the next one rolled once the slot was free
		expect(sim.state.decision?.id).not.toBe(log[0].decisionId);
	});

	it("a closed decisionGate holds new decisions without spending random draws; reopening lets one through", () => {
		const sim = newSim(contentWith([ev("x")], eventsBalance(100, 0)), "empty", 3);
		exec(sim, { type: "decisionGate", open: false });
		expect(issueLog(sim, 1440 * 3)).toHaveLength(0);
		const rngBefore = sim.state.rng.events;
		run(sim, 100);
		expect(sim.state.rng.events).toBe(rngBefore);
		exec(sim, { type: "decisionGate", open: true });
		run(sim, 1440 * 2);
		expect(sim.state.decision).not.toBeNull();
	});

	it("does not issue an event that is already open", () => {
		const sim = newSim(contentWith([ev("only")], eventsBalance(100, 0)), "empty", 2);
		expect(issueLog(sim, 3000, null)).toHaveLength(1);
	});

	it("an empty event list issues nothing and never throws", () => {
		const sim = newSim(contentWith([], eventsBalance(100, 0)), "empty", 2);
		expect(issueLog(sim, 2000)).toHaveLength(0);
	});

	it("is a function of the seed only", () => {
		const mk = (seed: number) => newSim(contentWith([ev("a1"), ev("a2"), ev("a3")], eventsBalance(300, 0)), "empty", seed);
		const a = issueLog(mk(5), 1440 * 30);
		const b = issueLog(mk(5), 1440 * 30);
		const c = issueLog(mk(6), 1440 * 30);
		expect(a.length).toBeGreaterThan(5);
		expect(a).toEqual(b);
		expect(a).not.toEqual(c);
	});
});

describe("memo eligibility", () => {
	const quick = eventsBalance(100, 0);

	it("minTier / maxTier", () => {
		const sim = newSim(contentWith([ev("t2", { minTier: 2 })], quick), "empty", 1);
		expect(issueLog(sim, 3000)).toHaveLength(0);
		sim.state.tier = 2;
		expect(issueLog(sim, 3000).length).toBeGreaterThan(0);

		const sim2 = newSim(contentWith([ev("t1", { maxTier: 1 })], quick), "empty", 1);
		expect(issueLog(sim2, 3000).length).toBeGreaterThan(0);
		sim2.state.tier = 2;
		expect(issueLog(sim2, 3000)).toHaveLength(0);
	});

	it("minDay", () => {
		const sim = newSim(contentWith([ev("late", { minDay: 3 })], quick), "empty", 1);
		const log = issueLog(sim, 1440 * 12);
		expect(log.length).toBeGreaterThan(5);
		expect(log[0].tick).toBeGreaterThanOrEqual(3 * 1440);
	});

	it("cooldownDays spaces repeats of the same event by whole days", () => {
		const sim = newSim(contentWith([ev("cool", { cooldownDays: 3 })], quick), "empty", 1);
		const log = issueLog(sim, 1440 * 40);
		expect(log.length).toBeGreaterThan(3);
		const days = log.map((l) => Math.floor(l.tick / 1440));
		for (let i = 1; i < days.length; i++) expect(days[i] - days[i - 1]).toBeGreaterThanOrEqual(3);
		// Without a cooldown the same event comes back within a day.
		const sim2 = newSim(contentWith([ev("hot", { cooldownDays: 0 })], quick), "empty", 1);
		expect(issueLog(sim2, 1440 * 40).length).toBeGreaterThan(days.length);
	});

	it("picks by weight", () => {
		const sim = newSim(contentWith([ev("heavy", { weight: 10 }), ev("light", { weight: 1 })], eventsBalance(100, 0)), "empty", 3);
		const log = issueLog(sim, 1440 * 100);
		const heavy = log.filter((l) => l.eventId === "heavy").length;
		expect(log.length).toBeGreaterThan(80); // at most one a day
		expect(heavy / log.length).toBeGreaterThan(0.8);
		expect(log.some((l) => l.eventId === "light")).toBe(true);
	}, 30_000);

	it("an issued decision is visible in the view with the advisor, text and recommendation", () => {
		const sim = newSim(contentWith([ev("shown", { category: "client", advisor: "luci", recommended: "b" })], eventsBalance(100, 0)), "empty", 1);
		const issued = until(sim, (e) => e.type === "decisionIssued");
		const v = sim.view();
		const m = v.decision;
		expect(m).not.toBeNull();
		expect(issued).toMatchObject({ decisionId: m?.id, eventId: "shown" });
		expect(m).toMatchObject({ eventId: "shown", advisor: "luci", category: "client", title: "Title shown", body: "Body shown", recommended: "b", canDefer: true });
		expect(m?.choices).toEqual([
			{ id: "a", label: "A", hint: "hint a" },
			{ id: "b", label: "B", hint: "hint b" },
		]);
		expect(m).not.toHaveProperty("expiresAt");
	});
});

// ── resolving ─────────────────────────────────────────────────────────────

describe("resolveDecision", () => {
	it("applies the choice, emits decisionResolved, records history and clears the decision", () => {
		const sim = newSim(fxContent(), "empty", 1);
		const id = inject(sim, "fx");
		const events = applyEffectsWith(sim, id, [{ type: "cash", amount: 1234 }]);
		expect(events).toContainEqual({ type: "decisionResolved", decisionId: id, eventId: "fx", choiceId: "a" });
		expect(sim.state.decision).toBeNull();
		const v = sim.view();
		expect(v.decision).toBeNull();
		expect(v.decisionHistory).toEqual([{ decisionId: id, eventId: "fx", title: "Title fx", choiceId: "a", outcome: "outcome a", tick: 0 }]);
	});

	function applyEffectsWith(sim: SimImpl, id: number, effects: EventEffect[]): SimEvent[] {
		sim.content.events[0].choices[0].effects = effects;
		return resolve(sim, id, "a");
	}

	it("rejects unknown decisions, unknown choices and malformed commands with a reason, never throwing", () => {
		const sim = newSim(fxContent(), "empty", 1);
		const id = inject(sim, "fx");
		const bad = (cmd: unknown, re: RegExp) => {
			const r = sim.submit(cmd as never);
			expect(r.ok).toBe(false);
			if (!r.ok) expect(r.reason).toMatch(re);
			expect(sim.canBuild(cmd as never)).toEqual(r);
		};
		bad({ type: "resolveDecision", decisionId: 999, choiceId: "a" }, /no such decision/);
		bad({ type: "resolveDecision", decisionId: id, choiceId: "zzz" }, /no such choice/);
		bad({ type: "resolveDecision", decisionId: id, choiceId: "__proto__" }, /no such choice/);
		bad({ type: "resolveDecision", decisionId: id }, /malformed/);
		bad({ type: "resolveDecision", decisionId: id, choiceId: 5 }, /malformed/);
		bad({ type: "resolveDecision", decisionId: Number.NaN, choiceId: "a" }, /malformed/);
		bad({ type: "resolveDecision", choiceId: "a" }, /malformed/);
		bad({ type: "markTip" }, /malformed/);
		bad({ type: "decisionGate", open: "yes" }, /malformed/);
		expect(sim.submit({ type: "resolveDecision", decisionId: id, choiceId: "a" })).toEqual({ ok: true });
	});

	it("validation is queue-aware: a decision can only be resolved once", () => {
		const sim = newSim(fxContent(), "empty", 1);
		const id = inject(sim, "fx");
		expect(sim.submit({ type: "resolveDecision", decisionId: id, choiceId: "a" })).toEqual({ ok: true });
		const second = sim.submit({ type: "resolveDecision", decisionId: id, choiceId: "b" });
		expect(second).toEqual({ ok: false, reason: "no such decision" });
		const events = sim.step();
		expect(count(events, "decisionResolved")).toBe(1);
		expect(count(events, "commandRejected")).toBe(0);
		expect(sim.submit({ type: "resolveDecision", decisionId: id, choiceId: "a" })).toEqual({ ok: false, reason: "no such decision" });
	});

	it("waiting never changes anything: no timeout, however long it is open", () => {
		const c = contentWith([ev("audit", { choices: [choice("a", [{ type: "cash", amount: -500 }]), choice("b")] })]);
		const sim = newSim(c, "empty", 1);
		const id = inject(sim, "audit");
		const events = run(sim, 1440 * 5);
		expect(sim.state.decision?.id).toBe(id);
		expect(count(events, "decisionResolved")).toBe(0);
		expect(sim.view().decisionHistory).toHaveLength(0);
		const before = sim.state.today.penalties;
		resolve(sim, id, "a");
		expect(sim.state.today.penalties - before).toBe(500); // only the player's choice applies anything
	});

	it("keeps only the last 20 resolved decisions, newest last", () => {
		const sim = newSim(fxContent(), "empty", 1);
		const ids: number[] = [];
		for (let i = 0; i < 25; i++) {
			const id = inject(sim, "fx");
			ids.push(id);
			resolve(sim, id, "a");
		}
		const h = sim.view().decisionHistory;
		expect(h).toHaveLength(20);
		expect(h.map((x) => x.decisionId)).toEqual(ids.slice(5));
	});
});

describe("deferDecision", () => {
	const mk = () => newSim(fxContent(), "empty", 1);

	it("hides the decision for one game day, then brings it back (announced again), and only once", () => {
		const sim = mk();
		const id = inject(sim, "fx");
		const events = exec(sim, { type: "deferDecision", decisionId: id });
		const deferred = events.find((e) => e.type === "decisionDeferred");
		expect(deferred).toMatchObject({ decisionId: id });
		expect(sim.view().decision).toBeNull();
		expect(sim.view().decisionReturnsAt).toBe((deferred as { until: number }).until);
		expect((deferred as { until: number }).until - sim.state.tick).toBeGreaterThanOrEqual(1439);
		const back = until(sim, (e) => e.type === "decisionIssued" && e.decisionId === id, 2000);
		expect(back).toBeDefined();
		const v = sim.view();
		expect(v.decision).toMatchObject({ id, canDefer: false });
		expect(v.decisionReturnsAt).toBeNull();
		const again = sim.submit({ type: "deferDecision", decisionId: id });
		expect(again).toEqual({ ok: false, reason: "already deferred once" });
	});

	it("deferring costs nothing, blocks new decisions while hidden, and a hidden decision cannot be answered", () => {
		const c = contentWith([ev("fx"), ev("other")], eventsBalance(100, 0));
		const sim = newSim(c, "empty", 1);
		const id = inject(sim, "fx");
		const cash = sim.state.cash;
		exec(sim, { type: "deferDecision", decisionId: id });
		expect(sim.submit({ type: "resolveDecision", decisionId: id, choiceId: "a" })).toEqual({ ok: false, reason: "no such decision" });
		const log = issueLog(sim, 1000, null);
		expect(log).toHaveLength(0);
		expect(sim.state.cash).toBe(cash);
	});
});

describe("advisor tips", () => {
	it("markTip records each tip id once and survives a snapshot", () => {
		const sim = newSim(fxContent(), "empty", 1);
		exec(sim, { type: "markTip", tipId: "heat" });
		exec(sim, { type: "markTip", tipId: "heat" });
		exec(sim, { type: "markTip", tipId: "power" });
		expect(sim.view().advisorTips).toEqual(["heat", "power"]);
		const twin = simFromSnapshot(sim.content, JSON.parse(JSON.stringify(sim.snapshot()))) as SimImpl;
		expect(twin.view().advisorTips).toEqual(["heat", "power"]);
	});
});

// ── effects ───────────────────────────────────────────────────────────────

describe("decision effects", () => {
	it("cash goes through the ledger: gains as revenue, losses as penalties", () => {
		const sim = newSim(fxContent(), "empty", 1);
		const cash0 = sim.state.cash;
		applyEffects(sim, [{ type: "cash", amount: 5000 }]);
		expect(sim.state.cash).toBe(cash0 + 5000);
		expect(sim.state.today.revenue).toBe(5000);
		applyEffects(sim, [{ type: "cash", amount: -2000 }]);
		expect(sim.state.cash).toBe(cash0 + 3000);
		expect(sim.state.today.penalties).toBe(2000);
		const day = sim.view().ledger.at(-1);
		expect(day).toMatchObject({ revenue: 5000, penalties: 2000 });
	});

	it("a cash penalty may push cash negative (no funds check)", () => {
		const sim = newSim(fxContent(), "empty", 1);
		sim.state.cash = 100;
		applyEffects(sim, [{ type: "cash", amount: -5000 }]);
		expect(sim.state.cash).toBe(-4900);
	});

	it("ambient: shifts the outdoor temperature for the duration, labelled in the view, then expires", () => {
		const c = fxContent();
		const sim = newSim(c, "empty", 1);
		applyEffects(sim, [{ type: "ambient", deltaC: 5, durationTicks: 100 }]);
		run(sim, 49);
		expect(sim.state.tick).toBe(50);
		run(sim, 1);
		expect(sim.state.ambientC).toBeCloseTo(ambientAt(c.balance, 50) + 5, 9);
		const mods = sim.view().modifiers;
		expect(mods).toHaveLength(1);
		expect(mods[0]).toMatchObject({ kind: "ambient", value: 5, endsAt: 100 });
		expect(mods[0].label).toMatch(/\+5.*°C/);
		run(sim, 48); // through tick 98 (state.tick 99)
		expect(sim.state.ambientC).toBeCloseTo(ambientAt(c.balance, 98) + 5, 9);
		run(sim, 2); // step at tick 99 still modified, tick 100 is not
		expect(sim.state.tick).toBe(101);
		expect(sim.state.ambientC).toBeCloseTo(ambientAt(c.balance, 100), 9);
		expect(sim.state.modifiers).toHaveLength(0);
		expect(sim.view().modifiers).toHaveLength(0);
	});

	it("ambient offsets add up", () => {
		const sim = newSim(fxContent(), "empty", 1);
		applyEffects(sim, [{ type: "ambient", deltaC: 5, durationTicks: 100 }]);
		applyEffects(sim, [{ type: "ambient", deltaC: -2, durationTicks: 100 }]);
		run(sim, 2);
		expect(sim.state.ambientC).toBeCloseTo(ambientAt(sim.content.balance, sim.state.tick - 1) + 3, 9);
	});

	it("gridCap: scales grid import capacity while active", () => {
		const power = scenario("pw", {
			slabs: [[0, 0, 47]],
			conduits: [["power", 0, 0, 47]],
			facilities: [
				{ defId: "grid_tie", floor: 0, x: 0 },
				{ defId: "rack_air_gpu", floor: 0, x: 12 },
				{ defId: "rack_air_gpu", floor: 0, x: 14 },
				{ defId: "rack_air_gpu", floor: 0, x: 16 },
				{ defId: "rack_air_gpu", floor: 0, x: 18 },
			],
		});
		const c = fxContent(QUIET, [power]);
		c.facilities.grid_tie.power = { capacityKw: 24 }; // = 4 idle racks
		const sim = newSim(c, "pw", 1);
		run(sim, 2);
		expect(sim.state.powerNets[0].satisfaction).toBe(1);
		applyEffects(sim, [{ type: "gridCap", factor: 0.5, durationTicks: 30 }]);
		expect(sim.state.powerNets[0].satisfaction).toBeCloseTo(0.5, 9);
		expect(sim.view().powerNets[0].gridImportKw).toBeCloseTo(12, 9);
		expect(sim.view().modifiers[0]).toMatchObject({ kind: "gridCap", value: 0.5 });
		run(sim, 40);
		expect(sim.state.powerNets[0].satisfaction).toBe(1);
		expect(sim.state.modifiers).toHaveLength(0);
		// A blackout (factor 0) removes the grid entirely.
		applyEffects(sim, [{ type: "gridCap", factor: 0, durationTicks: 10 }]);
		expect(sim.state.powerNets[0].satisfaction).toBe(0);
		expect(sim.view().modifiers[0].label).toMatch(/offline/i);
	});

	it("energyPrice: scales the price shown and the energy bill", () => {
		const power = scenario("pw2", {
			slabs: [[0, 0, 47]],
			conduits: [["power", 0, 0, 47]],
			facilities: [
				{ defId: "grid_tie", floor: 0, x: 0 },
				{ defId: "rack_air_gpu", floor: 0, x: 12 },
			],
		});
		const mk = () => newSim(fxContent(QUIET, [power]), "pw2", 1);
		const base = mk();
		const mod = mk();
		run(base, 3);
		applyEffects(mod, [{ type: "energyPrice", factor: 2, durationTicks: 1000 }]);
		run(mod, 2);
		expect(base.state.metrics.energyCost).toBeGreaterThan(0);
		expect(mod.state.metrics.energyCost).toBeCloseTo(2 * base.state.metrics.energyCost, 9);
		expect(mod.view().energyPrice).toBeCloseTo(2 * base.view().energyPrice, 9);
		expect(modFactor(mod.state, "energyPrice")).toBe(2);
	});

	it("payout: scales new offers generated while active (not earlier or later ones)", () => {
		const mk = () => newSim(fxContent(QUIET, [farm]), "farm", 3);
		const base = mk();
		const mod = mk();
		const record = (sim: SimImpl, ticks: number, startAt: number): Map<number, { gen: number; payout: number }> => {
			const out = new Map<number, { gen: number; payout: number }>();
			for (let i = 0; i < ticks; i++) {
				const t = sim.state.tick;
				if (t === startAt && sim === mod) applyEffects(sim, [{ type: "payout", factor: 3, durationTicks: 500 }]);
				else sim.step().forEach((e) => {
					if (e.type === "contractOffered") out.set(e.contractId, { gen: t, payout: sim.state.offers.find((o) => o.id === e.contractId)?.spec.payout ?? Number.NaN });
				});
			}
			return out;
		};
		// Offers are generated at the first step they exist; `applyEffects` consumes one step, so keep the base in lockstep.
		const a = record(base, 3000, -1);
		const b = record(mod, 3000, 100);
		expect(a.size).toBeGreaterThan(8);
		let boosted = 0;
		let normal = 0;
		for (const [id, x] of a) {
			const y = b.get(id);
			if (!y) continue;
			if (x.gen === y.gen && y.gen >= 100 && y.gen < 600) {
				expect(y.payout).toBeCloseTo(3 * x.payout, 6);
				boosted++;
			} else if (x.gen === y.gen && (y.gen < 100 || y.gen >= 601)) {
				expect(y.payout).toBe(x.payout);
				normal++;
			}
		}
		expect(boosted).toBeGreaterThan(0);
		expect(normal).toBeGreaterThan(0);
	});

	it("failureRate: scales the failure hazard", () => {
		const hot = () => {
			const c = fxContent();
			for (const id of ["rack_air_gpu", "rack_storage"]) {
				const r = c.facilities[id].rack;
				if (r) r.failurePerDay = 1;
			}
			return c;
		};
		const failures = (factor: number | null): number => {
			const sim = newSim(hot(), "farm", 8);
			if (factor !== null) applyEffects(sim, [{ type: "failureRate", factor, durationTicks: 100_000 }]);
			return count(run(sim, 600), "componentFailed");
		};
		const base = failures(null);
		expect(base).toBeGreaterThan(0);
		expect(failures(0.000001)).toBe(0);
		expect(failures(8)).toBeGreaterThan(base);
	});

	it("failRacks: fails exactly N healthy racks, seeded, never an already failed one", () => {
		const sim = newSim(fxContent(), "farm", 3);
		const racks = sim.state.facilities.filter((f) => f.defId.startsWith("rack_"));
		expect(racks).toHaveLength(5);
		failRack(sim.state, racks[0], []);
		const events = applyEffects(sim, [{ type: "failRacks", count: 2 }]);
		expect(count(events, "componentFailed")).toBe(2);
		expect(racks.filter((r) => r.failed)).toHaveLength(3);
		expect(sim.state.workOrders).toHaveLength(3);
		const more = applyEffects(sim, [{ type: "failRacks", count: 99 }]);
		expect(count(more, "componentFailed")).toBe(2); // only the 2 healthy ones are left
		expect(racks.every((r) => r.failed)).toBe(true);
	});

	it("failRacks is deterministic per seed and draws only from the events stream", () => {
		const pick = (seed: number): number[] => {
			const sim = newSim(fxContent(), "farm", seed);
			applyEffects(sim, [{ type: "failRacks", count: 2 }]);
			return sim.state.facilities.filter((f) => f.failed).map((f) => f.id);
		};
		expect(pick(7)).toEqual(pick(7));
		expect(new Set([1, 2, 3, 4, 5, 6].map((s) => pick(s).join(","))).size).toBeGreaterThan(1);

		const control = newSim(fxContent(), "farm", 4);
		run(control, 1);
		const sim = newSim(fxContent(), "farm", 4);
		applyEffects(sim, [{ type: "failRacks", count: 3 }]);
		expect(sim.state.rng.contracts).toBe(control.state.rng.contracts);
		expect(sim.state.rng.events).not.toBe(control.state.rng.events);
	});

	it("spareParts: adds up to depot capacity, removes down to zero", () => {
		const sim = newSim(fxContent(), "farm", 1);
		const parts = () => sim.view().spareParts;
		expect(parts()).toBe(4);
		applyEffects(sim, [{ type: "spareParts", count: 5 }]);
		expect(parts()).toBe(9);
		applyEffects(sim, [{ type: "spareParts", count: -3 }]);
		expect(parts()).toBe(6);
		applyEffects(sim, [{ type: "spareParts", count: 500 }]);
		expect(parts()).toBe(20); // depot capacity
		applyEffects(sim, [{ type: "spareParts", count: -500 }]);
		expect(parts()).toBe(0);
	});

	it("several effects in one choice all apply", () => {
		const sim = newSim(fxContent(), "farm", 1);
		const cash0 = sim.state.cash;
		const events = applyEffects(sim, [
			{ type: "cash", amount: -1000 },
			{ type: "bond", advisor: "mel", amount: -5 },
			{ type: "spareParts", count: 2 },
			{ type: "energyPrice", factor: 1.5, durationTicks: 60 },
		]);
		expect(sim.state.today.penalties).toBeGreaterThanOrEqual(1000);
		expect(cash0 - sim.state.cash).toBeGreaterThanOrEqual(1000);
		expect(sim.state.bonds.mel).toBe(45);
		expect(sim.view().spareParts).toBe(6);
		expect(sim.state.modifiers).toHaveLength(1);
		expect(events.some((e) => e.type === "decisionResolved")).toBe(true);
	});
});

// ── jobs ──────────────────────────────────────────────────────────────────

const training = (over: Partial<ContractSpec> = {}): ContractSpec => ({
	clientId: "t",
	clientName: "Trainer",
	kind: "training",
	work: 40,
	durationTicks: 1440,
	payout: 100_000,
	penalty: 30_000,
	needsLiquid: false,
	storageTB: 0,
	checkpointTicks: 60,
	...over,
});

function accept(sim: SimImpl, spec: ContractSpec): number {
	// Power is first solved inside a tick; at tick 0 every rack still reads unpowered and acceptance would refuse.
	if (sim.state.tick === 0) sim.step();
	const id = sim.state.nextId.contract++;
	sim.state.offers.push({ id, spec, expiresAt: sim.state.tick + 100_000 });
	const e = exec(sim, { type: "acceptContract", contractId: id }).find((x) => x.type === "jobStarted");
	if (e?.type !== "jobStarted") throw new Error("job not started");
	return e.jobId;
}

const noOffers = (extra: Partial<Balance> = {}) => contentWith([ev("fx")], { ...QUIET, economy: { slaPenaltyFactor: 1.5, maxOffers: 0, offerIntervalTicks: 100, offerExpiryTicks: 100 }, ...extra });

describe("no reputation", () => {
	it("a missed day, a finished job and a failed job move nothing but money (reputation is gone)", () => {
		const sim = newSim(noOffers(), "farm", 1);
		sim.state.tier = 2;
		accept(sim, training());
		const done = run(sim, 60);
		expect(count(done, "jobCompleted")).toBe(1);
		for (const f of sim.state.facilities) if (f.defId.startsWith("rack_")) failRack(sim.state, f, []);
		const day = run(sim, 1440);
		expect(day.filter((e) => e.type === "gameOver")).toHaveLength(0);
		expect(sim.state).not.toHaveProperty("standing");
	});
});

// ── game over ─────────────────────────────────────────────────────────────

describe("game over", () => {
	it("bankrupt: set once when the bankrupt flag trips, and never again", () => {
		const sim = newSim(contentWith([]), "empty", 1);
		expect(sim.view().gameOver).toBeNull();
		sim.state.cash = -1;
		const events = run(sim, 1440 + 5);
		expect(count(events, "bankrupt")).toBe(1);
		expect(events.filter((e) => e.type === "gameOver")).toEqual([{ type: "gameOver", kind: "bankrupt" }]);
		expect(sim.view().gameOver).toEqual({ kind: "bankrupt", tick: 1439 });
		// Recover, go under again: the flag trips again but the game over stays the first one.
		sim.state.cash = 1000;
		run(sim, 2);
		expect(sim.view().bankrupt).toBe(false);
		sim.state.cash = -1;
		const again = run(sim, 1440 + 5);
		expect(count(again, "bankrupt")).toBe(1);
		expect(count(again, "gameOver")).toBe(0);
		expect(sim.view().gameOver?.kind).toBe("bankrupt");
	});

	it("reaching the top tier is no longer a win: only the path endings end the game that way", () => {
		const c = noOffers({ tiers: { pflops: [0, 1], uptime: [0, 0], reward: [0, 100] } });
		const sim = newSim(c, "farm", 1);
		expect(run(sim, 1000).filter((e) => e.type === "gameOver")).toHaveLength(0);
		const events = run(sim, 440);
		expect(events.map((e) => e.type).filter((t) => t === "tierUp" || t === "gameOver")).toEqual(["tierUp"]);
		expect(sim.view().gameOver).toBeNull();
		expect(count(run(sim, 1440 * 2), "gameOver")).toBe(0);
	});

	it("no victory just for sitting at the top tier of a one-tier ladder before earning it", () => {
		const c = noOffers({ tiers: { pflops: [0], uptime: [0], reward: [0] } });
		const sim = newSim(c, "farm", 1);
		expect(count(run(sim, 1440 * 2), "gameOver")).toBe(0);
	});

	it("the first game over wins when several happen", () => {
		const sim = newSim(fxContent(), "empty", 1);
		sim.state.gameOver = { kind: "absorbed", tick: 0, ending: "absorbed" };
		sim.state.cash = -1;
		const events = run(sim, 1500);
		expect(count(events, "bankrupt")).toBe(1);
		expect(count(events, "gameOver")).toBe(0);
		expect(sim.view().gameOver?.kind).toBe("absorbed");
	});
});

// ── determinism, streams, snapshots ──────────────────────────────────────

/** A scripted player: resolves each decision one tick after it appears (even ids pick the second choice). */
function playDays(sim: SimImpl, days: number, hook?: (tick: number) => void): void {
	for (let i = 0; i < days * 1440; i++) {
		for (const e of sim.step()) {
			if (e.type === "contractOffered") sim.submit({ type: "acceptContract", contractId: e.contractId });
			if (e.type === "decisionIssued") sim.submit({ type: "resolveDecision", decisionId: e.decisionId, choiceId: e.decisionId % 2 === 0 ? "b" : "a" });
		}
		hook?.(sim.state.tick);
	}
}

const richEvents = (): EventDef[] => [
	ev("r1", { choices: [choice("a", [{ type: "cash", amount: -5000 }, { type: "bond", advisor: "bea", amount: 2 }]), choice("b", [{ type: "ambient", deltaC: 3, durationTicks: 700 }])] }),
	ev("r2", { advisor: "cass", recommended: "b", choices: [choice("a", [{ type: "failRacks", count: 1 }]), choice("b", [{ type: "energyPrice", factor: 1.5, durationTicks: 1200 }, { type: "spareParts", count: -1 }])] }),
	ev("r3", { choices: [choice("a", [{ type: "payout", factor: 1.2, durationTicks: 3000 }]), choice("b", [{ type: "gridCap", factor: 0.9, durationTicks: 300 }, { type: "failureRate", factor: 1.4, durationTicks: 900 }])] }),
];

describe("determinism and snapshots", () => {
	const mk = (seed: number) => newSim(contentWith(richEvents(), eventsBalance(500, 600)), "farm", seed);

	it("same seed ⇒ same hash trace; snapshots mid-run reload to the same hash and continue identically", () => {
		const a = mk(11);
		const b = mk(11);
		const trace = (sim: SimImpl): string[] => {
			const out: string[] = [];
			playDays(sim, 6, (t) => {
				if (t % 400 === 0) out.push(sim.hash());
			});
			return out;
		};
		const ta = trace(a);
		expect(ta).toEqual(trace(b));
		expect(ta.length).toBeGreaterThan(15);
		expect(mk(12).hash()).not.toBe(mk(11).hash());

		const c = mk(11);
		const snaps: { open: number; mods: number; hist: number }[] = [];
		for (let day = 0; day < 9; day++) {
			playDays(c, 1);
			snaps.push({ open: c.state.decision ? 1 : 0, mods: c.state.modifiers.length, hist: c.state.decisionHistory.length });
			const twin = simFromSnapshot(c.content, JSON.parse(JSON.stringify(c.snapshot()))) as SimImpl;
			expect(twin.hash(), `day ${day}`).toBe(c.hash());
		}
		expect(snaps.some((s) => s.mods > 0)).toBe(true);
		expect(snaps.at(-1)?.hist).toBeGreaterThan(3);
		// Mid-flight (live modifiers) continues identically after a reload.
		const d = mk(21);
		playDays(d, 2);
		const twin = simFromSnapshot(d.content, JSON.parse(JSON.stringify(d.snapshot()))) as SimImpl;
		playDays(d, 3);
		playDays(twin, 3);
		expect(twin.hash()).toBe(d.hash());
	});

	it("decisions never perturb the contract or reliability RNG streams", () => {
		const hot = (events: EventDef[]) => {
			const c = contentWith(events, eventsBalance(500, 600));
			const r = c.facilities.rack_air_gpu.rack;
			if (r) r.failurePerDay = 1;
			return newSim(c, "farm", 9);
		};
		const a = hot([]);
		const b = hot([ev("quiet", { cooldownDays: 0 })]);
		const ea = run(a, 1440 * 8);
		const eb = run(b, 1440 * 8);
		expect(count(eb, "decisionIssued")).toBeGreaterThanOrEqual(1); // never answered, so only the first opens
		expect(a.state.rng.contracts).toBe(b.state.rng.contracts);
		expect(a.state.rng.reliability).toBe(b.state.rng.reliability);
		expect(count(ea, "componentFailed")).toBe(count(eb, "componentFailed"));
		expect(a.state.offers).toEqual(b.state.offers);
		expect(a.state.cash).toBe(b.state.cash);
		expect(createRng(9).events).not.toBe(createRng(9).contracts);
	});

	it("a v2 save (before the Ministry) migrates with sane defaults and keeps running", () => {
		const sim = mk(5);
		run(sim, 300);
		const snap = JSON.parse(JSON.stringify(sim.snapshot())) as { version: number; state: Raw };
		expect(snap.version).toBe(SNAPSHOT_VERSION);
		snap.version = 2;
		for (const k of ["decision", "decisionHistory", "modifiers", "nextDecisionTick", "lastDecisionDay", "decisionGate", "advisorTips", "lastIssuedDay", "gameOver"]) delete snap.state[k];
		delete snap.state.rng.events;
		delete snap.state.nextId.decision;
		const old = simFromSnapshot(sim.content, snap as never) as SimImpl;
		expect(old.state).toMatchObject({ decision: null, decisionHistory: [], modifiers: [], lastIssuedDay: {}, gameOver: null, nextDecisionTick: 300 + 1440, decisionGate: true, advisorTips: [] });
		expect(old.state.nextId.decision).toBe(1);
		expect(old.state.rng.events).toBe(createRng(5).events);
		expect(old.snapshot().version).toBe(SNAPSHOT_VERSION);
		playDays(old, 4);
		expect(old.state.decisionHistory.length + (old.state.decision ? 1 : 0)).toBeGreaterThan(0);
		// And the migrated state reloads cleanly.
		expect(() => simFromSnapshot(old.content, JSON.parse(JSON.stringify(old.snapshot())))).not.toThrow();
	});

	it("a v8 save with pending memos becomes one pending decision (no expiry), history and counters move over", () => {
		const sim = mk(5);
		playDays(sim, 3);
		const snap = JSON.parse(JSON.stringify(sim.snapshot())) as { version: number; state: Raw };
		const st = snap.state;
		snap.version = 8;
		for (const k of ["decision", "decisionHistory", "nextDecisionTick", "lastDecisionDay", "decisionGate", "advisorTips"]) delete st[k];
		delete st.nextId.decision;
		delete st.stats.decisionsMade;
		st.memos = [{ id: 4, eventId: "r2", issuedAt: 100, expiresAt: 5000 }, { id: 5, eventId: "r1", issuedAt: 200, expiresAt: 5100 }];
		st.memoHistory = [{ memoId: 2, eventId: "r1", title: "Title r1", choiceId: "a", outcome: "o", tick: 50, auto: true }];
		st.nextMemoTick = 4321;
		st.nextId.memo = 6;
		st.stats.memosAnswered = 7;
		const old = simFromSnapshot(sim.content, snap as never) as SimImpl;
		expect(old.state.decision).toEqual({ id: 4, eventId: "r2", issuedAt: 100, deferred: false, hiddenUntil: 0 });
		expect(old.state.decisionHistory).toEqual([{ decisionId: 2, eventId: "r1", title: "Title r1", choiceId: "a", outcome: "o", tick: 50 }]);
		expect(old.state).toMatchObject({ nextDecisionTick: 4321, decisionGate: true, advisorTips: [] });
		expect(old.state.nextId.decision).toBe(6);
		expect(old.state.stats.decisionsMade).toBe(7);
		expect(old.state).not.toHaveProperty("standingLog");
		for (const gone of ["memos", "memoHistory", "nextMemoTick"]) expect(old.state).not.toHaveProperty(gone);
		expect(old.snapshot().version).toBe(SNAPSHOT_VERSION);
		// Waiting never expires it, however long the old clock had run.
		run(old, 1440 * 3);
		expect(old.state.decision?.id).toBe(4);
	});

	it("a bankrupt v2 save keeps its game over", () => {
		const sim = mk(5);
		sim.state.bankrupt = true;
		const snap = JSON.parse(JSON.stringify(sim.snapshot())) as { version: number; state: Raw };
		snap.version = 2;
		for (const k of ["decision", "decisionHistory", "modifiers", "nextDecisionTick", "lastDecisionDay", "decisionGate", "advisorTips", "lastIssuedDay", "gameOver"]) delete snap.state[k];
		delete snap.state.rng.events;
		delete snap.state.nextId.decision;
		const old = simFromSnapshot(sim.content, snap as never) as SimImpl;
		expect(old.view().gameOver).toEqual({ kind: "bankrupt", tick: 0 });
	});

	describe("validation of the new fields", () => {
		const base = () => {
			const sim = mk(5);
			playDays(sim, 2);
			// Make sure there is something of every kind to corrupt.
			if (!sim.state.decision) inject(sim, "r1");
			sim.state.modifiers.push({ kind: "ambient", value: 1, endsAt: 99999, label: "x" });
			sim.state.gameOver = { kind: "victory", tick: 5 };
			return JSON.parse(JSON.stringify(sim.snapshot())) as { version: number; state: Raw };
		};
		const reject = (mutate: (s: Raw) => void, re: RegExp) => {
			const snap = base();
			mutate(snap.state);
			expect(() => simFromSnapshot(mk(5).content, snap as never)).toThrow(re);
		};
		it("accepts the untouched snapshot", () => {
			expect(() => simFromSnapshot(mk(5).content, base() as never)).not.toThrow();
		});
		it("rejects bad decision state", () => {
			reject((s) => { s.decision.eventId = "ghost"; }, /^Invalid save: .*unknown event/);
			reject((s) => { s.decision.id = 0; }, /^Invalid save: .*decision/);
			reject((s) => { s.nextId.decision = 0; }, /^Invalid save: /);
			reject((s) => { delete s.nextId.decision; }, /^Invalid save: nextId\.decision/);
			reject((s) => { s.modifiers[s.modifiers.length - 1].kind = "nope"; }, /^Invalid save: modifiers/);
			reject((s) => { s.modifiers[s.modifiers.length - 1].value = -2; kindFix(s); }, /^Invalid save: modifiers/);
			reject((s) => { s.gameOver = { kind: "meh", tick: 1 }; }, /^Invalid save: gameOver/);
			reject((s) => { s.gameOver = 5; }, /^Invalid save: gameOver/);
			reject((s) => { s.decisionHistory = new Array(21).fill({ decisionId: 1, eventId: "r1", title: "t", choiceId: "a", outcome: "o", tick: 1 }); }, /^Invalid save: decisionHistory/);
			reject((s) => { s.decisionHistory = [{ decisionId: 1 }]; }, /^Invalid save: decisionHistory\[0\]/);
			reject((s) => { s.lastIssuedDay = { r1: 1.5 }; }, /^Invalid save: lastIssuedDay/);
			reject((s) => { s.lastIssuedDay = []; }, /^Invalid save: lastIssuedDay/);
			reject((s) => { delete s.rng.events; }, /^Invalid save: rng\.events/);
			reject((s) => { s.nextDecisionTick = Number.NaN; }, /^Invalid save: /);
		});
		function kindFix(s: Raw): void {
			s.modifiers[s.modifiers.length - 1].kind = "payout";
		}
		it("rejects a decision whose event no longer exists in the content", () => {
			const snap = base();
			const other = contentWith([ev("different")], eventsBalance(500, 600));
			expect(() => simFromSnapshot(other, snap as never)).toThrow(/^Invalid save: .*unknown event/);
		});
	});

	it("the facility farm keeps the facility lookup helper honest", () => {
		expect(facilityOf(mk(1), "rack_air_gpu")).toBeDefined();
	});
});
