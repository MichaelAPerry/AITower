import { useEffect, useMemo, useState } from "react";
import type { ContentDB } from "@aitower/content";
import type { PanelProps } from "../components/context";
import { type Entry, buildEntries, lockFor, SECTIONS, type Section, searchEntries, sectionOf } from "../encyclopedia/entries";
import { PanelHead, SplitPane } from "../panel/PanelShell";
import { type Chapter, buildChapters, isUnlocked, lockText, primerTarget, type TryId } from "./chapters";
import { Diagram } from "./diagrams";
import { loadProgress, markRead, onProgress, type PrimerProgress, update } from "./progress";
import "../encyclopedia/encyclopedia.css";
import "./primer.css";

const REF_TABS = SECTIONS.filter((s) => s.id !== "basics");

/** Primer chapters, memoised per content. */
export const useChapters = (content: ContentDB): Chapter[] => useMemo(() => buildChapters(content), [content]);

/** Live reading progress (shared with the unread dot and the prompt). */
export function useProgress(): PrimerProgress {
	const [p, setP] = useState(loadProgress);
	useEffect(() => onProgress(setP), []);
	return p;
}

/** What each "Try it" does in the game. */
export function runTry(id: TryId, p: Pick<PanelProps, "store" | "setUi" | "openResearch">): void {
	const { setUi } = p;
	if (id === "catalog") setUi({ paletteOpen: true, paletteTab: "rack", drawer: null, buildHover: null });
	else if (id === "power" || id === "heat") {
		p.store.setOverlay(id);
		setUi({ drawer: null });
	} else if (id === "parts") setUi({ paletteOpen: true, paletteTab: "supplies", drawer: null, buildHover: null });
	else if (id === "insights") setUi({ drawer: "insights", insightsTab: "overview", paletteOpen: false });
	else if (id === "contracts") setUi({ drawer: "contracts", paletteOpen: false });
	else p.openResearch();
}

/** The Datacenter Primer (K): chapters to read, then the reference lists (facilities, bots, research, words). */
export function PrimerDrawer(props: PanelProps) {
	const { content, state, ui, setUi } = props;
	const view = state.view;
	const chapters = useChapters(content);
	const entries = useMemo(() => buildEntries(content), [content]);
	const progress = useProgress();
	const [query, setQuery] = useState("");
	const [sel, setSel] = useState("ch:what");
	const [tab, setTab] = useState<Section | null>(null);

	useEffect(() => {
		update({ opened: true });
	}, []);
	// A "?" / "More..." / "Open in Research" link asked for a page.
	const wanted = ui.encyId ?? null;
	// biome-ignore lint/correctness/useExhaustiveDependencies: react to a new request only
	useEffect(() => {
		if (!wanted) return;
		const id = primerTarget(wanted);
		setQuery("");
		setSel(id);
		const s = sectionOf(id);
		setTab(s && s !== "basics" ? s : null);
		setUi({ encyId: null });
	}, [wanted]);

	const q = query.trim();
	const words = q.toLowerCase().split(/\s+/).filter(Boolean);
	const hitChapters = q ? chapters.filter((c) => words.every((w) => (isUnlocked(c.unlock, view) ? c.keywords : c.title.toLowerCase()).includes(w))) : [];
	const hitEntries = q ? searchEntries(entries, q).slice(0, 40) : [];
	// While searching, the pane shows the top hit unless the reader picked one of the results.
	const shown = q && ![...hitChapters, ...hitEntries].some((x) => x.id === sel) ? (hitChapters[0] ?? hitEntries[0])?.id ?? sel : sel;
	const chapter = chapters.find((c) => c.id === shown);
	const entry = entries.find((e) => e.id === shown);
	const open = chapter ? isUnlocked(chapter.unlock, view) : true;
	useEffect(() => {
		if (chapter && open) markRead(chapter.id);
	}, [chapter, open]);

	const chapterRow = (c: Chapter, i?: number) => {
		const lock = lockText(c.unlock, view);
		const unread = !lock && !progress.read.includes(c.id);
		return (
			<button key={c.id} type="button" role="option" aria-selected={shown === c.id} data-chapter={c.id} className={`pr-row ${shown === c.id ? "is-sel" : ""} ${lock ? "is-locked" : ""}`} onClick={() => setSel(c.id)}>
				<span className="pr-row-t">
					{i !== undefined ? `${i + 1} · ` : ""}
					{c.title}
				</span>
				{unread && <span className="pr-dot" role="img" aria-label="New" />}
				{lock && <span className="pr-lock">Locked</span>}
			</button>
		);
	};
	const entryRow = (e: Entry) => (
		<button key={e.id} type="button" role="option" aria-selected={shown === e.id} data-entry={e.id} className={`pr-row ${shown === e.id ? "is-sel" : ""}`} onClick={() => setSel(e.id)}>
			<span className="pr-row-t">{e.title}</span>
			{lockFor(e, view, content) && <span className="pr-lock">Locked</span>}
		</button>
	);
	const group = (label: string, g: Chapter["group"]) => (
		<>
			<h3 className="pnl-lh">
				<span>{label}</span>
			</h3>
			{chapters.filter((c) => c.group === g).map((c, i) => chapterRow(c, g === "core" ? i : undefined))}
		</>
	);

	const list = q ? (
		<>
			<h3 className="pnl-lh">
				<span>Results</span>
				<span className="pnl-count">{hitChapters.length + hitEntries.length}</span>
			</h3>
			{hitChapters.map((c) => chapterRow(c))}
			{hitEntries.map(entryRow)}
			{hitChapters.length + hitEntries.length === 0 && <p className="pnl-empty">Nothing matches "{q}". Try a shorter word, like "heat" or "rack".</p>}
		</>
	) : (
		<>
			{group("Start here", "core")}
			{group("Your Level", "level")}
			{group("Your path", "path")}
			<h3 className="pnl-lh">
				<span>Look something up</span>
			</h3>
			<div className="pr-tabs" role="tablist" aria-label="Reference lists">
				{REF_TABS.map((s) => (
					<button key={s.id} type="button" role="tab" aria-selected={tab === s.id} className={`pnl-tab ${tab === s.id ? "is-on" : ""}`} onClick={() => setTab(tab === s.id ? null : s.id)}>
						{s.id === "glossary" ? "Words" : s.label}
					</button>
				))}
			</div>
			{tab && entries.filter((e) => e.section === tab).map(entryRow)}
		</>
	);

	return (
		<>
			<PanelHead kicker="Never built a datacenter? Start here." title="Datacenter Primer" />
			<input
				type="search"
				className="ui-ency-search"
				placeholder="Search: chiller, uptime, rack..."
				aria-label="Search the Primer"
				value={query}
				onChange={(e) => setQuery(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Escape") {
						e.stopPropagation();
						if (query) setQuery("");
						else e.currentTarget.blur();
					}
				}}
			/>
			<SplitPane list={list} inspector={chapter ? <ChapterView c={chapter} n={chapters.filter((x) => x.group === "core").indexOf(chapter) + 1} next={chapters[chapters.indexOf(chapter) + 1]} {...props} onGo={setSel} /> : entry ? <EntryView e={entry} {...props} /> : <p className="pnl-empty">Pick a page on the left.</p>} />
		</>
	);
}

