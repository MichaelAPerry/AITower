import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { focusables, nextFocusIndex } from "../menu/focus";
import { useSaves } from "../menu/useSaves";
import { closeInduction, restartInduction } from "../tutorial/Tutorial";
import { scenarioCards, showPicker, validScenario } from "./scenarios";
import { continueSummary, inductionDefault, startGame, titleItems } from "./titleState";
import "./title.css";
const LABEL = { continue: "CONTINUE", new: "NEW GAME", load: "LOAD GAME", settings: "SETTINGS", controls: "CONTROLS" };
/**
 * The title screen: the AITOWER nameplate and the menu. The game stays paused
 * until the player picks. Arrow keys and Enter drive it; Esc does nothing here.
 */
export function TitleScreen({ store, state, menuOpen, openMenu, onStart, content }) {
    const root = useRef(null);
    const { saves } = useSaves(store, state.saveStatus.lastSavedAt);
    const [induction, setInduction] = useState(null);
    const cards = content ? scenarioCards(content) : [];
    const [picked, setPicked] = useState(null);
    const scenarioId = content ? validScenario(content, picked) : undefined;
    const ticked = induction ?? (saves ? inductionDefault(saves, scenarioId) : true);
    const now = Date.now();
    // Hold the game paused behind the title.
    useEffect(() => {
        store.setSpeed(0);
    }, [store]);
    // Focus the first entry when the list appears and whenever the menu hands control back.
    // biome-ignore lint/correctness/useExhaustiveDependencies: only the arrival of the saves and the menu closing matter
    useEffect(() => {
        if (!saves || menuOpen || !root.current)
            return;
        focusables(root.current)[0]?.focus();
    }, [!!saves, menuOpen]);
    const items = saves ? titleItems(saves) : [];
    const auto = saves?.find((s) => s.id === "auto");
    const hooks = { restartInduction, closeInduction };
    const pick = (item) => {
        if (item === "continue") {
            startGame(store, { kind: "continue" }, hooks);
            onStart();
        }
        else if (item === "new") {
            startGame(store, { kind: "new", induction: ticked, scenarioId, crawl: true }, hooks);
            onStart({ newGame: true, run: !ticked });
        }
        else
            openMenu(item);
    };
    const onKeyDown = (e) => {
        e.stopPropagation();
        if (e.key === "Escape") {
            e.preventDefault();
            return;
        }
        if (!root.current)
            return;
        const dir = e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey) ? 1 : e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey) ? -1 : 0;
        if (!dir)
            return;
        e.preventDefault();
        const els = focusables(root.current);
        const i = nextFocusIndex(els.length, els.indexOf(document.activeElement), dir < 0);
        if (i >= 0)
            els[i].focus();
    };
    return (
    // biome-ignore lint/a11y/noStaticElementInteractions: full-screen modal; the key handler implements arrow navigation and the focus loop
    _jsxs("div", { className: "ui-title", ref: root, onKeyDown: onKeyDown, "data-menu-open": menuOpen || undefined, children: [_jsx("div", { className: "ui-title-sky", "aria-hidden": "true", children: _jsx("span", { className: "ui-title-sign", children: "COMPUTE AUTHORITY" }) }), _jsxs("div", { className: "ui-title-cabinet ui-panel", role: "dialog", "aria-modal": "true", "aria-label": "AItower title screen", children: [_jsxs("div", { className: "ui-title-plate", children: [_jsxs("span", { className: "ui-title-brand", children: ["AI", _jsx("b", { children: "TOWER" })] }), _jsx("span", { className: "ui-title-sub", children: "LICENSED AI COMPUTE OPERATOR" })] }), _jsxs("div", { className: "ui-crt crt-amber ui-title-crt", children: [!saves && _jsx("p", { className: "ui-title-wait", children: "LOADING SAVES\u2026" }), saves && (_jsx("ul", { className: "ui-title-menu", children: items.map((item) => (_jsxs("li", { children: [_jsxs("button", { type: "button", className: "ui-title-item", onClick: () => pick(item), children: [_jsx("span", { className: "ui-title-cursor", "aria-hidden": "true", children: "\u25B6" }), _jsx("span", { className: "ui-title-label", children: LABEL[item] }), item === "continue" && auto && _jsx("span", { className: "ui-title-detail", children: continueSummary(auto, now) }), item === "load" && _jsxs("span", { className: "ui-title-detail", children: [saves.length, " saved"] })] }), item === "new" && (_jsxs("label", { className: "ui-title-check", children: [_jsx("input", { type: "checkbox", checked: ticked, onChange: (e) => setInduction(e.currentTarget.checked), onKeyDown: (e) => {
                                                        if (e.key === "Enter") {
                                                            e.preventDefault();
                                                            setInduction(!ticked);
                                                        }
                                                    } }), _jsx("span", { children: "Tutorial" })] }))] }, item))) }))] }), showPicker(cards) && (_jsxs("fieldset", { className: "ui-title-sites", children: [_jsx("legend", { className: "ui-dymo", children: "CHOOSE A SITE" }), _jsx("div", { className: "ui-title-cards", role: "radiogroup", "aria-label": "Scenario", children: cards.map((c) => (
                                // biome-ignore lint/a11y/useSemanticElements: card-styled radio
                                _jsxs("button", { type: "button", role: "radio", "aria-checked": c.id === scenarioId, className: `ui-title-card ${c.id === scenarioId ? "is-on" : ""}`, "data-scenario": c.id, onClick: () => setPicked(c.id), children: [_jsxs("span", { className: "ui-title-card-head", children: [_jsx("b", { children: c.name }), c.sandbox && _jsx("span", { className: "ui-tag", children: "SANDBOX" }), _jsx("span", { className: "ui-title-card-facts", children: c.facts })] }), _jsx("span", { className: "ui-title-card-desc", children: c.description })] }, c.id))) })] })), _jsxs("div", { className: "ui-title-foot", children: [_jsx("span", { className: "ui-dymo", children: "ENTER OR CLICK TO PROCEED" }), saves && saves.length > 0 && (_jsx("button", { type: "button", className: "ui-btn", onClick: () => {
                                    startGame(store, { kind: "new", induction: true, crawl: true }, hooks);
                                    onStart({ newGame: true, run: false });
                                }, title: "Start a fresh site with the tutorial", children: "Restart tutorial" }))] })] })] }));
}
