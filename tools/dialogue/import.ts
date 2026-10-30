/**
 * Reads a hand-edited DIALOGUE.md back into the game data. The inverse of tools/dialogue/export.ts.
 *
 *   npx tsx tools/dialogue/import.ts docs/DIALOGUE.md             dry run (default): report only, nothing written
 *   npx tsx tools/dialogue/import.ts --write docs/DIALOGUE.md     write the changed text into the data
 *   add --truncate-paragraphs: a body whose file has only p1..pk (k < n) is cut to those k paragraphs
 *   npx tsx tools/dialogue/import.ts --dry-run <file> --root <dir>  (--root: repo root, for tests)
 *
 * Only TEXT is imported. Ids, speaker/field TAGs and mood= are read for checking only (a change is a warning).
 * Targets: packages/ui/src/title/crawl.ts, packages/ui/src/advisors/advisors.ts (TS string literals, rewritten in
 * place) and story/endings/events/lessons.json in packages/content/src/data (string values spliced in place, so
 * indentation, line layout and the trailing newline stay as they were and an unchanged import gives an empty diff).
 * Effects, triggers, `recommended` and every other field are never touched.
 *
 * Exit code is non-zero on any error (malformed line, duplicate id, marker mismatch). With errors nothing is written.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export const FILES = {
	crawl: "packages/ui/src/title/crawl.ts",
	advisors: "packages/ui/src/advisors/advisors.ts",
	story: "packages/content/src/data/story.json",
	endings: "packages/content/src/data/endings.json",
	events: "packages/content/src/data/events.json",
	lessons: "packages/content/src/data/lessons.json",
	achievements: "packages/content/src/data/achievements.json",
} as const;

/** Files a project may lack (older fixtures): read as empty. */
const OPTIONAL_FILES: readonly string[] = [FILES.achievements];
const EMPTY_ACHIEVEMENTS = `{"achievements":[],"offDuty":{},"scenes":[]}`;

/** The grammar from export.ts / HANDOFF. */
export const LINE = /^- \[([a-z0-9_.]+)( mood=[a-z]+)?\] ([A-Za-z][A-Za-z ]*): (\S.*)$/;
/** A line that has the id and tag but no text: reported as empty rather than malformed. */
const EMPTY_LINE = /^- \[([a-z0-9_.]+)( mood=[a-z]+)?\] ([A-Za-z][A-Za-z ]*):\s*$/;

// ─── Slots: one per editable value, built from the current data ─────────────

export interface Slot {
	/** Base id (without .pN). */
	id: string;
	/** Container id used for longest-prefix resolution (scene, event, lesson, end.<id>, adv.<id>, crawl). */
	container: string;
	tag: string;
	mood?: string;
	/** Current value as stored. */
	value: string;
	/** File (repo-relative) and the [start, end) span of the quoted literal in that file's text. */
	file: string;
	start: number;
	end: number;
}

/** Paragraphs exactly as export.ts writes them. */
export function paragraphs(value: string): string[] {
	return value
		.split(/\n\s*\n/)
		.map((p) => p.replace(/\s*\n\s*/g, " ").trim())
		.filter(Boolean);
}

/** The ids export.ts writes for a slot (id, or id.p1 ... id.pN). */
export function lineIds(slot: Pick<Slot, "id" | "value">): string[] {
	const n = paragraphs(slot.value).length;
	return n <= 1 ? [slot.id] : Array.from({ length: n }, (_, i) => `${slot.id}.p${i + 1}`);
}

