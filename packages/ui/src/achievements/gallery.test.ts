import { achievementContent, galleryScenes } from "@aitower/content";
import { loadProfile, markProfileFlag, recordAchievement, recordOffDuty } from "@aitower/shared";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AchievementsPane, Gallery } from "./AchievementsPane";
import { LockedHead } from "./LockedHead";
import { ACHIEVEMENTS } from "./achievements";
import { DEFAULT_CROP, HIDDEN_NAME, HIDDEN_TEXT, LOCKED_LOOK, lockedLook, autoScene, counter, frames, listRows, newLines, pagesOf, sceneById, sceneIdFor } from "./gallery";

const memory = () => {
	const m = new Map<string, string>();
	return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};
const all = (s: ReturnType<typeof memory>, skip?: string) => {
	for (const a of ACHIEVEMENTS) if (a.id !== skip) recordAchievement(a.id, 5, null, s);
};

describe("the list", () => {
	it("a new profile: 0 / 20, hidden rows read ??? and the other way this ends", () => {
		const p = loadProfile(memory());
		expect(counter(p)).toBe("0 / 20");
		const rows = listRows(p);
		expect(rows).toHaveLength(20);
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
		expect(counter(p)).toBe("3 / 20");
		expect(rows.find((r) => r.id === "end_lattice")).toMatchObject({ earned: true, when: "Day 28 · The Lattice" });
		expect(rows.find((r) => r.id === "cash_deep")).toMatchObject({ earned: true, when: "Day 12" });
		expect(rows.find((r) => r.id === "end_bankrupt")).toMatchObject({ hidden: false, name: "Notice of Termination", when: "Day 3 · Bankrupt" });
		expect(rows.find((r) => r.id === "end_absorbed")?.hidden).toBe(true);
	});

	it("counts 20 / 20 when everything is earned", () => {
		const s = memory();
		all(s);
		expect(counter(loadProfile(s))).toBe("20 / 20");
	});
});

describe("the frames", () => {
	it("four casual frames locked, four bed frames closed", () => {
		const f = frames(loadProfile(memory()));
		expect(f.casual.map((x) => [x.advisor, x.unlocked])).toEqual([["luci", false], ["mel", false], ["bea", false], ["cass", false]]);
		expect(f.bed.every((x) => !x.unlocked)).toBe(true);
		expect(f.bedOpen).toBe(false);
	});

	it("the bed frames open only with every achievement AND all four casual portraits", () => {
		const s = memory();
		all(s, "heard_out");
		for (const a of ["luci", "mel", "bea", "cass"] as const) recordOffDuty(a, s);
		expect(frames(loadProfile(s)).bed.some((x) => x.unlocked)).toBe(false);
		recordAchievement("heard_out", 5, null, s);
		const f = frames(loadProfile(s));
		expect(f.bedOpen).toBe(true);
		expect(f.bed.every((x) => x.unlocked)).toBe(true);
		const s2 = memory();
		all(s2);
		expect(frames(loadProfile(s2)).bedOpen).toBe(false);
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
		const pages = pagesOf(sceneById("ach_unlock_mel"));
		expect(pages).toHaveLength(3);
		expect(pages.at(-1)).toEqual({ who: "mel", text: achievementContent.offDuty.mel.caption });
		expect(achievementContent.offDuty.mel.caption).toBe("Come join me for a conversation, I can make more tea.");
		expect(pagesOf(sceneById("ach_bed_luci"))).toHaveLength(1);
	});

	it("plays the bed intro once the last has landed, then never again; the empty line once, only while nothing is unlocked", () => {
		const s = memory();
		expect(autoScene(loadProfile(s))).toBe("ach_gallery_empty");
		markProfileFlag("scenesSeen", "ach_gallery_empty", s);
		expect(autoScene(loadProfile(s))).toBeNull();
		const t = memory();
		recordOffDuty("cass", t);
		expect(autoScene(loadProfile(t))).toBeNull();
		all(s);
		for (const a of ["luci", "mel", "bea", "cass"] as const) recordOffDuty(a, s);
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
	it("adds the Bankrupt note only when Notice of Termination unlocks", () => {
		const note = achievementContent.ui.endBankruptNote;
		expect(note.trim()).not.toBe("");
		expect(newLines({ achievements: ["end_bankrupt"], portraits: [], bed: false })).toContain(note);
		expect(newLines({ achievements: ["end_absorbed"], portraits: [], bed: false })).not.toContain(note);
	});
	it("adds the Bankrupt note only when Notice of Termination unlocks", () => {
		const note = achievementContent.ui.endBankruptNote;
		expect(note.trim()).not.toBe("");
		expect(newLines({ achievements: ["end_bankrupt"], portraits: [], bed: false })).toContain(note);
		expect(newLines({ achievements: ["end_absorbed"], portraits: [], bed: false })).not.toContain(note);
	});
});

describe("the page", () => {
	it("renders the list with 0 / 20 and the storage note", () => {
		const html = renderToStaticMarkup(createElement(AchievementsPane));
		expect(html).toContain("0 / 20");
		expect(html.match(/class="ach-row /g)).toHaveLength(20);
		expect(html).toContain("There is another way this ends.");
		expect(html).toContain("Export to file keeps it");
	});
});

describe("locked portraits show only the head", () => {
	it("every advisor has a head box inside the picture, cut above the shoulders (or is hidden)", () => {
		for (const a of ["luci", "mel", "bea", "cass"] as const) {
			const look = lockedLook(a);
			expect(look).toBe(LOCKED_LOOK[a]);
			if (look === "hide") continue;
			expect(look.x).toBeGreaterThanOrEqual(0);
			expect(look.y).toBeGreaterThanOrEqual(0);
			expect(look.x + look.w).toBeLessThanOrEqual(1);
			expect(look.y + look.h).toBeLessThanOrEqual(0.75);
		}
		expect(lockedLook("luci", {})).toBe(DEFAULT_CROP);
	});

	it("the gallery renders locked frames as a CSS head crop, never the plain full picture", () => {
		const html = renderToStaticMarkup(createElement(Gallery, { onPlay: () => {} }));
		const locked = html.match(/class="ach-frame is-locked"/g) ?? [];
		expect(locked).toHaveLength(4);
		expect(html.match(/data-crop="head"/g) ?? []).toHaveLength(4);
		expect(html).toContain("--cw:");
	});

	it("a crop of 'hide' is a lock tile with no image", () => {
		const html = renderToStaticMarkup(createElement(LockedHead, { src: "x.webp", look: "hide", alt: "Luci, locked" }));
		expect(html).toContain('data-crop="hide"');
		expect(html).not.toContain("<img");
	});
});
