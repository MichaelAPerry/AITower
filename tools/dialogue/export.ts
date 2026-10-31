/**
 * Writes docs/DIALOGUE.md: every piece of player-facing dialogue, grouped for hand rewriting.
 *
 *   npx tsx tools/dialogue/export.ts          regenerate docs/DIALOGUE.md
 *   npx tsx tools/dialogue/export.ts --check  re-read docs/DIALOGUE.md (and ACHIEVEMENTS_TEXT.md if present) and verify the id grammar (no write)
 *   npx tsx tools/dialogue/export.ts --achievements  write docs/ACHIEVEMENTS_TEXT.md: only the achievements and gallery words, with context lines
 *
 * Sources: packages/content/src/data (story, endings, events, lessons), packages/ui/src/advisors/advisors.ts (names,
 * mottos) and packages/ui/src/title/crawl.ts (title crawl). Nothing else is read.
 *
 * Line grammar (the import script reads this back):
 *   - [ID] TAG: TEXT                 an editable line. ID is stable, [a-z0-9_.]+, optionally followed by " mood=<word>".
 *                                    TAG is a speaker id (narrator, luci, mel, bea, cass) for spoken lines, or a field
 *                                    label starting with a capital letter (Title, Label, Hint, Outcome, Objective, ...).
 *   > text                           metadata, not editable, never imported (trigger, effects, votes, backdrop, ...).
 *   other lines, headings, blanks    structure, ignored by the importer.
 * Multi-paragraph text uses ids ending in .p1, .p2, ... one paragraph per line.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ADVISORS, ADVISOR_ORDER } from "../../packages/ui/src/advisors/advisors.ts";
import { CRAWL_LINES } from "../../packages/ui/src/title/crawl.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DATA = resolve(ROOT, "packages/content/src/data");
const OUT = resolve(ROOT, "docs/DIALOGUE.md");
const OUT_ACH = resolve(ROOT, "docs/ACHIEVEMENTS_TEXT.md");

const load = <T>(name: string): T => JSON.parse(readFileSync(resolve(DATA, name), "utf8")) as T;

// ─── Content shapes (only the fields this script reads) ──────────────────

interface Effect {
	type: string;
	[k: string]: unknown;
}
interface Reply {
	who: string;
	text: string;
	mood?: string;
}
interface Choice {
	id: string;
	label: string;
	hint?: string;
	outcome?: string;
	effects?: Effect[];
	reply?: Reply[];
}
interface Trigger {
	kind: string;
	atLeast?: number;
	tree?: string;
	rung?: number;
	path?: string;
	advisor?: string;
}
interface Scene {
	id: string;
	advisor: string;
	title: string;
	body: string;
	location?: string;
	backdrop?: string;
	trigger?: Trigger;
	minTier?: number;
	minDay?: number;
	lines?: Reply[];
	recommended: string;
	choices: Choice[];
}
interface Vote {
	advisor: string;
	approve: boolean;
	line: string;
}
interface EventDef {
	id: string;
	category: string;
	advisor: string;
	title: string;
	body: string;
	weight: number;
	minTier: number;
	minDay?: number;
	maxTier?: number;
	minCorruption?: number;
	path?: string;
	scriptedDay?: number;
	recommended: string;
	votes?: Vote[];
	choices: Choice[];
}
interface Ending {
	id: string;
	title: string;
	backdrop?: string;
	art?: string;
	body: string;
	epilogue?: Record<string, string>;
}
interface LessonStep {
	id: string;
	text: string;
	when: unknown[];
	say?: string[];
	afterBeat?: string;
	after?: string[];
}
interface Lesson {
	id: string;
	number: number;
	title: string;
	advisor: string;
	concept: string;
	goal: string;
	scenario: string;
	steps: LessonStep[];
	learned: string;
	outro: string;
	next: string;
}

const story = load<Scene[]>("story.json");
const events = load<EventDef[]>("events.json");
const endings = load<Ending[]>("endings.json");
const lessons = load<{ lessons: Lesson[] }>("lessons.json").lessons;
const ach = load<{
	achievements: { id: string; name: string; text: string; hidden?: boolean }[];
	offDuty: Record<string, { name: string; hint: string; rule: string }>;
	ui: Record<string, string>;
	scenes: { id: string; title: string; location: string; lines: Reply[] }[];
}>("achievements.json");

// ─── Line builders ──────────────────────────────────────────────────────

const seen = new Set<string>();
let out: string[] = [];

/** One editable line. Multi-paragraph text becomes .p1, .p2, ... lines. */
function text(id: string, tag: string, value: string | undefined, mood?: string): void {
	if (value === undefined || value.trim() === "") return;
	const paras = value
		.split(/\n\s*\n/)
		.map((p) => p.replace(/\s*\n\s*/g, " ").trim())
		.filter(Boolean);
	paras.forEach((p, i) => {
		const lineId = paras.length === 1 ? id : `${id}.p${i + 1}`;
		if (seen.has(lineId)) throw new Error(`duplicate dialogue id: ${lineId}`);
		seen.add(lineId);
		out.push(`- [${lineId}${mood ? ` mood=${mood}` : ""}] ${tag}: ${p}`);
	});
}

