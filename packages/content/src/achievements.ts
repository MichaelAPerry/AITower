/**
 * Achievements and the off-duty gallery: the words (docs/ACHIEVEMENTS.md). The checks live in the UI
 * (packages/ui/src/achievements); this file only holds names, texts, captions and the gallery scenes.
 */
import data from "./data/achievements.json";

export type GalleryAdvisor = "luci" | "mel" | "bea" | "cass";

export interface AchievementText {
	id: string;
	name: string;
	/** Player-facing text. */
	text: string;
	/** Hidden until earned (the failure endings). */
	hidden?: boolean;
}

export interface OffDutyText {
	name: string;
	/** Under the portrait once it is unlocked. */
	caption: string;
	/** The locked frame's old-style line. */
	hint: string;
	/** The plain rule, shown once her bond has reached 30. */
	rule: string;
}

export interface GalleryLine {
	who: "narrator" | GalleryAdvisor;
	text: string;
	mood?: "neutral" | "pleased" | "displeased" | "unsettling";
}

export interface GalleryScene {
	id: string;
	title: string;
	location: string;
	lines: GalleryLine[];
}

export interface AchievementContent {
	achievements: AchievementText[];
	offDuty: Record<GalleryAdvisor, OffDutyText>;
	scenes: GalleryScene[];
}

export const GALLERY_ADVISORS: readonly GalleryAdvisor[] = ["luci", "mel", "bea", "cass"];

/** Scene ids the gallery plays (each must exist in `scenes`). */
export const galleryScenes = {
	unlock: (a: GalleryAdvisor) => `ach_unlock_${a}`,
	bed: (a: GalleryAdvisor) => `ach_bed_${a}`,
	hint: (a: GalleryAdvisor) => `ach_hint_${a}`,
	bedIntro: "ach_bed_intro",
	empty: "ach_gallery_empty",
} as const;

/** Every problem with the achievement content (an empty list is valid). */
export function validateAchievementContent(c: AchievementContent): string[] {
	const p: string[] = [];
	const ids = new Set<string>();
	for (const a of c.achievements) {
		if (ids.has(a.id)) p.push(`achievements: duplicate id ${a.id}`);
		ids.add(a.id);
		if (!/^[a-z][a-z0-9_]*$/.test(a.id)) p.push(`achievements.${a.id}: id must be lower_snake`);
		if (!a.name?.trim()) p.push(`achievements.${a.id}: name is empty`);
		if (!a.text?.trim()) p.push(`achievements.${a.id}: text is empty`);
	}
	for (const adv of GALLERY_ADVISORS) {
		const o = c.offDuty?.[adv];
		if (!o) {
			p.push(`offDuty.${adv}: missing`);
			continue;
		}
		for (const k of ["name", "caption", "hint", "rule"] as const) if (!o[k]?.trim()) p.push(`offDuty.${adv}.${k}: empty`);
	}
	const sceneIds = new Set<string>();
	for (const s of c.scenes) {
		if (sceneIds.has(s.id)) p.push(`scenes: duplicate id ${s.id}`);
		sceneIds.add(s.id);
		if (!s.title?.trim()) p.push(`scenes.${s.id}: title is empty`);
		if (!s.location?.trim()) p.push(`scenes.${s.id}: location is empty`);
		if (!s.lines?.length) p.push(`scenes.${s.id}: no lines`);
		for (const [i, l] of (s.lines ?? []).entries()) {
			if (l.who !== "narrator" && !GALLERY_ADVISORS.includes(l.who)) p.push(`scenes.${s.id}.l${i + 1}: unknown speaker ${String(l.who)}`);
			if (!l.text?.trim()) p.push(`scenes.${s.id}.l${i + 1}: empty text`);
		}
	}
	const need = [galleryScenes.bedIntro, galleryScenes.empty, ...GALLERY_ADVISORS.flatMap((a) => [galleryScenes.unlock(a), galleryScenes.bed(a), galleryScenes.hint(a)])];
	for (const id of need) if (!sceneIds.has(id)) p.push(`scenes: missing ${id}`);
	return p;
}

/** The bundled achievement words, validated once at load. */
export function loadAchievementContent(): AchievementContent {
	const c = structuredClone(data) as unknown as AchievementContent;
	const problems = validateAchievementContent(c);
	if (problems.length) throw new Error(`Invalid achievements.json:\n- ${problems.join("\n- ")}`);
	return c;
}

export const achievementContent: AchievementContent = loadAchievementContent();
