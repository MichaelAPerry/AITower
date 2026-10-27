/** The dating systems (docs/VN_WRITING.md): stages and conditions, After hours, gifts, the confession and its route, flags, texts, saves. */
import { type AdvisorId, type ContentDB, type EventDef, loadContent } from "@aitower/content";
import { describe, expect, it } from "vitest";
import type { SimEvent } from "./api";
import { MESSAGE_MINUTE, giftable } from "./ministry/dating";
import { SNAPSHOT_VERSION } from "./snapshot/migrate";
import { type SimImpl, createSim, simFromSnapshot } from "./sim";

const base = loadContent();
/** Real content with every story scene removed, plus the given scenes. */
const withScenes = (...scenes: EventDef[]): ContentDB => ({ ...base, events: [...base.events.filter((e) => e.category !== "story"), ...structuredClone(scenes)] });
/** Real content with only the After-hours scenes, so no story scene or random decision blocks a visit. */
const visitsOnly = (): ContentDB => ({ ...base, events: base.events.filter((e) => e.trigger?.kind === "afterHours") });
const sim = (c: ContentDB = withScenes(), seed = 1): SimImpl => createSim(c, "starter", seed) as SimImpl;
const steps = (s: SimImpl, n: number): SimEvent[] => {
	const out: SimEvent[] = [];
	for (let i = 0; i < n; i++) out.push(...s.step());
	return out;
};
/** Jump the clock to the start of game day `d` (06:00). */
const toDay = (s: SimImpl, d: number): void => {
	s.state.tick = d * 1440;
	s.invalidateProjection();
};
const scene = (id: string, over: Partial<EventDef> = {}): EventDef => ({
	id,
	category: "story",
	advisor: "luci",
	title: id,
	body: "x",
	weight: 1,
	minTier: 1,
	cooldownDays: 0,
	trigger: { kind: "tick", atLeast: 0 },
	lines: [{ who: "luci", text: "Hello." }],
	recommended: "a",
	quiet: true,
	choices: [
		{ id: "a", label: "A", hint: "a", outcome: "a", effects: [{ type: "bond", advisor: "luci", amount: 1 }] },
		{ id: "b", label: "B", hint: "b", outcome: "b", effects: [{ type: "flag", id: "gift_luci" }] },
	],
	...over,
});
const issued = (s: SimImpl): string | null => s.view().decision?.eventId ?? null;
const answer = (s: SimImpl, choiceId: string): void => {
	const d = s.view().decision;
	expect(d, "a decision is open").not.toBeNull();
	expect(s.submit({ type: "resolveDecision", decisionId: d?.id ?? -1, choiceId })).toEqual({ ok: true });
	s.step();
};

describe("scene conditions: minBond and bondGap", () => {
	it("a minBond scene waits for the bond, and is issued the moment it holds", () => {
		const s = sim(withScenes(scene("needs_40", { minBond: { advisor: "luci", atLeast: 40 } })));
		s.state.bonds.luci = 39;
		steps(s, 60);
		expect(issued(s)).toBeNull();
		s.state.bonds.luci = 40;
		steps(s, 20);
		expect(issued(s)).toBe("needs_40");
	});

	it("maxBond keeps a scene to its stage", () => {
		const s = sim(withScenes(scene("young", { maxBond: { advisor: "luci", below: 30 } })));
		s.state.bonds.luci = 30;
		steps(s, 60);
		expect(issued(s)).toBeNull();
		s.state.bonds.luci = 29;
		steps(s, 20);
		expect(issued(s)).toBe("young");
	});

	it("a bondGap scene needs the high advisor that far above the low one", () => {
		const s = sim(withScenes(scene("jealous", { bondGap: { high: "cass", low: "luci", atLeast: 20 } })));
		s.state.bonds.cass = 49;
		s.state.bonds.luci = 30; // gap 19
		steps(s, 60);
		expect(issued(s)).toBeNull();
		s.state.bonds.cass = 50; // gap 20
		steps(s, 20);
		expect(issued(s)).toBe("jealous");
	});

	it("an earned option is hidden from the view and refused by the sim until her bond is high enough", () => {
		const earned = scene("earned", {
			choices: [
				{ id: "a", label: "A", hint: "a", outcome: "a", effects: [] },
				{ id: "vip", label: "VIP", hint: "v", outcome: "v", effects: [], minBond: { advisor: "mel", atLeast: 50 } },
			],
		});
		const s = sim(withScenes(earned));
		s.state.bonds.mel = 49;
		steps(s, 20);
		expect(s.view().decision?.choices.map((c) => c.id)).toEqual(["a"]);
		const id = s.view().decision?.id ?? -1;
		expect(s.submit({ type: "resolveDecision", decisionId: id, choiceId: "vip" })).toEqual({ ok: false, reason: "no such choice" });
		s.state.bonds.mel = 50;
		s.invalidateProjection();
		expect(s.view().decision?.choices.map((c) => c.id)).toEqual(["a", "vip"]);
		expect(s.submit({ type: "resolveDecision", decisionId: id, choiceId: "vip" })).toEqual({ ok: true });
	});

	it("a quiet scene never adds the follow / overrule bond", () => {
		const s = sim(withScenes(scene("quiet", { recommended: "b" })));
		steps(s, 20);
		const before = s.state.bonds.luci;
		answer(s, "a"); // overrules "b", but the scene is quiet: only its own +1
		expect(s.state.bonds.luci).toBe(before + 1);
	});
});

