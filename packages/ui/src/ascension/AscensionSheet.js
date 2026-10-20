import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { Stamp } from "../components/common";
import { focusables, nextFocusIndex } from "../menu/focus";
import { ConfirmBar, StampBtn } from "../menu/parts";
import { AffinityBars } from "../components/AffinityBars";
import { confirmQuestion, filePath, leadingPath, pathRows, pathToConfirm, preselectedPath } from "./ascension";
import "./ascension.css";
/** The printed form (no hooks, so tests can walk it): one card per path, then the confirmation bar once one is picked. */
export function AscensionForm({ rows, tier, affinity, content, pending, onPick, onConfirm, onCancel, onClose }) {
    const picked = rows.find((r) => r.id === pending);
    return (_jsxs("section", { className: "ui-asc", role: "dialog", "aria-modal": "true", "aria-labelledby": "asc-title", children: [_jsxs("header", { className: "ui-asc-head", children: [_jsx("span", { className: "ui-asc-form", children: "CLEARANCE REVIEW" }), _jsx("h2", { id: "asc-title", children: "ASCENSION" }), _jsx("button", { type: "button", className: "ui-btn ui-asc-close", onClick: onClose, title: "Close without choosing (Esc)", children: "Close" })] }), _jsxs("p", { className: "ui-asc-intro", children: ["Level ", tier, " entitles the tower to commit to one path of Ascension. The election is entered once. It cannot be amended, withdrawn or appealed, and the Board will not be reminded of it."] }), affinity && content && _jsx(AffinityBars, { affinity: affinity, content: content, leading: leadingPath(affinity) }), affinity && leadingPath(affinity) && _jsxs("p", { className: "ui-asc-lead", children: ["Your build, research and memo choices lead to ", rows.find((r) => r.id === leadingPath(affinity))?.name, ". It is pre-selected; you can pick another."] }), _jsx("ul", { className: "ui-asc-paths", children: rows.map((r) => (_jsxs("li", { className: `ui-asc-path ${r.available ? "" : "is-soon"} ${r.id === pending ? "is-picked" : ""}`, "data-path": r.id, children: [_jsx("h3", { className: "ui-asc-name", children: r.name }), _jsx("p", { className: "ui-asc-desc", children: r.description }), r.available ? (_jsx(StampBtn, { tone: "green", rest: "Choose", hot: "Confirm", onClick: () => onPick(r.id), disabled: r.id === pending, title: `Elect ${r.name} (you will be asked to confirm)` })) : (_jsx(Stamp, { tone: "ink", className: "ui-asc-soon", children: "Coming soon" }))] }, r.id))) }), picked && _jsx(ConfirmBar, { question: confirmQuestion(picked.name), yes: "Confirm", onYes: onConfirm, onNo: onCancel })] }));
}
/**
 * Modal ascension sheet. The Hud pauses the game while it is open (like the research sheet); Esc (or Close) shuts it.
 * Choosing a path asks for confirmation; confirming dispatches `choosePath` and reports the filing to the Hud.
 */
export function AscensionSheet({ store, content, view, onClose, onFiled }) {
    const root = useRef(null);
    const [pending, setPending] = useState(() => preselectedPath(content, view.affinity));
    useEffect(() => {
        const els = root.current ? focusables(root.current) : [];
        (els.find((e) => e.closest(".ui-asc-path:not(.is-soon)")) ?? els[0])?.focus();
    }, []);
    const onKeyDown = (e) => {
        // Nothing typed in the sheet may reach the game hotkeys or the camera.
        e.stopPropagation();
        if (e.key === "Escape") {
            e.preventDefault();
            onClose();
            return;
        }
        if (e.key !== "Tab" || !root.current)
            return;
        const els = focusables(root.current);
        const i = nextFocusIndex(els.length, els.indexOf(document.activeElement), e.shiftKey);
        if (i >= 0) {
            e.preventDefault();
            els[i].focus();
        }
    };
    const confirm = () => {
        const filed = pending ? filePath(store, content, pending) : null;
        setPending(null);
        if (filed)
            onFiled(filed);
    };
    return (
    // biome-ignore lint/a11y/noStaticElementInteractions: modal sheet; the key handler implements Esc and the focus loop
    _jsx("div", { className: "ui-asc-backdrop", ref: root, onKeyDown: onKeyDown, children: _jsx(AscensionForm, { rows: pathRows(content, view), tier: view.tier, affinity: view.affinity, content: content, pending: pending, onPick: (id) => setPending(pathToConfirm(content, id)), onConfirm: confirm, onCancel: () => setPending(null), onClose: onClose }) }));
}
