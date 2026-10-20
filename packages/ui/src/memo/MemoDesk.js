import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { memoStain } from "../bio/bio";
import { PATH_COLOR } from "../ascension/ascension";
import { chipParts, effectsOf, isUrgentMemo } from "../calm/calm";
import { useEffect } from "react";
import { Icon, Lamp, Stamp } from "../components/common";
import { fmtDuration } from "../format";
import { pushNotice } from "../notices";
import { clampStanding, defaultChoiceLabel, historyRows, memoCountdown, memoFraction, memoUrgent, modifierChip, modifierHurts, openMemos, pruneIds, standingTone } from "./memoDesk";
import "./memo.css";
/** The consequence of a choice: plain chips, with affinity effects as path-coloured pills. */
function choiceChipsNode(effects) {
    const parts = chipParts(effects);
    if (parts.length === 0)
        return _jsx("em", { children: "no effect" });
    return (_jsx("em", { children: parts.map((c, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static list
        _jsxs("span", { children: [i > 0 && " · ", c.path ? (_jsx("span", { className: "ui-pathchip", "data-path": c.path, style: { color: PATH_COLOR[c.path] }, children: c.text })) : (c.text)] }, i))) }));
}
const CATEGORY = { ministry: "COMPUTE AUTHORITY", environmental: "WEATHER SERVICE", operational: "OPERATIONS", client: "CLIENT LIAISON", horror: "CLASSIFIED" };
/** Stamp a memo. The memo is hidden at once; the store applies the answer immediately (or on the next tick while running). */
function answer(store, ui, setUi, memo, choiceId) {
    const r = store.dispatch({ type: "resolveMemo", memoId: memo.id, choiceId });
    if (!r.ok) {
        pushNotice({ text: `Memo not answered: ${r.reason}`, severity: "warn", key: `memo:${memo.id}` });
        return;
    }
    setUi({ stamped: [...ui.stamped, memo.id] });
}
export function MemoCard({ memo, tick, onAnswer, onAside }) {
    const urgent = memoUrgent(memo, tick);
    const id = `memo-${memo.id}`;
    return (_jsxs("article", { className: `memo-card ${urgent ? "is-urgent" : ""}`, "data-memo": memo.id, "aria-labelledby": `${id}-t`, children: [_jsxs("header", { className: "memo-head", children: [_jsxs("span", { className: "memo-from", children: ["FROM: ", CATEGORY[memo.category] ?? "COMPUTE AUTHORITY", " \u00B7 NO. ", String(memo.id).padStart(4, "0")] }), urgent && _jsx(Stamp, { tone: "red", className: "memo-urgent", children: "Urgent" })] }), _jsx("h3", { className: "memo-title", id: `${id}-t`, children: memo.title }), memo.body.split("\n\n").map((p) => (_jsx("p", { className: "memo-body", children: p }, p))), _jsxs("div", { className: "memo-clock", role: "timer", "aria-label": memoCountdown(memo, tick), children: [_jsx("span", { className: "memo-bar", "aria-hidden": "true", children: _jsx("i", { style: { width: `${Math.round(memoFraction(memo, tick) * 100)}%` } }) }), _jsx("span", { className: "memo-left", children: memoCountdown(memo, tick) }), _jsxs("span", { className: "memo-default", children: ["Unanswered memos resolve as: ", _jsx("b", { children: defaultChoiceLabel(memo) })] })] }), _jsx("div", { className: "memo-choices", children: memo.choices.map((c) => (_jsxs("div", { className: "memo-choice", children: [_jsxs("button", { type: "button", className: `ui-stampbtn stamp-green memo-stamp ${c.id === memo.defaultChoice ? "is-default" : ""}`, onClick: () => onAnswer(c.id), "aria-describedby": `${id}-${c.id}`, children: [_jsx("span", { className: "rest", children: c.label }), _jsx("span", { className: "hot", children: c.label })] }), _jsx("span", { className: "memo-hint", id: `${id}-${c.id}`, children: c.hint })] }, c.id))) }), onAside && (_jsx("footer", { className: "memo-foot", children: _jsx("button", { type: "button", className: "ui-btn", onClick: onAside, title: "Close this slip; the memo waits in the inbox", children: "To inbox" }) }))] }));
}
/** The urgent memo to pop up: the oldest open, unset-aside one that is urgent. Others only raise the inbox count. */
export const urgentToPop = (view, content, stamped, aside) => openMemos(view.memos, stamped).find((m) => !aside.includes(m.id) && isUrgentMemo(m, view, content)) ?? null;
/**
 * The compact slip: category and countdown, a headline, and one stamp per choice with its effects as numbers and icons
 * ("−$160k · ★−4"). The prose waits behind "read memo" (`ui.readMemo`).
 */
