/** The after-hours easter eggs (docs/AFTER_HOURS.md): fixed spots, click streaks, the two dialogues, the purchase and saves. */
import { type ContentDB, loadContent } from "@aitower/content";
import { describe, expect, it } from "vitest";
import { AFTER_HOURS_SPOTS, afterHoursBlock, streakOf } from "./afterHours/spots";
import { migrateState } from "./snapshot/migrate";
import { type SimImpl, SNAPSHOT_VERSION, createSim, simFromSnapshot } from "./sim";

/** Real content where the only story scenes are the after-hours ones, so nothing else takes the decision slot. */
const only = (): ContentDB => {
	const c = loadContent();
	c.events = c.events.filter((e) => e.id.startsWith("ah_"));
	return c;
};
const sim = (scenario = "starter"): SimImpl => createSim(only(), scenario, 1) as SimImpl;
const DAY = 1440;
/** Jump to 10:00 of `day` (the sim is a pure function of its state, so moving the clock is how the tests pass days). */
const goTo = (s: SimImpl, day: number): void => {
	s.state.tick = day * DAY + 600;
};
const click = (s: SimImpl, item: string, day: number): void => {
	goTo(s, day);
	expect(s.submit({ type: "clickAfterHours", item: item as never }), `${item} day ${day}`).toEqual({ ok: true });
	s.step();
};
const answer = (s: SimImpl, choiceId: string): void => {
	const d = s.view().decision;
	expect(d).not.toBeNull();
	expect(s.submit({ type: "resolveDecision", decisionId: d?.id ?? -1, choiceId })).toEqual({ ok: true });
	s.step();
};
const streak = (s: SimImpl, item: "fern" | "tank" | "coffee" | "book"): number => s.view().afterHours.items.find((i) => i.id === item)?.streak ?? -1;

describe("the four spots", () => {
	it("stand where the owner put them and never overlap a facility, a lift or each other in any scenario", () => {
		expect(AFTER_HOURS_SPOTS.map((p) => [p.id, p.advisor, p.floor])).toEqual([["tank", "mel", -1], ["fern", "bea", 0], ["coffee", "cass", 0], ["book", "luci", -1]]);
		// The fern and the coffee machine are on opposite sides of the lobby.
		const fern = AFTER_HOURS_SPOTS.find((p) => p.id === "fern");
		const coffee = AFTER_HOURS_SPOTS.find((p) => p.id === "coffee");
		expect((fern?.x ?? 99) + 20).toBeLessThan(coffee?.x ?? 0);
		const c = loadContent();
		for (const id of ["starter", "brownfield", "sandbox", "lesson_earn"]) {
			const s = createSim(c, id, 1) as SimImpl;
			for (const p of AFTER_HOURS_SPOTS) {
				for (let x = p.x; x < p.x + p.width; x++) {
					const hit = s.state.facilities.find((f) => f.floor === p.floor && x >= f.x && x < f.x + f.width);
					expect(hit, `${id} ${p.id} x=${x}`).toBeUndefined();
					expect(s.state.lifts.find((l) => l.x === x && p.floor >= l.floorMin && p.floor <= l.floorMax), `${id} ${p.id} lift`).toBeUndefined();
				}
				expect(p.x + p.width).toBeLessThanOrEqual(s.state.width);
				for (let x = p.x; x < p.x + p.width; x++) expect(s.state.slab[(p.floor - s.state.floorMin) * s.state.width + x], `${id} ${p.id} slab x=${x}`).toBe(1);
			}
		}
	});

	it("cannot be built over: a facility or a lift on a spot is refused", () => {
		const s = sim();
		expect(afterHoursBlock(s.state, 0, 4, 4)).toMatch(/not for building/);
		expect(afterHoursBlock(s.state, 0, 10, 12)).toBeNull();
		expect(afterHoursBlock(s.state, -1, 32, 32)).not.toBeNull();
		// Every game mode has the spots, the sandbox and lessons too.
		expect(afterHoursBlock({ scenarioId: "sandbox" }, 0, 4, 4)).not.toBeNull();
		expect(afterHoursBlock({ scenarioId: "lesson_earn" }, 0, 4, 4)).not.toBeNull();
		s.state.cash = 1e9;
		const fern = AFTER_HOURS_SPOTS.find((p) => p.id === "fern");
		const r = s.canBuild({ type: "place", defId: "crah_unit", floor: 0, x: fern?.x ?? 4 });
		expect(r.ok).toBe(false);
		const tank = AFTER_HOURS_SPOTS.find((p) => p.id === "tank");
		expect(s.canBuild({ type: "place", defId: "crah_unit", floor: -1, x: tank?.x ?? 31 }).ok).toBe(false);
		// A lift through the coffee corner is refused as well.
		const cx = AFTER_HOURS_SPOTS.find((p) => p.id === "coffee")?.x ?? 42;
		const lift = s.canBuild({ type: "buildLift", x: cx, floorMin: 0, floorMax: 1 });
		expect(lift.ok).toBe(false);
		// And another tile of the same floor is fine.
		expect(s.canBuild({ type: "place", defId: "crah_unit", floor: 0, x: 22 }).ok).toBe(true);
	});

	it("show in the view in every mode, with no extra floor built", () => {
		for (const id of ["starter", "brownfield", "sandbox"]) {
			const s = sim(id);
			expect(s.view().afterHours.items.map((i) => i.visible), id).toEqual([true, true, true, true]);
		}
	});
});

