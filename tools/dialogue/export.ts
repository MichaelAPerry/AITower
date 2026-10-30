/**
 * Writes docs/DIALOGUE.md: every piece of player-facing dialogue, grouped for hand rewriting.
 *
 *   npx tsx tools/dialogue/export.ts          regenerate docs/DIALOGUE.md
 *   npx tsx tools/dialogue/export.ts --check  re-read docs/DIALOGUE.md and verify the id grammar (no write)
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

// Sections build in order; the table of contents links to their headings.
const slug = (s: string): string =>
	s
		.toLowerCase()
		.replace(/[^a-z0-9 -]/g, "")
		.trim()
		.replace(/ /g, "-");
const toc: string[] = [];
const body: string[] = [];
sections.forEach((sec, i) => {
	const heading = `${i + 1}. ${sec.title}`;
	toc.push(`${i + 1}. [${sec.title}](#${slug(heading)})`);
	out = [];
	sec.body();
	body.push("", `## ${heading}`, "", ...out);
});

const doc = [
	"# AI Tower: player-facing dialogue",
	"",
	"Every line an advisor, the narrator or a story screen shows the player, in game order. Generated by `npx tsx tools/dialogue/export.ts` from packages/content/src/data and packages/ui/src. Verify a file with `npx tsx tools/dialogue/export.ts --check`.",
	"",
	HOW_TO_EDIT,
	"",
	"## Contents",
	"",
	...toc,
	...body,
	"",
].join("\n");

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
} else {
	writeFileSync(OUT, doc);
	check(doc);
	console.log(`wrote ${OUT}`);
}