describe("quiet scenes and the daily decision slot", () => {
	it("a quiet story scene announces itself but does not spend the day's slot for an operational decision; an ordinary one does", () => {
		const q = sim(withScenes(scene("q")));
		q.state.lastDecisionDay = -1;
		expect(steps(q, 20).some((e) => e.type === "decisionIssued")).toBe(true);
		expect(q.state.lastDecisionDay).toBe(-1);
		const n = sim(withScenes(scene("n", { quiet: false })));
		n.state.lastDecisionDay = -1;
		steps(n, 20);
		expect(n.state.lastDecisionDay).toBe(0);
	});
});

describe("After hours", () => {
	const visit = (s: SimImpl, advisor: AdvisorId): { ok: boolean; reason?: string } => {
		const r = s.submit({ type: "visitAdvisor", advisor });
		s.step();
		return r;
	};

	it("gives +3 bond to the advisor visited, and opens a scene from her pool as a decision", () => {
		const s = sim(visitsOnly());
		toDay(s, 2);
		const cass = s.state.bonds.cass;
		expect(visit(s, "cass")).toEqual({ ok: true });
		expect(s.state.bonds.cass).toBe(cass + s.content.balance.soul.afterHoursBond);
		const d = s.view().decision;
		expect(d?.eventId).toMatch(/^ah_cass_/);
		expect(d?.advisor).toBe("cass");
		expect(d?.canDefer).toBe(false);
	});

	it("is once per game day: a second visit is refused, the next day it is allowed again", () => {
		const s = sim(visitsOnly());
		toDay(s, 2);
		expect(visit(s, "bea")).toEqual({ ok: true });
		answer(s, s.view().decision?.choices[0].id ?? "");
		expect(s.view().soul.afterHours.available).toBe(false);
		const bond = s.state.bonds.mel;
		expect(visit(s, "mel")).toMatchObject({ ok: false, reason: "You already stayed late today" });
		expect(s.state.bonds.mel).toBe(bond);
		toDay(s, 3);
		expect(s.view().soul.afterHours.available).toBe(true);
		expect(visit(s, "mel")).toEqual({ ok: true });
	});

	it("is refused while a decision is open, and rejects an unknown advisor", () => {
		const s = sim(withScenes(scene("open")));
		steps(s, 20);
		expect(issued(s)).toBe("open");
		expect(s.submit({ type: "visitAdvisor", advisor: "cass" })).toMatchObject({ ok: false });
		expect(s.submit({ type: "visitAdvisor", advisor: "nobody" as AdvisorId })).toMatchObject({ ok: false });
	});

	it("the first answer of every visit scene is the plain one: it adds no bond to the +3 the visit earned, so the pace is exactly +3 a day", () => {
		for (const e of base.events.filter((x) => x.trigger?.kind === "afterHours")) {
			expect(e.choices[0].effects.filter((f) => f.type === "bond"), e.id).toEqual([]);
		}
	});

	it("stays in the bond stage: a Colleague gets a Colleague scene; intimate scenes wait for Close and Devoted", () => {
		const s = sim(visitsOnly());
		toDay(s, 2);
		s.state.bonds.bea = 5; // 5 + 3 = 8: Colleague
		visit(s, "bea");
		const first = s.content.events.find((e) => e.id === s.view().decision?.eventId);
		expect(first?.minBond).toBeUndefined();
		expect(first?.maxBond?.below).toBe(30);
		answer(s, s.view().decision?.choices[0].id ?? "");
		toDay(s, 3);
		s.state.bonds.bea = 70;
		visit(s, "bea");
		const late = s.content.events.find((e) => e.id === s.view().decision?.eventId);
		expect(late?.id).toBe("ah_bea_6");
	});

	it("does not repeat a scene until the pool runs dry: current stage first, then earlier stages, then the one seen longest ago", () => {
		const s = sim(visitsOnly());
		const seen: string[] = [];
		for (let d = 2; d < 2 + 5; d++) {
			toDay(s, d);
			s.state.bonds.mel = 40; // Friend (43 after the visit): Mel has two Friend scenes and two Colleague ones
			visit(s, "mel");
			seen.push(s.view().decision?.eventId ?? "");
			answer(s, s.view().decision?.choices[0].id ?? "");
		}
		expect(new Set(seen.slice(0, 4)).size).toBe(4);
		expect(seen.slice(0, 2).sort()).toEqual(["ah_mel_3", "ah_mel_4"]);
		expect(seen[4]).toBe(seen[0]);
	});

	it("keeps random decisions flowing: a visit neither spends the day's decision slot nor announces itself as one", () => {
		const s = sim(visitsOnly());
		toDay(s, 2);
		s.state.lastDecisionDay = -1;
		const r = s.submit({ type: "visitAdvisor", advisor: "luci" });
		expect(r).toEqual({ ok: true });
		const ev = s.step();
		expect(ev.some((e) => e.type === "decisionIssued")).toBe(false);
		expect(ev.some((e) => e.type === "visited")).toBe(true);
		expect(s.state.lastDecisionDay).toBe(-1);
	});

	it("is deterministic: the same commands give the same hash", () => {
		const run = (): string => {
			const s = sim(visitsOnly(), 7);
			for (let d = 2; d < 8; d++) {
				toDay(s, d);
				s.submit({ type: "visitAdvisor", advisor: (["cass", "bea", "mel", "luci"] as const)[d % 4] });
				s.step();
				if (s.view().decision) answer(s, s.view().decision?.choices[0].id ?? "");
				steps(s, 40);
			}
			return s.hash();
		};
		expect(run()).toBe(run());
	});
});

