import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from "react";
import { Stamp } from "../components/common";
import { focusables, nextFocusIndex } from "../menu/focus";
import { StampBtn } from "../menu/parts";
import { auditOutcome, gradeTone, reportRows } from "./finance";
/**
 * QUARTERLY AUDIT: a modal paper sheet with the figures, a big grade stamp, the standing and cash change and the
 * Compute Authority's remark. It does not pause the game. Closes with the button or Esc.
 */
export function AuditSheet({ report, onClose }) {
    const root = useRef(null);
    // biome-ignore lint/correctness/useExhaustiveDependencies: focus the close button when a (new) report appears
    useEffect(() => {
        if (root.current)
            focusables(root.current)[0]?.focus();
    }, [report.quarter]);
    const onKeyDown = (e) => {
        // The sheet does not pause the game, so game hotkeys still work; only the keys the sheet itself uses stay inside it.
        if (["Escape", "Tab", "Enter", " "].includes(e.key))
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
    return (
    // biome-ignore lint/a11y/noStaticElementInteractions: modal sheet; the key handler implements Esc and the focus loop
    _jsx("div", { className: "ui-audit-backdrop", ref: root, onKeyDown: onKeyDown, children: _jsx(AuditPaper, { report: report, onClose: onClose }) }));
}
/** The paper itself (no hooks, so tests can call it directly). */
export function AuditPaper({ report, onClose }) {
    const tone = gradeTone(report.grade);
    const out = auditOutcome(report);
    return (_jsxs("article", { className: "ui-audit", role: "dialog", "aria-modal": "true", "aria-labelledby": "audit-title", children: [_jsxs("header", { className: "ui-audit-head", children: [_jsx("span", { children: "COMPUTE AUTHORITY \u00B7 FACILITY AUDIT" }), _jsxs("span", { children: ["QUARTER ", report.quarter] })] }), _jsx("h2", { className: "ui-audit-title", id: "audit-title", children: "QUARTERLY AUDIT" }), _jsxs("div", { className: "ui-audit-main", children: [_jsx("dl", { className: "ui-audit-figs", children: reportRows(report).map((r) => (_jsxs("div", { children: [_jsx("dt", { children: r.label }), _jsx("dd", { className: r.tone === "bad" ? "is-bad" : r.tone === "good" ? "is-good" : "", children: r.value })] }, r.label))) }), _jsxs("div", { className: "ui-audit-grade", children: [_jsx("span", { className: "ui-audit-gradelabel", children: "GRADE" }), _jsx(Stamp, { tone: tone, className: "ui-audit-stamp", children: report.grade })] })] }), _jsxs("p", { className: "ui-audit-outcome", children: [_jsx("span", { className: report.standingDelta < 0 ? "is-bad" : report.standingDelta > 0 ? "is-good" : "", children: out.standing }), _jsx("span", { className: report.cashDelta < 0 ? "is-bad" : report.cashDelta > 0 ? "is-good" : "", children: out.cash })] }), _jsx("blockquote", { className: "ui-audit-remark", children: report.remark }), _jsx("footer", { className: "ui-audit-acts", children: _jsx(StampBtn, { tone: "green", rest: "Close", hot: "Closed", onClick: onClose, title: "Close the audit sheet (Esc)" }) })] }));
}
