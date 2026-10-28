/**
 * Lessons (M6.4), pure UI logic: which teacher line is due, the goal-bar numbers, which build items a lesson shows, the
 * blueprint slot to highlight and the result screen's model. The sim owns the lesson itself (`SimView.lesson`); nothing here
 * touches the clock or the store.
 */
import type { AdvisorId, ContentDB, LessonDef, LessonStep } from "@aitower/content";
import type { Ghost } from "@aitower/shared";
import type { LessonView, SimView } from "@aitower/sim";
import type { Tab } from "../build/plain";
import { termById } from "../glossary/terms";
import { buildChapters } from "../handbook/chapters";

/** The lessons that exist, in order. The menu lists exactly these: no placeholders. */
export const lessonsInOrder = (content: Pick<ContentDB, "lessons">): LessonDef[] => [...content.lessons].sort((a, b) => a.number - b.number);

/** The lesson after `def`, or undefined when it is the last one. */
export const nextLessonOf = (content: Pick<ContentDB, "lessons">, def: LessonDef): LessonDef | undefined => lessonsInOrder(content).find((l) => l.number === def.number + 1);

export const lessonDefOf = (content: ContentDB, view: Pick<SimView, "lesson">): LessonDef | undefined => (view.lesson ? content.lessons.find((l) => l.id === view.lesson?.id) : undefined);
export const playable = (content: ContentDB, id: string): LessonDef | undefined => content.lessons.find((l) => l.id === id);

/** True while a lesson restricts the screen (not once it is won or lost). */
export const lessonActive = (view: Pick<SimView, "lesson">): boolean => view.lesson?.status === "active";

// ─── The teacher ──────────────────────────────────────────────────────

/** How many lines of each step's `say` / `after` the player has acknowledged: keys are `${stepId}:say` and `${stepId}:after`. */
export type Ack = Record<string, number>;

export interface Message {
	key: string;
	stepId: string;
	kind: "say" | "after";
	line: string;
	/** 1-based position and total, for "2 / 3". */
	n: number;
	of: number;
	/** The clock stops while this line is up. */
	pause: boolean;
	/** Who says it: the step's own speaker, or the lesson's. */
	advisor: AdvisorId;
}

/** The next line the teacher owes the player, or null. After-lines of a finished step come before the next step's own lines. */
export function pendingMessage(def: LessonDef, lv: Pick<LessonView, "stepsDone" | "current" | "beatsFired">, ack: Ack): Message | null {
	for (let i = 0; i < def.steps.length; i++) {
		const s = def.steps[i];
		const done = lv.stepsDone.includes(s.id);
		if (done && s.after?.length && (!s.afterBeat || lv.beatsFired.includes(s.afterBeat))) {
			const k = `${s.id}:after`;
			const a = ack[k] ?? 0;
			if (a < s.after.length) return { key: k, stepId: s.id, kind: "after", line: s.after[a], n: a + 1, of: s.after.length, pause: s.pause !== false, advisor: s.advisor ?? def.advisor };
		}
		if (i === lv.current && !done) {
			// The previous step's scripted moment has not landed yet: hold the next step's lines back.
			const prev = def.steps[i - 1];
			if (prev?.after?.length && prev.afterBeat && !lv.beatsFired.includes(prev.afterBeat)) return null;
			const k = `${s.id}:say`;
			const a = ack[k] ?? 0;
			if (a < s.say.length) return { key: k, stepId: s.id, kind: "say", line: s.say[a], n: a + 1, of: s.say.length, pause: true, advisor: s.advisor ?? def.advisor };
		}
	}
	return null;
}

/** Everything before the current step is already acknowledged: a game loaded mid-lesson does not replay old lines. */
export function baselineAck(def: LessonDef, lv: Pick<LessonView, "stepsDone" | "current" | "status">): Ack {
	const out: Ack = {};
	def.steps.forEach((s, i) => {
		if (i < lv.current || lv.status !== "active") {
			out[`${s.id}:say`] = s.say.length;
			out[`${s.id}:after`] = s.after?.length ?? 0;
		}
	});
	return out;
}

export const stepOf = (def: LessonDef, lv: Pick<LessonView, "current">): LessonStep | undefined => def.steps[Math.min(lv.current, def.steps.length - 1)];

// ─── Goal bar ─────────────────────────────────────────────────────────

export interface GoalModel {
	loadKw: number;
	capacityKw: number;
	/** Load as a share of capacity, 0..1 (1 when there is no capacity and some load). */
	frac: number;
	headroomPct: number;
	tone: "ok" | "warn" | "bad";
	/** 0..1 progress through the success hold. */
	hold: number;
	holdText: string;
	pue: number;
}