describe("gifts", () => {
	/** Bea likes the Air Handler, dislikes the Battery Bank (both buildable at the start). */
	const giftContent = (): ContentDB => {
		const c = withScenes();
		c.gifts = c.gifts.map((g) => (g.advisor === "bea" ? { ...g, liked: "crah_unit", disliked: "ups_battery" } : g));
		return c;
	};
	const firstOf = (s: SimImpl, defId: string): number => s.state.facilities.find((f) => f.defId === defId)?.id ?? -1;
	const owned = (s: SimImpl, defId: string): number => {
		const f = s.state.facilities.find((x) => x.defId === defId);
		expect(f, defId).toBeDefined();
		return f?.id ?? -1;
	};

	it("shows an owned liked item as giftable; giving it moves her bond and sets a memory flag", () => {
		const s = sim(giftContent());
		expect(giftable(s.state, s.content).some((g) => g.advisor === "bea" && g.defId === "crah_unit" && g.liked)).toBe(true);
		const bea = s.state.bonds.bea;
		const id = owned(s, "crah_unit");
		expect(s.submit({ type: "giveGift", advisor: "bea", facilityId: id })).toEqual({ ok: true });
		const ev = s.step();
		expect(ev).toContainEqual({ type: "gifted", advisor: "bea", defId: "crah_unit", liked: true });
		expect(s.state.bonds.bea).toBe(bea + s.content.balance.soul.giftLiked);
		expect(s.state.flags).toContain("gift_bea");
	});

	it("a disliked item costs bond", () => {
		const s = sim(giftContent());
		s.state.cash = 1e8;
		expect(s.submit({ type: "place", defId: "ups_battery", floor: 0, x: 20 })).toEqual({ ok: true });
		s.step();
		const bea = s.state.bonds.bea;
		expect(s.submit({ type: "giveGift", advisor: "bea", facilityId: owned(s, "ups_battery") })).toEqual({ ok: true });
		s.step();
		expect(s.state.bonds.bea).toBe(bea + s.content.balance.soul.giftDisliked);
		expect(s.state.flags).toContain("gift_bea_bad");
	});

	it("is once per item: the same gift is refused a second time and is no longer giftable", () => {
		const s = sim(giftContent());
		const id = owned(s, "crah_unit");
		expect(s.submit({ type: "giveGift", advisor: "bea", facilityId: id })).toEqual({ ok: true });
		s.step();
		const bea = s.state.bonds.bea;
		expect(s.submit({ type: "giveGift", advisor: "bea", facilityId: id })).toEqual({ ok: false, reason: "You already gave her one" });
		expect(giftable(s.state, s.content).some((g) => g.advisor === "bea" && g.defId === "crah_unit")).toBe(false);
		expect(s.state.bonds.bea).toBe(bea);
		expect(s.state.gifted).toEqual(["bea:crah_unit"]);
	});

	it("refuses an item she has no taste for, someone else's taste, and a facility that is not there", () => {
		const s = sim(giftContent());
		const id = owned(s, "crah_unit");
		expect(s.submit({ type: "giveGift", advisor: "mel", facilityId: id })).toEqual({ ok: false, reason: "She has no use for that" });
		expect(s.submit({ type: "giveGift", advisor: "bea", facilityId: 99999 })).toEqual({ ok: false, reason: "no such facility" });
		expect(firstOf(s, "crah_unit")).toBe(id);
	});
});

