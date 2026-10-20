import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { clock } from "@aitower/shared";
import { anyAutomation, autoLampTitle } from "../automation/automation";
import { GrowthIndex } from "../bio/GrowthIndex";
import { Icon, Lamp, Toggle } from "../components/common";
import { fmtMoney } from "../format";
import { InboxButton, StandingMeter } from "../memo/MemoDesk";
import { saveLamp } from "../menu/slots";
import { PathGauge } from "../paths/PathGauge";
import { droughtChip, SANDBOX_TITLE } from "../paths/paths";
import { currentObjective, isProblem } from "../objective/objective";
import { clearanceProgress, fmtRateHour, nextDrawer, perHour } from "./calm";
export const SPEEDS = [0, 1, 3, 10, 30];
/**
 * The one thin strip: day and clock, speed, treasury, PER HOUR, Level bar, reputation, then the badges that appear when they
 * apply (SANDBOX, AUTO, the drought chip), the path gauge and growth index, inbox, menu.
 */
export function TopStrip({ store, content, state, openMenu, ui, setUi }) {
    const { view, speed, muted } = state;
    const lamp = saveLamp(state.saveStatus);
    const rate = perHour(view);
    const cl = clearanceProgress(view, content);
    const drought = droughtChip(view, content);
    const auto = anyAutomation(view);
    // Before the first contract the red figure is only upkeep: say so, in words.
    // ...and the hint yields the top centre to a NEXT alert.
    const nextShown = isProblem(currentObjective(view, content, (cmd) => store.canBuild(cmd), ui.pathFiled ?? null));
    const idleCost = rate !== null && rate < 0 && !view.jobs.some((j) => j.status === "running") && !nextShown;
    return (_jsxs("header", { className: "ui-strip", children: [_jsxs("div", { className: "ui-chip ui-clock", "data-help": "day", children: [_jsxs("span", { className: "ui-label", children: ["DAY ", view.day] }), _jsx("span", { className: "ui-big", children: clock(view.minuteOfDay) })] }), _jsx("div", { className: "ui-speeds", role: "group", "aria-label": "Simulation speed", "data-help": "speed", children: SPEEDS.map((s, i) => (_jsx("button", { type: "button", "data-tut": `speed-${s}`, className: `ui-speed ${speed === s ? "is-on" : ""}`, onClick: () => store.setSpeed(s), "aria-label": `${s === 0 ? "Pause" : `${s}× speed`} (key ${i + 1})`, "aria-pressed": speed === s, children: _jsx("span", { className: "ui-speed-cap", children: s === 0 ? _jsx(Icon, { name: "pause", size: 12 }) : `${s}×` }) }, s))) }), _jsxs("div", { className: `ui-chip ui-cash ${view.cash < 0 ? "is-bad" : ""}`, "data-help": "treasury", children: [_jsx("span", { className: "ui-label", children: "TREASURY" }), _jsx("span", { className: "ui-big", children: fmtMoney(view.cash) })] }), _jsxs("div", { className: `ui-chip ui-perhour ${rate !== null && rate < 0 ? "is-bad" : ""}`, "data-tut": "perhour", "data-help": "perhour", children: [_jsx("span", { className: "ui-label", children: "PER HOUR" }), _jsx("span", { className: "ui-big", children: fmtRateHour(rate) }), idleCost && _jsx("span", { className: "ui-hint", children: "Upkeep. Accept a contract to earn." })] }), _jsxs("div", { className: "ui-clearance", "data-tut": "clearance", "data-help": "level", title: cl.next ? `${Math.round(cl.have)} of ${cl.need} PF compute installed for Level ${cl.next}; uptime ${(cl.uptime * 100).toFixed(1)}% (needs ${(cl.uptimeNeed * 100).toFixed(1)}%)` : "Top level reached", children: [_jsxs("span", { className: "ui-label", children: [_jsxs("span", { children: ["LEVEL ", cl.tier] }), _jsx("span", { className: cl.uptimeOk ? "" : "is-warn", children: cl.next ? `${Math.round(cl.have)} / ${cl.need} PF compute · uptime ${cl.uptimeOk ? "ok" : "low"}` : "top" })] }), _jsx("span", { className: "ui-bar", role: "progressbar", tabIndex: -1, "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": Math.round(cl.frac * 100), "aria-label": "Level progress", children: _jsx("i", { style: { width: `${Math.round(cl.frac * 100)}%` } }) })] }), _jsx(StandingMeter, { standing: view.standing }), view.sandbox && (_jsx("div", { className: "ui-chip ui-sandbox", title: SANDBOX_TITLE, role: "status", children: "SANDBOX" })), auto && (_jsxs("button", { type: "button", className: "ui-chip ui-autolamp is-on", "data-tut": "auto-lamp", "aria-pressed": ui.drawer === "automation", onClick: () => setUi({ drawer: nextDrawer(ui.drawer, "automation") }), title: autoLampTitle(view), children: [_jsx(Lamp, { on: true, tone: "green" }), "AUTO"] })), drought && (_jsxs("div", { className: "ui-chip ui-drought is-warn", title: drought.title, role: "status", children: [_jsx("span", { className: "ui-label", children: drought.label }), _jsx("span", { className: "ui-big", children: drought.value })] })), _jsx(PathGauge, { view: view, content: content }), _jsx(GrowthIndex, { view: view, horror: state.settings.horrorIntensity }), _jsx(InboxButton, { state: state, ui: ui, setUi: setUi }), _jsxs("div", { className: "ui-sysbox", children: [_jsx("button", { type: "button", className: `ui-btn ui-help-btn ${ui.help ? "is-on" : ""}`, "data-help": "help", "aria-pressed": !!ui.help, "aria-label": "Help mode (? or F1)", onClick: () => setUi({ help: !ui.help }), children: "?" }), _jsx("button", { type: "button", className: "ui-btn ui-menu-btn", onClick: openMenu, title: "System menu (Esc): save, load, settings, controls", children: "Menu" }), _jsx("span", { className: `ui-savelamp tone-${lamp.tone}`, title: state.saveStatus.error ?? "Last successful save", role: "status", children: _jsx(Lamp, { on: lamp.lit, tone: lamp.tone, blink: lamp.blink }) })] }), _jsx(Toggle, { on: !muted, onClick: () => store.setMuted(!muted), title: `${muted ? "Unmute" : "Mute"} (M)`, label: "AUDIO", className: "ui-mute" })] }));
}
