/** The dating systems' content (docs/VN_WRITING.md): bond stages, After-hours pools, route scenes, gifts, texts, memories, and the writing bar. */
import { describe, expect, it } from "vitest";
import { loadContent, validateContent } from "./load";
import { ADVISOR_IDS, type AdvisorId, BOND_STAGES, type EventDef, bondStage } from "./schema";

const db = loadContent();
const story = db.events.filter((e) => e.category === "story");
const kind = (k: string): EventDef[] => story.filter((e) => e.trigger?.kind === k);
const BOND: AdvisorId[] = [...ADVISOR_IDS];

describe("named bond stages", () => {
	it("Colleague 0-29, Friend 30-49, Close 50-69, Devoted 70-100", () => {
		const at = (n: number): string => bondStage(n).name;
		expect([0, 29].map(at)).toEqual(["Colleague", "Colleague"]);
		expect([30, 49].map(at)).toEqual(["Friend", "Friend"]);
		expect([50, 69].map(at)).toEqual(["Close", "Close"]);
		expect([70, 100].map(at)).toEqual(["Devoted", "Devoted"]);
		expect(BOND_STAGES.map((s) => s.from)).toEqual([0, 30, 50, 70]);
	});
});

describe("After-hours pools", () => {
	it("each advisor has six visit scenes, banded by stage, and they ask for no tree consequences", () => {
		for (const a of BOND) {
			const pool = kind("afterHours").filter((e) => e.advisor === a);
			expect(pool, a).toHaveLength(6);
			for (const e of pool) {
				for (const c of e.choices) for (const f of c.effects) expect(["bond", "flag"], `${e.id}/${c.id}`).toContain(f.type);
				expect(e.quiet, e.id).toBe(true);
				expect(e.minBond?.advisor ?? a, e.id).toBe(a);
			}
			const stage = (e: EventDef): string => bondStage(e.minBond?.atLeast ?? 0).id;
			for (const s of ["friend", "close", "devoted"]) expect(pool.some((e) => stage(e) === s), `${a} ${s}`).toBe(true);
			expect(pool.some((e) => e.maxBond && !e.minBond), `${a} colleague`).toBe(true);
		}
	});
});

describe("route scenes", () => {
	it("three milestones per advisor at bond 40, 60 and 80, each fired by minBond", () => {
		const ms = story.filter((e) => e.id.startsWith("ms_"));
		expect(ms).toHaveLength(12);
		for (const a of BOND) {
			expect(ms.filter((e) => e.advisor === a).map((e) => e.minBond?.atLeast)).toEqual([40, 60, 80]);
			for (const e of ms.filter((x) => x.advisor === a)) expect(e.minBond?.advisor).toBe(a);
		}
	});

	it("six rival scenes use bondGap, and the neglected advisor is the speaker", () => {
		const rv = story.filter((e) => e.id.startsWith("rv_"));
		expect(rv).toHaveLength(6);
		for (const e of rv) {
			expect(e.bondGap, e.id).toBeDefined();
			expect(e.bondGap?.low, e.id).toBe(e.advisor);
			expect(e.bondGap?.high).not.toBe(e.advisor);
		}
	});

	it("four confessions with accept, defer and refuse; only accept locks the route", () => {
		const cf = kind("confession");
		expect(cf.map((e) => e.advisor).sort()).toEqual(["bea", "cass", "luci", "mel"]);
		for (const e of cf) {
			expect(e.choices.map((c) => c.id)).toEqual(["accept", "defer", "refuse"]);
			const routes = e.choices.filter((c) => c.effects.some((f) => f.type === "route"));
			expect(routes.map((c) => c.id)).toEqual(["accept"]);
			const bond = (id: string): number => e.choices.find((c) => c.id === id)?.effects.find((f) => f.type === "bond" && f.advisor === e.advisor && true)?.amount ?? 0;
			expect(bond("accept")).toBeGreaterThan(0);
			expect(bond("defer")).toBeLessThan(0);
			expect(bond("refuse")).toBeLessThan(bond("defer"));
		}
	});

	it("refusing a confession may raise Cass, never anyone else", () => {
		for (const e of kind("confession")) {
			const refuse = e.choices.find((c) => c.id === "refuse");
			const others = refuse?.effects.filter((f) => f.type === "bond" && f.advisor !== e.advisor) ?? [];
			for (const f of others) expect(f).toMatchObject({ advisor: "cass" });
		}
	});

	it("every ending can close on the route: it has an epilogue for each advisor and an acknowledgement line for each", () => {
		for (const e of db.endings.filter((x) => x.epilogue)) {
			for (const a of BOND) {
				expect(e.epilogue?.[a], `${e.id} epilogue ${a}`).toBeTruthy();
				expect(e.routeAck?.[a], `${e.id} routeAck ${a}`).toBeTruthy();
			}
		}
	});
});