describe("the confession and the route", () => {
	const confession = (adv: AdvisorId, over: Partial<EventDef> = {}): EventDef =>
		scene(`conf_${adv}`, {
			advisor: adv,
			minTier: 4,
			routeOpen: true,
			trigger: { kind: "confession" },
			choices: [
				{ id: "accept", label: "Yes", hint: "y", outcome: "y", effects: [{ type: "route", advisor: adv }, { type: "bond", advisor: adv, amount: 8 }] },
				{ id: "defer", label: "Later", hint: "l", outcome: "l", effects: [{ type: "bond", advisor: adv, amount: -3 }] },
				{ id: "refuse", label: "No", hint: "n", outcome: "n", effects: [{ type: "bond", advisor: adv, amount: -10 }, { type: "bond", advisor: "cass", amount: 4 }] },
			],
			recommended: "accept",
			...over,
		});
	const four = (): ContentDB => withScenes(...(["cass", "bea", "mel", "luci"] as const).map((a) => confession(a)));
	const ready = (s: SimImpl, bonds: Partial<Record<AdvisorId, number>>, tier = 4): void => {
		s.state.tier = tier;
		Object.assign(s.state.bonds, bonds);
	};

	it("waits for Level 4 and for a bond of 60 or more", () => {
		const s = sim(four());
		ready(s, { bea: 59 }, 4);
		steps(s, 60);
		expect(issued(s)).toBeNull();
		s.state.bonds.bea = 60;
		s.state.tier = 3;
		steps(s, 60);
		expect(issued(s)).toBeNull();
		s.state.tier = 4;
		steps(s, 20);
		expect(issued(s)).toBe("conf_bea");
	});

	it("goes to the advisor with the highest bond only, and once", () => {
		const s = sim(four());
		ready(s, { cass: 70, bea: 65, mel: 61, luci: 62 });
		steps(s, 20);
		expect(issued(s)).toBe("conf_cass");
		answer(s, "defer");
		expect(s.state.route).toBeNull();
		s.state.bonds.bea = 90; // now the top, but the confession has been asked
		steps(s, 400);
		expect(issued(s)).toBeNull();
	});

	it("accepting locks the route: it is stored, shown in the view, and cannot be overwritten", () => {
		const s = sim(four());
		ready(s, { mel: 66 });
		steps(s, 20);
		answer(s, "accept");
		expect(s.state.route).toBe("mel");
		expect(s.view().soul.route).toBe("mel");
		expect(s.state.bonds.mel).toBe(74);
		// A later route effect (another scene) does not move the lock.
		const other = confession("bea", { id: "second", trigger: { kind: "tick", atLeast: 0 }, routeOpen: false, minTier: 1 });
		const t = sim(withScenes(other));
		t.state.route = "mel";
		steps(t, 20);
		answer(t, "accept");
		expect(t.state.route).toBe("mel");
	});

	it("deferring keeps the route open at a small cost; refusing costs more, and may raise Cass", () => {
		const d = sim(four());
		ready(d, { luci: 64 });
		steps(d, 20);
		answer(d, "defer");
		expect(d.state.route).toBeNull();
		expect(d.state.bonds.luci).toBe(61);
		const r = sim(four());
		ready(r, { bea: 64 });
		const cass = r.state.bonds.cass;
		steps(r, 20);
		answer(r, "refuse");
		expect(r.state.route).toBeNull();
		expect(r.state.bonds.bea).toBe(54);
		expect(r.state.bonds.cass).toBe(cass + 4);
	});

	it("once the route is locked, no confession is asked", () => {
		const s = sim(four());
		ready(s, { bea: 80 });
		s.state.route = "cass";
		steps(s, 200);
		expect(issued(s)).toBeNull();
	});

	it("the real confession scenes exist for all four advisors and offer accept, defer and refuse", () => {
		const real = base.events.filter((e) => e.trigger?.kind === "confession");
		expect(real.map((e) => e.advisor).sort()).toEqual(["bea", "cass", "luci", "mel"]);
		for (const e of real) {
			expect(e.choices.map((c) => c.id)).toEqual(["accept", "defer", "refuse"]);
			expect(e.choices[0].effects).toContainEqual({ type: "route", advisor: e.advisor });
			expect(e.minTier).toBe(base.balance.soul.confessionTier);
			expect(e.quiet).toBe(true);
		}
	});
});

