import { achievementContent, galleryScenes } from "@aitower/content";
import { loadProfile, markProfileFlag, recordAchievement, recordBonds, recordOffDuty } from "@aitower/shared";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AchievementsPane } from "./AchievementsPane";
import { ACHIEVEMENTS } from "./achievements";
import { HIDDEN_NAME, HIDDEN_TEXT, RULE_BOND, autoScene, counter, frames, listRows, newLines, pagesOf, sceneById, sceneIdFor } from "./gallery";

const memory = () => {
	const m = new Map<string, string>();
	return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};
const all = (s: ReturnType<typeof memory>, skip?: string) => {
	for (const a of ACHIEVEMENTS) if (a.id !== skip) recordAchievement(a.id, 5, null, s);
};

describe("the list", () => {
	it("a new profile: 0 / 18, hidden rows read ??? and the other way this ends", () => {
		const p = loadProfile(memory());
		expect(counter(p)).toBe("0 / 18");
		const rows = listRows(p);
		expect(rows).toHaveLength(18);
		const hidden = rows.filter((r) => r.hidden);
		expect(hidden.map((r) => r.id)).toEqual(["end_absorbed", "end_bankrupt"]);
		for (const r of hidden) expect([r.name, r.text]).toEqual([HIDDEN_NAME, HIDDEN_TEXT]);
		expect(HIDDEN_TEXT).toBe("There is another way this ends.");
		expect(rows.find((r) => r.id === "end_lattice")).toMatchObject({ name: "Sensible Option", text: "Finish the game on The Lattice.", earned: false, when: null });
	});

	it("earned rows show the day and the ending; a hidden one is revealed when earned", () => {
		const s = memory();
		recordAchievement("end_lattice", 28, "singularity", s);
		recordAchievement("cash_deep", 12, null, s);
		recordAchievement("end_bankrupt", 3, "bankrupt", s);
		const p = loadProfile(s);
		const rows = listRows(p);
		expect(counter(p)).toBe("3 / 18");
		expect(rows.find((r) => r.id === "end_lattice")).toMatchObject({ earned: true, when: "Day 28 · The Lattice" });
		expect(rows.find((r) => r.id === "cash_deep")).toMatchObject({ earned: true, when: "Day 12" });
		expect(rows.find((r) => r.id === "end_bankrupt")).toMatchObject({ hidden: false, name: "Notice of Termination", when: "Day 3 · Bankrupt" });
		expect(rows.find((r) => r.id === "end_absorbed")?.hidden).toBe(true);
	});

	it("counts 18 / 18 when everything is earned", () => {
		const s = memory();
		all(s);
		expect(counter(loadProfile(s))).toBe("18 / 18");
	});
});

describe("the frames", () => {
	it("four casual frames locked, four bed frames closed", () => {
		const f = frames(loadProfile(memory()));
		expect(f.casual.map((x) => [x.advisor, x.unlocked])).toEqual([["luci", false], ["mel", false], ["bea", false], ["cass", false]]);
		expect(f.bed.every((x) => !x.unlocked)).toBe(true);
		expect(f.bedOpen).toBe(false);
	});

	it("the plain rule appears once her bond has reached 30, not before", () => {
		const s = memory();
		recordBonds({ mel: RULE_BOND - 1, bea: RULE_BOND }, s);
		const f = frames(loadProfile(s)).casual;
		expect(f.find((x) => x.advisor === "mel")?.showRule).toBe(false);
		expect(f.find((x) => x.advisor === "bea")?.showRule).toBe(true);
		recordOffDuty("bea", s);
		expect(frames(loadProfile(s)).casual.find((x) => x.advisor === "bea")).toMatchObject({ unlocked: true, showRule: false });
	});

	it("all four bed frames open together at 18, not at 17", () => {
		const s = memory();
		all(s, "heard_out");
		expect(frames(loadProfile(s)).bed.some((x) => x.unlocked)).toBe(false);
		recordAchievement("heard_out", 5, null, s);
		const f = frames(loadProfile(s));
		expect(f.bedOpen).toBe(true);
		expect(f.bed.every((x) => x.unlocked)).toBe(true);
		// Cass's casual portrait is a separate unlock: the bed set does not open it.
		expect(f.casual.every((x) => !x.unlocked)).toBe(true);
	});

	it("each frame plays its own scene: hint when locked, unlock when open, bed in the bed set", () => {
		const f = frames(loadProfile(memory()));
		expect(sceneIdFor(f.casual[0])).toBe("ach_hint_luci");
		expect(sceneIdFor({ ...f.casual[1], unlocked: true })).toBe("ach_unlock_mel");
		expect(sceneIdFor({ ...f.bed[3], unlocked: true })).toBe("ach_bed_cass");
	});
});

describe("scenes", () => {
	it("every scene the gallery can play exists with the owner's lines", () => {
		for (const a of ["luci", "mel", "bea", "cass"] as const) for (const id of [galleryScenes.unlock(a), galleryScenes.bed(a), galleryScenes.hint(a)]) expect(sceneById(id).lines.length, id).toBeGreaterThan(0);
		expect(sceneById("ach_bed_intro").lines).toHaveLength(2);
		expect(() => sceneById("nope")).toThrow();
	});

	it("an unlock scene ends on her caption", () => {
		const pages = pagesOf(sceneById("ach_unlock_mel"), { advisor: "mel", text: achievementContent.offDuty.mel.caption });
		expect(pages).toHaveLength(4);
		expect(pages.at(-1)).toEqual({ who: "mel", text: "Hm. Feet up. I read that helps. It does, a little, if you like." });
		expect(pagesOf(sceneById("ach_bed_luci"))).toHaveLength(1);
	});

	it("plays the bed intro once the 18th has landed, then never again; the empty line once, only while nothing is unlocked", () => {
		const s = memory();
		expect(autoScene(loadProfile(s))).toBe("ach_gallery_empty");
		markProfileFlag("scenesSeen", "ach_gallery_empty", s);
		expect(autoScene(loadProfile(s))).toBeNull();
		const t = memory();
		recordOffDuty("cass", t);
		expect(autoScene(loadProfile(t))).toBeNull();
		all(s);
		expect(autoScene(loadProfile(s))).toBe("ach_bed_intro");
		markProfileFlag("scenesSeen", "ach_bed_intro", s);
		expect(autoScene(loadProfile(s))).toBeNull();
	});
});

describe("the ending screen line", () => {
	it("says what the run earned, and is empty when nothing", () => {
		expect(newLines({ achievements: [], portraits: [], bed: false })).toEqual([]);
		expect(newLines({ achievements: ["clean_hands"], portraits: [], bed: false })).toEqual(["New: Clean Hands"]);
		expect(newLines({ achievements: ["end_flesh", "clean_hands"], portraits: ["mel"], bed: false })).toEqual(["New: The Flesh Remembers, Clean Hands", "Off duty: Mel's portrait"]);
		expect(newLines({ achievements: [], portraits: [], bed: true })).toEqual(["Off duty: the after-hours set"]);
	});
});

describe("the page", () => {
	it("renders the list with 0 / 18 and the storage note", () => {
		const html = renderToStaticMarkup(createElement(AchievementsPane));
		expect(html).toContain("0 / 18");
		expect(html.match(/class="ach-row /g)).toHaveLength(18);
		expect(html).toContain("There is another way this ends.");
		expect(html).toContain("Export to file keeps it");
	});
});
