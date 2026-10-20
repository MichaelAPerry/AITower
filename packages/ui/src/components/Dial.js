import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useId } from "react";
const C = 32;
const SWEEP = 240;
/** Angle in degrees (0 = straight up, clockwise positive) for a value. Pegs slightly past each end. */
export function dialAngle(v, min, max) {
    const t0 = (v - min) / (max - min || 1);
    const t = Number.isFinite(t0) ? Math.min(1.035, Math.max(-0.035, t0)) : 0;
    return -SWEEP / 2 + SWEEP * t;
}
function polar(deg, r) {
    const a = ((deg - 90) * Math.PI) / 180;
    return [C + r * Math.cos(a), C + r * Math.sin(a)];
}
function arcPath(d0, d1, r) {
    const [x0, y0] = polar(d0, r);
    const [x1, y1] = polar(d1, r);
    const large = d1 - d0 > 180 ? 1 : 0;
    return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}
/**
 * Analog panel gauge: brass bezel, cream face, black ticks, red needle.
 * Needles rotate with a CSS transition whose easing overshoots slightly (see `.ui-dial-needle`).
 */
export function Dial({ min, max, needles, size = 56, zones = [], majors = 4, minors = 4, face, ends, title }) {
    const id = useId();
    const ticks = [];
    const n = majors * minors;
    for (let i = 0; i <= n; i++)
        ticks.push({ a: -SWEEP / 2 + (SWEEP * i) / n, major: i % minors === 0 });
    const zoneAngle = (v) => Math.max(-SWEEP / 2, Math.min(SWEEP / 2, dialAngle(v, min, max)));
    return (_jsxs("svg", { className: "ui-dial", width: size, height: size, viewBox: "0 0 64 64", role: "img", "aria-label": title, children: [title && _jsx("title", { children: title }), _jsxs("defs", { children: [_jsxs("linearGradient", { id: `${id}b`, x1: "0", y1: "0", x2: "1", y2: "1", children: [_jsx("stop", { offset: "0", stopColor: "var(--paper)" }), _jsx("stop", { offset: "0.25", stopColor: "var(--brass)" }), _jsx("stop", { offset: "0.7", stopColor: "var(--brass-dk)" }), _jsx("stop", { offset: "1", stopColor: "var(--brass)" })] }), _jsxs("radialGradient", { id: `${id}f`, cx: "0.45", cy: "0.4", r: "0.65", children: [_jsx("stop", { offset: "0.55", stopColor: "var(--paper)" }), _jsx("stop", { offset: "1", stopColor: "var(--beige)" })] })] }), _jsx("circle", { cx: C, cy: C, r: "31.5", fill: "var(--ink)" }), _jsx("circle", { cx: C, cy: C, r: "30.5", fill: `url(#${id}b)` }), _jsx("circle", { cx: C, cy: C, r: "27", fill: "var(--brass-dk)" }), _jsx("circle", { cx: C, cy: C, r: "26.2", fill: `url(#${id}f)` }), zones.map((z) => (_jsx("path", { d: arcPath(zoneAngle(z.from), zoneAngle(z.to), 21.6), stroke: z.color, strokeWidth: "3.2", fill: "none" }, `${z.from}-${z.to}`))), ticks.map((t) => {
                const [x0, y0] = polar(t.a, 24.6);
                const [x1, y1] = polar(t.a, t.major ? 19.4 : 22.2);
                return _jsx("line", { x1: x0, y1: y0, x2: x1, y2: y1, stroke: "var(--ink)", strokeWidth: t.major ? 1.5 : 0.7 }, t.a);
            }), face && (_jsx("text", { x: C, y: C + 13, className: "ui-dial-face", textAnchor: "middle", children: face })), ends && (_jsxs(_Fragment, { children: [_jsx("text", { x: polar(-SWEEP / 2, 15)[0] + 1, y: polar(-SWEEP / 2, 15)[1] + 1, className: "ui-dial-end", textAnchor: "middle", children: ends[0] }), _jsx("text", { x: polar(SWEEP / 2, 15)[0] - 1, y: polar(SWEEP / 2, 15)[1] + 1, className: "ui-dial-end", textAnchor: "middle", children: ends[1] })] })), [...needles].reverse().map((nd, i) => (_jsx("g", { className: `ui-dial-needle n-${nd.kind ?? "red"}`, style: { transform: `rotate(${dialAngle(nd.value, min, max).toFixed(2)}deg)`, transformOrigin: `${C}px ${C}px` }, children: nd.kind === "ink" ? (_jsx("path", { d: `M${C - 1.1} ${C + 3} L${C} ${C - 19} L${C + 1.1} ${C + 3} Z`, fill: "var(--ink)" })) : (_jsx("path", { d: `M${C - 1.6} ${C + 6} L${C - 0.5} ${C - 23} L${C + 0.5} ${C - 23} L${C + 1.6} ${C + 6} Z`, fill: "var(--red)", stroke: "var(--ink)", strokeWidth: "0.4" })) }, i))), _jsx("circle", { cx: C, cy: C, r: "3.4", fill: "var(--brass)", stroke: "var(--ink)", strokeWidth: "0.8" }), _jsx("circle", { cx: C - 0.8, cy: C - 0.8, r: "1", fill: "var(--paper)", opacity: "0.7" }), _jsx("path", { d: "M12 22 A22 22 0 0 1 34 8", stroke: "var(--paper)", strokeWidth: "3", fill: "none", opacity: "0.28", strokeLinecap: "round" })] }));
}
/** Round "nice" scale maximum (1, 2, 2.5, 5 × 10ⁿ) at or above v. */
export function niceMax(v) {
    const a = Math.abs(v);
    if (!Number.isFinite(a) || a <= 0)
        return 1;
    const p = 10 ** Math.floor(Math.log10(a));
    for (const m of [1, 2, 2.5, 5, 10])
        if (a <= m * p)
            return m * p;
    return 10 * p;
}