function ChapterView({ c, n, next, onGo, ...p }: { c: Chapter; n: number; next?: Chapter; onGo: (id: string) => void } & PanelProps) {
	const lock = lockText(c.unlock, p.state.view);
	const kicker = c.group === "core" ? `CHAPTER ${n} OF 6 · 1 MIN` : c.group === "level" ? "LEVEL GUIDE" : "PATH GUIDE";
	if (lock)
		return (
			<article className="pr-chap" data-chapter-view={c.id}>
				<div className="pr-kicker">{kicker}</div>
				<h2 className="pr-h">{c.title}</h2>
				<p className="pr-p pr-lockline">{lock}.</p>
				<p className="pr-p pr-dim">Keep building and this guide opens by itself. You will see a small note when it does.</p>
			</article>
		);
	return (
		<article className="pr-chap" data-chapter-view={c.id}>
			<div className="pr-kicker">{kicker}</div>
			<h2 className="pr-h">{c.title}</h2>
			{c.blocks.map((b, i) => (
				<div key={b.h ?? i}>
					{b.h && <h3 className="pr-sub">{b.h}</h3>}
					<p className="pr-p">{b.p}</p>
					{i === 0 && c.diagram && <Diagram id={c.diagram} />}
				</div>
			))}
			<div className="pr-act">
				<button type="button" className="ui-btn pnl-primary is-go pr-try" onClick={() => runTry(c.tryIt.id, p)}>
					Try it: {c.tryIt.label}
				</button>
				{next && c.group === "core" && (
					<button type="button" className="ui-btn pr-next" onClick={() => onGo(next.id)}>
						Next: {next.title}
					</button>
				)}
			</div>
		</article>
	);
}

function EntryView({ e, content, state, openResearch }: { e: Entry } & PanelProps) {
	const lock = lockFor(e, state.view, content);
	const hidden = e.spoiler && lock !== null;
	return (
		<article className="pr-chap" data-entry-view={e.id}>
			<div className="pr-kicker">{e.section === "glossary" ? "WORD" : e.section.toUpperCase()}</div>
			<h2 className="pr-h">{e.title}</h2>
			{lock && <p className="ui-ency-locktext">{lock}</p>}
			{!hidden && e.lines.map((l) => <p key={l} className="pr-p">{l}</p>)}
			{e.ref?.kind === "tech" && (
				<button type="button" className="ui-btn ui-mini" onClick={() => e.ref && openResearch(e.ref.id)}>
					Open in Research
				</button>
			)}
			{!hidden && e.needs.length > 0 && <p className="ui-ency-needs">Needs: {e.needs.join(" / ")}</p>}
			{!hidden && e.stats.length > 0 && (
				<dl className="ui-ency-stats">
					{e.stats.map(([k, v], i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: stat names can repeat (two "Capacity" rows)
						<div key={`${k}${i}`}>
							<dt>{k}</dt>
							<dd>{v}</dd>
						</div>
					))}
				</dl>
			)}
		</article>
	);
}
