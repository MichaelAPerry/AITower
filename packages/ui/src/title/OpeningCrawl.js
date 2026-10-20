import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from "react";
import { CRAWL_FADE_S, CRAWL_LINES, crawlSeconds, isSkipKey, lineDelay } from "./crawl";
import "./crawl.css";
/**
 * The opening crawl, shown once over a freshly started game (which stays paused). Esc, Enter, Space, a click or the Skip
 * button end it. With reduced motion every line is shown at once and it waits for the player; otherwise it ends by itself.
 */
export function OpeningCrawl({ onDone, reduced }) {
    const root = useRef(null);
    const done = useRef(onDone);
    done.current = onDone;
    useEffect(() => {
        root.current?.focus();
        if (reduced)
            return;
        const h = setTimeout(() => done.current(), crawlSeconds() * 1000);
        return () => clearTimeout(h);
    }, [reduced]);
    const onKeyDown = (e) => {
        // Nothing typed here may reach the game hotkeys or the camera.
        e.stopPropagation();
        if (isSkipKey(e.key)) {
            e.preventDefault();
            onDone();
        }
    };
    return (_jsxs("div", { className: `ui-crawl ${reduced ? "is-still" : ""}`, ref: root, tabIndex: -1, role: "dialog", "aria-modal": "true", "aria-label": "Opening crawl", onKeyDown: onKeyDown, onClick: onDone, children: [_jsx("div", { className: "ui-crawl-text", children: CRAWL_LINES.map((line, i) => (_jsx("p", { className: "ui-crawl-line", style: reduced ? undefined : { animationDelay: `${lineDelay(i)}s`, animationDuration: `${CRAWL_FADE_S}s` }, children: line }, line))) }), _jsxs("button", { type: "button", className: "ui-btn ui-crawl-skip", onClick: (e) => {
                    e.stopPropagation();
                    onDone();
                }, children: [reduced ? "Begin" : "Skip", " ", _jsx("kbd", { children: "Esc" })] })] }));
}
