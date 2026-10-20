import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { bioWords } from "../bio/bio";
import { heatRamp } from "../settings";
import { Icon, Lamp } from "./common";
const COLLAPSED_KEY = "aitower.overlay.collapsed";
const readCollapsed = () => {
    try {
        return localStorage.getItem(COLLAPSED_KEY) === "1";
    }
    catch {
        return false;
    }
};
const writeCollapsed = (v) => {
    try {
        localStorage.setItem(COLLAPSED_KEY, v ? "1" : "0");
    }
    catch {
        /* best effort */
    }
};
export const MODES = [
    { id: "normal", label: "Normal", key: "N" },
    { id: "heat", label: "Heat", key: "H" },
    { id: "power", label: "Power", key: "P" },
    { id: "coolant", label: "Coolant", key: "C" },
    { id: "nutrient", label: "Nutrient", key: "U" },
    { id: "contamination", label: "Growth", key: "G" },
];
/** Button label and tooltip of an overlay: the contamination overlay is "Growth" (Compute Authority wording) unless horror is off. */
export function overlayLabel(m, horror) {
    if (m.id === "contamination") {
        const w = bioWords(horror);
        return { label: w.overlayButton, title: `${horror === "off" ? "Contamination" : "Asset growth"} overlay (${m.key})` };
    }
    return { label: m.label, title: `${m.label} overlay (${m.key})` };
}
function Legend({ mode, colorBlind, horror }) {
    if (mode === "heat") {
        const ramp = heatRamp(colorBlind);
        const lo = ramp[0][0];
        const hi = ramp[ramp.length - 1][0];
        const pct = (c) => ((c - lo) / (hi - lo)) * 100;
        const grad = `linear-gradient(90deg, ${ramp.map(([c, col]) => `${col} ${pct(c).toFixed(1)}%`).join(", ")})`;
        return (_jsxs("div", { className: "ui-legend ui-crt crt-amber", title: "Heat overlay: air temperature per cell", children: [_jsx("div", { className: "ui-legend-bar", style: { background: grad } }), _jsx("div", { className: "ui-legend-ticks", children: ramp.map(([c], i) => (_jsxs("span", { style: { left: `${pct(c)}%` }, children: [i === 0 ? "≤" : i === ramp.length - 1 ? "≥" : "", c, "\u00B0"] }, c))) })] }));
    }
    if (mode === "power")
        return (_jsxs("div", { className: "ui-legend ui-crt crt-amber", children: [_jsx("div", { className: "ui-legend-bar sat" }), _jsxs("div", { className: "ui-legend-ticks", children: [_jsx("span", { style: { left: 0 }, children: "0%" }), _jsx("span", { style: { left: "50%" }, children: "supplied" }), _jsx("span", { style: { left: "100%" }, children: "100%" })] })] }));
    if (mode === "coolant")
        return (_jsxs("div", { className: "ui-legend ui-crt crt-amber", children: [_jsx("div", { className: "ui-legend-bar load" }), _jsxs("div", { className: "ui-legend-ticks", children: [_jsx("span", { style: { left: 0 }, children: "0%" }), _jsx("span", { style: { left: "80%" }, children: "80%" }), _jsx("span", { style: { left: "100%" }, children: "\u2265100" })] })] }));
    if (mode === "nutrient")
        return (_jsxs("div", { className: "ui-legend ui-crt crt-amber", title: "Nutrient overlay: lines coloured by how much of their demand the plants supply", children: [_jsx("div", { className: "ui-legend-bar nutrient" }), _jsxs("div", { className: "ui-legend-ticks", children: [_jsx("span", { style: { left: 0 }, children: "0%" }), _jsx("span", { style: { left: "50%" }, children: "supplied" }), _jsx("span", { style: { left: "100%" }, children: "100%" })] })] }));
    if (mode === "contamination")
        return (_jsxs("div", { className: "ui-legend ui-crt crt-amber", title: bioWords(horror).overlayLegend, children: [_jsx("div", { className: "ui-legend-bar contam" }), _jsxs("div", { className: "ui-legend-ticks", children: [_jsx("span", { style: { left: 0 }, children: "0" }), _jsx("span", { style: { left: "50%" }, children: "0.5" }), _jsx("span", { style: { left: "100%" }, children: "1" })] })] }));
    return null;
}
export function OverlaySwitcher({ store, state, embedded = false }) {
    const [collapsed, setCollapsed] = useState(readCollapsed);
    const toggle = () => {
        writeCollapsed(!collapsed);
        setCollapsed(!collapsed);
    };
    const horror = state.settings.horrorIntensity;
    const cur = MODES.find((m) => m.id === state.overlay) ?? MODES[0];
    return (_jsxs("div", { className: `ui-overlay ${embedded ? "is-embedded" : `ui-panel ${collapsed ? "is-collapsed" : ""}`}`, children: [!embedded && (_jsxs("button", { type: "button", className: "ui-overlay-fold", onClick: toggle, "aria-expanded": !collapsed, title: collapsed ? "Show the overlay switcher" : "Fold the overlay switcher away", children: [_jsx(Icon, { name: collapsed ? "chevDown" : "chevUp", size: 11 }), _jsx("span", { className: "ui-dymo ui-overlay-title", children: "OVERLAY" }), collapsed && (_jsxs("span", { className: "ui-overlay-cur", children: [_jsx(Lamp, { on: state.overlay !== "normal", tone: "amber", plain: true }), overlayLabel(cur, horror).label] }))] })), (embedded || !collapsed) && (_jsx("div", { className: "ui-seg", role: "radiogroup", "aria-label": "Overlay", children: MODES.map((m) => (
                // biome-ignore lint/a11y/useSemanticElements: styled button group acts as a radio group; native radio inputs would change the markup and CSS
                _jsxs("button", { type: "button", "data-tut": `overlay-${m.id}`, role: "radio", "aria-checked": state.overlay === m.id, className: `ui-btn ui-ov ov-${m.id} ${state.overlay === m.id ? "is-on" : ""}`, onClick: () => store.setOverlay(m.id), title: overlayLabel(m, horror).title, children: [_jsx("b", { children: m.key }), overlayLabel(m, horror).label] }, m.id))) })), state.overlay !== "normal" && (embedded || !collapsed) && _jsx(Legend, { mode: state.overlay, colorBlind: state.settings.colorBlind, horror: horror })] }));
}