describe("the streak", () => {
	it("counts one click a day, in a row", () => {
		const s = sim();
		click(s, "fern", 1);
		expect(streak(s, "fern")).toBe(1);
		click(s, "fern", 1); // a second click the same day adds nothing
		click(s, "fern", 1);
		expect(streak(s, "fern")).toBe(1);
		click(s, "fern", 2);
		expect(streak(s, "fern")).toBe(2);
		expect(streak(s, "tank")).toBe(0); // the items count separately
	});

	it("a missed day resets the count to 0 (and the next click starts again at 1)", () => {
		const s = sim();
		click(s, "tank", 1);
		click(s, "tank", 2);
		expect(streak(s, "tank")).toBe(2);
		goTo(s, 3);
		s.step();
		expect(streak(s, "tank")).toBe(2); // day 3 is not over: still alive
		goTo(s, 4);
		s.step();
		expect(streak(s, "tank")).toBe(0); // day 3 passed with no click
		click(s, "tank", 4);
		expect(streak(s, "tank")).toBe(1);
		expect(streakOf({ streak: 5, lastDay: 7, thirdSeen: false, tenthReached: false, offers: 0, bought: false }, 9)).toBe(0);
	});

	it("a click does nothing visible: no decision before the third day, no cash change", () => {
		const s = sim();
		const cash = s.state.cash;
		click(s, "coffee", 1);
		click(s, "coffee", 2);
		expect(s.view().decision).toBeNull();
		expect(s.state.cash).toBeGreaterThan(cash - 100000);
	});

	it("is refused while a decision is open", () => {
		const s = sim("sandbox");
		click(s, "fern", 1);
		expect(streak(s, "fern")).toBe(1);
		const t = sim();
		click(t, "fern", 1);
		click(t, "fern", 2);
		click(t, "fern", 3);
		expect(t.view().decision?.eventId).toBe("ah_fern_third");
		goTo(t, 4);
		t.submit({ type: "clickAfterHours", item: "tank" });
		t.step();
		expect(streak(t, "tank")).toBe(0);
	});
});

describe("the third-day dialogue", () => {
	for (const [item, advisor] of [["fern", "bea"], ["tank", "mel"], ["coffee", "cass"], ["book", "luci"]] as const) {
		it(`${item}: opens on the third consecutive day, spoken by ${advisor}, with Yes and No`, () => {
			const s = sim("brownfield"); // F2 is built here, so the book can be clicked too
			click(s, item, 1);
			click(s, item, 2);
			expect(s.view().decision).toBeNull();
			click(s, item, 3);
			const d = s.view().decision;
			expect(d?.eventId).toBe(`ah_${item}_third`);
			expect(d?.advisor).toBe(advisor);
			expect(d?.canDefer).toBe(false);
			expect(d?.choices.map((c) => c.id)).toEqual(["yes", "no"]);
			expect(d?.lines?.every((l) => l.who === advisor)).toBe(true);
			expect(d?.choices.every((c) => c.cost === undefined && c.reply?.length === 1)).toBe(true);
		});
	}

	it("the answer changes nothing: the count goes on, and the dialogue does not come back", () => {
		for (const choice of ["yes", "no"]) {
			const s = sim();
			click(s, "fern", 1);
			click(s, "fern", 2);
			click(s, "fern", 3);
			const cash = s.state.cash;
			answer(s, choice);
			expect(s.state.cash).toBeGreaterThan(cash - 100000);
			expect(streak(s, "fern")).toBe(3);
			expect(s.view().afterHours.items.find((i) => i.id === "fern")?.bought).toBe(false);
			click(s, "fern", 4);
			expect(streak(s, "fern")).toBe(4);
			expect(s.view().decision).toBeNull();
		}
	});

	it("does not come at all when a day is missed before the third", () => {
		const s = sim();
		click(s, "fern", 1);
		click(s, "fern", 2);
		click(s, "fern", 4); // day 3 missed
		expect(streak(s, "fern")).toBe(1);
		expect(s.view().decision).toBeNull();
	});
});

