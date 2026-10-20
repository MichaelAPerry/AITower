import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Meter } from "../components/common";
import { fmtPct } from "../format";
import { bioWords, growthTitle, showGrowthGauge } from "./bio";
/**
 * Top-bar "ASSET GROWTH INDEX" (plain "CONTAMINATION" at horror off): a small CRT with the corruption as a percentage
 * and a meter. Appears once corruption is above zero or from Clearance 3 on.
 */
export function GrowthIndex({ view, horror }) {
    if (!showGrowthGauge(view))
        return null;
    const c = view.corruption ?? 0;
    const tone = c >= 0.75 ? "error" : c >= 0.4 ? "warn" : "cyan";
    return (_jsxs("div", { className: `ui-crt crt-${c >= 0.75 ? "red" : "amber"} ui-growth`, title: growthTitle(view, horror), role: "status", children: [_jsx("span", { className: "ui-label", children: bioWords(horror).gauge }), _jsx("span", { className: "ui-big", children: fmtPct(c, 0) }), _jsx(Meter, { value: c, tone: tone, height: 5 })] }));
}
