import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from "react";
import { Icon, Pill, Stamp } from "../components/common";
import { focusables, nextFocusIndex } from "../menu/focus";
import { StampBtn } from "../menu/parts";
import { pushNotice } from "../notices";
import { BRANCHES, branchLabel, branchNodes, effectText, fmtRp, nodeState, requirementList, techList, unlocksFor } from "./tech";
export function TechCard({ node, view, content, store }) {
    const st = nodeState(node, view, content);
    const unlocks = unlocksFor(node.id, content);
    const reqs = requirementList(node, view, content);
    const file = () => {
        const r = store.dispatch({ type: "research", techId: node.id });
        if (!r.ok)
            pushNotice({ text: r.reason, severity: "warn", key: `res:${r.reason}` });
    };
    return (_jsxs("li", { className: `ui-tech is-${st.kind}`, "data-tech": node.id, children: [_jsxs("header", { className: "ui-tech-head", children: [_jsx("span", { className: "ui-tech-name", children: node.name }), _jsxs("span", { className: "ui-tech-cost", title: `${node.cost} research points`, children: [node.cost, " RP"] })] }), _jsxs("div", { className: "ui-tech-meta", children: [_jsx(Pill, { tone: "dim", children: branchLabel(node.branch) }), node.minTier > 1 && _jsxs("span", { className: "ui-tech-tier", children: ["Level ", node.minTier] })] }), node.effects.length > 0 && (_jsx("ul", { className: "ui-tech-fx", children: node.effects.map((e) => (_jsx("li", { children: effectText(e, content) }, effectText(e, content)))) })), unlocks.length > 0 && (_jsxs("p", { className: "ui-tech-unlocks", children: [_jsx("b", { children: "Unlocks:" }), " ", unlocks.join(", ")] })), reqs.length > 0 && (_jsxs("p", { className: "ui-tech-reqs", children: [_jsx("b", { children: "Needs:" }), " ", reqs.map((r, i) => (_jsxs("span", { className: r.done ? "is-done" : "is-missing", children: [i > 0 ? ", " : "", r.done ? "✓ " : "", r.name] }, r.id)))] })), node.description && _jsx("p", { className: "ui-tech-desc", children: node.description }), _jsxs("footer", { className: "ui-tech-foot", children: [st.kind === "researched" && (_jsx(Stamp, { tone: "green", className: "ui-tech-filed", children: "Researched" })), st.kind === "available" && _jsx(StampBtn, { tone: "green", rest: "Research", hot: "Started", onClick: file, title: `Start research: spend ${node.cost} RP on ${node.name}` }), st.kind === "poor" && (_jsxs("span", { className: "ui-tech-state is-poor", title: `${node.name} costs ${node.cost} RP; you are ${st.short} short`, children: ["Need ", st.short, " more RP"] })), st.kind === "locked" && (_jsxs("span", { className: "ui-tech-state is-locked", title: st.reason, children: [_jsx(Icon, { name: "lock", size: 10 }), st.reason] }))] })] }));
}
/**
 * DEPARTMENT OF RESEARCH: a full-screen sheet with one column per branch and an index card per node.
 * The game is paused while it is open (the Hud does that); R or Esc closes it.
 */
export function ResearchSheet({ store, content, view, onClose }) {
    const root = useRef(null);
    useEffect(() => {
        const els = root.current ? focusables(root.current) : [];
        (els.find((e) => e.closest(".ui-tech.is-available")) ?? els[0])?.focus();
    }, []);
    const onKeyDown = (e) => {
        // Nothing typed in the sheet may reach the game hotkeys or the camera.
        e.stopPropagation();
        if (e.key === "Escape" || ((e.key === "r" || e.key === "R") && !e.ctrlKey && !e.metaKey && !e.altKey)) {
            e.preventDefault();
            onClose();
            return;
        }
        if (e.key !== "Tab" || !root.current)
            return;
        const els = focusables(root.current);
        const i = nextFocusIndex(els.length, els.indexOf(document.activeElement), e.shiftKey);
        if (i >= 0) {
            e.preventDefault();
            els[i].focus();
        }
    };
    const empty = techList(content).length === 0;
    return (
    // biome-ignore lint/a11y/noStaticElementInteractions: modal sheet; the key handler implements Esc, R and the focus loop
    _jsx("div", { className: "ui-research-backdrop", ref: root, onKeyDown: onKeyDown, children: _jsxs("section", { className: "ui-research", role: "dialog", "aria-modal": "true", "aria-labelledby": "research-title", children: [_jsxs("header", { className: "ui-research-head", children: [_jsxs("div", { className: "ui-research-titles", children: [_jsx("span", { className: "ui-research-form", children: "RESEARCH QUEUE" }), _jsx("h2", { id: "research-title", children: "DEPARTMENT OF RESEARCH" })] }), _jsxs("div", { className: "ui-research-rp ui-crt crt-amber", title: "Unspent research points. Delivering compute and finishing jobs earns them.", children: [_jsx("span", { className: "ui-label", children: "POINTS" }), _jsx("span", { className: "ui-big", children: fmtRp(view.researchPoints ?? 0) })] }), _jsx("span", { className: "ui-research-pause", children: "GAME PAUSED" }), _jsx("button", { type: "button", className: "ui-btn ui-research-close", onClick: onClose, title: "Close the Department of Research (R or Esc)", children: "Close" })] }), empty ? (_jsx("p", { className: "ui-empty ui-pad", children: "No research started yet." })) : (_jsx("div", { className: "ui-research-cols", children: BRANCHES.map((b) => (_jsxs("div", { className: "ui-research-col", children: [_jsx("h3", { className: "ui-research-branch", children: b.label }), _jsx("ul", { className: "ui-research-list", children: branchNodes(content, b.id).map((n) => (_jsx(TechCard, { node: n, view: view, content: content, store: store }, n.id))) })] }, b.id))) }))] }) }));
}
