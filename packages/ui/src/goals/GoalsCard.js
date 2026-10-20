import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { pushNotice } from "../notices";
import { goalLadder, newlyDone, visibleGoals } from "./goals";
import "./goals.css";
const KEY = "aitower.goals.collapsed";
const FLASH_MS = 3500;
const readCollapsed = () => {
    try {
        return localStorage.getItem(KEY) === "1";
    }
    catch {
        return false;
    }
};
/** The always-visible "what now" card: the next 1 to 3 goals with progress. Replaces NEXT as the main guide. */
export function GoalsCard({ state, content }) {
    const ladder = goalLadder(state.view, content);
    // Goals already done when the card first appears (a loaded game) are latched silently: no toast, no tick.
    const latched = useRef(null);
    if (latched.current === null)
        latched.current = new Set(ladder.filter((g) => g.done).map((g) => g.id));
    const [flash, setFlash] = useState([]);
    const [collapsed, setCollapsed] = useState(readCollapsed);
    useEffect(() => {
        const fresh = newlyDone(ladder, latched.current);
        if (fresh.length === 0)
            return;
        for (const g of fresh) {
            latched.current.add(g.id);
            pushNotice({ text: `Goal done: ${g.title}`, severity: "good", key: `goal:${g.id}` });
        }
        setFlash((f) => [...f, ...fresh]);
        const t = setTimeout(() => setFlash((f) => f.filter((g) => !fresh.includes(g))), FLASH_MS);
        return () => clearTimeout(t);
    });
    const goals = visibleGoals(ladder, latched.current);
    if (goals.length === 0 && flash.length === 0)
        return null;
    const toggle = () => {
        const v = !collapsed;
        setCollapsed(v);
        try {
            localStorage.setItem(KEY, v ? "1" : "0");
        }
        catch {
            /* best effort */
        }
    };
    const main = goals[0];
    return (_jsxs("section", { className: `ui-goals ${collapsed ? "is-collapsed" : ""}`, "data-tut": "goals", "data-help": "goals", "aria-label": "Goals", children: [_jsxs("button", { type: "button", className: "ui-goals-head", onClick: toggle, "aria-expanded": !collapsed, title: collapsed ? "Show goals" : "Hide goals", children: [_jsx("span", { className: "ui-label", children: "GOALS" }), collapsed && main && _jsx("span", { className: "ui-goals-peek", children: main.title }), _jsx("span", { className: "ui-goals-chev", "aria-hidden": "true", children: collapsed ? "▸" : "▾" })] }), !collapsed && (_jsxs("ul", { className: "ui-goals-list", children: [flash.map((g) => (_jsx("li", { className: "ui-goal is-done", children: _jsxs("span", { className: "ui-goal-title", children: [_jsx("span", { className: "ui-goal-tick", "aria-hidden": "true", children: "\u2713" }), g.title] }) }, g.id))), goals.map((g, i) => (_jsxs("li", { className: `ui-goal ${i === 0 ? "is-main" : ""}`, "data-goal": g.id, children: [_jsx("span", { className: "ui-goal-title", children: g.title }), _jsx("span", { className: "ui-goal-num", children: g.progress }), _jsx("span", { className: "ui-goal-bar", role: "progressbar", tabIndex: -1, "aria-valuemin": 0, "aria-valuemax": g.need, "aria-valuenow": Math.round(g.have), "aria-label": g.title, children: _jsx("i", { style: { width: `${Math.round((g.have / g.need) * 100)}%` } }) })] }, g.id)))] }))] }));
}
