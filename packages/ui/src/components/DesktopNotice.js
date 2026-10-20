import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Stamp } from "./common";
/** "Best on desktop" memo for small screens. The checkbox turns the setting off for good; Dismiss hides it for this visit. */
export function DesktopNotice({ store, onDismiss }) {
    return (_jsxs("section", { className: "ui-desknotice", role: "note", "aria-label": "Best on desktop", children: [_jsxs("header", { className: "tut-head", children: [_jsx("span", { className: "ui-dymo", children: "NOTICE" }), _jsx(Stamp, { tone: "red", className: "ui-desknotice-stamp", children: "Notice" })] }), _jsx("h3", { className: "tut-title", children: "Best viewed on a desktop" }), _jsx("p", { className: "tut-body", children: "This console is built for a large screen and a mouse. On a window this small the panels crowd the tower. It still runs, but a desktop browser is recommended." }), _jsxs("label", { className: "ui-desknotice-check", children: [_jsx("input", { type: "checkbox", onChange: (e) => {
                            if (e.currentTarget.checked) {
                                store.setSettings({ showDesktopNotice: false });
                                onDismiss();
                            }
                        } }), _jsx("span", { children: "Don\u2019t show this again" })] }), _jsxs("footer", { className: "tut-actions", children: [_jsx("span", { className: "ui-grow" }), _jsx("button", { type: "button", className: "ui-btn is-on", onClick: onDismiss, children: "Understood" })] })] }));
}
