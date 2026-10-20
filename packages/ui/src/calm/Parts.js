import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { isSerious, AlertsLog, ContractsDrawer, ResearchDrawer, Telemetry } from "./Panels";
import { FinanceTab } from "../finance/FinanceTab";
import { OverlaySwitcher } from "../components/OverlaySwitcher";
import { fmtMoney, fmtPct, fmtPower, fmtPue, fmtTemp } from "../format";
import { AutomationDrawer } from "../automation/AutomationDrawer";
import { ModifierChips } from "../memo/MemoDesk";
import { pushNotice } from "../notices";
import { currentObjective, endingLine, isProblem } from "../objective/objective";
import { toolKey } from "../tools/controller";
import { BuildPalette, defSpecs } from "../components/BuildPalette";
import { SpecCard, anchorOf, softHide } from "../components/SpecCard";
import { facilityEntryId } from "../encyclopedia/entries";
import { EncyclopediaDrawer } from "../encyclopedia/EncyclopediaDrawer";
import { AffinityBars } from "../components/AffinityBars";
import { leadingPath } from "../ascension/ascension";
import { hudScale } from "../settings";
import { DRAWER_TABS, dockPicks, feedLines, isRoutine, nextDrawer } from "./calm";
import { Icon, Swatch } from "../components/common";
/** NEXT: one line from the current objective, with the key to press. The detail is its tooltip. */
export function NextChip({ store, content, state, ui, setUi, openAscension }) {
    const obj = currentObjective(state.view, content, (cmd) => store.canBuild(cmd), ui.pathFiled ?? null);
    const ending = endingLine(state.view, content);
    // NEXT is for problems; the Goals card is the everyday guide.
    if (!isProblem(obj) && !ending)
        return null;
    const go = () => {
        if (obj.action === "ascension")
            openAscension();
        else if (obj.key === "C")
            setUi({ drawer: "contracts" });
        else if (obj.key === "R")
            setUi({ drawer: "research" });
    };
    return (_jsxs("section", { className: `ui-next tone-${isProblem(obj) ? obj.tone : "progress"}`, "aria-live": "polite", "aria-label": "Next step", "data-help": "next", children: [isProblem(obj) && (_jsxs("button", { type: "button", className: "ui-next-btn", onClick: go, title: obj.detail, children: [_jsx("span", { className: "ui-tag", children: "NEXT" }), _jsx("span", { className: "ui-next-title", children: obj.title }), obj.key && _jsx("span", { className: "ui-tag is-key", children: obj.key }), obj.action === "ascension" && _jsx("span", { className: "ui-tag is-key", children: "ASCENSION" })] })), ending && (_jsx("span", { className: "ui-next-ending", title: "Days the ending condition has held without a break", children: ending }))] }));
}
/** One line at the bottom of the world: the latest events that need a person, a count, and a click into the log. */
export function Ticker({ content, state, ui, setUi }) {
    const { view } = state;
    const items = feedLines(state.log.slice(-300), view, content, state.settings.horrorIntensity, (ev) => !isRoutine(ev, view)).slice(-3);
    const unseen = state.log.filter((e) => e.tick > ui.alertsSeenTick && isSerious(e.event) && !isRoutine(e.event, view)).length;
    const glyph = { good: "✓", info: "·", warn: "▲", error: "✕" };
    return (_jsxs("button", { type: "button", className: "ui-ticker", onClick: () => setUi({ drawer: ui.drawer === "log" ? null : "log" }), title: "Open the alert log", "aria-live": "polite", children: [_jsx("span", { className: `ui-tag ${unseen ? "is-alert" : ""}`, children: unseen || "LOG" }), items.length === 0 && _jsx("span", { className: "ui-dim", children: "All quiet" }), items.map((l) => (_jsxs("span", { className: `ui-tk sev-${l.severity}`, children: [glyph[l.severity], " ", l.text] }, l.key)))] }));
}
/** Bottom-left dock: the 3 most useful builds for now (glowing when affordable) and More, which opens the full palette. */
export function BuildDock({ store, content, state, ui, setUi }) {
    const { view, tool } = state;
    const picks = dockPicks(view, content);
    const hover = ui.dockHover ?? null;
    const setHover = (h) => setUi({ dockHover: h });
    const soft = softHide(() => setHover(null));
    const cost = (p) => (p.kind === "parts" ? content.structure.sparePart * 5 : content.facilities[p.defId].cost);
    const run = (p) => {
        if (cost(p) > view.cash) {
            pushNotice({ text: `Need ${fmtMoney(cost(p) - view.cash)} more`, severity: "warn", key: "dock-poor" });
            return;
        }
        if (p.kind === "parts") {
            const r = store.dispatch({ type: "buyParts", count: 5 });
            if (!r.ok)
                pushNotice({ text: r.reason, severity: "warn", key: `buy:${r.reason}` });
            return;
        }
        const t = { kind: "place", defId: p.defId };
        store.setGhost(null);
        store.setTool(toolKey(tool) === toolKey(t) ? { kind: "select" } : t);
    };
    return (_jsxs("section", { className: "ui-dock", "aria-label": "Build dock", "data-help": "build", children: [_jsxs("div", { className: "ui-dockhead", children: [_jsx("span", { className: "ui-label", children: "BUILD" }), _jsx("span", { className: "ui-label", children: "B" })] }), picks.map((p) => {
                const key = p.kind === "parts" ? "parts" : p.defId;
                const def = p.kind === "place" ? content.facilities[p.defId] : null;
                const can = cost(p) <= view.cash;
                const on = p.kind === "place" && toolKey(tool) === toolKey({ kind: "place", defId: p.defId });
                return (_jsxs("button", { type: "button", "data-tut": `dock-${key}`, className: `ui-dockbtn ${can ? "can" : ""} ${on ? "is-on" : ""}`, onClick: () => run(p), onMouseLeave: soft.hide, onMouseEnter: (e) => {
                        soft.keep();
                        setHover({ anchor: { ...anchorOf(e.currentTarget), right: e.currentTarget.getBoundingClientRect().right + 80 * hudScale(state.settings) }, ...(def ? { entry: facilityEntryId(def.id), title: def.name, body: def.description, specs: defSpecs(def) } : { title: "Spare parts ×5", body: "Replacement parts for maintenance bots. Each repair uses one.", specs: [["Cost", fmtMoney(cost(p))]] }) });
                    }, children: [_jsx("span", { className: "ui-dock-ic", children: def ? _jsx(Swatch, { color: def.color, accent: def.accent, size: 22 }) : _jsx(Icon, { name: "bolt", size: 14 }) }), _jsx("span", { className: "ui-dock-name", children: def ? def.name : "Spare parts ×5" }), _jsx("span", { className: "ui-dock-cost", children: fmtMoney(cost(p)) })] }, key));
            }), _jsxs("button", { type: "button", "data-tut": "dock-more", className: `ui-dockbtn ${ui.paletteOpen ? "is-on" : ""}`, "aria-expanded": ui.paletteOpen, onClick: () => setUi({ paletteOpen: !ui.paletteOpen }), title: "All builds: structure, racks, power, cooling, logistics, wetware (B)", children: [_jsx("span", { className: "ui-dock-ic", children: "\u2026" }), _jsx("span", { className: "ui-dock-name", children: "More" }), _jsx("span", { className: "ui-dock-cost", children: "\u25B8" })] }), hover && _jsx(SpecCard, { hover: hover, scale: hudScale(state.settings), onEnter: soft.keep, onLeave: soft.hide, onMore: (entry) => { setHover(null); setUi({ drawer: "encyclopedia", encyId: entry }); } })] }));
}
/** The edge tabs: one drawer at a time, each on a hotkey. */
export function DrawerTabs({ ui, setUi }) {
    return (_jsx("div", { className: "ui-dtabs", role: "tablist", "aria-label": "Drawers", children: DRAWER_TABS.map((d) => (_jsxs("button", { type: "button", role: "tab", "data-tut": `dtab-${d.id}`, "data-help": `tab-${d.id}`, "aria-selected": ui.drawer === d.id, className: `ui-dtab ${ui.drawer === d.id ? "is-on" : ""}`, onClick: () => setUi({ drawer: nextDrawer(ui.drawer, d.id) }), "aria-label": `${d.label} (${d.key})`, children: [_jsx("span", { className: "ui-dtab-name", children: d.label }), _jsx("kbd", { children: d.key })] }, d.id))) }));
}
function GaugesDrawer(props) {
    const { state } = props;
    const { view } = state;
    const stat = (label, value, tone = "") => (_jsxs("div", { className: `ui-chip ui-gstat ${tone}`, children: [_jsx("span", { className: "ui-label", children: label }), _jsx("span", { className: "ui-big", children: value })] }, label));
    const supply = view.powerNets.reduce((s, n) => s + n.supplyKw, 0);
    return (_jsxs(_Fragment, { children: [_jsx("h4", { className: "ui-dh", children: _jsx("span", { children: "GAUGES" }) }), _jsxs("div", { className: "ui-gstats", children: [stat("PUE", fmtPue(view.pue)), stat("IT LOAD", fmtPower(view.itKw), supply > 0 && view.totalKw > supply ? "is-bad" : ""), stat("UPTIME", fmtPct(view.uptime, 1), view.uptime < 0.99 ? "is-warn" : ""), stat("OUTSIDE", fmtTemp(view.ambientC, 0)), stat("GRID $/kWh", view.energyPrice.toFixed(3)), stat("COMPUTE", `${Math.round(view.pflops)} PF`)] }), _jsx("h4", { className: "ui-dh", children: _jsx("span", { children: "OVERLAYS" }) }), _jsx(OverlaySwitcher, { ...props, embedded: true }), _jsx("h4", { className: "ui-dh", children: _jsx("span", { children: "PATH AFFINITY" }) }), _jsx(AffinityBars, { affinity: view.affinity, content: props.content, leading: view.path ?? leadingPath(view.affinity) }), view.modifiers.length > 0 && (_jsxs(_Fragment, { children: [_jsx("h4", { className: "ui-dh", children: _jsx("span", { children: "MODIFIERS" }) }), _jsx(ModifierChips, { modifiers: view.modifiers, tick: view.tick })] })), _jsx(Telemetry, { ...props })] }));
}
/** The open drawer, if any. */
export function Drawer(props) {
    const d = props.ui.drawer;
    if (!d)
        return null;
    const title = d === "log" ? "ALERT LOG" : DRAWER_TABS.find((t) => t.id === d)?.label.toUpperCase();
    return (_jsxs("section", { className: `ui-edge ui-glass is-${d}`, "aria-label": title, "data-drawer": d, children: [_jsx("button", { type: "button", className: "ui-btn ui-icon-btn ui-drawer-x", "aria-label": "Close drawer", title: "Close (Esc)", onClick: () => props.setUi({ drawer: null }), children: _jsx(Icon, { name: "close", size: 11 }) }), d === "contracts" && _jsx(ContractsDrawer, { ...props }), d === "research" && _jsx(ResearchDrawer, { ...props }), d === "automation" && _jsx(AutomationDrawer, { ...props }), d === "finance" && _jsx(FinanceTab, { ...props }), d === "gauges" && _jsx(GaugesDrawer, { ...props }), d === "encyclopedia" && _jsx(EncyclopediaDrawer, { ...props }), d === "log" && _jsx(AlertsLog, { ...props })] }));
}
/** The full palette as a popover above the dock. */
export function PalettePopover(props) {
    return props.ui.paletteOpen ? _jsx(BuildPalette, { ...props }) : null;
}