export function MemoSlip({ memo, content, tick, open, onRead, onAnswer, onAside }) {
    return (_jsxs("article", { className: "memo-slip", "data-memo": memo.id, "aria-label": memo.title, children: [_jsxs("header", { className: "memo-slip-from", children: [_jsxs("span", { children: [CATEGORY[memo.category] ?? "COMPUTE AUTHORITY", " \u00B7 URGENT"] }), _jsx("span", { title: "The memo resolves to its default choice when the time runs out", children: memoCountdown(memo, tick) })] }), _jsx("h3", { className: "memo-slip-title", children: memo.title }), _jsx("div", { className: "memo-slip-stamps", children: memo.choices.map((c) => (_jsxs("button", { type: "button", className: `memo-slip-stamp ${c.id === memo.defaultChoice ? "is-default" : ""}`, title: c.hint, onClick: () => onAnswer(c.id), children: [_jsx("span", { children: c.label }), choiceChipsNode(effectsOf(content, memo, c.id))] }, c.id))) }), _jsxs("footer", { className: "memo-slip-foot", children: [_jsx("button", { type: "button", className: "memo-slip-more", "aria-expanded": open, onClick: onRead, children: open ? "hide memo" : "read memo" }), _jsx("button", { type: "button", className: "memo-slip-more", onClick: onAside, title: "Close this slip; the memo waits in the inbox", children: "later" })] }), open && (_jsx("div", { className: "memo-slip-body", children: memo.body.split(/\n\s*\n/).map((p) => (_jsx("p", { children: p }, p))) }))] }));
}
/** An urgent unanswered memo pops up at the top right of the world; everything else raises the inbox count. */
export function MemoPop({ store, content, state, ui, setUi }) {
    const { memos, tick } = state.view;
    // Forget bookkeeping for memos the sim has resolved.
    const stale = ui.stamped.length + ui.aside.length > 0 && (pruneIds(ui.stamped, memos).length !== ui.stamped.length || pruneIds(ui.aside, memos).length !== ui.aside.length);
    useEffect(() => {
        if (stale)
            setUi({ stamped: pruneIds(ui.stamped, memos), aside: pruneIds(ui.aside, memos) });
    }, [stale, memos, ui.stamped, ui.aside, setUi]);
    const memo = ui.inboxOpen ? null : urgentToPop(state.view, content, ui.stamped, ui.aside);
    if (!memo)
        return null;
    const stain = memoStain(state.view.corruption ?? 0, state.settings.horrorIntensity);
    return (_jsx("div", { className: `ui-memo-pop ${stain === "none" ? "" : `has-stain-${stain}`}`, role: "dialog", "aria-label": "Incoming Authority memo", children: _jsx(MemoSlip, { memo: memo, content: content, tick: tick, open: ui.readMemo === memo.id, onRead: () => setUi({ readMemo: ui.readMemo === memo.id ? null : memo.id }), onAnswer: (c) => answer(store, ui, setUi, memo, c), onAside: () => setUi({ aside: [...ui.aside, memo.id] }) }) }, memo.id));
}
/** Inbox drawer: every open memo (answerable here), then the history of resolved ones with their outcomes. */
export function MemoDrawer({ store, content, state, ui, setUi }) {
    const { view } = state;
    const open = openMemos(view.memos, ui.stamped);
    const history = historyRows(view, content);
    return (_jsxs("aside", { className: "ui-memo-drawer ui-panel", "aria-label": "Compute Authority inbox", children: [_jsxs("div", { className: "ui-panel-title", children: [_jsx("span", { className: "memo-drawer-title", children: "AUTHORITY INBOX" }), _jsx("button", { type: "button", className: "ui-btn ui-icon-btn", onClick: () => setUi({ inboxOpen: false }), "aria-label": "Close inbox", title: "Close the inbox", children: _jsx(Icon, { name: "close", size: 12 }) })] }), _jsxs("div", { className: "memo-drawer-scroll", children: [_jsxs("h4", { className: "memo-sect", children: ["IN TRAY (", open.length, ")"] }), open.length === 0 && _jsx("p", { className: "memo-empty", children: "No open memos." }), open.map((m) => (_jsx(MemoCard, { memo: m, tick: view.tick, onAnswer: (c) => answer(store, ui, setUi, m, c) }, m.id))), _jsxs("h4", { className: "memo-sect", children: ["RESOLVED (", history.length, ")"] }), history.length === 0 && _jsx("p", { className: "memo-empty", children: "Nothing resolved yet." }), _jsx("ul", { className: "memo-history", children: history.map((h) => (_jsxs("li", { className: "memo-hist", children: [_jsxs("div", { className: "memo-hist-top", children: [_jsx("b", { children: h.title }), _jsx("span", { className: `memo-hist-stamp ${h.auto ? "is-auto" : ""}`, children: h.auto ? `AUTO: ${h.stamp}` : h.stamp })] }), _jsx("div", { className: "memo-hist-out", children: h.outcome }), _jsxs("div", { className: "memo-hist-when", children: [fmtDuration(Math.max(0, view.tick - h.tick)), " ago"] })] }, h.memoId))) })] })] }));
}
/** Top-bar inbox lamp with the count of open memos (lit and blinking while any are waiting). */
export function InboxButton({ state, ui, setUi }) {
    const n = openMemos(state.view.memos, ui.stamped).length;
    return (_jsxs("button", { type: "button", className: `ui-btn ui-inbox ${ui.inboxOpen ? "is-on" : ""}`, "data-tut": "inbox", "data-help": "inbox", onClick: () => setUi({ inboxOpen: !ui.inboxOpen }), "aria-expanded": ui.inboxOpen, children: [_jsx(Lamp, { on: n > 0, tone: "red", blink: n > 0, plain: true }), _jsx("span", { className: "ui-inbox-label ui-hide-narrow", children: "INBOX" }), _jsx("span", { className: `ui-inbox-count ${n ? "has" : ""}`, children: n })] }));
}
/** Authority standing as a horizontal needle meter, 0–100, with a red zone below 25. */
export function StandingMeter({ standing }) {
    const v = clampStanding(standing);
    const tone = standingTone(v);
    return (
    // biome-ignore lint/a11y/useSemanticElements: a custom needle meter; a native <meter> cannot be styled into this gauge
    _jsxs("div", { className: `ui-standing tone-${tone}`, "data-tut": "standing", role: "meter", "aria-label": "Reputation", "data-help": "reputation", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": Math.round(v), children: [_jsx("span", { className: "ui-dymo", children: "REPUTATION" }), _jsxs("span", { className: "ui-standing-row", children: [_jsxs("span", { className: "ui-standing-scale", "aria-hidden": "true", children: [_jsx("i", { className: "ui-standing-red" }), _jsx("i", { className: "ui-standing-needle", style: { left: `${v}%` } })] }), _jsx("span", { className: `ui-crt ${tone === "red" ? "crt-red" : tone === "green" ? "crt-green" : "crt-amber"} ui-standing-read`, children: Math.round(v) })] })] }));
}
const MAX_CHIPS = 2;
/** Active temporary effects, e.g. "HEATWAVE +8 °C · 14h". */
export function ModifierChips({ modifiers, tick }) {
    if (modifiers.length === 0)
        return null;
    const shown = modifiers.slice(0, MAX_CHIPS);
    const hidden = modifiers.slice(MAX_CHIPS);
    return (_jsxs("ul", { className: "ui-modchips", "aria-label": "Active effects", children: [hidden.length > 0 && (_jsxs("li", { className: "ui-modchip is-more", title: hidden.map((m) => modifierChip(m, tick)).join("\n"), children: ["+", hidden.length, " MORE"] })), shown.map((m) => (_jsx("li", { className: `ui-modchip ${modifierHurts(m) ? "is-bad" : "is-good"}`, children: modifierChip(m, tick) }, `${m.kind}:${m.label}:${m.endsAt}`)))] }));
}
