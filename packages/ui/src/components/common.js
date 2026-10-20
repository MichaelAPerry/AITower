import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { clamp01 } from "../format";
export const statusTone = {
    ok: "good",
    idle: "dim",
    disabled: "dim",
    unpowered: "error",
    brownout: "warn",
    noCoolant: "error",
    noNutrient: "error",
    tooCold: "warn",
    throttled: "warn",
    tripped: "error",
    failed: "error",
};
export const statusLabel = {
    ok: "online",
    idle: "idle",
    disabled: "disabled",
    unpowered: "no power",
    brownout: "brownout",
    noCoolant: "no coolant",
    noNutrient: "no nutrient",
    tooCold: "too cold",
    throttled: "throttled",
    tripped: "tripped",
    failed: "failed",
};
/**
 * Small stamped tag. `status` marks a true status indicator: with colour-blind mode on it gains a glyph
 * (✓ good, ▲ warn, ✕ error, ○ dim) so it never relies on colour alone.
 */
export function Pill({ tone, children, status = false }) {
    return _jsx("span", { className: `ui-pill tone-${tone} ${status ? "is-status" : ""}`, children: children });
}
/** Segmented phosphor VU bar, 0..1. */
export function Meter({ value, tone = "cyan", height = 8 }) {
    return (_jsx("div", { className: `ui-meter tone-${tone}`, style: { height }, children: _jsx("div", { className: "ui-meter-fill", style: { width: `${clamp01(value) * 100}%` } }) }));
}
/** Inset CRT screen: dark glass, phosphor glow, scanlines and a curved inner shadow. */
export function Crt({ tone = "amber", className = "", children, title }) {
    return (_jsx("div", { className: `ui-crt crt-${tone} ${className}`, title: title, children: children }));
}
/**
 * Round indicator lamp with a glow halo. Status lamps gain a glyph in colour-blind mode (✓ green, ▲ amber,
 * ✕ red, ○ unlit); `plain` lamps (progress or switch indicators) never do.
 */
