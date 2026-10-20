import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
const MARGIN = 8;
/**
 * Where the spec card goes, in CSS px of the zoomed HUD (viewport numbers divided by `scale`): just right of the anchor,
 * its top level with the hovered row, clamped so it stays inside the viewport. Never left of the anchor, so it cannot
 * cover the palette, the dock or the hovered row.
 */
export function specCardPos(anchor, card, vw, vh, scale) {
    const w = card.w * scale;
    const h = card.h * scale;
    const left = Math.max(MARGIN, Math.min(anchor.right + MARGIN, vw - w - MARGIN));
    const top = Math.max(MARGIN, Math.min(anchor.rowTop, vh - h - MARGIN));
    return { left: left / scale, top: top / scale };
}
/** The anchor for a hovered element: the card sits right of `edge` (default: the element itself). */
export function anchorOf(row, edge) {
    const r = row.getBoundingClientRect();
    return { right: (edge ?? row).getBoundingClientRect().right, rowTop: r.top, rowBottom: r.bottom };
}
let hideTimer;
/**
 * A hover card whose clearing is delayed, so the pointer can travel from the row to a "More..." link on the card.
 * `hide()` clears after a beat unless `keep()` (the card was entered, or a new hover began) comes first.
 * Not a hook (the dock is rendered as a plain function in tests); only one hover card exists at a time.
 */
export const softHide = (clear) => ({
    hide: () => {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(clear, 250);
    },
    keep: () => clearTimeout(hideTimer),
});
export function SpecCard({ hover, scale, onMore, onEnter, onLeave }) {
    const ref = useRef(null);
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el)
            return;
        const { left, top } = specCardPos(hover.anchor, { w: el.offsetWidth, h: el.offsetHeight }, window.innerWidth, window.innerHeight, scale);
        el.style.left = `${left}px`;
        el.style.top = `${top}px`;
        el.style.visibility = "visible";
    }, [hover, scale]);
    // Portalled to the HUD root: panels have backdrop filters and scroll areas, which would make `fixed` relative to them and clip the card.
    const host = typeof document === "undefined" ? null : document.querySelector(".aitower-hud");
    if (!host)
        return null;
    return createPortal(_jsxs("div", { ref: ref, className: "ui-tooltip ui-speccard", role: "tooltip", style: { visibility: "hidden", ...(hover.entry ? { pointerEvents: "auto" } : {}) }, onMouseEnter: onEnter, onMouseLeave: onLeave, children: [_jsx("div", { className: "ui-tooltip-title", children: hover.title }), _jsx("p", { children: hover.body }), _jsx("div", { className: "ui-tooltip-specs", children: hover.specs.map(([k, v]) => (_jsxs("div", { className: "ui-row", children: [_jsx("span", { className: "ui-k", children: k }), _jsx("span", { className: "ui-v", children: v })] }, k))) }), hover.warn && _jsx("div", { className: "ui-tooltip-warn", children: hover.warn }), hover.entry && onMore && (_jsx("button", { type: "button", className: "ui-more-link", onClick: () => onMore(hover.entry), children: "More\u2026" }))] }), host);
}
