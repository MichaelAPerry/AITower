import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { helpFor } from "./helpText";
import { tipDelay, tipPos } from "./placement";
import "./help.css";
const HIDE_MS = 220;
/**
 * The help tooltip. Elements opt in with `data-help="<key>"`. In help mode a hover shows the card at once, with a
 * "More..." link into the Encyclopedia; outside help mode only the top-strip stats show it, after a short delay.
 */
export function HelpLayer({ ui, setUi, scale }) {
    const [tip, setTip] = useState(null);
    const helpOn = !!ui.help;
    const helpRef = useRef(helpOn);
    helpRef.current = helpOn;
    const timer = useRef(undefined);
    const overCard = useRef(false);
    const cardRef = useRef(null);
    const hideSoon = useCallback(() => {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
            if (!overCard.current)
                setTip(null);
        }, HIDE_MS);
    }, []);
    useEffect(() => {
        const onOver = (e) => {
            const t = e.target;
            if (!(t instanceof Element))
                return;
            if (t.closest(".ui-helpcard"))
                return;
            const el = t.closest("[data-help]");
            const item = el ? helpFor(el.getAttribute("data-help") ?? "") : null;
            if (!el || !item || !el.closest(".aitower-hud")) {
                hideSoon();
                return;
            }
            const inStrip = !!el.closest(".ui-strip");
            if (!helpRef.current && !inStrip) {
                hideSoon();
                return;
            }
            clearTimeout(timer.current);
            const r = el.getBoundingClientRect();
            const show = () => setTip({ item, rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom } });
            const d = tipDelay(helpRef.current);
            if (d === 0)
                show();
            else
                timer.current = setTimeout(show, d);
        };
        document.addEventListener("mouseover", onOver);
        return () => {
            document.removeEventListener("mouseover", onOver);
            clearTimeout(timer.current);
        };
    }, [hideSoon]);
    // Leaving help mode drops any open card that offered the link.
    useEffect(() => {
        if (!helpOn)
            setTip(null);
    }, [helpOn]);
    const host = typeof document === "undefined" ? null : document.querySelector(".aitower-hud");
    if (!tip || !host)
        return null;
    const pos = tipPos(tip.rect, { w: 260, h: cardRef.current?.offsetHeight ?? 90 }, window.innerWidth, window.innerHeight, scale);
    return createPortal(_jsxs("div", { ref: cardRef, className: "ui-helpcard", role: "tooltip", style: { left: pos.left, top: pos.top }, onMouseEnter: () => {
            overCard.current = true;
            clearTimeout(timer.current);
        }, onMouseLeave: () => {
            overCard.current = false;
            hideSoon();
        }, children: [_jsx("b", { children: tip.item.title }), _jsx("p", { children: tip.item.text }), helpOn && (_jsx("button", { type: "button", onClick: () => {
                    setUi({ drawer: "encyclopedia", encyId: tip.item.entry, paletteOpen: false });
                    setTip(null);
                }, children: "More\u2026" }))] }), host);
}