/** Metadata: shown for context, never imported. */
const meta = (s: string): void => {
	out.push(`> ${s}`);
};

const h = (level: number, s: string): void => {
	out.push("", `${"#".repeat(level)} ${s}`, "");
};

const kv = (v: Record<string, unknown>): string =>
	Object.entries(v)
		.map(([k, x]) => `${k}=${typeof x === "object" ? JSON.stringify(x) : String(x)}`)
		.join(" ");

const effectText = (e: Effect): string => {
	const { type, ...rest } = e;
	return Object.keys(rest).length ? `${type} ${kv(rest)}` : type;
};

const ADV_NAME: Record<string, string> = Object.fromEntries(Object.values(ADVISORS).map((a) => [a.id, a.first]));
const TREE_NAME: Record<string, string> = {
	synthetic: "Synthetic (Luci's Lattice)",
	biotech: "Biotech (Mel's Flesh)",
	greentech: "Greentech (Bea's Garden)",
};

/** Plain-words description of when a story scene is issued. */
function whenInWords(s: Scene): string {
	const t = s.trigger;
	const parts: string[] = [];
	if (!t) parts.push("(no trigger)");
	else if (t.kind === "tick") {
		const n = t.atLeast ?? 0;
		parts.push(`Once, when the game clock reaches ${n} minute${n === 1 ? "" : "s"} of play (${Math.floor(n / 60)}h ${n % 60}m in).`);
	} else if (t.kind === "seal")
		parts.push(`Once, the first time the ${TREE_NAME[t.tree ?? ""] ?? t.tree} tree is sealed (its seal reaches 100). It plays even if you never committed to that tree.`);
	else if (t.kind === "bond")
		parts.push(`Once, the first time ${ADV_NAME[t.advisor ?? ""] ?? t.advisor}'s bond with the Operator reaches ${t.atLeast}.`);
	else if (t.kind === "tier") parts.push(`Once, when the Operator's Level reaches ${t.atLeast}.`);
	else if (t.kind === "rung") parts.push(`Once, when the ${TREE_NAME[t.tree ?? ""] ?? t.tree} tree reaches rung ${t.rung} of 4.`);
	else if (t.kind === "objection")
		parts.push(
			`Once per facility: when you place a facility that scars the ${TREE_NAME[t.path ?? ""] ?? t.path} tree enough, provided that tree is not sealed yet. The {item} in the text is the name of the facility just placed.`,
		);
	if (s.minTier && s.minTier > 1) parts.push(`Needs Level ${s.minTier} or higher.`);
	if (s.minDay) parts.push(`Not before game day ${s.minDay}.`);
	parts.push("Story scenes are issued in file order, one at a time.");
	return parts.join(" ");
}

function storyScene(s: Scene): void {
	h(3, `\`${s.id}\``);
	meta(`Speaker: ${ADV_NAME[s.advisor] ?? s.advisor}. Recommended choice: \`${s.recommended}\`.`);
	meta(`When: ${whenInWords(s)}`);
	if (s.backdrop) meta(`Backdrop: ${s.backdrop} floor.`);
	text(`${s.id}.title`, "Title", s.title);
	text(`${s.id}.location`, "Location", s.location);
	text(`${s.id}.caption`, "Caption", s.body);
	out.push("", "Dialogue before the choice:", "");
	for (const [i, l] of (s.lines ?? []).entries()) text(`${s.id}.l${i + 1}`, l.who, l.text, l.mood);
	for (const c of s.choices) {
		out.push("", `Choice \`${c.id}\`${c.id === s.recommended ? " (recommended)" : ""}:`, "");
		text(`${s.id}.${c.id}.label`, "Label", c.label);
		text(`${s.id}.${c.id}.hint`, "Hint", c.hint);
		text(`${s.id}.${c.id}.outcome`, "Outcome", c.outcome);
		if (c.effects?.length)
			meta(
				`Effects: ${c.effects
					.map((e) => (e.type === "bond" ? `${ADV_NAME[String(e.advisor)] ?? e.advisor} bond ${Number(e.amount) > 0 ? "+" : ""}${e.amount}` : effectText(e)))
					.join("; ")}.`,
			);
		for (const [i, r] of (c.reply ?? []).entries()) text(`${s.id}.${c.id}.r${i + 1}`, r.who, r.text, r.mood);
	}
}

