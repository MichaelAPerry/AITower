import { useEffect, useMemo, useRef, useState } from "react";
import type { PanelProps } from "../components/context";
import { buildEntries, type Entry, lockFor, SECTIONS, type Section, searchEntries, sectionOf } from "./entries";
import "./encyclopedia.css";

/** Encyclopedia drawer (K): search, section tabs, and entries that open in place. */
export function EncyclopediaDrawer({ content, state, ui, setUi, openResearch }: PanelProps) {
	const entries = useMemo(() => buildEntries(content), [content]);
	const [query, setQuery] = useState("");
	const [section, setSection] = useState<Section>("basics");
	const [open, setOpen] = useState<string | null>(null);
	const target = useRef<HTMLLIElement>(null);

	// A "More..." link asked for an entry: show its section, open it, scroll to it.
	const wanted = ui.encyId ?? null;
	// biome-ignore lint/correctness/useExhaustiveDependencies: react to a new request only
	useEffect(() => {
		if (!wanted) return;
		const s = sectionOf(wanted);
		if (s) setSection(s);
		setQuery("");
		setOpen(wanted);
		setUi({ encyId: null });
	}, [wanted]);
	// biome-ignore lint/correctness/useExhaustiveDependencies: re-scroll when the list behind the open entry changes
	useEffect(() => {
		if (open) target.current?.scrollIntoView({ block: "nearest" });
	}, [open, section, query]);

	const rows = useMemo(() => (query.trim() ? searchEntries(entries, query) : entries.filter((e) => e.section === section)), [entries, query, section]);
	const row = (e: Entry) => {
		const lock = lockFor(e, state.view, content);
		const hidden = e.spoiler && lock !== null;
		const isOpen = open === e.id;
		return (
			<li key={e.id} className={`ui-ency-item ${isOpen ? "is-open" : ""}`} ref={isOpen ? target : undefined} data-entry={e.id}>
				<button type="button" className="ui-ency-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : e.id)}>
					<span className="ui-ency-title">{e.title}</span>
					{lock && <span className="ui-ency-lock">locked</span>}
					<span aria-hidden="true">{isOpen ? "▾" : "▸"}</span>
				</button>
				{isOpen && (
					<div className="ui-ency-body">
						{lock && <p className="ui-ency-locktext">{lock}</p>}
						{!hidden && e.lines.map((l) => <p key={l}>{l}</p>)}
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
					</div>
				)}
			</li>
		);
	};
	return (
		<>
			<h4 className="ui-dh">
				<span>ENCYCLOPEDIA</span>
				<span>{rows.length}</span>
			</h4>
			<input
				type="search"
				className="ui-ency-search"
				placeholder="Search: power, rack, PUE..."
				aria-label="Search the Encyclopedia"
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
			{!query.trim() && (
				<div className="ui-ency-tabs" role="tablist" aria-label="Sections">
					{SECTIONS.map((s) => (
						<button key={s.id} type="button" role="tab" aria-selected={section === s.id} className={`ui-ency-tab ${section === s.id ? "is-on" : ""}`} onClick={() => setSection(s.id)}>
							{s.label}
						</button>
					))}
				</div>
			)}
			{rows.length === 0 && <div className="ui-empty">Nothing matches "{query}".</div>}
			<ul className="ui-ency-list">{rows.map(row)}</ul>
		</>
	);
}