export function goalModel(lv: LessonView): GoalModel {
	const frac = lv.capacityKw > 0 ? Math.min(1, lv.loadKw / lv.capacityKw) : lv.loadKw > 0 ? 1 : 0;
	const tone = lv.capacityKw <= 0 || lv.loadKw > lv.capacityKw ? "bad" : lv.headroomPct < 10 ? "warn" : "ok";
	const hours = Math.floor(lv.holdTicks / 60);
	const goalHours = Math.round(lv.holdGoal / 60);
	return { loadKw: lv.loadKw, capacityKw: lv.capacityKw, frac, headroomPct: lv.headroomPct, tone, hold: lv.holdGoal > 0 ? Math.min(1, lv.holdTicks / lv.holdGoal) : 0, holdText: `${hours} of ${goalHours} h`, pue: lv.pue };
}

// ─── The restricted catalog ───────────────────────────────────────────

/** Ids the lesson lets the player build right now, or null when nothing is restricted. */
export const allowedIds = (view: Pick<SimView, "lesson">): ReadonlySet<string> | null => (view.lesson?.status === "active" ? new Set(view.lesson.allowed.map((a) => a.defId)) : null);

/** The build bar tabs that still hold something buildable; null = all (no lesson). */
export function lessonTabs(content: ContentDB, view: Pick<SimView, "lesson">): Tab[] | null {
	const ids = allowedIds(view);
	if (!ids) return null;
	const tabs = new Set<Tab>();
	if (view.lesson?.supplies) tabs.add("supplies");
	for (const id of ids) {
		const d = content.facilities[id];
		if (d) tabs.add(d.category as Tab);
	}
	return [...tabs];
}

/** True when the lesson's current step still has something to place that the player has not (the slot to show). */
export function slotGhost(def: LessonDef, lv: LessonView, content: ContentDB): Ghost | null {
	if (lv.status !== "active") return null;
	const s = def.steps[lv.current];
	if (!s?.slot) return null;
	const slot = s.slot;
	const d = content.facilities[slot.defId];
	if (!d) return null;
	const cells = Array.from({ length: d.width }, (_, i) => ({ x: slot.x + i, floor: slot.floor }));
	return { cells, valid: true, defId: d.id, label: "BUILD HERE" };
}

/** Selectors (inside the HUD) of what to pulse for the current step: the category, then the card. */
export function pulseTargets(def: LessonDef, lv: LessonView, content: ContentDB, ui: { paletteOpen: boolean; paletteTab: string }): string[] {
	if (lv.status !== "active") return [];
	const s = def.steps[lv.current];
	const d = s?.slot ? content.facilities[s.slot.defId] : undefined;
	if (!d) return [];
	if (!ui.paletteOpen || ui.paletteTab !== d.category) return [`[data-tut="cat-${d.category}"]`];
	return [`[data-tut="card-${d.id}"]`];
}

/** Everything the current step wants pulsed: the slot's category or card, and the step's own selectors. */
export function stepPulse(def: LessonDef, lv: LessonView, content: ContentDB, ui: { paletteOpen: boolean; paletteTab: string }): string[] {
	if (lv.status !== "active") return [];
	return [...pulseTargets(def, lv, content, ui), ...(def.steps[lv.current]?.pulse ?? [])];
}

// ─── Result ───────────────────────────────────────────────────────────

export interface ResultModel {
	won: boolean;
	/** False for the lessons that give no stars: finishing is the reward. */
	starred: boolean;
	stars: number;
	rows: { label: string; value: string; earned: boolean }[];
	learned: string;
	handbook: { id: string; label: string }[];
	bonus: number;
	/** Game-days the lesson took. */
	days: string;
}


/** The Handbook article's name for a link: a chapter title, or the word for "chapter#word". */
export function articleTitle(content: ContentDB, id: string): string {
	const [page, word] = id.split("#");
	if (word) return termById(word)?.name ?? word;
	return buildChapters(content).find((c) => c.id === page)?.title ?? page;
}

export function resultModel(def: LessonDef, lv: LessonView, firstTime: boolean, titleOf: (id: string) => string = (id) => id): ResultModel {
	const won = lv.status === "won";
	const starred = def.starred !== false;
	return {
		won,
		starred,
		stars: lv.stars,
		rows: starred
			? [
					{ label: "Passed", value: won ? (def.passed ?? def.goal) : "Not this time", earned: won },
					{ label: "Headroom", value: `lowest ${Math.round(lv.minHeadroom)}% (want ${def.stars.headroomPct}%+)`, earned: won && lv.minHeadroom >= def.stars.headroomPct },
					{ label: "Uptime", value: `${lv.downTicks} min short of power (want ${def.stars.maxDarkTicks} or fewer)`, earned: won && lv.downTicks <= def.stars.maxDarkTicks },
				]
			: [{ label: "Passed", value: won ? (def.passed ?? def.goal) : "Not this time", earned: won }],
		learned: def.learned,
		handbook: def.handbook.map((id) => ({ id, label: titleOf(id) })),
		bonus: won && firstTime ? def.bonus : 0,
		days: ((lv.endTick - lv.startTick) / 1440).toFixed(1),
	};
}