function eventDef(e: EventDef): void {
	h(3, `\`${e.id}\``);
	const when =
		e.scriptedDay !== undefined ? `Scripted: issued on game day ${e.scriptedDay}.` : `Random: drawn from the pool with weight ${e.weight} when eligible.`;
	const gates = [
		e.minTier > 1 ? `Level ${e.minTier}+` : "",
		e.minDay !== undefined ? `from day ${e.minDay}` : "",
		e.maxTier !== undefined ? `up to Level ${e.maxTier}` : "",
		e.minCorruption !== undefined ? `corruption ${e.minCorruption}+` : "",
		e.path ? `path ${e.path}` : "",
	].filter(Boolean);
	meta(`Category: ${e.category}. ${when}${gates.length ? ` Gates: ${gates.join(", ")}.` : ""}`);
	meta(`Recommended choice: \`${e.recommended}\`.`);
	text(`${e.id}.title`, "Title", e.title);
	text(`${e.id}.body`, e.advisor, e.body);
	if (e.votes?.length) {
		meta(
			`MAGI votes on the recommended choice: ${e.votes.map((v) => `${ADV_NAME[v.advisor] ?? v.advisor} ${v.approve ? "for" : "against"}`).join(", ")}. Each vote line is spoken by that advisor.`,
		);
		for (const v of e.votes) text(`${e.id}.vote.${v.advisor}`, v.advisor, v.line);
	}
	for (const c of e.choices) {
		out.push("", `Choice \`${c.id}\`${c.id === e.recommended ? " (recommended)" : ""}:`, "");
		text(`${e.id}.${c.id}.label`, "Label", c.label);
		text(`${e.id}.${c.id}.hint`, "Hint", c.hint);
		text(`${e.id}.${c.id}.outcome`, "Outcome", c.outcome);
		if (c.effects?.length) meta(`Effects: ${c.effects.map(effectText).join("; ")}.`);
	}
}

function lessonBlock(l: Lesson): void {
	h(3, `Lesson ${l.number}: ${l.title} (\`${l.id}\`)`);
	meta(`Speaker: ${ADV_NAME[l.advisor] ?? l.advisor}. Scenario \`${l.scenario}\`. Every line in the steps is spoken by the lesson's advisor.`);
	text(`${l.id}.title`, "Title", l.title);
	text(`${l.id}.concept`, "Concept", l.concept);
	text(`${l.id}.goal`, "Goal", l.goal);
	text(`${l.id}.learned`, "Learned", l.learned);
	text(`${l.id}.outro`, l.advisor, l.outro);
	text(`${l.id}.next`, "Next lesson", l.next);
	for (const s of l.steps) {
		h(4, `Step \`${s.id}\``);
		meta(`Done when: ${s.when.length ? JSON.stringify(s.when) : "immediately"}.`);
		if (s.afterBeat) meta(`Runs scripted beat \`${s.afterBeat}\` after the lines.`);
		text(`${l.id}.${s.id}.objective`, "Objective", s.text);
		for (const [i, t] of (s.say ?? []).entries()) text(`${l.id}.${s.id}.say${i + 1}`, l.advisor, t);
		for (const [i, t] of (s.after ?? []).entries()) text(`${l.id}.${s.id}.after${i + 1}`, l.advisor, t);
	}
}

// ─── Assemble ───────────────────────────────────────────────────────────

const HOW_TO_EDIT = `## How to edit

- Change only the text after \`TAG:\` on a \`- [id] TAG: text\` line, and the text after a field label such as \`Hint:\`. Those are the only places you type.
- Keep every \`{item}\`, \`{{term}}\` and \`{{term|label}}\` marker exactly as written. \`{item}\` becomes the facility name in the game. \`{{kw|kW}}\` is a glossary link: keep the term id before the \`|\`.
- Never change, delete or retype the ids in square brackets, and leave \`mood=\` alone. They are how the import finds each line.
- Do not change the \`TAG\` (speaker or field label). Do not add or remove lines. Keep each line on one line; a paragraph that has several \`.p1\`, \`.p2\` lines stays split that way.
- Lines starting with \`>\`, headings and "Choice" labels are context for you. They are not imported, so edits there are lost.
- Every line must keep some text. An empty value is skipped by the import.
- If you regenerate this file, your edits are overwritten. Keep a copy first.`;

interface Section {
	title: string;
	body: () => void;
}
const sections: Section[] = [];

