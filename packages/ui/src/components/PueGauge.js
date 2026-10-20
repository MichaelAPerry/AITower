import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { fmtPue } from "../format";
import { Dial } from "./Dial";
const MIN = 1;
const MAX = 2.5;
/** Phosphor colour for a PUE value: green → amber → red. */
export function pueColor(v) {
    if (v <= 1.35)
        return "var(--green)";
    if (v <= 1.75)
        return "var(--amber)";
    return "var(--red)";
}
const ZONES = [
    { from: 1, to: 1.35, color: "var(--green-dim)" },
    { from: 1.35, to: 1.75, color: "var(--amber)" },
    { from: 1.75, to: 2.5, color: "var(--red)" },
];
/** A needle gauge with a Dymo label and a CRT readout beside it. */
export function Gauge({ label, min, max, needles, zones, majors, minors, face, ends, title, children, sub, tone = "amber", }) {
    return (_jsxs("div", { className: "ui-gauge", title: title, children: [_jsx(Dial, { min: min, max: max, needles: needles, zones: zones, majors: majors, minors: minors, face: face, ends: ends, title: title }), _jsxs("div", { className: "ui-gauge-read", children: [_jsx("span", { className: "ui-dymo", children: label }), _jsxs("div", { className: `ui-crt crt-${tone} ui-gauge-crt`, children: [_jsx("span", { className: "ui-big", children: children }), sub !== undefined && _jsx("span", { className: "ui-gauge-sub", children: sub })] })] })] }));
}
/** PUE needle gauge, 1.0 (perfect) to 2.5, with a CRT readout. */
export function PueGauge({ pue }) {
    const tone = pue <= 1.35 ? "green" : pue <= 1.75 ? "amber" : "red";
    return (_jsx(Gauge, { label: "PUE", min: MIN, max: MAX, majors: 6, minors: 2, zones: ZONES, face: "PUE", ends: ["1", "2.5"], needles: [{ value: Number.isFinite(pue) ? pue : MIN }], title: "Power Usage Effectiveness (rolling 24h): total facility power \u00F7 IT power. 1.0 is perfect.", tone: tone, children: fmtPue(pue) }));
}
