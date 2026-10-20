import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Meter } from "../components/common";
import { fmtPct } from "../format";
import { pathGauge } from "./paths";
/** Top-strip gauge for the chosen path (green score or refinement), styled like the growth index. Nothing on other paths. */
export function PathGauge({ view, content }) {
    const g = pathGauge(view, content);
    if (!g)
        return null;
    return (_jsxs("div", { className: "ui-crt crt-green ui-growth ui-pathgauge", title: g.title, role: "status", "data-path-gauge": g.id, children: [_jsx("span", { className: "ui-label", children: g.label }), _jsx("span", { className: "ui-big", children: fmtPct(g.value, 0) }), _jsx(Meter, { value: g.value, tone: g.tone, height: 5 })] }));
}
