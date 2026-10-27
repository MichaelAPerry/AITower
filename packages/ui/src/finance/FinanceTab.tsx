import type { CommandResult } from "@aitower/sim";
import { Stamp } from "../components/common";
import type { FinanceTab as FinanceSection, PanelProps } from "../components/context";
import { fmtMoney } from "../format";
import { pushNotice } from "../notices";
import { cashDeltaText, fmtDailyRate, gradeTone, ledgerNet, lifetimeRows, loanInfo, repayPresets, takePresets } from "./finance";

const report = (r: CommandResult): void => {
	if (!r.ok) pushNotice({ text: r.reason, severity: "warn", key: `fin:${r.reason}` });
};

export function LedgerSection({ state }: PanelProps) {
	const rows = state.view.ledger.slice(-8).reverse();
	const today = state.view.day;
	return (
		<table className="ui-table ui-ledger">
			<caption>DAILY LEDGER</caption>
			<thead>
				<tr>
					<th>Day</th>
					<th className="num">Revenue</th>
					<th className="num">Energy</th>
					<th className="num">Upkeep</th>
					<th className="num">Construction</th>
					<th className="num">Penalties</th>
					<th className="num" title="Levy on the day's profit, charged at midnight">
						Taxes
					</th>
					<th className="num" title="Interest on the Credit Facility loan">
						Interest
					</th>
					<th className="num" title="Contract Automation fees withheld from earnings">
						Fees
					</th>
					<th className="num">Net</th>
				</tr>
			</thead>
			<tbody>
				{rows.map((d) => {
					const n = ledgerNet(d);
					const dash = (v: number | undefined): string => (v ? fmtMoney(-v) : "—");
					return (
						<tr key={d.day} className={d.day === today ? "is-today" : ""}>
							<td className="strong">{d.day === today ? `Today (${d.day})` : `Day ${d.day}`}</td>
							<td className="num is-pos">{fmtMoney(d.revenue)}</td>
							<td className="num">{fmtMoney(-d.energy)}</td>
							<td className="num">{fmtMoney(-d.upkeep)}</td>
							<td className="num">{fmtMoney(-d.construction)}</td>
							<td className="num">{dash(d.penalties)}</td>
							<td className="num">{dash(d.taxes)}</td>
							<td className="num">{dash(d.interest)}</td>
							<td className="num">{dash(d.fees)}</td>
							<td className={`num strong ${n < 0 ? "is-neg" : "is-pos"}`}>{fmtMoney(n)}</td>
						</tr>
					);
				})}
			</tbody>
		</table>
	);
}

export function CreditSection({ store, state }: PanelProps) {
	const { view } = state;
	const info = loanInfo(view.loan);
	const take = takePresets(info);
	const repay = repayPresets(info, view.cash);
	const send = (type: "takeLoan" | "repayLoan", amount: number): void => report(store.dispatch({ type, amount }));
	return (
		<section className="ui-form ui-credit" aria-label="Credit Facility">
			<div className="ui-form-head">
				<span>CREDIT FACILITY</span>
				<span>LOAN APPLICATION</span>
			</div>
			<dl className="ui-credit-figs">
				<div>
					<dt>Owed</dt>
					<dd className={info.principal > 0 ? "is-neg-soft" : ""}>{fmtMoney(info.principal)}</dd>
				</div>
				<div>
					<dt title="The most the Office lends at your level">Limit</dt>
					<dd>{fmtMoney(info.max)}</dd>
				</div>
				<div>
					<dt>Interest rate</dt>
					<dd>{fmtDailyRate(info.dailyRate)}</dd>
				</div>
				<div>
					<dt title="Charged every midnight on what you owe">Interest per day</dt>
					<dd className={info.interestPerDay > 0 ? "is-neg-soft" : ""}>{fmtMoney(info.interestPerDay)}</dd>
				</div>
			</dl>
			<div className="ui-credit-acts">
				{/* biome-ignore lint/a11y/useSemanticElements: a div group of buttons; a fieldset would bring default styling */}
				<div className="ui-credit-group" role="group" aria-label="Take a loan">
					<span className="ui-credit-label">TAKE</span>
					{take.map((p) => (
						<button key={p.label} type="button" className="ui-btn ui-mini ui-credit-btn" disabled={!!p.disabled} title={p.disabled ?? `Borrow ${fmtMoney(p.amount)} from the Credit Facility (${p.label} of the remaining limit)`} onClick={() => send("takeLoan", p.amount)}>
							{p.label} <span className="ui-credit-amt">{fmtMoney(p.amount)}</span>
						</button>
					))}
				</div>
				{/* biome-ignore lint/a11y/useSemanticElements: a div group of buttons; a fieldset would bring default styling */}
				<div className="ui-credit-group" role="group" aria-label="Repay a loan">
					<span className="ui-credit-label">REPAY</span>
					{repay.map((p) => (
						<button key={p.label} type="button" className="ui-btn ui-mini ui-credit-btn" disabled={!!p.disabled} title={p.disabled ?? `Repay ${fmtMoney(p.amount)} of the principal (${p.label} of what you owe)`} onClick={() => send("repayLoan", p.amount)}>
							{p.label} <span className="ui-credit-amt">{fmtMoney(p.amount)}</span>
						</button>
					))}
				</div>
			</div>
			<p className="ui-credit-note">Borrowed money is cash, not income. Interest is charged each midnight and counts as a cost.</p>
		</section>
	);
}