describe("the tenth-day dialogue and the purchase", () => {
	const tenDays = (s: SimImpl, item: string): void => {
		for (let d = 1; d <= 10; d++) {
			click(s, item, d);
			if (s.view().decision) answer(s, "no"); // the third-day question on day 3
		}
	};

	it("offers the upgrade on the tenth consecutive day", () => {
		const s = sim();
		tenDays(s, "coffee");
		// The tenth click opened the offer and tenDays answered No; click once more later to see it again.
		const t = sim();
		for (let d = 1; d <= 9; d++) {
			click(t, "coffee", d);
			if (t.view().decision) answer(t, "yes");
		}
		expect(t.view().decision).toBeNull();
		click(t, "coffee", 10);
		const d = t.view().decision;
		expect(d?.eventId).toBe("ah_coffee_tenth");
		expect(d?.advisor).toBe("cass");
		expect(d?.lines?.[0].who).toBe("cass");
		expect(d?.choices.find((c) => c.id === "yes")?.cost).toBe(1_000_000);
		expect(d?.choices.find((c) => c.id === "no")?.cost).toBeUndefined();
	});

	it("Yes buys it when affordable: $1,000,000 leaves the bank, the item is upgraded, the unlock is in the view", () => {
		const s = sim();
		for (let d = 1; d <= 9; d++) {
			click(s, "fern", d);
			if (s.view().decision) answer(s, "yes");
		}
		click(s, "fern", 10);
		s.state.cash = 2_000_000;
		const before = s.state.cash;
		answer(s, "yes");
		const item = s.view().afterHours.items.find((i) => i.id === "fern");
		expect(item?.bought).toBe(true);
		expect(item?.advisor).toBe("bea");
		expect(before - s.state.cash).toBeGreaterThanOrEqual(1_000_000);
		expect(before - s.state.cash).toBeLessThan(1_050_000);
		// Bought: clicks no longer open anything.
		click(s, "fern", 11);
		click(s, "fern", 12);
		expect(s.view().decision).toBeNull();
		// The other items are not affected.
		expect(s.view().afterHours.items.filter((i) => i.bought).map((i) => i.id)).toEqual(["fern"]);
	});

	it("Yes is refused when the cash is not there, and nothing is bought", () => {
		const s = sim();
		for (let d = 1; d <= 9; d++) {
			click(s, "tank", d);
			if (s.view().decision) answer(s, "yes");
		}
		click(s, "tank", 10);
		s.state.cash = 900_000;
		const d = s.view().decision;
		const r = s.submit({ type: "resolveDecision", decisionId: d?.id ?? -1, choiceId: "yes" });
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.reason).toMatch(/1,000,000/);
		s.step();
		expect(s.view().afterHours.items.find((i) => i.id === "tank")?.bought).toBe(false);
		expect(s.view().decision).not.toBeNull();
		answer(s, "no");
		expect(s.view().afterHours.items.find((i) => i.id === "tank")?.bought).toBe(false);
	});

	it("No leaves it open: later clicks re-offer with a short lead-in line and then the same tenth-day dialogue", () => {
		const s = sim();
		for (let d = 1; d <= 9; d++) {
			click(s, "coffee", d);
			if (s.view().decision) answer(s, "no");
		}
		click(s, "coffee", 10);
		const first = s.view().decision;
		expect(first?.lines?.[0].who).toBe("cass");
		const tenth = first?.lines ?? [];
		answer(s, "no");
		const leads: string[] = [];
		for (let k = 0; k < 4; k++) {
			click(s, "coffee", 11 + k); // even a click after a missed-day reset (the day count does not matter any more)
			const d = s.view().decision;
			expect(d?.eventId).toBe("ah_coffee_tenth");
			expect(d?.lines?.length).toBe(tenth.length + 1);
			expect(d?.lines?.[0]).toMatchObject({ who: "narrator" });
			expect(d?.lines?.slice(1)).toEqual(tenth);
			leads.push(d?.lines?.[0].text ?? "");
			answer(s, "no");
		}
		// Different wordings, cycling.
		expect(new Set(leads.slice(0, 3)).size).toBe(3);
		expect(leads[3]).toBe(leads[0]);
		expect(leads[0]).toBe("[ buy the coffee machine ]");
		// Coming back after a missed day still re-offers.
		click(s, "coffee", 30);
		expect(s.view().decision?.eventId).toBe("ah_coffee_tenth");
		answer(s, "yes");
		expect(s.view().afterHours.items.find((i) => i.id === "coffee")?.bought).toBe(true);
	});

	it("tenDays helper sanity: ten days of clicks end in the offer", () => {
		const s = sim();
		tenDays(s, "tank");
		expect(s.state.afterHours.tank.tenthReached).toBe(true);
	});
});