sections.push({
	title: "Title crawl",
	body: () => {
		meta("Shown before a new game. One card per line; each fades in after the last. Source: packages/ui/src/title/crawl.ts.");
		for (const [i, l] of CRAWL_LINES.entries()) text(`crawl.${i + 1}`, "narrator", l);
	},
});

sections.push({
	title: "Advisors",
	body: () => {
		meta(
			"Name, first name and role show on the cards and in the Ask panel. The motto is the one dry line under the name. packages/ui/src/advisors has no separate greeting text; the motto is the only fixed advisor line there.",
		);
		for (const id of ADVISOR_ORDER) {
			const a = ADVISORS[id];
			h(3, `${a.first} (\`${id}\`)`);
			text(`adv.${id}.name`, "Name", a.name);
			text(`adv.${id}.first`, "First name", a.first);
			text(`adv.${id}.role`, "Role", a.role);
			text(`adv.${id}.areas`, "Areas", a.areas);
			text(`adv.${id}.motto`, "Motto", a.motto);
		}
	},
});

const storyGroups: { title: string; ids: string[] }[] = [
	{ title: "Story: the opening (Luci)", ids: ["st_intro"] },
	{ title: "Story: Synthetic tree, Luci's Lattice", ids: ["rung_syn_1", "rung_syn_2", "rung_syn_3", "rung_syn_4"] },
	{ title: "Story: Biotech tree, Mel's Flesh", ids: ["obj_biotech", "rung_bio_1", "rung_bio_2", "rung_bio_3", "rung_bio_4"] },
	{ title: "Story: Greentech tree, Bea's Garden", ids: ["obj_greentech", "rung_green_1", "rung_green_2", "rung_green_3", "rung_green_4"] },
	{ title: "Story: a tree closes (seal scenes)", ids: ["seal_biotech", "seal_greentech", "tip_seal"] },
	{ title: "Story: the bond tip", ids: ["tip_bond"] },
	{ title: "Story: bond 50 beats", ids: ["bond50_luci", "bond50_mel", "bond50_bea", "bond50_cass"] },
	{ title: "Story: Cass, in her own scene", ids: ["cass_night_shift"] },
];
const storyById = new Map(story.map((s) => [s.id, s]));
const grouped = new Set(storyGroups.flatMap((g) => g.ids));
const ungrouped = story.filter((s) => !grouped.has(s.id)).map((s) => s.id);
if (ungrouped.length) throw new Error(`story scenes not grouped: ${ungrouped.join(", ")}`);

for (const g of storyGroups) {
	sections.push({
		title: g.title,
		body: () => {
			for (const id of g.ids) {
				const s = storyById.get(id);
				if (!s) throw new Error(`missing story scene ${id}`);
				storyScene(s);
			}
		},
	});
}

sections.push({
	title: "Endings",
	body: () => {
		meta("Shown when the tower reaches an ending. Each ending (the three Singularity wins, Absorbed and Bankrupt) has one short epilogue per advisor, written as narration, and one fallback epilogue for when no advisor's bond is high enough.");
		for (const e of endings) {
			h(3, `\`${e.id}\``);
			if (e.art) meta(`Art: ${e.art}.webp${e.backdrop ? ` (placeholder backdrop: ${e.backdrop})` : " (plain stage until it exists)"}.`);
			text(`end.${e.id}.title`, "Title", e.title);
			text(`end.${e.id}.body`, "narrator", e.body);
			if (!e.epilogue) {
				meta("No epilogues.");
				continue;
			}
			for (const adv of ADVISOR_ORDER) {
				const t = e.epilogue[adv];
				if (t) text(`end.${e.id}.epilogue.${adv}`, "narrator", t);
			}
			if (e.epilogue.fallback) {
				meta("Shown instead of an advisor epilogue when nobody's bond reaches the epilogue bar (50).");
				text(`end.${e.id}.epilogue.fallback`, "narrator", e.epilogue.fallback);
			}
		}
	},
});

for (const adv of ADVISOR_ORDER) {
	const mine = events.filter((e) => e.advisor === adv);
	sections.push({
		title: `Decision memos: ${ADVISORS[adv].first}`,
		body: () => {
			meta(
				`Decision memos ${ADVISORS[adv].first} speaks, from packages/content/src/data/events.json. ${mine.length} memo${mine.length === 1 ? "" : "s"}.`,
			);
			for (const e of mine) eventDef(e);
		},
	});
}

sections.push({
	title: "Lessons",
	body: () => {
		meta(
			'Lesson scripts from lessons.json. Only Lesson 1 exists in that file. Its "Next lesson" names a lesson that is not in the file (see docs/AUDIT_LEFTOVERS.md).',
		);
		for (const l of lessons) lessonBlock(l);
	},
});

