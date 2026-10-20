import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Toggle } from "../components/common";
import { pushNotice } from "../notices";
import { clerkLockedText, feePercent, JOB_KINDS, parseAmount, toggleKind } from "./clerk";
const KIND_TITLE = {
    training: "Training jobs: long, big payouts, penalised if late",
    finetune: "Fine-tuning jobs: medium length",
    inference: "Inference jobs: a steady load for a fixed time",
};
/**
 * A number box that keeps what you type (so "1." and an empty box are fine) and sends a valid value on every change.
 * An invalid entry leaves the standing order alone and snaps back when the box loses focus.
 */
export function AmountField({ label, value, onValue, title, prefix }) {
    const [draft, setDraft] = useState(String(value));
    // Follow changes that came from elsewhere (a load, another control).
    useEffect(() => {
        setDraft((d) => (parseAmount(d) === value ? d : String(value)));
    }, [value]);
    return (_jsxs("label", { className: "ui-clerk-field", title: title, children: [_jsx("span", { className: "ui-clerk-flabel", children: label }), _jsxs("span", { className: "ui-clerk-box", children: [prefix && _jsx("span", { className: "ui-clerk-prefix", children: prefix }), _jsx("input", { type: "text", inputMode: "decimal", className: "ui-clerk-input", value: draft, "aria-label": label, onChange: (e) => {
                            setDraft(e.currentTarget.value);
                            const n = parseAmount(e.currentTarget.value);
                            if (n !== null)
                                onValue(n);
                        }, onBlur: () => setDraft(String(value)) })] })] }));
}
/** The Contract Automation: a hire-me slip until researched, then a compact standing-order form. */
export function ClerkPanel({ store, content, state, openResearch }) {
    const clerk = state.view.clerk;
    if (!clerk)
        return null;
    if (!clerk.unlocked) {
        return (_jsxs("div", { className: "ui-clerk-slip", "data-tut": "clerk-locked", children: [_jsx("span", { className: "ui-clerk-slip-text", children: clerkLockedText(content) }), _jsx("button", { type: "button", className: "ui-btn ui-mini", onClick: openResearch, title: "Open the Department of Research (R)", children: "Research (R)" })] }));
    }
    const p = clerk.policy;
    const send = (patch) => {
        // Build on the policy as it is now, not as it was at the last render (the HUD redraws view changes at 10 Hz).
        const cur = store.get().view.clerk.policy;
        const r = store.dispatch({ type: "setClerk", policy: { ...cur, kinds: [...cur.kinds], ...patch } });
        if (!r.ok)
            pushNotice({ text: r.reason, severity: "warn", key: `clerk:${r.reason}` });
    };
    return (_jsxs("section", { className: `ui-clerk ${p.enabled ? "is-on" : "is-off"}`, "aria-label": "Contract Automation standing order", children: [_jsxs("div", { className: "ui-clerk-head", children: [_jsx("span", { className: "ui-clerk-title", children: "CONTRACT AUTOMATION \u00B7 STANDING ORDER" }), _jsxs("span", { className: "ui-clerk-stats", title: "The clerk keeps this share of the earnings of every job it books", children: ["Fee ", feePercent(content), " % \u00B7 accepted so far: ", _jsx("b", { children: clerk.acceptedTotal })] })] }), _jsxs("div", { className: "ui-clerk-body", children: [_jsx(Toggle, { on: p.enabled, onClick: () => send({ enabled: !p.enabled }), label: p.enabled ? "CLERK ON" : "CLERK OFF", title: p.enabled ? "Clerk is on: it accepts matching offers once per tick. Click to switch off" : "Clerk is off: you accept offers by hand. Click to switch on", className: "ui-collapse ui-clerk-toggle" }), _jsxs("fieldset", { className: "ui-clerk-kinds", children: [_jsx("legend", { children: "Job kinds" }), JOB_KINDS.map((k) => (_jsxs("label", { className: "ui-clerk-check", title: p.kinds.length === 1 && p.kinds[0] === k ? "The clerk needs at least one job kind" : KIND_TITLE[k], children: [_jsx("input", { type: "checkbox", checked: p.kinds.includes(k), disabled: p.kinds.length === 1 && p.kinds[0] === k, onChange: () => send({ kinds: toggleKind(p.kinds, k) }) }), k] }, k)))] }), _jsx(AmountField, { label: "Min $/PF\u00B7h", value: p.minPayPerPflopHour, onValue: (n) => send({ minPayPerPflopHour: n }), title: "Skip offers that pay less than this many dollars per PFLOP-hour. 0 = any", prefix: "$" }), _jsx(AmountField, { label: "Max penalty", value: p.maxPenalty, onValue: (n) => send({ maxPenalty: n }), title: "Skip offers whose missed-deadline penalty is above this many dollars. 0 = any", prefix: "$" }), _jsxs("label", { className: "ui-clerk-check", title: "Let the clerk take offers that need liquid-cooled racks", children: [_jsx("input", { type: "checkbox", checked: p.allowLiquid, onChange: () => send({ allowLiquid: !p.allowLiquid }) }), "allow liquid"] })] })] }));
}