/** Positions of every string value in a JSON text, keyed by JSON.stringify(path). */
export function indexJsonStrings(raw: string): Map<string, [number, number]> {
	const spans = new Map<string, [number, number]>();
	let i = 0;
	const ws = (): void => {
		while (i < raw.length && /\s/.test(raw[i] as string)) i++;
	};
	const str = (): [number, number] => {
		const start = i;
		i++;
		while (raw[i] !== '"') {
			if (i >= raw.length) throw new Error("unterminated JSON string");
			i += raw[i] === "\\" ? 2 : 1;
		}
		i++;
		return [start, i];
	};
	const value = (path: (string | number)[]): void => {
		ws();
		const c = raw[i];
		if (c === '"') {
			spans.set(JSON.stringify(path), str());
		} else if (c === "{") {
			i++;
			ws();
			if (raw[i] === "}") {
				i++;
				return;
			}
			for (;;) {
				ws();
				const [ks, ke] = str();
				const key = JSON.parse(raw.slice(ks, ke)) as string;
				ws();
				i++; // ':'
				value([...path, key]);
				ws();
				if (raw[i] === ",") {
					i++;
					continue;
				}
				i++; // '}'
				return;
			}
		} else if (c === "[") {
			i++;
			ws();
			if (raw[i] === "]") {
				i++;
				return;
			}
			for (let n = 0; ; n++) {
				value([...path, n]);
				ws();
				if (raw[i] === ",") {
					i++;
					continue;
				}
				i++; // ']'
				return;
			}
		} else {
			while (i < raw.length && !/[\s,\]}]/.test(raw[i] as string)) i++;
		}
	};
	value([]);
	return spans;
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
	reply?: Reply[];
}
interface Scene {
	id: string;
	title: string;
	body: string;
	location?: string;
	lines?: Reply[];
	choices: Choice[];
}
interface EventDef {
	id: string;
	advisor: string;
	title: string;
	body: string;
	votes?: { advisor: string; line: string }[];
	choices: Choice[];
}
interface Ending {
	id: string;
	title: string;
	body: string;
	epilogue?: Record<string, string>;
}
interface LessonStep {
	id: string;
	text: string;
	say?: string[];
	after?: string[];
}
interface Lesson {
	id: string;
	advisor: string;
	title: string;
	concept: string;
	goal: string;
	learned: string;
	outro: string;
	next: string;
	steps: LessonStep[];
}

export interface Project {
	root: string;
	/** Raw text of each file in FILES, keyed by repo-relative path. */
	files: Record<string, string>;
	slots: Slot[];
}

const TS_STRING = '"(?:[^"\\\\]|\\\\.)*"';