// ─── Achievements and the off-duty gallery ─────────────────────────────
// One set of builders, used twice: as one section of DIALOGUE.md, and as the top-level sections of the short owner file
// docs/ACHIEVEMENTS_TEXT.md (`--achievements`). Every `>` line says where the text shows and when.

const ACH_WHEN: Record<string, string> = {
	end_lattice: "Earned at game over, when the run ends on the Lattice (Synthetic Singularity).",
	end_flesh: "Earned at game over, when the run ends on the Flesh.",
	end_garden: "Earned at game over, when the run ends on the Garden.",
	end_absorbed: "Earned at game over, when the inspectors absorb the tower. Hidden in the list until earned.",
	end_bankrupt: "Earned at game over, when the money runs out for a full day. Hidden in the list until earned.",
	lvl_five: "Earned the moment the Operator reaches Level 5.",
	rung_top: "Earned when any tree has a top-rung (rung 4) rack.",
	fast_win: "Earned at game over on a win that is quick enough (Lattice by day 25, Flesh by day 40, Garden by day 38).",
	clean_hands: "Earned at game over on a Flesh or Garden win with that tree's secret meter under 30 of 100.",
	open_hands: "Earned at game over on a Lattice win with neither other tree closed.",
	cash_deep: "Earned at day end with $10M in the bank.",
	books_clean: "Earned at game over on a win with no loan and at least the starting cash.",
	perfect_qtr: "Earned when a quarterly audit is filed with grade A and uptime of 99% or better.",
	calm_month: "Earned at day close when the 99%-uptime streak reaches 20 days.",
	bond_close: "Earned the moment any advisor's trust reaches 50.",
	bond_crew: "Earned when all four advisors have reached 40 trust in one run.",
	les_done: "Earned when every lesson is finished.",
	heard_out: "Earned when the ending epilogues of all four advisors have been seen, across any runs.",
};

const UI_CONTEXT: Record<string, string> = {
	menuLabel: "Name of the Achievements entry in the pause menu's side list.",
	menuTitle: "Heading of the Achievements screen (pause menu and title screen).",
	titleItem: "Title screen menu item, next to Lessons.",
	titleDetail: "Small detail under the title menu item. It follows the counter: `11 / 18 earned · off-duty gallery`.",
	tabList: "First tab on the Achievements screen (the list of 18).",
	tabOffDuty: "Second tab on the Achievements screen (the portrait gallery).",
	ariaPages: "Screen-reader label for the two tabs. Not visible.",
	ariaList: "Screen-reader label for the list of achievements. Not visible.",
	earnedMark: "Tooltip on the check mark beside an earned achievement.",
	day: "Beside an earned achievement: `Day 28 · The Lattice`. This is the word before the day number.",
	endingSingularity: "Beside an earned achievement, after the day: the ending the run finished on.",
	endingFlesh: "Beside an earned achievement, after the day: the ending the run finished on.",
	endingGarden: "Beside an earned achievement, after the day: the ending the run finished on.",
	endingAbsorbed: "Beside an earned achievement, after the day: the ending the run finished on.",
	endingBankrupt: "Beside an earned achievement, after the day: the ending the run finished on.",
	hiddenName: "The name shown for a hidden achievement (the two failure endings) until it is earned. Also the label on each locked after-hours frame.",
	hiddenText: "The text shown for a hidden achievement until it is earned.",
	subOffDuty: "Heading above the four off-duty frames, on the OFF DUTY tab.",
	subAfterHours: "Heading above the four after-hours frames, on the OFF DUTY tab.",
	altOffDuty: "Screen-reader description of an unlocked portrait: `Mel, off duty`. Not visible.",
	altLocked: "Screen-reader description of a locked frame: `Mel, locked`. Not visible.",
	note: "Small note at the foot of the Achievements screen.",
	stripAchievement: "Small tag on the unlock strip when an achievement is earned.",
	stripOffDuty: "Small tag on the unlock strip for a new portrait or the after-hours set.",
	stripPortrait: "Unlock strip for a casual portrait: `Mel has a new portrait`. The advisor's name comes first. Waits for the pause menu or the ending screen if it fires mid-run.",
	stripBed: "Unlock strip, the moment the 18th achievement is earned. Waits for the pause menu or the ending screen.",
	stripBedText: "Second line of the after-hours strip.",
	endNew: "Ending screen, one line under the ending when the run earned something. Followed by the achievement names: `New: Clean Hands`.",
	endOffDuty: "Ending screen, one line when the run unlocked a portrait. Followed by the portraits: `Off duty: Mel's portrait`.",
	endPortrait: "Ending screen: added after an advisor's name in the `Off duty:` line (`Mel` + this).",
	endBed: "Ending screen: in the `Off duty:` line, when the 18th achievement unlocked the after-hours set.",
	endBankruptNote: "Bankrupt ending screen, under the record, the first time \"Notice of Termination\" unlocks. One or two short lines (spec id `end_bankrupt_note`). PLACEHOLDER: write your own.",
	creditsTitle: "Credits screen: heading, and the name of its entry in the menu.",
	creditsMenuLabel: "Title screen: the Credits entry.",
	creditsDetail: "Title screen: small text beside the Credits entry.",
	creditsCode: "Credits screen: line.",
	creditsArt: "Credits screen: line.",
	creditsInspired: "Credits screen: line.",
	creditsFonts: "Credits screen: line.",
	creditsQuotes: "Credits screen: line above the list of quotes. The list itself is built from the game's quotes (docs/QUOTES.md), not edited here.",
	creditsQuotesHead: "Credits screen: heading of the quote list.",
};

