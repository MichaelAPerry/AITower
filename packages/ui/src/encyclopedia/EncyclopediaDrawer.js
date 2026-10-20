import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildEntries, lockFor, SECTIONS, searchEntries, sectionOf } from "./entries";
import "./encyclopedia.css";
/** Encyclopedia drawer (K): search, section tabs, and entries that open in place. */
export function EncyclopediaDrawer({ content, state, ui, setUi }) {
    const entries = useMemo(() => buildEntries(content), [content]);
    const [query, setQuery] = useState("");
    const [section, setSection] = useState("basics");
    const [open, setOpen] = useState(null);
    const target = useRef(null);
    // A "More..." link asked for an entry: show its section, open it, scroll to it.
    const wanted = ui.encyId ?? null;
    // biome-ignore lint/correctness/useExhaustiveDependencies: react to a new request only
    useEffect(() => {
        if (!wanted)
            return;
        const s = sectionOf(wanted);
        if (s)
            setSection(s);
        setQuery("");
        setOpen(wanted);
        setUi({ encyId: null });
    }, [wanted]);
    // biome-ignore lint/correctness/useExhaustiveDependencies: re-scroll when the list behind the open entry changes
    useEffect(() => {
        if (open)
            target.current?.scrollIntoView({ block: "nearest" });
    }, [open, section, query]);
    const rows = useMemo(() => (query.trim() ? searchEntries(entries, query) : entries.filter((e) => e.section === section)), [entries, query, section]);
    const row = (e) => {
        const lock = lockFor(e, state.view, content);
        const hidden = e.spoiler && lock !== null;
        const isOpen = open === e.id;
        return (_jsxs("li", { className: `ui-ency-item ${isOpen ? "is-open" : ""}`, ref: isOpen ? target : undefined, "data-entry": e.id, children: [_jsxs("button", { type: "button", className: "ui-ency-head", "aria-expanded": isOpen, onClick: () => setOpen(isOpen ? null : e.id), children: [_jsx("span", { className: "ui-ency-title", children: e.title }), lock && _jsx("span", { className: "ui-ency-lock", children: "locked" }), _jsx("span", { "aria-hidden": "true", children: isOpen ? "▾" : "▸" })] }), isOpen && (_jsxs("div", { className: "ui-ency-body", children: [lock && _jsx("p", { className: "ui-ency-locktext", children: lock }), !hidden && e.lines.map((l) => _jsx("p", { children: l }, l)), !hidden && e.needs.length > 0 && _jsxs("p", { className: "ui-ency-needs", children: ["Needs: ", e.needs.join(" / ")] }), !hidden && e.stats.length > 0 && (_jsx("dl", { className: "ui-ency-stats", children: e.stats.map(([k, v], i) => (
                            // biome-ignore lint/suspicious/noArrayIndexKey: stat names can repeat (two "Capacity" rows)
                            _jsxs("div", { children: [_jsx("dt", { children: k }), _jsx("dd", { children: v })] }, `${k}${i}`))) }))] }))] }, e.id));
    };
    return (_jsxs(_Fragment, { children: [_jsxs("h4", { className: "ui-dh", children: [_jsx("span", { children: "ENCYCLOPEDIA" }), _jsx("span", { children: rows.length })] }), _jsx("input", { type: "search", className: "ui-ency-search", placeholder: "Search: power, rack, PUE...", "aria-label": "Search the Encyclopedia", value: query, onChange: (e) => setQuery(e.target.value), onKeyDown: (e) => {
                    if (e.key === "Escape") {
                        e.stopPropagation();
                        if (query)
                            setQuery("");
                        else
                            e.currentTarget.blur();
                    }
                } }), !query.trim() && (_jsx("div", { className: "ui-ency-tabs", role: "tablist", "aria-label": "Sections", children: SECTIONS.map((s) => (_jsx("button", { type: "button", role: "tab", "aria-selected": section === s.id, className: `ui-ency-tab ${section === s.id ? "is-on" : ""}`, onClick: () => setSection(s.id), children: s.label }, s.id))) })), rows.length === 0 && _jsxs("div", { className: "ui-empty", children: ["Nothing matches \"", query, "\"."] }), _jsx("ul", { className: "ui-ency-list", children: rows.map(row) })] }));
}
