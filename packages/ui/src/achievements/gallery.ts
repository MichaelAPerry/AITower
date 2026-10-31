/** Pure helpers for the achievements list and the off-duty gallery (no React). */
import { type GalleryAdvisor, type GalleryScene, achievementContent, galleryScenes } from "@aitower/content";
import type { Profile } from "@aitower/shared";
import { ACHIEVEMENTS, ACHIEVEMENT_COUNT, type AchievementDef, bedComplete } from "./achievements";

/** A locked frame shows the plain rule once her bond has reached this (so the player can aim). */
export const RULE_BOND = 30;

/** The text a hidden row shows until it is earned. */
const U = achievementContent.ui;
export const HIDDEN_NAME = U.hiddenName;
export const HIDDEN_TEXT = U.hiddenText;

/** What an ending is called next to the day an achievement was earned. */
export const ENDING_LABEL: Readonly<Record<string, string>> = { singularity: U.endingSingularity, flesh: U.endingFlesh, garden: U.endingGarden, absorbed: U.endingAbsorbed, bankrupt: U.endingBankrupt };

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
			when: e ? `${U.day} ${e.day}${e.ending ? ` · ${ENDING_LABEL[e.ending] ?? e.ending}` : ""}` : null,
			def,
		};
	});
}

/** "11 / 18" */
export const counter = (profile: Pick<Profile, "earned">, defs: readonly AchievementDef[] = ACHIEVEMENTS): string => `${defs.filter((d) => profile.earned[d.id]).length} / ${defs.length || ACHIEVEMENT_COUNT}`;

/**
 * What a locked portrait may show: a head box as fractions of the (square) bust image, cut just below the neck, or "hide"
 * for a lock tile with no picture. The owner's rule: never the full greyscale picture.
 */
export interface HeadCrop {
	x: number;
	y: number;
	w: number;
	h: number;
}
export type LockedLook = HeadCrop | "hide";
/** Used for any advisor without an entry in `LOCKED_LOOK`. */
export const DEFAULT_CROP: HeadCrop = { x: 0.1, y: 0, w: 0.7, h: 0.66 };
/** Per-portrait head boxes, set by eye from the neutral busts (256x256). */
export const LOCKED_LOOK: Readonly<Partial<Record<GalleryAdvisor, LockedLook>>> = {
	luci: { x: 0.12, y: 0.0, w: 0.7, h: 0.66 },
	mel: { x: 0.06, y: 0.0, w: 0.7, h: 0.66 },
	bea: { x: 0.12, y: 0.0, w: 0.7, h: 0.66 },
	cass: { x: 0.12, y: 0.0, w: 0.72, h: 0.66 },
};
export const lockedLook = (a: GalleryAdvisor, table: Readonly<Partial<Record<GalleryAdvisor, LockedLook>>> = LOCKED_LOOK): LockedLook => table[a] ?? DEFAULT_CROP;

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

/** The pages of a scene: its lines. (An unlock scene's last line is the portrait's caption, so nothing is appended.) */
export function pagesOf(scene: GalleryScene): Page[] {
	return scene.lines.map((l) => ({ who: l.who, text: l.text }));
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
	if (names.length) out.push(`${U.endNew} ${names.join(", ")}`);
	const off = run.portraits.map((a) => `${achievementContent.offDuty[a].name}${U.endPortrait}`);
	if (run.bed) off.push(U.endBed);
	if (off.length) out.push(`${U.endOffDuty} ${off.join(", ")}`);
	// The hidden failure achievement comes with a line of its own (docs/OWNER_TEXT.md, end_bankrupt_note).
	if (run.achievements.includes("end_bankrupt")) out.push(U.endBankruptNote);
	return out;
}