const UI_GROUPS: { title: string; note: string; keys: string[] }[] = [
	{ title: "List screen: headings and labels", note: "The Achievements screen, LIST tab and its frame. Shown whenever the screen is open (title screen or pause menu).", keys: ["menuLabel", "menuTitle", "titleItem", "titleDetail", "tabList", "tabOffDuty", "ariaPages", "ariaList", "earnedMark", "day", "endingSingularity", "endingFlesh", "endingGarden", "endingAbsorbed", "endingBankrupt", "note"] },
	{ title: "The hidden achievements", note: "Until the two failure-ending achievements are earned, the list shows this instead of their name and text.", keys: ["hiddenName", "hiddenText"] },
	{ title: "Gallery: headings", note: "The OFF DUTY tab.", keys: ["subOffDuty", "subAfterHours", "altOffDuty", "altLocked"] },
	{ title: "Unlock strips", note: "A small strip at the top of the screen when something unlocks (4 seconds, the game keeps running).", keys: ["stripAchievement", "stripOffDuty", "stripPortrait", "stripBed", "stripBedText"] },
	{ title: "Ending screen: new achievements and portraits", note: "Shown under the ending text on the ending screen and the game-over sheet, only if the run earned something.", keys: ["endNew", "endOffDuty", "endPortrait", "endBed", "endBankruptNote"] },
	{ title: "Credits screen", note: "Title menu, Credits. Every quote in the game is listed below these lines with its author and source.", keys: ["creditsTitle", "creditsMenuLabel", "creditsDetail", "creditsCode", "creditsArt", "creditsInspired", "creditsFonts", "creditsQuotes", "creditsQuotesHead"] },
];

const OFF_WHEN: Record<string, string> = {
	luci: "Unlocks at game over (ending screen, after her epilogue) on a Lattice win with no loan and her trust at 50 or more.",
	mel: "Unlocks at game over on a Flesh win, staying mostly yourself (corruption under 0.5), with her trust at 40 or more.",
	bea: "Unlocks at game over on a Garden win with the green seal under 50 and her trust at 50 or more.",
	cass: "Unlocks at day close, the day the 99%-uptime streak reaches 20, mid-run.",
};

function achList(): void {
	meta("One row per achievement on the LIST tab: the name in bold, the plain text under it. Greyed while locked. Strip texts that reuse these are listed in the unlock strips section.");
	for (const a of ach.achievements) {
		h(3, `\`${a.id}\``);
		meta(`Shows: LIST tab row, and the unlock strip when earned. ${ACH_WHEN[a.id] ?? ""}`.trim());
		text(`ach.${a.id}.name`, "Name", a.name);
		text(`ach.${a.id}.text`, "Text", a.text);
	}
}

function uiGroup(g: { title: string; note: string; keys: string[] }): void {
	meta(g.note);
	for (const k of g.keys) {
		const v = ach.ui?.[k];
		if (v === undefined) throw new Error(`achievements.json ui.${k} is missing`);
		meta(UI_CONTEXT[k] ?? "");
		text(`ach.ui.${k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)}`, "Label", v);
	}
}

