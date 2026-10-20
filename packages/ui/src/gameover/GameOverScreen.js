import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from "react";
import { Stamp } from "../components/common";
import { focusables, nextFocusIndex } from "../menu/focus";
import { StampBtn } from "../menu/parts";
import { endingOf, isFinal, lifetimeStats, overCopyFor } from "./gameOver";
import "./gameover.css";
/** Full-screen notice: NOTICE OF TERMINATION (bankrupt, shutdown), COMMENDATION (victory), or the text of the ending reached (living / clean / absorbed). */
export function GameOverScreen({ over, view, content, horror = "full", onLoad, onNewGame, onContinue, menuOpen }) {
    const root = useRef(null);
    const copy = overCopyFor(over, content, horror);
    const ending = endingOf(over);
    const final = isFinal(over.kind);
    // biome-ignore lint/correctness/useExhaustiveDependencies: refocus the first button when the notice appears and when the menu hands control back
    useEffect(() => {
        if (!menuOpen && root.current)
            focusables(root.current)[0]?.focus();
    }, [menuOpen, over.kind]);
    const onKeyDown = (e) => {
        e.stopPropagation();
        if (e.key !== "Tab" || !root.current)
            return;
        const els = focusables(root.current);
        const i = nextFocusIndex(els.length, els.indexOf(document.activeElement), e.shiftKey);
        if (i >= 0) {
            e.preventDefault();
            els[i].focus();
        }
    };
    return (
    // biome-ignore lint/a11y/noStaticElementInteractions: full-screen modal; the key handler implements the focus loop
    _jsx("div", { className: `ui-over is-${over.kind}${ending ? ` ending-${ending}` : ""}`, ref: root, onKeyDown: onKeyDown, children: _jsxs("article", { className: "ui-over-memo", role: "alertdialog", "aria-modal": "true", "aria-labelledby": "over-title", children: [_jsxs("header", { className: "ui-over-head", children: [_jsx("span", { className: "ui-over-from", children: "COMPUTE AUTHORITY \u00B7 ENFORCEMENT" }), _jsx("span", { className: "ui-over-form", children: copy.form })] }), _jsx("h2", { className: "ui-over-title", id: "over-title", children: copy.heading }), copy.lines.map((l) => (_jsx("p", { className: "ui-over-line", children: l }, l))), _jsxs("section", { className: "ui-over-record", "aria-label": "Service record", children: [_jsx("h3", { children: "SERVICE RECORD" }), _jsx("dl", { children: lifetimeStats(view).map((r) => (_jsxs("div", { children: [_jsx("dt", { children: r.label }), _jsx("dd", { children: r.value })] }, r.label))) })] }), _jsx(Stamp, { tone: copy.tone === "red" ? "red" : "green", className: "ui-over-stamp", children: copy.stamp }), _jsxs("footer", { className: "ui-over-acts", children: [final ? _jsx(StampBtn, { tone: "green", rest: "Load game", onClick: onLoad }) : _jsx(StampBtn, { tone: "green", rest: "Continue in sandbox", onClick: onContinue }), _jsx(StampBtn, { tone: final ? "red" : "green", rest: "New game", onClick: onNewGame })] })] }) }));
}