describe("gifts, texts and memories", () => {
	it("each advisor likes one real item and dislikes another", () => {
		expect(db.gifts.map((g) => g.advisor).sort()).toEqual(["bea", "cass", "luci", "mel"]);
		for (const g of db.gifts) {
			expect(db.facilities[g.liked], g.advisor).toBeDefined();
			expect(db.facilities[g.disliked], g.advisor).toBeDefined();
			expect(g.liked).not.toBe(g.disliked);
		}
	});

	it("texts cover every advisor in every stage, with one to three one-tap replies", () => {
		for (const a of BOND) {
			const mine = db.messages.filter((m) => m.from === a);
			expect(mine.length, a).toBeGreaterThanOrEqual(6);
			for (const lo of [0, 30, 50, 70]) expect(mine.some((m) => (m.minBond ?? 0) <= lo + (lo === 0 ? 0 : 0) && (m.maxBond ?? 101) > lo), `${a} at ${lo}`).toBe(true);
			for (const m of mine) {
				expect(m.taps.length, m.id).toBeGreaterThanOrEqual(1);
				expect(m.text.split(/\s+/).length, m.id).toBeLessThanOrEqual(14);
			}
		}
	});

	it("every memory flag used by a choice has words, and every memory is set by something", () => {
		const used = new Set<string>();
		for (const e of db.events) for (const c of e.choices) for (const f of c.effects) if (f.type === "flag") used.add(f.id);
		const gifts = new Set(db.gifts.flatMap((g) => [`gift_${g.advisor}`, `gift_${g.advisor}_bad`]));
		for (const m of db.memories) expect(used.has(m.flag) || gifts.has(m.flag), m.flag).toBe(true);
		for (const f of used) expect(db.memories.some((m) => m.flag === f), f).toBe(true);
		for (const g of gifts) expect(db.memories.some((m) => m.flag === g), g).toBe(true);
	});

	it("validates, and a flag with no memory is reported", () => {
		expect(validateContent(db)).toEqual([]);
		const broken = { ...db, memories: db.memories.filter((m) => m.flag !== "luci_money") };
		expect(validateContent(broken).join("\n")).toContain('flag "luci_money" has no entry in memories');
	});
});

describe("the writing bar (docs/VN_SAMPLE.md)", () => {
	const fresh = story.filter((e) => /^(ah|ms|rv|st_confess)_/.test(e.id));
	const words = (t: string): number => t.split(/\s+/).filter(Boolean).length;

	it("short spoken lines: nothing over 20 words, advisors' lines under 15", () => {
		for (const e of fresh) {
			for (const l of [...(e.lines ?? []), ...e.choices.flatMap((c) => c.reply ?? [])]) {
				expect(words(l.text), `${e.id}: ${l.text}`).toBeLessThanOrEqual(l.who === "narrator" ? 20 : 15);
			}
		}
	});

	it("no em dashes, no stacked ellipses, no mid-game ending paintings", () => {
		const text = JSON.stringify(fresh);
		expect(text).not.toMatch(/—|–|\.\.\.\.|…/);
		for (const e of fresh) expect(e.backdrop, e.id).toBeUndefined();
	});

	it("labels are speakable (under 8 words, no 'Agree with') and every choice has an answer", () => {
		for (const e of fresh) {
			for (const c of e.choices) {
				expect(words(c.label), `${e.id}/${c.id}`).toBeLessThanOrEqual(8);
				expect(c.label).not.toMatch(/^(Agree with|Push back)/);
				expect(c.reply?.length ?? 0, `${e.id}/${c.id}`).toBeGreaterThan(0);
			}
		}
	});

	it("every scene has between 3 and 6 lines before its choice, and 3 to 4 choices (confessions 3)", () => {
		for (const e of fresh) {
			expect(e.lines?.length ?? 0, e.id).toBeGreaterThanOrEqual(3);
			expect(e.lines?.length ?? 0, e.id).toBeLessThanOrEqual(6);
			expect(e.choices.length, e.id).toBeGreaterThanOrEqual(3);
			expect(e.choices.length, e.id).toBeLessThanOrEqual(4);
		}
	});

	it("earned options appear on existing scenes: at least eight, each gated by a bond", () => {
		const earned = story.flatMap((e) => e.choices.filter((c) => c.minBond && !/^(ah|ms|rv|st_confess)_/.test(e.id)));
		expect(earned.length).toBeGreaterThanOrEqual(8);
		for (const c of earned) expect(c.minBond?.atLeast).toBeGreaterThanOrEqual(30);
	});
});
