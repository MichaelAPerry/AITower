import { Children, isValidElement } from "react";
/** Every element in the tree (depth first) that satisfies `pred`. Function components are not expanded. */
export function findAll(node, pred, out = []) {
    for (const child of Children.toArray(node)) {
        if (!isValidElement(child))
            continue;
        const el = child;
        if (pred(el))
            out.push(el);
        findAll(el.props.children, pred, out);
    }
    return out;
}
/** The text content of the tree, joined with spaces (string and number children only). */
export function textOf(node) {
    const parts = [];
    const walk = (n) => {
        for (const c of Children.toArray(n)) {
            if (typeof c === "string" || typeof c === "number")
                parts.push(String(c));
            else if (isValidElement(c))
                walk(c.props.children);
        }
    };
    walk(node);
    return parts.join(" ").replace(/\s+/g, " ").trim();
}
export const hasText = (el, re) => re.test(textOf(el.props.children));
/** A button-like element (native button, or a component with `onClick`) whose own text or title matches. */
export function findButton(node, re) {
    const hit = findAll(node, (el) => typeof el.props.onClick === "function" && (hasText(el, re) || re.test(String(el.props.title ?? "")) || re.test(String(el.props.label ?? "")) || re.test(String(el.props.rest ?? ""))))[0];
    if (!hit)
        throw new Error(`no control matching ${re}`);
    return hit;
}
export const click = (el) => el.props.onClick();
export function panelProps(store, content, over = {}) {
    const ui = { drawer: null, paletteOpen: false, focusJobId: null, alertsSeenTick: -1, paletteTab: "structure", inboxOpen: false, financeTab: "ledger", stamped: [], aside: [], ...over.ui };
    return { store, content, state: store.get(), ui, setUi: over.setUi ?? (() => { }), openMenu: () => { }, openResearch: over.openResearch ?? (() => { }), openAscension: over.openAscension ?? (() => { }), openAudit: over.openAudit ?? (() => { }) };
}