function offDutyFrames(): void {
	meta("The four casual portraits on the OFF DUTY tab. Locked: the advisor's dimmed bust with her hint line. Once her trust has reached 30 the plain rule shows too, so the player can aim. Unlocked: the portrait with her caption. The caption is not a separate line: it is the last spoken line of her unlock scene (see the gallery scenes section).");
	for (const [adv, o] of Object.entries(ach.offDuty)) {
		h(3, `${ADV_NAME[adv] ?? adv} (\`${adv}\`)`);
		meta(OFF_WHEN[adv] ?? "");
		text(`ach.offduty.${adv}.name`, "Name", o.name);
		meta("Locked frame: her hint line, under her name.");
		text(`ach.offduty.${adv}.hint`, "Hint", o.hint);
		meta("Locked frame: the plain rule, shown once her trust has reached 30.");
		text(`ach.offduty.${adv}.rule`, "Rule", o.rule);
	}
}

const SCENE_WHEN: Record<string, string> = {
	unlock: "Plays when the player clicks her unlocked casual frame. The LAST SPOKEN LINE is also her portrait's caption (under the frame). Edit it here.",
	bed: "Plays when the player clicks her after-hours frame (the set opens when all 18 achievements are earned).",
	hint: "Plays when the player clicks her locked casual frame.",
	bed_intro: "Plays once, the first time the OFF DUTY tab is opened after the 18th achievement.",
	empty: "Plays once, the first time the OFF DUTY tab is opened while nothing is unlocked.",
};

function galleryScene(s: { id: string; title: string; location: string; lines: Reply[] }): void {
	h(3, `\`${s.id}\``);
	const kind = s.id.startsWith("ach_unlock_") ? "unlock" : s.id.startsWith("ach_bed_intro") ? "bed_intro" : s.id.startsWith("ach_bed_") ? "bed" : s.id.startsWith("ach_hint_") ? "hint" : "empty";
	meta(`Gallery scene, fired by the UI. ${SCENE_WHEN[kind]}`);
	text(`${s.id}.title`, "Title", s.title);
	text(`${s.id}.location`, "Location", s.location);
	let lastSpoken = -1;
	s.lines.forEach((l, i) => {
		if (l.who !== "narrator") lastSpoken = i;
	});
	for (const [i, l] of s.lines.entries()) {
		if (kind === "unlock" && i === lastSpoken) meta("This is the portrait's caption.");
		text(`${s.id}.l${i + 1}`, l.who, l.text, l.mood);
	}
}

const sceneGroups: { title: string; note: string; pick: (id: string) => boolean }[] = [
	{ title: "Gallery scenes: casual portrait unlocks", note: "One short scene per advisor. The last spoken line of each is her portrait caption.", pick: (id) => id.startsWith("ach_unlock_") },
	{ title: "Gallery scenes: the after-hours set", note: "The set that opens at 18 of 18: the intro, then one scene per advisor.", pick: (id) => id.startsWith("ach_bed_") },
	{ title: "Gallery scenes: locked frames and the empty gallery", note: "What a click on a locked frame, or an empty gallery, plays.", pick: (id) => id.startsWith("ach_hint_") || id === "ach_gallery_empty" },
];

const CODE_TEXT = [
	'"RECORD": the small form stamp on the Achievements screen (packages/ui/src/menu/SystemMenu.tsx).',
	'"{n} / 18": the counter (packages/ui/src/achievements/gallery.ts). The numbers are computed.',
	'" · ": the separator between the day and the ending in a list row, and the `, ` between names on the ending screen lines (gallery.ts).',
	'"???": also drawn as the label on a locked after-hours frame, from the same `hiddenName` line above.',
	'"▼" and "■": the page markers in the gallery dialogue box (packages/ui/src/achievements/GalleryScene.tsx).',
	"Advisor names (Luci, Mel, Bea, Cass) in the unlock strips and ending lines come from the `Name` lines in the off-duty frames section.",
];

function achievementsDialogueSection(): void {
	meta("The achievements list, the off-duty portraits and gallery scenes, and the words around them. All are fired by the UI, not by the sim. Source: packages/content/src/data/achievements.json. For a short file with only these, run `npx tsx tools/dialogue/export.ts --achievements`.");
	h(3, "The 18 achievements");
	achList();
	for (const g of UI_GROUPS) {
		h(3, g.title);
		uiGroup(g);
	}
	h(3, "Off-duty frames");
	offDutyFrames();
	for (const s of ach.scenes) galleryScene(s);
}

sections.push({ title: "Achievements and the off-duty gallery", body: achievementsDialogueSection });