function crawlSlots(src: string, add: (s: Slot) => void): void {
	const head = /CRAWL_LINES[^=\n]*=\s*\[/.exec(src);
	if (!head) throw new Error("CRAWL_LINES array not found in crawl.ts");
	const bodyStart = head.index + head[0].length;
	const bodyEnd = src.indexOf("];", bodyStart);
	const re = new RegExp(TS_STRING, "g");
	re.lastIndex = bodyStart;
	let n = 0;
	for (let m = re.exec(src); m && m.index < bodyEnd; m = re.exec(src)) {
		n++;
		add({
			id: `crawl.${n}`,
			container: "crawl",
			tag: "narrator",
			value: JSON.parse(m[0]) as string,
			file: FILES.crawl,
			start: m.index,
			end: m.index + m[0].length,
		});
	}
}

const ADV_FIELDS: [string, string][] = [
	["name", "Name"],
	["first", "First name"],
	["role", "Role"],
	["areas", "Areas"],
	["motto", "Motto"],
];

function advisorSlots(src: string, add: (s: Slot) => void): void {
	const lineRe = /^[ \t]*([a-z]+): \{ id: "([a-z]+)",.*$/gm;
	for (let lm = lineRe.exec(src); lm; lm = lineRe.exec(src)) {
		if (lm[1] !== lm[2]) continue;
		const id = lm[1] as string;
		for (const [field, tag] of ADV_FIELDS) {
			const fm = new RegExp(`\\b${field}: (${TS_STRING})`).exec(lm[0]);
			if (!fm) continue;
			const start = lm.index + fm.index + fm[0].length - (fm[1] as string).length;
			add({
				id: `adv.${id}.${field}`,
				container: `adv.${id}`,
				tag,
				value: JSON.parse(fm[1] as string) as string,
				file: FILES.advisors,
				start,
				end: start + (fm[1] as string).length,
			});
		}
	}
}

/** Reads the six target files under `root` and lists every editable value in them, in export order. */
export function loadProject(root: string = DEFAULT_ROOT): Project {
	const files: Record<string, string> = {};
	for (const f of Object.values(FILES)) files[f] = OPTIONAL_FILES.includes(f) && !existsSync(resolve(root, f)) ? EMPTY_ACHIEVEMENTS : readFileSync(resolve(root, f), "utf8");
	const slots: Slot[] = [];
	const add = (s: Slot): void => {
		slots.push(s);
	};

	crawlSlots(files[FILES.crawl] as string, add);
	advisorSlots(files[FILES.advisors] as string, add);

	/** Adds a slot for the string at `path` in a JSON file (skipped when empty, as export skips it). */
	const json = (file: string) => {
		const spans = indexJsonStrings(files[file] as string);
		return (container: string, id: string, tag: string, path: (string | number)[], value: string | undefined, mood?: string): void => {
			if (value === undefined || value.trim() === "") return;
			const span = spans.get(JSON.stringify(path));
			if (!span) throw new Error(`${file}: no string at ${JSON.stringify(path)} for ${id}`);
			add({ id, container, tag, mood, value, file, start: span[0], end: span[1] });
		};
	};

	const story = JSON.parse(files[FILES.story] as string) as Scene[];
	{
		const put = json(FILES.story);
		story.forEach((s, si) => {
			put(s.id, `${s.id}.title`, "Title", [si, "title"], s.title);
			put(s.id, `${s.id}.location`, "Location", [si, "location"], s.location);
			put(s.id, `${s.id}.caption`, "Caption", [si, "body"], s.body);
			(s.lines ?? []).forEach((l, i) => {
				put(s.id, `${s.id}.l${i + 1}`, l.who, [si, "lines", i, "text"], l.text, l.mood);
			});
			s.choices.forEach((c, ci) => {
				put(s.id, `${s.id}.${c.id}.label`, "Label", [si, "choices", ci, "label"], c.label);
				put(s.id, `${s.id}.${c.id}.hint`, "Hint", [si, "choices", ci, "hint"], c.hint);
				put(s.id, `${s.id}.${c.id}.outcome`, "Outcome", [si, "choices", ci, "outcome"], c.outcome);
				(c.reply ?? []).forEach((r, i) => {
					put(s.id, `${s.id}.${c.id}.r${i + 1}`, r.who, [si, "choices", ci, "reply", i, "text"], r.text, r.mood);
				});
			});
		});
	}

	const endings = JSON.parse(files[FILES.endings] as string) as Ending[];
	{
		const put = json(FILES.endings);
		endings.forEach((e, ei) => {
			const c = `end.${e.id}`;
			put(c, `${c}.title`, "Title", [ei, "title"], e.title);
			put(c, `${c}.body`, "narrator", [ei, "body"], e.body);
			for (const [adv, t] of Object.entries(e.epilogue ?? {})) put(c, `${c}.epilogue.${adv}`, "narrator", [ei, "epilogue", adv], t);
		});
	}

	const events = JSON.parse(files[FILES.events] as string) as EventDef[];
	{
		const put = json(FILES.events);
		events.forEach((e, ei) => {
			put(e.id, `${e.id}.title`, "Title", [ei, "title"], e.title);
			put(e.id, `${e.id}.body`, e.advisor, [ei, "body"], e.body);
			(e.votes ?? []).forEach((v, vi) => {
				put(e.id, `${e.id}.vote.${v.advisor}`, v.advisor, [ei, "votes", vi, "line"], v.line);
			});
			e.choices.forEach((c, ci) => {
				put(e.id, `${e.id}.${c.id}.label`, "Label", [ei, "choices", ci, "label"], c.label);
				put(e.id, `${e.id}.${c.id}.hint`, "Hint", [ei, "choices", ci, "hint"], c.hint);
				put(e.id, `${e.id}.${c.id}.outcome`, "Outcome", [ei, "choices", ci, "outcome"], c.outcome);
			});
		});
	}

	const lessons = (JSON.parse(files[FILES.lessons] as string) as { lessons: Lesson[] }).lessons;
	{
		const put = json(FILES.lessons);
		lessons.forEach((l, li) => {
			const p = ["lessons", li];
			put(l.id, `${l.id}.title`, "Title", [...p, "title"], l.title);
			put(l.id, `${l.id}.concept`, "Concept", [...p, "concept"], l.concept);
			put(l.id, `${l.id}.goal`, "Goal", [...p, "goal"], l.goal);
			put(l.id, `${l.id}.learned`, "Learned", [...p, "learned"], l.learned);
			put(l.id, `${l.id}.outro`, l.advisor, [...p, "outro"], l.outro);
			put(l.id, `${l.id}.next`, "Next lesson", [...p, "next"], l.next);
			l.steps.forEach((s, si) => {
				put(l.id, `${l.id}.${s.id}.objective`, "Objective", [...p, "steps", si, "text"], s.text);
				(s.say ?? []).forEach((t, i) => {
					put(l.id, `${l.id}.${s.id}.say${i + 1}`, l.advisor, [...p, "steps", si, "say", i], t);
				});
				(s.after ?? []).forEach((t, i) => {
					put(l.id, `${l.id}.${s.id}.after${i + 1}`, l.advisor, [...p, "steps", si, "after", i], t);
				});
			});
		});
	}

	const ach = JSON.parse(files[FILES.achievements] as string) as {
		achievements: { id: string; name: string; text: string }[];
		offDuty: Record<string, { name: string; hint: string; rule: string }>;
		ui?: Record<string, string>;
		scenes: { id: string; title: string; location: string; lines: Reply[] }[];
	};
	{
		const put = json(FILES.achievements);
		ach.achievements.forEach((a, ai) => {
			put(`ach.${a.id}`, `ach.${a.id}.name`, "Name", ["achievements", ai, "name"], a.name);
			put(`ach.${a.id}`, `ach.${a.id}.text`, "Text", ["achievements", ai, "text"], a.text);
		});
		for (const [adv, o] of Object.entries(ach.offDuty)) {
			const c = `ach.offduty.${adv}`;
			put(c, `${c}.name`, "Name", ["offDuty", adv, "name"], o.name);
			put(c, `${c}.hint`, "Hint", ["offDuty", adv, "hint"], o.hint);
			put(c, `${c}.rule`, "Rule", ["offDuty", adv, "rule"], o.rule);
		}
		for (const [k, v] of Object.entries(ach.ui ?? {})) put("ach.ui", `ach.ui.${k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)}`, "Label", ["ui", k], v);
		ach.scenes.forEach((s, si) => {
			put(s.id, `${s.id}.title`, "Title", ["scenes", si, "title"], s.title);
			put(s.id, `${s.id}.location`, "Location", ["scenes", si, "location"], s.location);
			s.lines.forEach((l, li) => {
				put(s.id, `${s.id}.l${li + 1}`, l.who, ["scenes", si, "lines", li, "text"], l.text, l.mood);
			});
		});
	}

	return { root, files, slots };
}

// ─── Resolution ─────────────────────────────────────────────────────────────

/**
 * Longest-prefix match of an id against known container ids (scene, event, lesson, `end.<id>`, `adv.<id>`, `crawl`).
 * Never splits on dots: `a.b.title` with containers `a` and `a.b` resolves to `a.b`.
 */
export function resolveContainer(id: string, containers: Iterable<string>): { container: string; rest: string } | undefined {
	let best: string | undefined;
	for (const c of containers) {
		if ((id === c || id.startsWith(`${c}.`)) && (best === undefined || c.length > best.length)) best = c;
	}
	return best === undefined ? undefined : { container: best, rest: id.slice(best.length + 1) };
}

// ─── Markers ────────────────────────────────────────────────────────────────

/** `{item}` and `{{term}}` / `{{term|label}}` markers in order. */
export const markers = (s: string): string[] => s.match(/\{item\}|\{\{[^}]*\}\}/g) ?? [];
/** Marker identity: `{item}` or `{{term}}`. The label of `{{term|label}}` is prose and may be reworded. */
const markerKey = (m: string): string => (m.startsWith("{{") ? `{{${m.slice(2, -2).split("|")[0]}}}` : m);
const sortedKeys = (s: string): string[] => markers(s).map(markerKey).sort();

// ─── Import ─────────────────────────────────────────────────────────────────

export interface Report {
	changed: string[];
	unchanged: number;
	missing: string[];
	extra: string[];
	empty: string[];
	warnings: string[];
	errors: string[];
	/** Splices to apply, per file. */
	edits: { file: string; start: number; end: number; text: string }[];
}

interface FileLine {
	n: number;
	id: string;
	mood?: string;
	tag: string;
	text: string;
}

export interface ImportOptions {
	/**
	 * When a multi-paragraph value has only its first k paragraph lines in the file (p1..pk, k < n), the file wins:
	 * the value is cut to those k paragraphs instead of keeping the current text. Without it the slot is kept and
	 * a warning is reported.
	 */
	truncateParagraphs?: boolean;
}

export function importDialogue(project: Project, md: string, opts: ImportOptions = {}): Report {
	const r: Report = { changed: [], unchanged: 0, missing: [], extra: [], empty: [], warnings: [], errors: [], edits: [] };

	// 1. Parse the file.
	const byId = new Map<string, FileLine>();
	md.split(/\r?\n/).forEach((raw, idx) => {
		const n = idx + 1;
		if (!raw.startsWith("- [")) return;
		const m = LINE.exec(raw.trimEnd());
		if (!m) {
			const e = EMPTY_LINE.exec(raw);
			if (e) r.empty.push(e[1] as string);
			else r.errors.push(`line ${n}: does not match the editable-line grammar: ${raw.slice(0, 100)}`);
			return;
		}
		const id = m[1] as string;
		if (byId.has(id)) {
			r.errors.push(`line ${n}: duplicate id ${id} (first on line ${byId.get(id)?.n})`);
			return;
		}
		byId.set(id, { n, id, mood: m[2]?.replace(" mood=", ""), tag: m[3] as string, text: (m[4] as string).trimEnd() });
	});

	// 2. Known ids, from the data.
	const expected = new Map<string, Slot>();
	for (const s of project.slots) for (const lid of lineIds(s)) expected.set(lid, s);
	const containers = new Set(project.slots.map((s) => s.container));
	const slotOfLine = (id: string): Slot | undefined => expected.get(id);

	for (const id of byId.keys()) {
		if (slotOfLine(id)) continue;
		const res = resolveContainer(id, containers);
		r.extra.push(res ? `${id} (in ${res.container}, no field "${res.rest}")` : `${id} (no scene, event, lesson, ending or advisor with this id)`);
	}

	// 3. Per slot.
	const emptySet = new Set(r.empty);
	for (const s of project.slots) {
		const ids = lineIds(s);
		const present = ids.filter((i) => byId.has(i));
		const absent = ids.filter((i) => !byId.has(i));
		if (present.length === 0) {
			for (const i of absent) if (!emptySet.has(i)) r.missing.push(i);
			continue;
		}
		const prefix = present.length < ids.length && present.every((i, k) => i === ids[k]);
		if (absent.length && opts.truncateParagraphs && prefix) {
			// the file wins: handled below with only the present lines
		} else if (absent.length) {
			for (const i of absent) if (!emptySet.has(i)) r.missing.push(i);
			r.warnings.push(`${s.id}: only ${present.length} of ${ids.length} paragraph lines present; kept current text`);
			continue;
		}
		const lines = present.map((i) => byId.get(i) as FileLine);
		if (absent.length) r.warnings.push(`${s.id}: cut from ${ids.length} to ${present.length} paragraphs (--truncate-paragraphs)`);
		for (const l of lines) {
			if (l.tag !== s.tag) r.warnings.push(`line ${l.n} [${l.id}]: TAG changed from "${s.tag}" to "${l.tag}" (ignored)`);
			if ((l.mood ?? "") !== (s.mood ?? "")) r.warnings.push(`line ${l.n} [${l.id}]: mood changed from "${s.mood ?? ""}" to "${l.mood ?? ""}" (ignored)`);
		}
		const next = lines.map((l) => l.text).join("\n\n");
		const current = paragraphs(s.value).join("\n\n");
		if (next === current) {
			r.unchanged++;
			continue;
		}
		const a = sortedKeys(s.value);
		const b = sortedKeys(next);
		if (a.join("\u0000") !== b.join("\u0000")) {
			r.errors.push(`${s.id}: markers differ. current: ${markers(s.value).join(" ") || "(none)"}; file: ${markers(next).join(" ") || "(none)"}`);
			continue;
		}
		if (markers(s.value).join("\u0000") !== markers(next).join("\u0000"))
			r.warnings.push(`${s.id}: marker labels or order changed: ${markers(s.value).join(" ")} -> ${markers(next).join(" ")}`);
		r.changed.push(s.id);
		r.edits.push({ file: s.file, start: s.start, end: s.end, text: JSON.stringify(next) });
	}
	return r;
}

/** Applies a report's edits to the loaded file texts (last edit first, so offsets stay valid). */
export function applyEdits(files: Record<string, string>, edits: Report["edits"]): Record<string, string> {
	const out = { ...files };
	for (const f of Object.keys(out)) {
		let t = out[f] as string;
		for (const e of edits.filter((x) => x.file === f).sort((x, y) => y.start - x.start)) t = t.slice(0, e.start) + e.text + t.slice(e.end);
		if (f.endsWith(".json")) JSON.parse(t); // never write a broken file
		out[f] = t;
	}
	return out;
}

export function formatReport(r: Report, mdPath: string, write: boolean): string {
	const list = (title: string, items: string[]): string[] => [`${title}: ${items.length}`, ...items.map((i) => `  - ${i}`)];
	return [
		`Dialogue import ${write ? "(WRITE)" : "(dry run, nothing written)"} from ${mdPath}`,
		`changed ${r.changed.length}, unchanged ${r.unchanged}, missing ${r.missing.length}, extra ${r.extra.length}, empty ${r.empty.length}, warnings ${r.warnings.length}, errors ${r.errors.length}`,
		"",
		...list("Errors", r.errors),
		...list("Warnings", r.warnings),
		...list("Changed ids", r.changed),
		...list("Missing ids (in data, not in file; current text kept)", r.missing),
		...list("Extra ids (in file, not in data; ignored)", r.extra),
		...list("Empty text (current text kept)", r.empty),
		"",
	].join("\n");
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function main(argv: string[]): number {
	const write = argv.includes("--write");
	const ri = argv.indexOf("--root");
	const root = ri >= 0 ? resolve(argv[ri + 1] ?? "") : DEFAULT_ROOT;
	const positional = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--root");
	const mdPath = positional[0] ? resolve(positional[0]) : resolve(root, "docs/DIALOGUE.md");
	if (write && argv.includes("--dry-run")) {
		console.error("choose one of --write and --dry-run");
		return 2;
	}
	if (!existsSync(mdPath)) {
		console.error(`${mdPath} does not exist`);
		return 2;
	}
	const project = loadProject(root);
	const report = importDialogue(project, readFileSync(mdPath, "utf8"), { truncateParagraphs: argv.includes("--truncate-paragraphs") });
	console.log(formatReport(report, mdPath, write));
	if (report.errors.length) {
		if (write) console.error("errors found: nothing written");
		return 1;
	}
	if (write && report.edits.length) {
		const next = applyEdits(project.files, report.edits);
		for (const [f, text] of Object.entries(next)) if (text !== project.files[f]) writeFileSync(resolve(root, f), text);
		console.log(`wrote ${report.edits.length} changed value${report.edits.length === 1 ? "" : "s"}`);
	}
	return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exit(main(process.argv.slice(2)));
