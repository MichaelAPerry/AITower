import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../components/common";
import { restartInduction } from "../tutorial/Tutorial";
import { focusables, nextFocusIndex } from "./focus";
import { ControlsPane, LoadPane, NewGamePane, SavePane, SettingsPane } from "./panes";
import { useSaves } from "./useSaves";
import "./menu.css";
const DRAWERS = [
    { id: "save", label: "Save game", form: "SAVE", title: "Save game" },
    { id: "load", label: "Load game", form: "LOAD", title: "Load game" },
    { id: "settings", label: "Settings", form: "SETTINGS", title: "Settings" },
    { id: "controls", label: "Controls", form: "CONTROLS", title: "Controls · keys and mouse" },
    { id: "new", label: "New game", form: "NEW GAME", title: "New game" },
];
/**
 * The system menu: a bakelite filing cabinet. Modal: focus is trapped, Esc closes (restoring the game
 * speed), and key presses never reach the game's hotkeys or the camera while it is open.
 */
export function SystemMenu({ store, state, menu, initial = "save", fromTitle = false, onReplaced, onEncyclopedia }) {
    const [section, setSection] = useState(initial);
    const [flash, setFlash] = useState(null);
    const root = useRef(null);
    const resume = useRef(null);
    const { saves, error, reload } = useSaves(store, state.saveStatus.lastSavedAt);
    useEffect(() => {
        resume.current?.focus();
        // Pull stray focus back inside (clicks on the backdrop, programmatic focus elsewhere).
        const onFocusIn = (e) => {
            if (root.current && e.target instanceof Node && !root.current.contains(e.target))
                resume.current?.focus();
        };
        document.addEventListener("focusin", onFocusIn);
        return () => {
            document.removeEventListener("focusin", onFocusIn);
        };
    }, []);
    const onKeyDown = (e) => {
        // Nothing typed or pressed in the menu may reach the game hotkeys or the camera.
        e.stopPropagation();
        if (e.key === "Escape") {
            e.preventDefault();
            menu.close();
            return;
        }
        if (e.key === "Tab" && root.current) {
            const els = focusables(root.current);
            const i = nextFocusIndex(els.length, els.indexOf(document.activeElement), e.shiftKey);
            if (i >= 0) {
                e.preventDefault();
                els[i].focus();
            }
        }
    };
    const go = (id) => {
        setSection(id);
        setFlash(null);
    };
    const drawers = fromTitle ? DRAWERS.filter((d) => d.id === "load" || d.id === "settings" || d.id === "controls") : DRAWERS;
    const active = drawers.find((d) => d.id === section) ?? drawers[0];
    const common = { store, state, menu, flash: setFlash, onReplaced };
    return (
    // biome-ignore lint/a11y/noStaticElementInteractions: modal backdrop; key handling implements the focus trap
    _jsx("div", { className: `ui-menu-backdrop ${fromTitle ? "is-over-title" : ""}`, ref: root, onKeyDown: onKeyDown, onMouseDown: (e) => e.target === e.currentTarget && e.preventDefault(), children: _jsxs("div", { className: "ui-menu ui-panel", role: "dialog", "aria-modal": "true", "aria-label": "System menu", children: [_jsxs("header", { className: "ui-menu-head ui-panel-title", children: [_jsxs("span", { className: "ui-menu-plate", children: [_jsx("b", { children: "SYSTEM" }), _jsx("i", { children: "MENU" })] }), !fromTitle && _jsx("span", { className: "ui-dymo ui-menu-paused", children: "GAME PAUSED" }), _jsx("span", { className: "ui-grow" }), _jsx("button", { type: "button", className: "ui-btn ui-icon-btn", onClick: menu.close, "aria-label": "Close menu", title: "Close menu (Esc)", children: _jsx(Icon, { name: "close", size: 12 }) })] }), _jsxs("div", { className: "ui-menu-body", children: [_jsxs("nav", { className: "ui-menu-rail", "aria-label": "Menu sections", children: [_jsxs("button", { ref: resume, type: "button", className: "ui-btn is-go ui-resume", onClick: menu.close, children: [_jsx(Icon, { name: "play", size: 11 }), " ", fromTitle ? "Back" : "Resume"] }), drawers.map((d) => (_jsx("button", { type: "button", className: `ui-drawer ${section === d.id ? "is-open" : ""}`, "aria-current": section === d.id ? "page" : undefined, onClick: () => go(d.id), children: _jsx("span", { className: "ui-drawer-label", children: d.label }) }, d.id))), _jsx("span", { className: "ui-grow" }), !fromTitle && onEncyclopedia && (_jsx("button", { type: "button", className: "ui-btn ui-induct-btn", onClick: () => {
                                        menu.close();
                                        onEncyclopedia();
                                    }, title: "How everything works (K)", children: "Encyclopedia" })), !fromTitle && (_jsx("button", { type: "button", className: "ui-btn ui-induct-btn", onClick: () => {
                                        restartInduction();
                                        menu.close();
                                    }, title: "Reopen the tutorial", children: "Restart tutorial" }))] }), _jsxs("section", { className: "ui-menu-pane ui-form", "aria-label": active.label, children: [_jsxs("div", { className: "ui-form-head", children: [_jsx("span", { children: active.title }), _jsx("span", { children: active.form })] }), _jsxs("div", { className: "ui-menu-scroll", children: [error && section !== "controls" && section !== "settings" && _jsxs("div", { className: "ui-menu-note is-error", children: ["Could not read saves: ", error] }), section === "save" && _jsx(SavePane, { ...common, saves: saves, reload: reload }), section === "load" && _jsx(LoadPane, { ...common, saves: saves, reload: reload }), section === "settings" && _jsx(SettingsPane, { ...common }), section === "controls" && _jsx(ControlsPane, {}), section === "new" && _jsx(NewGamePane, { ...common })] }), _jsx("div", { className: `ui-menu-note ${flash ? `is-${flash.tone}` : "is-idle"}`, role: "status", "aria-live": "polite", children: flash?.text ?? " " })] })] })] }) }));
}
