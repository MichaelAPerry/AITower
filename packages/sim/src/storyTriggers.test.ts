/** The seal and night-shift story scenes: each fires once, at the right moment and never before, with no new state field. */
import { type ContentDB, loadContent } from "@aitower/content";
import { describe, expect, it } from "vitest";
import type { SimEvent } from "./api";
import { dayOf } from "./core/time";
import { type SimImpl, createSim } from "./sim";

/** Real content where the only story scene is `id`, so nothing else can take the decision slot. */
const only = (id: string): ContentDB => {
	const c = loadContent();
	c.events = c.events.filter((e) => e.id === id);
	expect(c.events, id).toHaveLength(1);
	return c;
};
const sim = (id: string): SimImpl => createSim(only(id), "starter", 1) as SimImpl;
const steps = (s: SimImpl, n: number): SimEvent[] => {
	const out: SimEvent[] = [];
	for (let i = 0; i < n; i++) out.push(...s.step());
	return out;
};
/** Step long enough for the story check (every 10 ticks) and the spacing rule to let a scene through. */
const SETTLE = 400;
const answer = (s: SimImpl, choiceId: string): void => {
	const d = s.view().decision;
	expect(d).not.toBeNull();
	expect(s.submit({ type: "resolveDecision", decisionId: d?.id ?? -1, choiceId })).toEqual({ ok: true });
	s.step();
};

describe("seal scenes", () => {
	for (const [id, tree, other, advisor] of [
		["seal_biotech", "biotech", "greentech", "mel"],
		["seal_greentech", "greentech", "biotech", "bea"],
	] as const) {
		it(`${id} plays once, when that tree's seal reaches 100, and never before`, () => {
			const s = sim(id);
			steps(s, SETTLE);
			expect(s.view().decision).toBeNull();
			// Just under the bar, and the other tree sealed: nothing.
			s.state.sealScar[tree] = 99;
			s.state.sealResidue[other] = 100;
			steps(s, SETTLE);
			expect(s.view().decision).toBeNull();
			s.state.sealResidue[tree] = 1; // 99 scar + 1 residue = 100
			steps(s, SETTLE);
			const d = s.view().decision;
			expect(d?.eventId).toBe(id);
			expect(d?.advisor).toBe(advisor);
			expect(d?.canDefer).toBe(false);
			expect(s.state.scriptedIssued).toContain(id);
			answer(s, d?.choices[0].id ?? "");
			// Clearing the residue and sealing again does not replay it.
			s.state.sealResidue[tree] = 0;
			steps(s, SETTLE);
			s.state.sealResidue[tree] = 5;
			steps(s, SETTLE * 2);
			expect(s.view().decision).toBeNull();
		});
	}

});

describe("cass_night_shift", () => {
	it("plays once, from day 10 on, and never before", () => {
		const s = sim("cass_night_shift");
		const first = Math.max(14400, Math.ceil(14400 / 1440) * 1440);
		expect(dayOf(first)).toBeGreaterThanOrEqual(10);
		expect(dayOf(first - 1)).toBe(9);
		s.state.tick = first - 40;
		steps(s, 39);
		expect(s.view().decision).toBeNull();
		steps(s, SETTLE);
		const d = s.view().decision;
		expect(d?.eventId).toBe("cass_night_shift");
		expect(d?.advisor).toBe("cass");
		expect(s.state.tick).toBeGreaterThanOrEqual(first);
		const cash = s.state.cash;
		answer(s, "ask");
		expect(cash - s.state.cash).toBeLessThan(1000); // the honest version costs nothing
		steps(s, SETTLE * 3);
		expect(s.view().decision).toBeNull();
	});

	it("the rush order costs $12,000", () => {
		const s = sim("cass_night_shift");
		s.state.tick = 14400;
		steps(s, SETTLE);
		expect(s.view().decision?.eventId).toBe("cass_night_shift");
		const cash = s.state.cash;
		answer(s, "order");
		expect(cash - s.state.cash).toBeGreaterThan(11000); // $12,000 out; a step of income is small
	});
});

describe("tip_seal", () => {
	it("plays once, Bea speaking, the first time any seal rises above the starting 10 and never before", () => {
		const s = sim("tip_seal");
		steps(s, SETTLE);
		expect(s.view().decision).toBeNull();
		// the starter tower already sits at 10 and the bar rounds: only 10.5 or more is a visible rise
		steps(s, SETTLE);
		expect(s.view().decision).toBeNull();
		s.state.sealScar.greentech = 12;
		steps(s, SETTLE);
		const d = s.view().decision;
		expect(d?.eventId).toBe("tip_seal");
		expect(d?.advisor).toBe("bea");
		answer(s, d?.choices[0].id ?? "");
		s.state.sealScar.greentech = 0;
		steps(s, SETTLE);
		s.state.sealScar.biotech = 5;
		steps(s, SETTLE * 2);
		expect(s.view().decision).toBeNull();
	});
});