/** The sections of the short owner file docs/ACHIEVEMENTS_TEXT.md. */
const achSections: Section[] = [
	{ title: "The 18 achievements", body: achList },
	...UI_GROUPS.filter((g) => g.title.startsWith("List") || g.title.startsWith("The hidden")).map((g) => ({ title: g.title, body: () => uiGroup(g) })),
	{ title: "Off-duty frames: hints and rules", body: offDutyFrames },
	...UI_GROUPS.filter((g) => g.title.startsWith("Gallery: headings")).map((g) => ({ title: g.title, body: () => uiGroup(g) })),
	...sceneGroups.map((g) => ({
		title: g.title,
		body: () => {
			meta(g.note);
			for (const s of ach.scenes.filter((x) => g.pick(x.id))) galleryScene(s);
		},
	})),
	...UI_GROUPS.filter((g) => g.title.startsWith("Unlock strips") || g.title.startsWith("Ending screen") || g.title.startsWith("Credits")).map((g) => ({ title: g.title, body: () => uiGroup(g) })),
	{
		title: "Code text (change by hand)",
		body: () => {
			meta("These few strings are in the code, not in the data, so this file cannot change them. Tell Claude if one should change. They are not editable lines.");
			for (const c of CODE_TEXT) meta(c);
		},
	},
];

// Sections build in order; the table of contents links to their headings.
const slug = (s: string): string =>
	s
		.toLowerCase()
		.replace(/[^a-z0-9 -]/g, "")
		.trim()
		.replace(/ /g, "-");
function assemble(secs: Section[]): { toc: string[]; body: string[] } {
	const toc: string[] = [];
	const body: string[] = [];
	secs.forEach((sec, i) => {
		const heading = `${i + 1}. ${sec.title}`;
		toc.push(`${i + 1}. [${sec.title}](#${slug(heading)})`);
		out = [];
		sec.body();
		body.push("", `## ${heading}`, "", ...out);
	});
	return { toc, body };
}

const main = assemble(sections);

const doc = [
	"# AI Tower: player-facing dialogue",
	"",
	"Every line an advisor, the narrator or a story screen shows the player, in game order. Generated by `npx tsx tools/dialogue/export.ts` from packages/content/src/data and packages/ui/src. Verify a file with `npx tsx tools/dialogue/export.ts --check`.",
	"",
	HOW_TO_EDIT,
	"",
	"## Contents",
	"",
	...main.toc,
	...main.body,
	"",
].join("\n");

/** docs/ACHIEVEMENTS_TEXT.md: only the achievements and gallery words, with a `>` line for where each shows and when. */
function achievementsDoc(): string {
	seen.clear();
	const a = assemble(achSections);
	const count = a.body.filter((l) => l.startsWith("- [")).length;
	return [
		"# AI Tower: achievements and gallery text",
		"",
		`Every player-facing word of the achievements list, the off-duty gallery, the unlock strips and the ending-screen lines. ${count} editable lines. Same format as DIALOGUE_NEW.md: edit only the text after the label, leave the \`[ids]\` and labels alone, and your words win. Generated by \`npx tsx tools/dialogue/export.ts --achievements\`; import with \`npx tsx tools/dialogue/import.ts docs/ACHIEVEMENTS_TEXT.md --write\`.`,
		"",
		"The portrait captions are not separate lines: a caption is the last spoken line of that advisor's unlock scene. Change that line and the caption follows.",
		"",
		HOW_TO_EDIT,
		"",
		"## Contents",
		"",
		...a.toc,
		...a.body,
		"",
	].join("\n");
}

// ─── Check: every editable line matches the grammar, ids are unique ─────

const LINE = /^- \[([a-z0-9_.]+)( mood=[a-z]+)?\] ([A-Za-z][A-Za-z ]*): (\S.*)$/;

function check(md: string): void {
	const ids = new Set<string>();
	let n = 0;
	for (const line of md.split("\n")) {
		if (!line.startsWith("- [")) continue;
		const m = LINE.exec(line);
		if (!m) throw new Error(`line does not match the import grammar: ${line.slice(0, 120)}`);
		const id = m[1] ?? "";
		if (ids.has(id)) throw new Error(`duplicate id ${id}`);
		ids.add(id);
		n++;
	}
	console.log(`ok: ${n} editable lines, ${ids.size} unique ids`);
}

if (process.argv.includes("--check")) {
	if (!existsSync(OUT)) throw new Error(`${OUT} does not exist; run without --check first`);
	check(readFileSync(OUT, "utf8"));
	if (existsSync(OUT_ACH)) {
		check(readFileSync(OUT_ACH, "utf8"));
		if (readFileSync(OUT_ACH, "utf8") !== achievementsDoc()) console.log(`note: ${OUT_ACH} differs from the data (edited, or regenerate with --achievements)`);
	}
} else if (process.argv.includes("--achievements")) {
	const d = achievementsDoc();
	writeFileSync(OUT_ACH, d);
	check(d);
	console.log(`wrote ${OUT_ACH}`);
} else {
	writeFileSync(OUT, doc);
	check(doc);
	console.log(`wrote ${OUT}`);
}
