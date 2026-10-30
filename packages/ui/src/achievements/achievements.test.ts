import { achievementContent } from "@aitower/content";
import { loadProfile, recordAchievement } from "@aitower/shared";
import type { SimView } from "@aitower/sim";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AchIcon } from "./AchIcon";
import { bedItem, itemsFor, momentsOf, portraitItem, untoldItems } from "./AchievementToast";
import { ACHIEVEMENTS, ACHIEVEMENT_COUNT, type AchEnv, type AchievementDef, FAST_WIN_DAYS, PORTRAITS, awardFor, bedComplete, countsForAchievements, evaluate } from "./achievements";
import { ICONS, ICON_PALETTE, ICON_SIZE, hasIcon, iconRows, lockedIcon } from "./icons";
import { ICON_SHEETS, type IconSheet, sheetCellStyle } from "./sheets";

const memory = () => {
	const m = new Map<string, string>();
	return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

type Over = { kind: "victory" | "absorbed" | "bankrupt"; tick: number; ending?: string };
interface Spec {
	cash?: number;
	tier?: number;
	day?: number;
	over?: Over | null;
	seal?: { biotech?: number; greentech?: number };
	bonds?: Partial<Record<"luci" | "mel" | "bea" | "cass", number>>;
	rungs?: number[];
	loan?: number;
	corruption?: number;
	streak?: number;
	reports?: { grade: string; uptime: number; quarter?: number }[];
	lesson?: unknown;
	sandbox?: boolean;
}
const view = (s: Spec = {}): SimView =>
	({
		cash: s.cash ?? 0,
		tier: s.tier ?? 1,
		day: s.day ?? 9,
		lesson: s.lesson ?? null,
		sandbox: s.sandbox ?? false,
		gameOver: s.over ?? null,
		loan: { principal: s.loan ?? 0, max: 1e6, dailyRate: 0 },
		corruption: s.corruption ?? 0,
		uptimeStreak: s.streak ?? 0,
		reports: s.reports ?? [],
		soul: {
			seal: { biotech: 0, greentech: 0, ...s.seal },
			sealMax: 100,
			bonds: { luci: 30, mel: 20, bea: 20, cass: 20, ...s.bonds },
			trees: { synthetic: { rung: s.rungs?.[0] ?? 0 }, biotech: { rung: s.rungs?.[1] ?? 0 }, greentech: { rung: s.rungs?.[2] ?? 0 } },
		},
	}) as unknown as SimView;

const win = (ending: string, day = 20): Over => ({ kind: "victory", tick: (day - 1) * 1440 + 100, ending });
const env = (p: Partial<AchEnv> = {}): AchEnv => ({ profile: loadProfile(memory()), startingCash: 3_000_000, lessonIds: ["a", "b"], lessonsDone: {}, ...p });
const def = (id: string): AchievementDef => ACHIEVEMENTS.find((d) => d.id === id) as AchievementDef;
const met = (id: string, v: SimView, e: AchEnv = env()): boolean => def(id).check(v, e);

describe("the table", () => {
	it("is the 18 rows of the spec, each with a check and a moment", () => {
		expect(ACHIEVEMENT_COUNT).toBe(18);
		expect(ACHIEVEMENTS.map((a) => a.id)).toEqual(achievementContent.achievements.map((a) => a.id));
		const moments: Record<string, string> = {};
		for (const a of ACHIEVEMENTS) moments[a.id] = a.when;
		expect(moments).toEqual({
			end_lattice: "gameOver", end_flesh: "gameOver", end_garden: "gameOver", end_absorbed: "gameOver", end_bankrupt: "gameOver",
			lvl_five: "dayClose", rung_top: "dayClose", fast_win: "gameOver", clean_hands: "gameOver", open_hands: "gameOver",
			cash_deep: "dayClose", books_clean: "gameOver", perfect_qtr: "quarterReport", calm_month: "dayClose",
			bond_close: "dayClose", bond_crew: "dayClose", les_done: "lessonEnd", heard_out: "gameOver",
		});
	});

	it("hides exactly the two failure endings; every row has a name and text", () => {
		expect(ACHIEVEMENTS.filter((a) => a.hidden).map((a) => a.id)).toEqual(["end_absorbed", "end_bankrupt"]);
		for (const a of ACHIEVEMENTS) expect(a.name && a.text, a.id).toBeTruthy();
	});

	it("every row has a cell of the achievements sheet, each cell used once, all inside the grid", () => {
		const sheet = ICON_SHEETS.achievements;
		expect(sheet).toMatchObject({ cols: 6, rows: 3 });
		const cells = ACHIEVEMENTS.map((a) => a.icon);
		for (const c of cells) expect(c && typeof c === "object" && sheetCellStyle(c, 48), String(c)).not.toBeNull();
		expect(new Set(cells.map((c) => JSON.stringify(c))).size).toBe(ACHIEVEMENTS.length);
	});
});

describe("each check fires at its boundary, not just below it", () => {
	it("the three endings", () => {
		expect(met("end_lattice", view({ over: win("singularity") }))).toBe(true);
		expect(met("end_lattice", view({ over: win("flesh") }))).toBe(false);
		expect(met("end_lattice", view({ over: { kind: "absorbed", tick: 5, ending: "absorbed" } }))).toBe(false);
		expect(met("end_lattice", view())).toBe(false);
		expect(met("end_flesh", view({ over: win("flesh") }))).toBe(true);
		expect(met("end_flesh", view({ over: win("garden") }))).toBe(false);
		expect(met("end_garden", view({ over: win("garden") }))).toBe(true);
		expect(met("end_garden", view({ over: win("singularity") }))).toBe(false);
	});

	it("the two failures read gameOver.kind (bankrupt has no ending id)", () => {
		expect(met("end_absorbed", view({ over: { kind: "absorbed", tick: 9, ending: "absorbed" } }))).toBe(true);
		expect(met("end_absorbed", view({ over: win("flesh") }))).toBe(false);
		expect(met("end_bankrupt", view({ over: { kind: "bankrupt", tick: 9 } }))).toBe(true);
		expect(met("end_bankrupt", view({ over: { kind: "absorbed", tick: 9 } }))).toBe(false);
		expect(met("end_bankrupt", view())).toBe(false);
	});

	it("Level Five at tier 5, not 4", () => {
		expect(met("lvl_five", view({ tier: 4 }))).toBe(false);
		expect(met("lvl_five", view({ tier: 5 }))).toBe(true);
	});

	it("Top Rung needs rung 4 on any tree", () => {
		expect(met("rung_top", view({ rungs: [3, 3, 3] }))).toBe(false);
		expect(met("rung_top", view({ rungs: [0, 0, 4] }))).toBe(true);
		expect(met("rung_top", view({ rungs: [4, 0, 0] }))).toBe(true);
	});

	it("Ahead of the Plan: day 25 / 40 / 38 is in time, one day later is not", () => {
		expect(FAST_WIN_DAYS).toEqual({ singularity: 25, flesh: 40, garden: 38 });
		for (const [end, d] of [["singularity", 25], ["flesh", 40], ["garden", 38]] as const) {
			expect(met("fast_win", view({ over: win(end, d) })), `${end} day ${d}`).toBe(true);
			expect(met("fast_win", view({ over: win(end, d + 1) })), `${end} day ${d + 1}`).toBe(false);
		}
		// The very last tick of the day still counts as that day.
		expect(met("fast_win", view({ over: { kind: "victory", tick: 25 * 1440 - 1, ending: "singularity" } }))).toBe(true);
		expect(met("fast_win", view({ over: { kind: "victory", tick: 25 * 1440, ending: "singularity" } }))).toBe(false);
		expect(met("fast_win", view({ over: { kind: "absorbed", tick: 100, ending: "absorbed" } }))).toBe(false);
	});

	it("Clean Hands: that tree's meter under 30, on that tree's win only", () => {
		expect(met("clean_hands", view({ over: win("flesh"), seal: { biotech: 29.9 } }))).toBe(true);
		expect(met("clean_hands", view({ over: win("flesh"), seal: { biotech: 30 } }))).toBe(false);
		expect(met("clean_hands", view({ over: win("garden"), seal: { greentech: 29.9 } }))).toBe(true);
		expect(met("clean_hands", view({ over: win("garden"), seal: { greentech: 30 } }))).toBe(false);
		// The other tree's meter does not matter, and the Lattice never counts.
		expect(met("clean_hands", view({ over: win("garden"), seal: { greentech: 10, biotech: 90 } }))).toBe(true);
		expect(met("clean_hands", view({ over: win("flesh"), seal: { greentech: 0, biotech: 50 } }))).toBe(false);
		expect(met("clean_hands", view({ over: win("singularity"), seal: {} }))).toBe(false);
	});

	it("Open Hands: a Lattice win with neither other tree closed (below sealMax)", () => {
		expect(met("open_hands", view({ over: win("singularity"), seal: { biotech: 99.9, greentech: 99.9 } }))).toBe(true);
		expect(met("open_hands", view({ over: win("singularity"), seal: { biotech: 100 } }))).toBe(false);
		expect(met("open_hands", view({ over: win("singularity"), seal: { greentech: 161 } }))).toBe(false);
		expect(met("open_hands", view({ over: win("flesh") }))).toBe(false);
	});

	it("Deep Pockets at $10M exactly", () => {
		expect(met("cash_deep", view({ cash: 9_999_999 }))).toBe(false);
		expect(met("cash_deep", view({ cash: 10_000_000 }))).toBe(true);
	});

	it("Clean Books: a win, no loan, at least the starting cash", () => {
		const e = env({ startingCash: 3_000_000 });
		expect(met("books_clean", view({ over: win("flesh"), cash: 3_000_000 }), e)).toBe(true);
		expect(met("books_clean", view({ over: win("garden"), cash: 2_999_999 }), e)).toBe(false);
		expect(met("books_clean", view({ over: win("singularity"), cash: 5e6, loan: 1 }), e)).toBe(false);
		expect(met("books_clean", view({ over: { kind: "absorbed", tick: 1 }, cash: 9e6 }), e)).toBe(false);
		expect(met("books_clean", view({ over: win("flesh"), cash: 3_500_000 }), env({ startingCash: 4_000_000 }))).toBe(false);
	});

	it("Perfect Quarter: the latest report is an A at 99% or better", () => {
		const r = (grade: string, uptime: number) => view({ reports: [{ grade: "C", uptime: 0.5 }, { grade, uptime }] });
		expect(met("perfect_qtr", r("A", 0.99))).toBe(true);
		expect(met("perfect_qtr", r("A", 0.9899))).toBe(false);
		expect(met("perfect_qtr", r("B", 1))).toBe(false);
		expect(met("perfect_qtr", view())).toBe(false);
		expect(met("perfect_qtr", view({ reports: [{ grade: "A", uptime: 1 }, { grade: "D", uptime: 1 }] }))).toBe(false);
	});

	it("Month of Calm at a streak of 20, not 19", () => {
		expect(met("calm_month", view({ streak: 19 }))).toBe(false);
		expect(met("calm_month", view({ streak: 20 }))).toBe(true);
	});

	it("Someone You Trust: any advisor at 50", () => {
		expect(met("bond_close", view({ bonds: { luci: 49, mel: 49 } }))).toBe(false);
		expect(met("bond_close", view({ bonds: { bea: 50 } }))).toBe(true);
	});

	it("The Whole Crew: all four at 40", () => {
		expect(met("bond_crew", view({ bonds: { luci: 80, mel: 39, bea: 40, cass: 40 } }))).toBe(false);
		expect(met("bond_crew", view({ bonds: { luci: 40, mel: 40, bea: 40, cass: 40 } }))).toBe(true);
	});

	it("Student: every lesson id finished, none missing", () => {
		expect(met("les_done", view(), env({ lessonIds: ["a", "b"], lessonsDone: { a: 3 } }))).toBe(false);
		expect(met("les_done", view(), env({ lessonIds: ["a", "b"], lessonsDone: { a: 1, b: 2 } }))).toBe(true);
		expect(met("les_done", view(), env({ lessonIds: [], lessonsDone: {} }))).toBe(false);
	});

	it("Heard Her Out: all four epilogues in the profile", () => {
		const s = memory();
		const profile = (e: Record<string, boolean>) => ({ ...loadProfile(s), epilogues: { luci: false, mel: false, bea: false, cass: false, ...e } });
		expect(met("heard_out", view(), env({ profile: profile({ luci: true, mel: true, bea: true }) }))).toBe(false);
		expect(met("heard_out", view(), env({ profile: profile({ luci: true, mel: true, bea: true, cass: true }) }))).toBe(true);
	});
});

describe("awarding", () => {
	it("latches: earned once, ever, even after the condition lapses", () => {
		const s = memory();
		expect(awardFor("dayClose", view({ cash: 12e6 }), { storage: s }).won.map((d) => d.id)).toEqual(["cash_deep"]);
		expect(awardFor("dayClose", view({ cash: 12e6 }), { storage: s }).won).toHaveLength(0);
		expect(awardFor("dayClose", view({ cash: 1e6 }), { storage: s }).won).toHaveLength(0);
		expect(loadProfile(s).earned.cash_deep).toEqual({ day: 9, ending: null });
	});

	it("only the checks of that moment run", () => {
		const s = memory();
		const v = view({ cash: 12e6, tier: 5, over: win("garden", 30), seal: { greentech: 5 } });
		expect(awardFor("dayClose", v, { storage: s }).won.map((d) => d.id).sort()).toEqual(["cash_deep", "lvl_five"]);
		expect(awardFor("gameOver", v, { storage: s }).won.map((d) => d.id).sort()).toEqual(["books_clean", "clean_hands", "end_garden", "fast_win"]);
		expect(awardFor("quarterReport", v, { storage: s }).won).toEqual([]);
	});

	it("a game over records the ending with the unlock", () => {
		const s = memory();
		awardFor("gameOver", view({ over: win("singularity", 30), day: 30 }), { storage: s });
		expect(loadProfile(s).earned.end_lattice).toEqual({ day: 30, ending: "singularity" });
		awardFor("gameOver", view({ over: { kind: "bankrupt", tick: 5 }, day: 3 }), { storage: s });
		expect(loadProfile(s).earned.end_bankrupt).toEqual({ day: 3, ending: "bankrupt" });
	});

	it("hidden ones are awarded like any other (the list hides them only until earned)", () => {
		const s = memory();
		const r = awardFor("gameOver", view({ over: { kind: "absorbed", tick: 9, ending: "absorbed" } }), { storage: s });
		expect(r.won.map((d) => [d.id, d.hidden])).toEqual([["end_absorbed", true]]);
		expect(itemsFor(r)[0]).toMatchObject({ tag: "ACHIEVEMENT", name: "Merged" });
	});

	it("never fires in a lesson or a sandbox run, but Student does at a lesson's end", () => {
		const s = memory();
		const lesson = { id: "first_watt" };
		expect(countsForAchievements(view({ lesson }))).toBe(false);
		expect(awardFor("dayClose", view({ cash: 20e6, lesson }), { storage: s }).won).toEqual([]);
		expect(awardFor("dayClose", view({ cash: 20e6, sandbox: true }), { storage: s }).won).toEqual([]);
		expect(awardFor("gameOver", view({ over: win("flesh"), sandbox: true }), { storage: s })).toEqual({ won: [], portraits: [], bed: false });
		expect(loadProfile(s).earned).toEqual({});
		const content = { balance: { startingCash: 3e6 }, lessons: [{ id: "l1" }, { id: "l2" }] };
		expect(awardFor("lessonEnd", view({ lesson }), { storage: s, content }).won).toEqual([]);
		s.setItem("aitower.lessons.v1", JSON.stringify({ done: { l1: 1, l2: 3 } }));
		expect(awardFor("lessonEnd", view({ lesson }), { storage: s, content }).won.map((d) => d.id)).toEqual(["les_done"]);
		expect(awardFor("dayClose", view({ cash: 20e6 }), { storage: s }).won).toHaveLength(1);
	});

	it("evaluate is pure and skips what is earned", () => {
		const s = memory();
		recordAchievement("cash_deep", 1, null, s);
		expect(evaluate("dayClose", view({ cash: 20e6 }), env({ profile: loadProfile(s) }))).toEqual([]);
		expect(evaluate("dayClose", view({ cash: 20e6 }), env())).toHaveLength(1);
		expect(loadProfile(memory()).earned).toEqual({});
	});

	it("Heard Her Out counts the epilogue shown, across runs, and never the fallback", () => {
		const s = memory();
		const over = view({ over: { kind: "absorbed", tick: 9, ending: "absorbed" } });
		for (const adv of ["luci", "mel", "bea"] as const) expect(awardFor("gameOver", over, { storage: s, epilogue: adv }).won.map((d) => d.id)).not.toContain("heard_out");
		expect(awardFor("gameOver", over, { storage: s, epilogue: null }).won.map((d) => d.id)).not.toContain("heard_out");
		expect(loadProfile(s).epilogues).toEqual({ luci: true, mel: true, bea: true, cass: false });
		expect(awardFor("gameOver", over, { storage: s, epilogue: "cass" }).won.map((d) => d.id)).toContain("heard_out");
	});

	it("remembers the highest bonds for the gallery hints", () => {
		const s = memory();
		awardFor("dayClose", view({ bonds: { luci: 33, cass: 12 } }), { storage: s });
		awardFor("dayClose", view({ bonds: { luci: 31, cass: 30 } }), { storage: s });
		expect(loadProfile(s).bondMax).toMatchObject({ luci: 33, cass: 30 });
	});
});

describe("off-duty portraits unlock at their boundary", () => {
	const unlocked = (v: SimView, moment: "gameOver" | "dayClose" = "gameOver") => awardFor(moment, v, { storage: memory() }).portraits;

	it("Luci: Lattice win, no loan, bond 50", () => {
		expect(unlocked(view({ over: win("singularity"), bonds: { luci: 50 } }))).toEqual(["luci"]);
		expect(unlocked(view({ over: win("singularity"), bonds: { luci: 49 } }))).toEqual([]);
		expect(unlocked(view({ over: win("singularity"), bonds: { luci: 90 }, loan: 1 }))).toEqual([]);
		expect(unlocked(view({ over: win("flesh"), bonds: { luci: 90 } }))).toEqual([]);
	});

	it("Mel: Flesh win, corruption under 0.5, bond 40", () => {
		expect(unlocked(view({ over: win("flesh"), corruption: 0.49, bonds: { mel: 40 } }))).toEqual(["mel"]);
		expect(unlocked(view({ over: win("flesh"), corruption: 0.5, bonds: { mel: 40 } }))).toEqual([]);
		expect(unlocked(view({ over: win("flesh"), corruption: 0.1, bonds: { mel: 39 } }))).toEqual([]);
		expect(unlocked(view({ over: win("garden"), corruption: 0.1, bonds: { mel: 90 } }))).toEqual([]);
	});

	it("Bea: Garden win, green seal under 50, bond 50", () => {
		expect(unlocked(view({ over: win("garden"), seal: { greentech: 49.9 }, bonds: { bea: 50 } }))).toEqual(["bea"]);
		expect(unlocked(view({ over: win("garden"), seal: { greentech: 50 }, bonds: { bea: 50 } }))).toEqual([]);
		expect(unlocked(view({ over: win("garden"), seal: { greentech: 0 }, bonds: { bea: 49 } }))).toEqual([]);
	});

	it("Cass: the day the streak reaches 20, mid-run (day close)", () => {
		expect(unlocked(view({ streak: 20 }), "dayClose")).toEqual(["cass"]);
		expect(unlocked(view({ streak: 19 }), "dayClose")).toEqual([]);
		expect(unlocked(view({ streak: 25 }), "gameOver")).toEqual([]);
	});

	it("latches, and is announced once", () => {
		const s = memory();
		const v = view({ streak: 21 });
		expect(awardFor("dayClose", v, { storage: s }).portraits).toEqual(["cass"]);
		expect(awardFor("dayClose", v, { storage: s }).portraits).toEqual([]);
		expect(loadProfile(s).offDuty.cass.casual).toBe(true);
		expect(PORTRAITS.map((p) => p.advisor)).toEqual(["luci", "mel", "bea", "cass"]);
	});

	it("not in lessons or sandbox", () => {
		expect(awardFor("dayClose", view({ streak: 30, sandbox: true }), { storage: memory() }).portraits).toEqual([]);
	});
});

describe("the bed set", () => {
	const all = (s: ReturnType<typeof memory>, skip?: string) => {
		for (const a of ACHIEVEMENTS) if (a.id !== skip) recordAchievement(a.id, 5, null, s);
	};

	it("opens at all 18, not 17", () => {
		const s = memory();
		all(s, "heard_out");
		expect(bedComplete(loadProfile(s))).toBe(false);
		recordAchievement("heard_out", 5, null, s);
		expect(bedComplete(loadProfile(s))).toBe(true);
	});

	it("is announced by the call that lands the 18th, once", () => {
		const s = memory();
		all(s, "cash_deep");
		const r = awardFor("dayClose", view({ cash: 11e6 }), { storage: s });
		expect(r.won.map((d) => d.id)).toEqual(["cash_deep"]);
		expect(r.bed).toBe(true);
		expect(itemsFor(r).map((i) => i.key)).toEqual(["a:cash_deep", "p:bed"]);
		expect(awardFor("dayClose", view({ cash: 11e6 }), { storage: s }).bed).toBe(false);
	});

	it("untold strips are found again later: portraits and bed, until shown", () => {
		const s = memory();
		all(s);
		const p = loadProfile(s);
		p.offDuty.mel.casual = true;
		expect(untoldItems(p).map((i) => i.key)).toEqual(["p:mel", "p:bed"]);
		p.told.mel = true;
		p.told.bed = true;
		expect(untoldItems(p)).toEqual([]);
		expect(portraitItem("bea").deferred && bedItem().deferred).toBe(true);
	});
});

describe("events and moments", () => {
	it("maps sim events to the moments that run", () => {
		expect(momentsOf([{ type: "newDay" }])).toEqual(["dayClose"]);
		expect(momentsOf([{ type: "quarterReport" }, { type: "gameOver" }, { type: "newDay" }, { type: "decisionResolved" }, { type: "jobDone" }])).toEqual(["dayClose", "quarterReport", "decisionResolved", "gameOver"]);
		expect(momentsOf([{ type: "researched" }])).toEqual([]);
	});
});

describe("achievement icons", () => {
	it("a code sprite is 24x24, palette keys only, in every state", () => {
		for (const a of ACHIEVEMENTS.filter((x) => typeof x.icon === "string")) {
			const id = a.icon as string;
			expect(hasIcon(id), a.id).toBe(true);
			for (const rows of [ICONS[id], lockedIcon(id), iconRows(id, true, true)]) {
				expect(rows).toHaveLength(ICON_SIZE);
				for (const r of rows) {
					expect(r).toHaveLength(ICON_SIZE);
					for (const c of r) expect(c === "." || c in ICON_PALETTE).toBe(true);
				}
			}
		}
	});

	it("renders a code sprite and the placeholder plate in every state", () => {
		for (const p of [{}, { locked: true }, { locked: true, hidden: true }, { scale: 3 }]) {
			expect(renderToStaticMarkup(createElement(AchIcon, { icon: "vault_bars", ...p }))).toContain("<rect");
			expect(renderToStaticMarkup(createElement(AchIcon, { ...p }))).toContain("<rect");
		}
		expect(renderToStaticMarkup(createElement(AchIcon, {}))).toContain('data-icon="placeholder"');
	});

	describe("an image sheet cell", () => {
		const sheets: Record<string, IconSheet | undefined> = { achievements: { url: "data:image/png;base64,AAAA", cols: 6, rows: 3 } };

		it("crops one cell with background size and position", () => {
			expect(sheetCellStyle({ sheet: "achievements", col: 0, row: 0 }, 48, sheets)).toMatchObject({ width: 48, height: 48, backgroundSize: "600% 300%", backgroundPosition: "0% 0%" });
			expect(sheetCellStyle({ sheet: "achievements", col: 5, row: 2 }, 48, sheets)).toMatchObject({ backgroundPosition: "100% 100%" });
			expect(sheetCellStyle({ sheet: "achievements", col: 1, row: 1 }, 48, sheets)?.backgroundPosition).toBe("20% 50%");
		});

		it("is null for an unknown sheet or a cell outside the grid", () => {
			expect(sheetCellStyle({ sheet: "nope", col: 0, row: 0 }, 48, sheets)).toBeNull();
			expect(sheetCellStyle({ sheet: "achievements", col: 6, row: 0 }, 48, sheets)).toBeNull();
			expect(sheetCellStyle({ sheet: "achievements", col: 0, row: -1 }, 48, sheets)).toBeNull();
			expect(sheetCellStyle({ sheet: "achievements", col: 0.5, row: 0 }, 48, sheets)).toBeNull();
		});

		it("renders the cell, with locked and hidden variants as CSS classes", () => {
			const cell = { sheet: "achievements", col: 2, row: 1 };
			const plain = renderToStaticMarkup(createElement(AchIcon, { icon: cell, sheets }));
			expect(plain).toContain("ui-ach-sheet");
			expect(plain).toContain("background-size:600% 300%");
			expect(plain).not.toContain("is-locked");
			expect(renderToStaticMarkup(createElement(AchIcon, { icon: cell, sheets, locked: true }))).toContain("is-locked");
			expect(renderToStaticMarkup(createElement(AchIcon, { icon: cell, sheets, locked: true, hidden: true }))).toContain("is-hidden");
			expect(renderToStaticMarkup(createElement(AchIcon, { icon: cell, sheets, scale: 3 }))).toContain("width:72px");
		});

		it("falls back to the placeholder plate when the sheet is not registered", () => {
			const html = renderToStaticMarkup(createElement(AchIcon, { icon: { sheet: "achievements", col: 0, row: 0 }, sheets: {} }));
			expect(html).toContain("<rect");
			expect(html).toContain('data-icon="placeholder"');
		});
	});
});
