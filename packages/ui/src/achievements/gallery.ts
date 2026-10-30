/** Pure helpers for the achievements list and the off-duty gallery (no React). */
import { type GalleryAdvisor, type GalleryScene, achievementContent, galleryScenes } from "@aitower/content";
import type { Profile } from "@aitower/shared";
import { ACHIEVEMENTS, ACHIEVEMENT_COUNT, type AchievementDef, bedComplete } from "./achievements";

/** A locked frame shows the plain rule once her bond has reached this (so the player can aim). */
export const RULE_BOND = 30;

/** The text a hidden row shows until it is earned. */
export const HIDDEN_NAME = "???";
export const HIDDEN_TEXT = "There is another way this ends.";

/** What an ending is called next to the day an achievement was earned. */
export const ENDING_LABEL: Readonly<Record<string, string>> = { singularity: "The Lattice", flesh: "The Flesh", garden: "The Garden", absorbed: "Absorbed", bankrupt: "Bankrupt" };

export interface ListRow {
	id: string;
	name: string;
	text: string;
	earned: boolean;
	hidden: boolean;
	/** "Day 28 · The Lattice" once earned. */
	when: string | null;
	def: AchievementDef;
}

/** One row per achievement, in table order. A hidden one shows `???` until earned. */
export function listRows(profile: Pick<Profile, "earned">, defs: readonly AchievementDef[] = ACHIEVEMENTS): ListRow[] {
	return defs.map((def) => {
		const e = profile.earned[def.id];
		const masked = !!def.hidden && !e;
		return {
			id: def.id,
			name: masked ? HIDDEN_NAME : def.name,
			text: masked ? HIDDEN_TEXT : def.text,
			earned: !!e,
			hidden: masked,
			when: e ? `Day ${e.day}${e.ending ? ` · ${ENDING_LABEL[e.ending] ?? e.ending}` : ""}` : null,
			def,
		};
	});
}

/** "11 / 18" */
export const counter = (profile: Pick<Profile, "earned">, defs: readonly AchievementDef[] = ACHIEVEMENTS): string => `${defs.filter((d) => profile.earned[d.id]).length} / ${defs.length || ACHIEVEMENT_COUNT}`;

export interface Frame {
	advisor: GalleryAdvisor;
	set: "casual" | "bed";
	unlocked: boolean;
	/** Casual locked frames only: show the plain rule (her bond has reached `RULE_BOND`). */
	showRule: boolean;
}

/** The four casual frames, then the four bed frames. */
export function frames(profile: Profile, defs: readonly AchievementDef[] = ACHIEVEMENTS): { casual: Frame[]; bed: Frame[]; bedOpen: boolean } {
	const bedOpen = bedComplete(profile, defs);
	const advisors = ["luci", "mel", "bea", "cass"] as const;
	return {
		bedOpen,
		casual: advisors.map((advisor) => ({ advisor, set: "casual", unlocked: profile.offDuty[advisor].casual, showRule: !profile.offDuty[advisor].casual && profile.bondMax[advisor] >= RULE_BOND })),
		bed: advisors.map((advisor) => ({ advisor, set: "bed", unlocked: bedOpen, showRule: false })),
	};
}

export const sceneById = (id: string): GalleryScene => {
	const s = achievementContent.scenes.find((x) => x.id === id);
	if (!s) throw new Error(`gallery scene ${id} is missing`);
	return s;
};

/** The scene a click on a frame plays. */
export const sceneIdFor = (f: Frame): string => (f.set === "bed" ? galleryScenes.bed(f.advisor) : f.unlocked ? galleryScenes.unlock(f.advisor) : galleryScenes.hint(f.advisor));

export interface Page {
	who: "narrator" | GalleryAdvisor;
	text: string;
}

/** The pages of a scene: its lines, then (casual unlock) her caption as her last line. */
export function pagesOf(scene: GalleryScene, caption?: { advisor: GalleryAdvisor; text: string }): Page[] {
	const pages: Page[] = scene.lines.map((l) => ({ who: l.who, text: l.text }));
	if (caption) pages.push({ who: caption.advisor, text: caption.text });
	return pages;
}

/** Which one-time scene to play on opening the OFF DUTY page: the bed intro once the set is open, else the empty-gallery line once. */
export function autoScene(profile: Profile, defs: readonly AchievementDef[] = ACHIEVEMENTS): string | null {
	if (bedComplete(profile, defs) && !profile.scenesSeen[galleryScenes.bedIntro]) return galleryScenes.bedIntro;
	const any = (["luci", "mel", "bea", "cass"] as const).some((a) => profile.offDuty[a].casual);
	if (!any && !bedComplete(profile, defs) && !profile.scenesSeen[galleryScenes.empty]) return galleryScenes.empty;
	return null;
}

/** The "New: ..." lines on the ending screen for what this run earned (empty when nothing). */
export function newLines(run: { achievements: readonly string[]; portraits: readonly GalleryAdvisor[]; bed: boolean }, defs: readonly AchievementDef[] = ACHIEVEMENTS): string[] {
	const out: string[] = [];
	const names = run.achievements.map((id) => defs.find((d) => d.id === id)?.name).filter((n): n is string => !!n);
	if (names.length) out.push(`New: ${names.join(", ")}`);
	const off = run.portraits.map((a) => `${achievementContent.offDuty[a].name}'s portrait`);
	if (run.bed) off.push("the after-hours set");
	if (off.length) out.push(`Off duty: ${off.join(", ")}`);
	return out;
}
