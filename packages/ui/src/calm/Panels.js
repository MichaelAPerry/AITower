import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { payPerPflopHour } from "@aitower/sim";
import { ClerkPanel } from "../clerk/ClerkPanel";
import { clerkRowText, clerkVerdict, fmtRate } from "../clerk/clerk";
import { feedLines } from "./calm";
import { fmtDuration, fmtMoney, fmtPflops, fmtPower, fmtPue, fmtTemp } from "../format";
import { pushNotice } from "../notices";
import { cheapestAvailable, nodeState, techList } from "../research/tech";
import { Meter, Pill } from "../components/common";
import { downsample, Sparkline } from "../components/Sparkline";
const jobTone = { queued: "dim", running: "good", stalled: "warn", completed: "cyan", failed: "error" };
const SERIOUS = new Set(["rackTripped", "componentFailed", "powerShortfall", "jobFailed", "bankrupt", "upsDepleted"]);
export const isSerious = (e) => SERIOUS.has(e.type);
const report = (r) => {
    if (!r.ok)
        pushNotice({ text: r.reason, severity: "warn", key: `bp:${r.reason}` });
};
/** The offer the induction points at: one that needs neither liquid cooling nor stored data, so the starter site can serve it. */
export function easiestOffer(offers) {
    return offers.find((o) => !o.needsLiquid && o.storageTB === 0) ?? offers.find((o) => !o.needsLiquid) ?? offers[0];
}
/** Contracts drawer: the clerk in one line (Edit opens its form), the offers as compact rows, then the running jobs. */
export function ContractsDrawer(props) {
    const { store, state, ui, setUi } = props;
    const { view } = state;
    const fit = new Map(view.offers.map((o) => [o.id, store.canBuild({ type: "acceptContract", contractId: o.id })]));
    const easy = view.offers.find((o) => fit.get(o.id)?.ok) ?? easiestOffer(view.offers);
    const clerk = view.clerk?.unlocked ? view.clerk : null;
    const live = view.jobs.filter((j) => j.status !== "completed" && j.status !== "failed");
    return (_jsxs(_Fragment, { children: [clerk && (_jsxs("div", { className: "ui-clerkline", children: [_jsxs("span", { children: ["CONTRACT AUTOMATION ", clerk.policy.enabled ? "ON" : "OFF", " \u00B7 ", clerk.acceptedTotal, " booked"] }), _jsx("button", { type: "button", className: "ui-btn ui-mini", "aria-expanded": !!ui.clerkEdit, onClick: () => setUi({ clerkEdit: !ui.clerkEdit }), children: ui.clerkEdit ? "Done" : "Edit" })] })), ((!clerk && (view.stats?.jobsCompleted ?? 0) >= 3) || ui.clerkEdit) && _jsx(ClerkPanel, { ...props }), _jsxs("h4", { className: "ui-dh", children: [_jsx("span", { children: "OFFERS" }), _jsx("span", { children: view.offers.length })] }), view.offers.length === 0 && _jsx("div", { className: "ui-empty", children: "No offers right now. New ones arrive every few hours." }), view.offers.map((o) => {
                const f = fit.get(o.id);
                const blocked = f && !f.ok ? f.reason : null;
                const left = o.expiresAt - view.tick;
                const verdict = clerk ? clerkVerdict(clerk.policy, o, f) : null;
                return (_jsxs("div", { className: `ui-row-card ${blocked ? "is-blocked" : ""}`, children: [_jsxs("span", { className: "ui-rc-name", children: [o.clientName, " ", _jsxs("span", { className: "ui-dim", children: ["\u00B7 ", o.kind] })] }), _jsx("span", { className: "ui-rc-num is-money", children: fmtMoney(o.payout) }), _jsx("span", { className: "ui-rc-num", title: "Dollars of payout per PFLOP-hour of work", children: fmtRate(payPerPflopHour(o), false) }), _jsx(Pill, { status: true, tone: blocked ? "error" : "good", children: blocked ? "can't start" : "fits" }), _jsxs("span", { className: "ui-rc-act", children: [_jsxs("button", { type: "button", className: "ui-stampbtn stamp-green", "data-tut": o.id === easy?.id ? "accept" : undefined, "aria-label": "Accept", title: blocked ? `Can't accept: ${blocked}` : "Accept contract", disabled: !!blocked, onClick: () => report(store.dispatch({ type: "acceptContract", contractId: o.id })), children: [_jsx("span", { className: "rest", children: "Accept" }), _jsx("span", { className: "hot", children: "Approved" })] }), _jsx("button", { type: "button", className: "ui-btn ui-mini", "aria-label": "Decline", title: "Decline contract", onClick: () => report(store.dispatch({ type: "declineContract", contractId: o.id })), children: "\u2715" })] }), blocked && _jsx("span", { className: "ui-rc-why", children: blocked }), clerk && _jsx("span", { className: "ui-rc-why is-soft", children: clerkRowText(clerk.policy.enabled, verdict) }), left < 120 && _jsxs("span", { className: "ui-rc-why is-soft", children: ["expires in ", fmtDuration(left)] })] }, o.id));
            }), _jsxs("h4", { className: "ui-dh", children: [_jsx("span", { children: "RUNNING" }), _jsx("span", { children: live.length })] }), live.length === 0 && _jsx("div", { className: "ui-empty", children: "Nothing running. Accept an offer to put the racks to work." }), live.map((j) => {
                const p = j.total > 0 ? j.progress / j.total : 0;
                const left = j.deadline - view.tick;
                return (_jsxs("div", { className: `ui-row-card ${ui.focusJobId === j.id ? "is-focus" : ""}`, children: [_jsxs("span", { className: "ui-rc-name", children: [j.clientName, " ", _jsxs("span", { className: "ui-dim", children: ["\u00B7 ", j.kind] })] }), _jsxs("span", { className: "ui-rc-num", children: [(p * 100).toFixed(0), "%"] }), _jsx("span", { className: "ui-rc-num", children: fmtPflops(j.pflops) }), _jsx(Pill, { status: true, tone: jobTone[j.status], children: j.status }), _jsx("span", { className: "ui-rc-act", children: _jsx("button", { type: "button", className: "ui-btn ui-mini is-danger", onClick: () => report(store.dispatch({ type: "cancelJob", jobId: j.id })), title: "Cancel job", children: "Abort" }) }), _jsx("span", { className: "ui-rc-bar", children: _jsx(Meter, { value: p, tone: j.status === "stalled" ? "warn" : "good", height: 4 }) }), left < 360 && _jsx("span", { className: "ui-rc-why", children: left >= 0 ? `due in ${fmtDuration(left)}` : "overdue" })] }, j.id));
            })] }));
}
/** Research drawer: only what can be bought now or nearly (at least half the cost in hand), with a way into the full sheet. */
export function ResearchDrawer({ store, content, state, openResearch }) {
    const { view } = state;
    const rows = techList(content)
        .map((n) => ({ n, s: nodeState(n, view, content) }))
        .filter(({ n, s }) => s.kind === "available" || (s.kind === "poor" && view.researchPoints >= n.cost / 2))
        .sort((a, b) => a.n.cost - b.n.cost)
        .slice(0, 6);
    const next = cheapestAvailable(view, content);
    return (_jsxs(_Fragment, { children: [_jsxs("h4", { className: "ui-dh", children: [_jsx("span", { children: "RESEARCH" }), _jsxs("span", { className: "ui-rp", children: [Math.floor(view.researchPoints), " RP"] })] }), rows.length === 0 && _jsx("div", { className: "ui-empty", children: "Nothing within reach yet. Racks and finished jobs earn research points." }), rows.map(({ n, s }) => (_jsxs("div", { className: `ui-row-card ${s.kind === "available" ? "is-ready" : ""}`, children: [_jsx("span", { className: "ui-rc-name", children: n.name }), _jsx("span", { className: "ui-rc-num is-rp", children: n.cost }), s.kind === "available" ? (_jsx("button", { type: "button", className: "ui-btn ui-mini is-accent", title: n.description, onClick: () => report(store.dispatch({ type: "research", techId: n.id })), children: "Research" })) : (_jsx(Pill, { tone: "dim", children: s.kind === "poor" ? `need ${s.short}` : "" }))] }, n.id))), _jsx("button", { type: "button", className: `ui-btn ui-wide ${next ? "is-accent" : ""}`, onClick: openResearch, children: "Open the full Department of Research" })] }));
}
export function Telemetry({ content, state }) {
    const h = state.view.history;
    const series = [
        { label: "PUE", color: "var(--green)", pick: (s) => s.pue, fmt: fmtPue, min: 1 },
        { label: "IT load", color: "var(--green)", pick: (s) => s.itKw, fmt: fmtPower, min: 0 },
        { label: "Compute", color: "var(--green)", pick: (s) => s.pflops, fmt: fmtPflops, min: 0 },
        { label: "Cash", color: "var(--green)", pick: (s) => s.cash, fmt: fmtMoney },
        { label: "Max rack temp", color: "var(--green)", pick: (s) => s.maxRackC, fmt: (v) => fmtTemp(v), ref: content.balance.thermal.throttleC },
    ];
    const span = h.length > 1 ? h[h.length - 1].tick - h[0].tick : 0;
    return (_jsx("div", { className: "ui-telemetry", children: series.map((s) => {
            const vals = downsample(h.map((x) => s.pick(x)), 160);
            const last = vals.length ? vals[vals.length - 1] : Number.NaN;
            return (_jsxs("div", { className: "ui-spark-card ui-crt crt-green", children: [_jsxs("div", { className: "ui-spark-head", children: [_jsx("span", { className: "ui-label", children: s.label }), _jsx("span", { className: "ui-big", children: s.fmt(last) })] }), _jsx(Sparkline, { values: vals, color: s.color, refLine: s.ref, min: s.min, height: 72 }), _jsxs("div", { className: "ui-spark-foot", children: [_jsxs("span", { children: ["\u2212", fmtDuration(span)] }), _jsxs("span", { children: ["\u2193", vals.length ? s.fmt(Math.min(...vals)) : "—", " \u2191", vals.length ? s.fmt(Math.max(...vals)) : "—"] })] })] }, s.label));
        }) }));
}
export function AlertsLog({ store, content, state }) {
    const items = feedLines(state.log.slice(-400), state.view, content, state.settings.horrorIntensity).slice(-80).reverse();
    if (!items.length)
        return _jsx("div", { className: "ui-empty ui-pad", children: "All quiet." });
    return (_jsx("ul", { className: "ui-alerts ui-crt crt-amber", children: items.map((l) => {
            const cell = l.cell;
            const day = Math.floor(l.tick / 1440);
            const min = (l.tick + 360) % 1440;
            const t = `D${day} ${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
            return (
            // biome-ignore lint/a11y/useKeyWithClickEvents: click-to-focus on a log row is a mouse convenience; the log text is the accessible content
            _jsxs("li", { className: `sev-${l.severity} ${cell ? "is-click" : ""}`, onClick: cell ? () => store.focus(cell) : undefined, title: cell ? "Click to focus" : undefined, children: [_jsx("span", { className: "ui-alert-dot" }), _jsx("span", { className: "ui-alert-time", children: t }), _jsx("span", { className: "ui-alert-text", children: l.text })] }, l.key));
        }) }));
}