export function AuditsSection({ content, state, openAudit }: PanelProps) {
	const rows = [...state.view.reports].reverse();
	if (!rows.length) {
		const days = content.balance?.audit?.periodDays;
		return <div className="ui-empty ui-pad">No inspection yet. An inspector grades uptime every {days ? `${days} days` : "few days"}, from A to E, and pays or fines cash.</div>;
	}
	return (
		<div className="ui-form ui-audits">
			<div className="ui-form-head">
				<span>QUARTERLY INSPECTIONS</span>
				<span>NEWEST FIRST</span>
			</div>
			<table className="ui-table">
			<thead>
				<tr>
					<th>Quarter</th>
					<th>Days</th>
					<th>Grade</th>
					<th className="num">Profit</th>
					<th>Grant / fine</th>
					<th>Remark</th>
					<th />
				</tr>
			</thead>
			<tbody>
				{rows.map((r) => {
					const profit = r.revenue - r.costs;
					return (
						<tr key={r.quarter}>
							<td className="strong">Quarter {r.quarter}</td>
							<td>
								{r.fromDay}–{r.toDay}
							</td>
							<td>
								<Stamp tone={gradeTone(r.grade)} className="ui-audit-mini">
									{r.grade}
								</Stamp>
							</td>
							<td className={`num ${profit < 0 ? "is-neg-soft" : "is-pos"}`}>{fmtMoney(profit)}</td>
							<td>{cashDeltaText(r.cashDelta)}</td>
							<td className="ui-audits-remark" title={r.remark}>
								{r.remark}
							</td>
							<td className="actions">
								<button type="button" className="ui-btn ui-mini" onClick={() => openAudit(r)} title="Open this inspection again">
									Open
								</button>
							</td>
						</tr>
					);
				})}
			</tbody>
		</table>
		</div>
	);
}

export function RecordSection({ state }: PanelProps) {
	const rows = lifetimeRows(state.view.stats);
	return (
		<section className="ui-form ui-record" aria-label="Service record">
			<div className="ui-form-head">
				<span>SERVICE RECORD · LIFETIME FIGURES</span>
				<span>SINCE DAY 0</span>
			</div>
			<dl className="ui-record-grid">
				{rows.map((r) => (
					<div key={r.label}>
						<dt>{r.label}</dt>
						<dd>{r.value}</dd>
					</div>
				))}
			</dl>
		</section>
	);
}

const SECTIONS: { id: FinanceSection; label: string; title: string }[] = [
	{ id: "ledger", label: "Ledger", title: "Daily accounts" },
	{ id: "credit", label: "Credit Facility", title: "Take or repay a loan" },
	{ id: "audits", label: "Inspections", title: "Quarterly inspections: uptime grades, cash paid or fined" },
	{ id: "record", label: "Record", title: "Lifetime statistics" },
];

/** Finance tab: the ledger, the Credit Facility, past audits and lifetime stats. */
export function FinanceTab(props: PanelProps) {
	const { ui, setUi, state } = props;
	const loan = loanInfo(state.view.loan);
	return (
		<div className="ui-finance">
			<div className="ui-finance-nav" role="tablist" aria-label="Finance sections">
				{SECTIONS.map((s) => (
					<button key={s.id} type="button" role="tab" aria-selected={ui.financeTab === s.id} title={s.title} className={`ui-tab ui-subtab ${ui.financeTab === s.id ? "is-on" : ""}`} onClick={() => setUi({ financeTab: s.id })}>
						{s.label}
						{s.id === "credit" && loan.principal > 0 && <span className="ui-subtab-note"> {fmtMoney(loan.principal)}</span>}
					</button>
				))}
			</div>
			{ui.financeTab === "ledger" && <LedgerSection {...props} />}
			{ui.financeTab === "credit" && <CreditSection {...props} />}
			{ui.financeTab === "audits" && <AuditsSection {...props} />}
			{ui.financeTab === "record" && <RecordSection {...props} />}
		</div>
	);
}