describe("memory flags", () => {
	it("a flag effect remembers once; the view lists the flags in the order they were set", () => {
		const s = sim(withScenes(scene("f1"), scene("f2", { trigger: { kind: "tick", atLeast: 0 } })));
		steps(s, 20);
		answer(s, "b");
		expect(s.state.flags).toEqual(["gift_luci"]);
		steps(s, 200);
		answer(s, "b");
		expect(s.state.flags).toEqual(["gift_luci"]);
		expect(s.view().soul.flags).toEqual(["gift_luci"]);
	});
});

describe("texts", () => {
	const noonOfDay = (d: number): number => d * 1440 + (MESSAGE_MINUTE - 360);
	it("one text a day at noon, never on day zero, from a rotating sender", () => {
		const s = sim(loadContent());
		s.state.tick = noonOfDay(0);
		steps(s, 2);
		expect(s.state.inbox).toHaveLength(0);
		const senders: string[] = [];
		for (let d = 1; d <= 4; d++) {
			s.state.tick = noonOfDay(d);
			const ev = steps(s, 2);
			expect(ev.filter((e) => e.type === "messageReceived")).toHaveLength(1);
			senders.push(s.state.inbox.at(-1)?.from ?? "");
			steps(s, 5); // the same noon does not send a second one
		}
		expect(s.state.inbox).toHaveLength(4);
		expect(new Set(senders).size).toBeGreaterThanOrEqual(3);
	});

	it("respects the sender's bond band and never repeats a text", () => {
		const s = sim(loadContent());
		for (const a of ["cass", "bea", "mel", "luci"] as const) s.state.bonds[a] = 75;
		for (let d = 1; d <= 6; d++) {
			s.state.tick = noonOfDay(d);
			steps(s, 2);
		}
		for (const m of s.state.inbox) {
			const def = s.content.messages.find((x) => x.id === m.msgId);
			expect(def?.minBond ?? 0, m.msgId).toBeLessThanOrEqual(75);
			expect(def?.maxBond ?? 101, m.msgId).toBeGreaterThan(75);
		}
		expect(new Set(s.state.messageSeen).size).toBe(s.state.messageSeen.length);
	});

	it("a one-tap reply earns +1 once; ignoring earns nothing; the inbox is capped", () => {
		const s = sim(loadContent());
		s.state.tick = noonOfDay(1);
		steps(s, 2);
		const m = s.state.inbox[0];
		const before = s.state.bonds[m.from];
		expect(s.submit({ type: "replyMessage", msgId: m.msgId, tap: 0 })).toEqual({ ok: true });
		s.step();
		expect(s.state.bonds[m.from]).toBe(before + s.content.balance.soul.messageBond);
		expect(s.state.inbox[0].tapped).toBe(0);
		expect(s.submit({ type: "replyMessage", msgId: m.msgId, tap: 1 })).toEqual({ ok: false, reason: "already answered" });
		expect(s.submit({ type: "replyMessage", msgId: m.msgId, tap: 9 })).toMatchObject({ ok: false });
		for (let d = 2; d <= 12; d++) {
			s.state.tick = noonOfDay(d);
			steps(s, 2);
		}
		expect(s.state.inbox.length).toBeLessThanOrEqual(6);
		const last = s.state.inbox.at(-1);
		const b = s.state.bonds[last?.from ?? "cass"];
		expect(s.submit({ type: "replyMessage", msgId: last?.msgId ?? "", tap: -1 })).toEqual({ ok: true });
		s.step();
		expect(s.state.bonds[last?.from ?? "cass"]).toBe(b);
	});
});

