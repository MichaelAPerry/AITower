import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useId } from "react";
/** Oscilloscope trace on a graticule (10 × 4 divisions): faint fill, glowing phosphor line, bright last-point dot. */
export function Sparkline({ values, width = 200, height = 48, color, min, max, refLine }) {
    const id = useId();
    const grid = (_jsxs("g", { className: "ui-spark-grid", children: [Array.from({ length: 9 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static graticule lines; index is the identity
            _jsx("line", { x1: (width * (i + 1)) / 10, x2: (width * (i + 1)) / 10, y1: "0", y2: height, vectorEffect: "non-scaling-stroke" }, `v${i}`))), Array.from({ length: 3 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static graticule lines; index is the identity
            _jsx("line", { x1: "0", x2: width, y1: (height * (i + 1)) / 4, y2: (height * (i + 1)) / 4, vectorEffect: "non-scaling-stroke", className: i === 1 ? "axis" : "" }, `h${i}`)))] }));
    if (values.length < 2)
        return (_jsx("svg", { width: "100%", height: height, viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: "none", className: "ui-spark", "aria-hidden": "true", children: grid }));
    let lo = min ?? Math.min(...values);
    let hi = max ?? Math.max(...values);
    if (refLine !== undefined && min === undefined)
        lo = Math.min(lo, refLine);
    if (refLine !== undefined && max === undefined)
        hi = Math.max(hi, refLine);
    if (hi - lo < 1e-9) {
        hi += 1;
        lo -= 1;
    }
    const pad = 4;
    const x = (i) => pad + (i / (values.length - 1)) * (width - pad * 2);
    const y = (v) => pad + (1 - (v - lo) / (hi - lo)) * (height - pad * 2);
    let line = "";
    for (let i = 0; i < values.length; i++)
        line += `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(values[i]).toFixed(1)}`;
    const area = `${line}L${x(values.length - 1).toFixed(1)} ${height}L${x(0).toFixed(1)} ${height}Z`;
    const last = values[values.length - 1];
    return (_jsxs("svg", { width: "100%", height: height, viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: "none", className: "ui-spark", "aria-hidden": "true", children: [_jsx("defs", { children: _jsxs("linearGradient", { id: id, x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "0", stopColor: color, stopOpacity: "0.16" }), _jsx("stop", { offset: "1", stopColor: color, stopOpacity: "0" })] }) }), grid, refLine !== undefined && _jsx("line", { x1: "0", x2: width, y1: y(refLine), y2: y(refLine), stroke: "var(--red)", strokeDasharray: "4 3", strokeWidth: "1", opacity: "0.8", vectorEffect: "non-scaling-stroke" }), _jsx("path", { d: area, fill: `url(#${id})` }), _jsx("path", { d: line, fill: "none", stroke: color, strokeWidth: "3.5", opacity: "0.22", vectorEffect: "non-scaling-stroke", strokeLinejoin: "round" }), _jsx("path", { d: line, fill: "none", stroke: color, strokeWidth: "1.4", vectorEffect: "non-scaling-stroke", strokeLinejoin: "round", className: "ui-spark-trace" }), _jsx("circle", { cx: x(values.length - 1), cy: y(last), r: "2.2", fill: "var(--paper)", stroke: color, strokeWidth: "1", vectorEffect: "non-scaling-stroke" })] }));
}
/** Downsample to at most n points (keeps the last sample). */
export function downsample(values, n) {
    if (values.length <= n)
        return values;
    const out = [];
    const step = (values.length - 1) / (n - 1);
    for (let i = 0; i < n; i++)
        out.push(values[Math.round(i * step)]);
    return out;
}
