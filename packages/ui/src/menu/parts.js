import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** Rubber-stamp action button for paper forms. `hot` is the stamped wording shown on hover or focus. */
export function StampBtn({ tone = "green", rest, hot, onClick, disabled, autoFocus, title, }) {
    return (
    // biome-ignore lint/a11y/noAutofocus: dialog action buttons deliberately take focus when the dialog opens
    _jsxs("button", { type: "button", className: `ui-stampbtn stamp-${tone}`, onClick: onClick, disabled: disabled, autoFocus: autoFocus, title: title, "aria-label": rest, children: [_jsx("span", { className: "rest", children: rest }), _jsx("span", { className: "hot", children: hot ?? rest })] }));
}
/** Brass-knobbed fader in a groove, 0..1 style range input. */
export function Slider({ value, min, max, step, onChange, label, readout, }) {
    return (_jsxs("span", { className: "ui-slider-wrap", children: [_jsx("input", { type: "range", className: "ui-slider", min: min, max: max, step: step, value: value, "aria-label": label, "aria-valuetext": readout, onChange: (e) => onChange(Number(e.currentTarget.value)) }), _jsx("span", { className: "ui-crt crt-amber ui-slider-read", children: readout })] }));
}
/** One engraved setting row: label and hint on the left, the control on the right. */
export function SettingRow({ label, hint, children }) {
    return (_jsxs("div", { className: "ui-setting", children: [_jsxs("div", { className: "ui-setting-text", children: [_jsx("span", { className: "ui-setting-label", children: label }), _jsx("span", { className: "ui-setting-hint", children: hint })] }), _jsx("div", { className: "ui-setting-ctl", children: children })] }));
}
/** Inline confirmation bar (no window.confirm). */
export function ConfirmBar({ question, yes, onYes, onNo }) {
    return (_jsxs("div", { className: "ui-confirm", role: "alertdialog", "aria-label": question, children: [_jsx("span", { className: "ui-confirm-q", children: question }), _jsxs("span", { className: "ui-confirm-acts", children: [_jsx(StampBtn, { tone: "red", rest: yes, onClick: onYes, autoFocus: true }), _jsx(StampBtn, { tone: "green", rest: "Cancel", hot: "Stand down", onClick: onNo })] })] }));
}