describe("saves", () => {
	it("round-trips the click state exactly", () => {
		const s = sim();
		click(s, "fern", 1);
		click(s, "fern", 2);
		click(s, "fern", 3);
		const twin = simFromSnapshot(s.content, JSON.parse(JSON.stringify(s.snapshot()))) as SimImpl;
		expect(twin.hash()).toBe(s.hash());
		expect(twin.state.afterHours.fern).toMatchObject({ streak: 3, thirdSeen: true });
		expect(twin.view().decision?.eventId).toBe("ah_fern_third");
	});

	it("an old (v16) save loads: the bonds are dropped and the after-hours state starts fresh", () => {
		const s = sim();
		const snap = JSON.parse(JSON.stringify(s.snapshot())) as { version: number; state: Record<string, unknown> };
		snap.version = 16;
		delete snap.state.afterHours;
		snap.state.bonds = { cass: 40, bea: 20, mel: 20, luci: 30 };
		const loaded = simFromSnapshot(s.content, snap as never) as SimImpl;
		expect(loaded.snapshot().version).toBe(SNAPSHOT_VERSION);
		expect("bonds" in loaded.state).toBe(false);
		expect(loaded.state.afterHours.fern).toEqual({ streak: 0, lastDay: -1, thirdSeen: false, tenthReached: false, offers: 0, bought: false });
		expect(loaded.view().afterHours.items.every((i) => !i.bought && i.streak === 0)).toBe(true);
		for (let t = 0; t < 50; t++) loaded.step();
		const raw = migrateState({ bonds: { cass: 1 } }, 16);
		expect("bonds" in raw).toBe(false);
		expect(Object.keys(raw.afterHours as object).sort()).toEqual(["book", "coffee", "fern", "tank"]);
	});

	it("a corrupt after-hours block is rejected", () => {
		const s = sim();
		const snap = JSON.parse(JSON.stringify(s.snapshot())) as { version: number; state: Record<string, unknown> };
		(snap.state.afterHours as Record<string, Record<string, unknown>>).fern.streak = -2;
		expect(() => simFromSnapshot(s.content, snap as never)).toThrow(/afterHours/);
	});

	it("a decision with an unknown lead-in is rejected", () => {
		const s = sim();
		for (let d = 1; d <= 9; d++) {
			click(s, "coffee", d);
			if (s.view().decision) answer(s, "no");
		}
		click(s, "coffee", 10);
		answer(s, "no");
		click(s, "coffee", 11);
		expect(s.state.decision?.lead).toBe("ah_coffee_again1");
		const snap = JSON.parse(JSON.stringify(s.snapshot())) as { version: number; state: { decision: { lead: string } } };
		snap.state.decision.lead = "nope";
		expect(() => simFromSnapshot(s.content, snap as never)).toThrow(/lead/);
	});
});