describe("saves (snapshot v14)", () => {
	it("the version is 14 and a current save round-trips every dating field with the same hash", () => {
		const s = sim(loadContent());
		expect(SNAPSHOT_VERSION).toBe(14);
		s.state.route = "bea";
		s.state.flags.push("gift_bea");
		s.state.afterHoursDay = 3;
		s.state.afterSeen.push("ah_bea_1");
		s.state.gifted.push("bea:heat_exchanger");
		s.state.messageDay = 2;
		s.state.messageSeen.push("msg_bea_1");
		s.state.inbox.push({ msgId: "msg_bea_1", from: "bea", tick: 100, tapped: 0 });
		const twin = simFromSnapshot(s.content, JSON.parse(JSON.stringify(s.snapshot()))) as SimImpl;
		expect(twin.hash()).toBe(s.hash());
		expect(twin.state.route).toBe("bea");
		expect(twin.state.inbox).toEqual(s.state.inbox);
	});

	it("a v13 save migrates: no route, no flags, an empty inbox, After hours open; it then plays on", () => {
		const s = sim(loadContent());
		const snap = JSON.parse(JSON.stringify(s.snapshot())) as { version: number; state: Record<string, unknown> };
		snap.version = 13;
		for (const k of ["route", "flags", "afterHoursDay", "afterSeen", "gifted", "inbox", "messageDay", "messageSeen"]) delete snap.state[k];
		const loaded = simFromSnapshot(s.content, snap as never) as SimImpl;
		expect(loaded.state.route).toBeNull();
		expect(loaded.state.flags).toEqual([]);
		expect(loaded.state.afterHoursDay).toBe(-1);
		expect(loaded.state.inbox).toEqual([]);
		expect(loaded.state.messageDay).toBe(-1);
		expect(loaded.snapshot().version).toBe(SNAPSHOT_VERSION);
		toDay(loaded, 2);
		expect(loaded.submit({ type: "visitAdvisor", advisor: "cass" })).toEqual({ ok: true });
		steps(loaded, 30);
	});

	it("rejects a save whose route or inbox is malformed", () => {
		const s = sim(loadContent());
		const bad = (edit: (st: Record<string, unknown>) => void): void => {
			const snap = JSON.parse(JSON.stringify(s.snapshot())) as { state: Record<string, unknown> };
			edit(snap.state);
			expect(() => simFromSnapshot(s.content, snap as never)).toThrow(/Invalid save/);
		};
		bad((st) => {
			st.route = "nobody";
		});
		bad((st) => {
			st.inbox = [{ msgId: "x", from: "ghost", tick: 1, tapped: null }];
		});
		bad((st) => {
			st.flags = [1];
		});
	});
});
