import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Stamp } from "../components/common";
import { fmtMoney } from "../format";
import { pushNotice } from "../notices";
import { cashDeltaText, fmtDailyRate, gradeTone, ledgerNet, lifetimeRows, loanInfo, repayPresets, signed, takePresets } from "./finance";
const report = (r) => {
    if (!r.ok)
        pushNotice({ text: r.reason, severity: "warn", key: `fin:${r.reason}` });
};
export function LedgerSection({ state }) {
    const rows = state.view.ledger.slice(-8).reverse();
    const today = state.view.day;
    return (_jsxs("table", { className: "ui-table ui-ledger", children: [_jsx("caption", { children: "COMPUTE AUTHORITY \u00B7 DAILY LEDGER" }), _jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Day" }), _jsx("th", { className: "num", children: "Revenue" }), _jsx("th", { className: "num", children: "Energy" }), _jsx("th", { className: "num", children: "Upkeep" }), _jsx("th", { className: "num", children: "Construction" }), _jsx("th", { className: "num", children: "Penalties" }), _jsx("th", { className: "num", title: "Authority levy on the day's profit, charged at midnight", children: "Taxes" }), _jsx("th", { className: "num", title: "Interest on the Credit Facility loan", children: "Interest" }), _jsx("th", { className: "num", title: "Contract Automation fees withheld from earnings", children: "Fees" }), _jsx("th", { className: "num", children: "Net" })] }) }), _jsx("tbody", { children: rows.map((d) => {
                    const n = ledgerNet(d);
                    const dash = (v) => (v ? fmtMoney(-v) : "—");
                    return (_jsxs("tr", { className: d.day === today ? "is-today" : "", children: [_jsx("td", { className: "strong", children: d.day === today ? `Today (${d.day})` : `Day ${d.day}` }), _jsx("td", { className: "num is-pos", children: fmtMoney(d.revenue) }), _jsx("td", { className: "num", children: fmtMoney(-d.energy) }), _jsx("td", { className: "num", children: fmtMoney(-d.upkeep) }), _jsx("td", { className: "num", children: fmtMoney(-d.construction) }), _jsx("td", { className: "num", children: dash(d.penalties) }), _jsx("td", { className: "num", children: dash(d.taxes) }), _jsx("td", { className: "num", children: dash(d.interest) }), _jsx("td", { className: "num", children: dash(d.fees) }), _jsx("td", { className: `num strong ${n < 0 ? "is-neg" : "is-pos"}`, children: fmtMoney(n) })] }, d.day));
                }) })] }));
}
export function CreditSection({ store, state }) {
    const { view } = state;
    const info = loanInfo(view.loan);
    const take = takePresets(info);
    const repay = repayPresets(info, view.cash);
    const send = (type, amount) => report(store.dispatch({ type, amount }));
    return (_jsxs("section", { className: "ui-form ui-credit", "aria-label": "Credit Facility", children: [_jsxs("div", { className: "ui-form-head", children: [_jsx("span", { children: "CREDIT FACILITY" }), _jsx("span", { children: "LOAN APPLICATION" })] }), _jsxs("dl", { className: "ui-credit-figs", children: [_jsxs("div", { children: [_jsx("dt", { children: "Owed" }), _jsx("dd", { className: info.principal > 0 ? "is-neg-soft" : "", children: fmtMoney(info.principal) })] }), _jsxs("div", { children: [_jsx("dt", { title: "The most the Office lends at your level", children: "Limit" }), _jsx("dd", { children: fmtMoney(info.max) })] }), _jsxs("div", { children: [_jsx("dt", { children: "Interest rate" }), _jsx("dd", { children: fmtDailyRate(info.dailyRate) })] }), _jsxs("div", { children: [_jsx("dt", { title: "Charged every midnight on what you owe", children: "Interest per day" }), _jsx("dd", { className: info.interestPerDay > 0 ? "is-neg-soft" : "", children: fmtMoney(info.interestPerDay) })] })] }), _jsxs("div", { className: "ui-credit-acts", children: [_jsxs("div", { className: "ui-credit-group", role: "group", "aria-label": "Take a loan", children: [_jsx("span", { className: "ui-credit-label", children: "TAKE" }), take.map((p) => (_jsxs("button", { type: "button", className: "ui-btn ui-mini ui-credit-btn", disabled: !!p.disabled, title: p.disabled ?? `Borrow ${fmtMoney(p.amount)} from the Credit Facility (${p.label} of the remaining limit)`, onClick: () => send("takeLoan", p.amount), children: [p.label, " ", _jsx("span", { className: "ui-credit-amt", children: fmtMoney(p.amount) })] }, p.label)))] }), _jsxs("div", { className: "ui-credit-group", role: "group", "aria-label": "Repay a loan", children: [_jsx("span", { className: "ui-credit-label", children: "REPAY" }), repay.map((p) => (_jsxs("button", { type: "button", className: "ui-btn ui-mini ui-credit-btn", disabled: !!p.disabled, title: p.disabled ?? `Repay ${fmtMoney(p.amount)} of the principal (${p.label} of what you owe)`, onClick: () => send("repayLoan", p.amount), children: [p.label, " ", _jsx("span", { className: "ui-credit-amt", children: fmtMoney(p.amount) })] }, p.label)))] })] }), _jsx("p", { className: "ui-credit-note", children: "Borrowed money is cash, not income. Interest is charged each midnight and counts as a cost." })] }));
}
export function AuditsSection({ content, state, openAudit }) {
    const rows = [...state.view.reports].reverse();
    if (!rows.length) {
        const days = content.balance?.audit?.periodDays;
        return _jsxs("div", { className: "ui-empty ui-pad", children: ["No quarterly audit yet. The Compute Authority audits every ", days ? `${days} days` : "few days", ", graded A to E on uptime, failed jobs, penalties, PUE and profit."] });
    }
    return (_jsxs("div", { className: "ui-form ui-audits", children: [_jsxs("div", { className: "ui-form-head", children: [_jsx("span", { children: "QUARTERLY AUDITS" }), _jsx("span", { children: "NEWEST FIRST" })] }), _jsxs("table", { className: "ui-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Quarter" }), _jsx("th", { children: "Days" }), _jsx("th", { children: "Grade" }), _jsx("th", { className: "num", children: "Profit" }), _jsx("th", { className: "num", children: "Reputation" }), _jsx("th", { children: "Grant / fine" }), _jsx("th", { children: "Remark" }), _jsx("th", {})] }) }), _jsx("tbody", { children: rows.map((r) => {
                            const profit = r.revenue - r.costs;
                            return (_jsxs("tr", { children: [_jsxs("td", { className: "strong", children: ["Quarter ", r.quarter] }), _jsxs("td", { children: [r.fromDay, "\u2013", r.toDay] }), _jsx("td", { children: _jsx(Stamp, { tone: gradeTone(r.grade), className: "ui-audit-mini", children: r.grade }) }), _jsx("td", { className: `num ${profit < 0 ? "is-neg-soft" : "is-pos"}`, children: fmtMoney(profit) }), _jsx("td", { className: "num", children: signed(Math.round(r.standingDelta)) }), _jsx("td", { children: cashDeltaText(r.cashDelta) }), _jsx("td", { className: "ui-audits-remark", title: r.remark, children: r.remark }), _jsx("td", { className: "actions", children: _jsx("button", { type: "button", className: "ui-btn ui-mini", onClick: () => openAudit(r), title: "Open this audit sheet again", children: "Open" }) })] }, r.quarter));
                        }) })] })] }));
}
export function RecordSection({ state }) {
    const rows = lifetimeRows(state.view.stats);
    return (_jsxs("section", { className: "ui-form ui-record", "aria-label": "Service record", children: [_jsxs("div", { className: "ui-form-head", children: [_jsx("span", { children: "SERVICE RECORD \u00B7 LIFETIME FIGURES" }), _jsx("span", { children: "SINCE DAY 0" })] }), _jsx("dl", { className: "ui-record-grid", children: rows.map((r) => (_jsxs("div", { children: [_jsx("dt", { children: r.label }), _jsx("dd", { children: r.value })] }, r.label))) })] }));
}
const SECTIONS = [
    { id: "ledger", label: "Ledger", title: "Daily accounts" },
    { id: "credit", label: "Credit Facility", title: "Take or repay a loan" },
    { id: "audits", label: "Audits", title: "Quarterly Compute Authority audits" },
    { id: "record", label: "Record", title: "Lifetime statistics" },
];
/** Finance tab: the ledger, the Credit Facility, past audits and lifetime stats. */
export function FinanceTab(props) {
    const { ui, setUi, state } = props;
    const loan = loanInfo(state.view.loan);
    return (_jsxs("div", { className: "ui-finance", children: [_jsx("div", { className: "ui-finance-nav", role: "tablist", "aria-label": "Finance sections", children: SECTIONS.map((s) => (_jsxs("button", { type: "button", role: "tab", "aria-selected": ui.financeTab === s.id, title: s.title, className: `ui-tab ui-subtab ${ui.financeTab === s.id ? "is-on" : ""}`, onClick: () => setUi({ financeTab: s.id }), children: [s.label, s.id === "credit" && loan.principal > 0 && _jsxs("span", { className: "ui-subtab-note", children: [" ", fmtMoney(loan.principal)] })] }, s.id))) }), ui.financeTab === "ledger" && _jsx(LedgerSection, { ...props }), ui.financeTab === "credit" && _jsx(CreditSection, { ...props }), ui.financeTab === "audits" && _jsx(AuditsSection, { ...props }), ui.financeTab === "record" && _jsx(RecordSection, { ...props })] }));
}