export function Lamp({ on, tone = "amber", blink = false, plain = false }) {
    return _jsx("span", { className: `ui-lamp lamp-${tone} ${on ? "is-lit" : ""} ${on && blink ? "is-blink" : ""} ${plain ? "is-plain" : ""}`, "aria-hidden": "true" });
}
/** Mechanical bat-handle toggle switch with ON/OFF engraving. Lever up = on. */
export function Toggle({ on, onClick, label, title, role = "switch", lamp, className = "", children, }) {
    return (
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: role is switch or radio (both support aria-checked); the lint cannot see through the prop
    _jsxs("button", { type: "button", role: role, "aria-checked": on, className: `ui-toggle ${on ? "is-on" : "is-off"} ${className}`, onClick: onClick, title: title, children: [lamp && _jsx(Lamp, { on: on, tone: lamp, plain: true }), _jsxs("span", { className: "ui-toggle-plate", "aria-hidden": "true", children: [_jsx("span", { className: "ui-toggle-eng on", children: "ON" }), _jsx("span", { className: "ui-toggle-nut" }), _jsx("span", { className: "ui-toggle-lever" }), _jsx("span", { className: "ui-toggle-eng off", children: "OFF" })] }), label !== undefined && _jsx("span", { className: "ui-toggle-label", children: label }), children] }));
}
/** Rubber-stamp impression. */
export function Stamp({ tone = "red", children, className = "" }) {
    return _jsx("span", { className: `ui-stamp stamp-${tone} ${className}`, children: children });
}
/** Mechanical drum counter: each character on its own wheel. */
export function Counter({ text, className = "" }) {
    return (
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: aria-label on a text span reads the whole counter as one string; the per-character wheels are decorative
    _jsx("span", { className: `ui-counter ${className}`, "aria-label": text, children: Array.from(text).map((ch, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: characters are positional wheels with no identity beyond their index
        _jsx("span", { className: /[0-9]/.test(ch) ? "d" : "s", children: ch }, i))) }));
}
/** Typewritten form-title strip riveted onto a housing, e.g. "FORM AT-7 · CONTRACT REQUISITION". */
export function FormLabel({ form, children }) {
    return (_jsxs("span", { className: "ui-formlabel", children: [form && _jsx("span", { className: "ui-formlabel-no", children: form }), _jsx("span", { className: "ui-formlabel-text", children: children })] }));
}
/** Facility colour chip (body + accent stripe), the HUD's stand-in for pixel-art icons. */
export function Swatch({ color, accent, size = 22 }) {
    return (_jsxs("span", { className: "ui-swatch", style: { width: size, height: size, background: color }, children: [_jsx("span", { style: { background: accent } }), _jsx("span", { style: { background: accent } }), _jsx("span", { style: { background: accent } })] }));
}
export function Row({ k, children }) {
    return (_jsxs("div", { className: "ui-row", children: [_jsx("span", { className: "ui-k", children: k }), _jsx("span", { className: "ui-v", children: children })] }));
}
const paths = {
    lock: (_jsxs(_Fragment, { children: [_jsx("rect", { x: "3", y: "7", width: "10", height: "7", rx: "1" }), _jsx("path", { d: "M5 7V5a3 3 0 0 1 6 0v2", fill: "none" })] })),
    close: _jsx("path", { d: "M4 4l8 8M12 4l-8 8", fill: "none" }),
    chevUp: _jsx("path", { d: "M4 10l4-4 4 4", fill: "none" }),
    chevDown: _jsx("path", { d: "M4 6l4 4 4-4", fill: "none" }),
    sound: (_jsxs(_Fragment, { children: [_jsx("path", { d: "M2 6h3l4-3v10l-4-3H2z" }), _jsx("path", { d: "M11 5.5a3.5 3.5 0 0 1 0 5M12.5 3.5a6 6 0 0 1 0 9", fill: "none" })] })),
    mute: (_jsxs(_Fragment, { children: [_jsx("path", { d: "M2 6h3l4-3v10l-4-3H2z" }), _jsx("path", { d: "M11 6l4 4M15 6l-4 4", fill: "none" })] })),
    pause: (_jsxs(_Fragment, { children: [_jsx("rect", { x: "4", y: "3", width: "3", height: "10" }), _jsx("rect", { x: "9", y: "3", width: "3", height: "10" })] })),
    play: _jsx("path", { d: "M5 3l8 5-8 5z" }),
    slab: (_jsxs(_Fragment, { children: [_jsx("rect", { x: "1", y: "9", width: "14", height: "3" }), _jsx("path", { d: "M3 9V5h10v4", fill: "none" })] })),
    bolt: _jsx("path", { d: "M9 1L3 9h4l-1 6 6-8H8z" }),
    drop: _jsx("path", { d: "M8 1.5C8 1.5 3 7 3 10a5 5 0 0 0 10 0c0-3-5-8.5-5-8.5z" }),
    leaf: _jsx("path", { d: "M13 3C6 3 3 6 3 10a5 5 0 0 0 1.5 3.6C5 10.5 7 8 10 6.5 8 8.5 6.8 10.8 6.5 13.5 11.5 12.5 13 8 13 3z" }),
    lift: (_jsxs(_Fragment, { children: [_jsx("rect", { x: "3", y: "1.5", width: "10", height: "13", fill: "none" }), _jsx("path", { d: "M8 4l2 2.5H6zM8 12l2-2.5H6z" })] })),
    demolish: _jsx("path", { d: "M2 14l6-6M7 3l6 6-2 2-6-6zM10 2l4 4", fill: "none" }),
    pointer: _jsx("path", { d: "M3 2l9 5-4 1.2L10.5 13 9 13.8 6.6 9 3 11z" }),
    star: _jsx("path", { d: "M8 1.5l1.9 4.1 4.5.5-3.4 3 1 4.4L8 11.3l-4 2.2 1-4.4-3.4-3 4.5-.5z" }),
};
export function Icon({ name, size = 14 }) {
    return (_jsx("svg", { className: "ui-icon", width: size, height: size, viewBox: "0 0 16 16", fill: "currentColor", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: paths[name] }));
}
/** Small "key" hint chip, e.g. <Kbd>H</Kbd>. */
export function Kbd({ children }) {
    return _jsx("kbd", { className: "ui-kbd", children: children });
}
