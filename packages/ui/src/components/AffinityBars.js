import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { PATH_COLOR, PATH_ORDER, sharePct } from "../ascension/ascension";
/** Three small bars: how far each ascension path leads, from what the player built, researched and chose. */
export function AffinityBars({ affinity, content, leading }) {
    const name = (id) => content.paths?.find((p) => p.id === id)?.name ?? id;
    return (_jsx("ul", { className: "ui-affinity", "aria-label": "Path affinity", children: PATH_ORDER.map((id) => (_jsxs("li", { className: leading === id ? "is-lead" : "", "data-path": id, children: [_jsx("span", { className: "ui-affinity-name", children: name(id) }), _jsx("span", { className: "ui-affinity-bar", role: "img", "aria-label": `${name(id)} affinity ${sharePct(affinity[id])}`, children: _jsx("i", { style: { width: sharePct(affinity[id]), background: PATH_COLOR[id] } }) }), _jsx("span", { className: "ui-affinity-pct", children: sharePct(affinity[id]) })] }, id))) }));
}
