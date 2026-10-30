import { loadProfile } from "@aitower/shared";
import type { SimView } from "@aitower/sim";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AchIcon } from "./AchIcon";
import { ICONS, ICON_PALETTE, ICON_SIZE, hasIcon, iconRows, lockedIcon } from "./icons";
import { ACHIEVEMENTS, awardFor, countsForAchievements, evaluate } from "./achievements";

const memory = () => {
	const m = new Map<string, string>();
	return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};
const view = (o: Partial<SimView> = {}): SimView => ({ cash: 0, day: 9, lesson: null, sandbox: false, gameOver: null, ...o }) as unknown as SimView;

describe("achievements checker", () => {
	it("registers only Deep Pockets for now", () => {
		expect(ACHIEVEMENTS.map((a) => a.id)).toEqual(["cash_deep"]);
	});

	it("fires at $10M and not below", () => {
		const s = memory();
		expect(awardFor("dayClose", view({ cash: 9_999_999 }), s)).toEqual([]);
		const won = awardFor("dayClose", view({ cash: 10_000_000 }), s);
		expect(won.map((d) => d.id)).toEqual(["cash_deep"]);
		expect(loadProfile(s).earned.cash_deep).toEqual({ day: 9, ending: null });
	});

	it("fires once, ever, even after cash drops and returns", () => {
		const s = memory();
		expect(awardFor("dayClose", view({ cash: 12e6 }), s)).toHaveLength(1);
		expect(awardFor("dayClose", view({ cash: 12e6 }), s)).toHaveLength(0);
		expect(awardFor("dayClose", view({ cash: 1e6 }), s)).toHaveLength(0);
		expect(evaluate("dayClose", view({ cash: 12e6 }), loadProfile(s))).toEqual([]);
	});

	it("never fires in a lesson or a sandbox run", () => {
		const s = memory();
		const lesson = { id: "first_watt" } as unknown as SimView["lesson"];
		expect(countsForAchievements(view({ lesson }))).toBe(false);
		expect(awardFor("dayClose", view({ cash: 20e6, lesson }), s)).toEqual([]);
		expect(awardFor("dayClose", view({ cash: 20e6, sandbox: true }), s)).toEqual([]);
		expect(loadProfile(s).earned).toEqual({});
		expect(awardFor("dayClose", view({ cash: 20e6 }), s)).toHaveLength(1);
	});
});

describe("achievement icons", () => {
	it("every row names an icon that exists, 24x24, palette keys only", () => {
		for (const a of ACHIEVEMENTS) {
			expect(hasIcon(a.icon), a.id).toBe(true);
			for (const rows of [ICONS[a.icon], lockedIcon(a.icon), iconRows(a.icon, true, true)]) {
				expect(rows).toHaveLength(ICON_SIZE);
				for (const r of rows) {
					expect(r).toHaveLength(ICON_SIZE);
					for (const c of r) expect(c === "." || c in ICON_PALETTE).toBe(true);
				}
			}
		}
	});

	it("renders to svg in every state without error", () => {
		for (const p of [{}, { locked: true }, { locked: true, hidden: true }, { scale: 3 }]) {
			const html = renderToStaticMarkup(createElement(AchIcon, { id: ACHIEVEMENTS[0].icon, ...p }));
			expect(html).toContain("<rect");
		}
	});
});
