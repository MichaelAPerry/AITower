import { fmtDuration, fmtMoney, fmtPflops, fmtPower, fmtPue, fmtTemp } from "../format";
import { describeEvent, isNoise } from "../events";
import { pushNotice } from "../notices";
import { Icon, Meter, Pill, type Tone } from "./common";
import type { BottomTab, PanelProps } from "./context";
import { downsample, Sparkline } from "./Sparkline";
import type { CommandResult, JobStatus, SimEvent } from "@aitower/sim";

const jobTone: Record<JobStatus, Tone> = { queued: "dim", running: "good", stalled: "warn", completed: "cyan", failed: "error" };

const SERIOUS = new Set<SimEvent["type"]>(["rackTripped", "componentFailed", "powerShortfall", "jobFailed", "bankrupt", "upsDepleted"]);
export const isSerious = (e: SimEvent): boolean => SERIOUS.has(e.type);

const report = (r: CommandResult): void => {
	if (!r.ok) pushNotice({ text: r.reason, severity: "warn", key: `bp:${r.reason}` });
};

function Contracts({ store, state }: PanelProps) {
	const { view } = state;
	if (!view.offers.length) return <div className="ui-empty ui-pad">No offers right now — new contracts arrive every few hours.</div>;
	return (
		<table className="ui-table">
			<thead>
				<tr>
					<th>Client</th>
					<th>Kind</th>
					<th>Size</th>
					<th>Window</th>
					<th className="num">Payout</th>
					<th className="num">Penalty</th>
					<th>Needs</th>
					<th>Expires</th>
					<th />
				</tr>
			</thead>
			<tbody>
				{view.offers.map((o) => {
					const left = o.expiresAt - view.tick;
					return (
						<tr key={o.id}>
							<td className="strong">{o.clientName}</td>
							<td>
								<Pill tone={o.kind === "inference" ? "info" : "cyan"}>{o.kind}</Pill>
							</td>
							<td>{o.kind === "inference" ? `${fmtPflops(o.sustainedPflops ?? o.work)} sustained` : `${Math.round(o.work).toLocaleString()} PF·h`}</td>
							<td>{fmtDuration(o.durationTicks)}</td>
							<td className="num is-pos">{fmtMoney(o.payout)}</td>
							<td className="num is-neg-soft">{o.penalty ? fmtMoney(o.penalty) : "—"}</td>
							<td>
								<span className="ui-tags">
									{o.needsLiquid && <Pill tone="info">liquid</Pill>}
									{o.storageTB > 0 && <Pill tone="dim">{o.storageTB} TB</Pill>}
									{!o.needsLiquid && !o.storageTB && <span className="ui-dim">—</span>}
								</span>
							</td>
							<td className={left < 120 ? "is-warn" : "ui-dim"}>{fmtDuration(left)}</td>
							<td className="actions">
								<button type="button" className="ui-btn ui-mini is-go" onClick={() => report(store.dispatch({ type: "acceptContract", contractId: o.id }))}>
									Accept
								</button>
								<button type="button" className="ui-btn ui-mini" onClick={() => report(store.dispatch({ type: "declineContract", contractId: o.id }))}>
									Decline
								</button>
							</td>
						</tr>
					);
				})}
			</tbody>
		</table>
	);
}

function Jobs({ store, state, ui }: PanelProps) {
	const { view } = state;
	if (!view.jobs.length) return <div className="ui-empty ui-pad">No jobs. Accept a contract to put your racks to work.</div>;
	return (
		<table className="ui-table">
			<thead>
				<tr>
					<th>Client</th>
					<th>Kind</th>
					<th>Status</th>
					<th className="wide">Progress</th>
					<th className="num">PFLOPS</th>
					<th className="num">Racks</th>
					<th>Deadline</th>
					<th className="num">Payout</th>
					<th />
				</tr>
			</thead>
			<tbody>
				{view.jobs.map((j) => {
					const p = j.total > 0 ? j.progress / j.total : 0;
					const left = j.deadline - view.tick;
					const done = j.status === "completed" || j.status === "failed";
					return (
						<tr key={j.id} className={ui.focusJobId === j.id ? "is-focus" : ""}>
							<td className="strong">{j.clientName}</td>
							<td>{j.kind}</td>
							<td>
								<Pill tone={jobTone[j.status]}>{j.status}</Pill>
							</td>
							<td className="wide">
								<div className="ui-progress">
									<Meter value={p} tone={j.status === "stalled" ? "warn" : j.status === "failed" ? "error" : "good"} height={8} />
									<span>{(p * 100).toFixed(1)}%</span>
								</div>
							</td>
							<td className="num">{fmtPflops(j.pflops)}</td>
							<td className="num">{j.rackIds.length}</td>
							<td className={!done && left < 360 ? "is-warn" : "ui-dim"}>{done ? "—" : left >= 0 ? fmtDuration(left) : "overdue"}</td>
							<td className="num is-pos">{fmtMoney(j.payout)}</td>
							<td className="actions">
								{!done && (
									<button type="button" className="ui-btn ui-mini is-danger" onClick={() => report(store.dispatch({ type: "cancelJob", jobId: j.id }))}>
										Cancel
									</button>
								)}
							</td>
						</tr>
					);
				})}
			</tbody>
		</table>
	);
}

function Telemetry({ content, state }: PanelProps) {
	const h = state.view.history;
	const series: { label: string; color: string; pick: (s: (typeof h)[number]) => number; fmt: (v: number) => string; ref?: number; min?: number }[] = [
		{ label: "PUE", color: "var(--good)", pick: (s) => s.pue, fmt: fmtPue, min: 1 },
		{ label: "IT load", color: "var(--cyan)", pick: (s) => s.itKw, fmt: fmtPower, min: 0 },
		{ label: "Compute", color: "var(--violet)", pick: (s) => s.pflops, fmt: fmtPflops, min: 0 },
		{ label: "Cash", color: "var(--lime)", pick: (s) => s.cash, fmt: fmtMoney },
		{ label: "Max rack temp", color: "var(--warn)", pick: (s) => s.maxRackC, fmt: (v) => fmtTemp(v), ref: content.balance.thermal.throttleC },
	];
	const span = h.length > 1 ? h[h.length - 1].tick - h[0].tick : 0;
	return (
		<div className="ui-telemetry">
			{series.map((s) => {
				const vals = downsample(
					h.map((x) => s.pick(x)),
					160,
				);
				const last = vals.length ? vals[vals.length - 1] : Number.NaN;
				return (
					<div key={s.label} className="ui-spark-card">
						<div className="ui-spark-head">
							<span className="ui-label">{s.label}</span>
							<span className="ui-big" style={{ color: s.color }}>
								{s.fmt(last)}
							</span>
						</div>
						<Sparkline values={vals} color={s.color} refLine={s.ref} min={s.min} height={72} />
						<div className="ui-spark-foot">
							<span>−{fmtDuration(span)}</span>
							<span>
								↓{vals.length ? s.fmt(Math.min(...vals)) : "—"} ↑{vals.length ? s.fmt(Math.max(...vals)) : "—"}
							</span>
						</div>
					</div>
				);
			})}
		</div>
	);
}

function Finance({ state }: PanelProps) {
	const rows = state.view.ledger.slice(-8).reverse();
	const net = (d: (typeof rows)[number]): number => d.revenue - d.energy - d.upkeep - d.construction - d.penalties;
	const today = state.view.day;
	return (
		<table className="ui-table ui-ledger">
			<thead>
				<tr>
					<th>Day</th>
					<th className="num">Revenue</th>
					<th className="num">Energy</th>
					<th className="num">Upkeep</th>
					<th className="num">Construction</th>
					<th className="num">Penalties</th>
					<th className="num">Net</th>
				</tr>
			</thead>
			<tbody>
				{rows.map((d) => {
					const n = net(d);
					return (
						<tr key={d.day} className={d.day === today ? "is-today" : ""}>
							<td className="strong">{d.day === today ? `Today (${d.day})` : `Day ${d.day}`}</td>
							<td className="num is-pos">{fmtMoney(d.revenue)}</td>
							<td className="num">{fmtMoney(-d.energy)}</td>
							<td className="num">{fmtMoney(-d.upkeep)}</td>
							<td className="num">{fmtMoney(-d.construction)}</td>
							<td className="num">{d.penalties ? fmtMoney(-d.penalties) : "—"}</td>
							<td className={`num strong ${n < 0 ? "is-neg" : "is-pos"}`}>{fmtMoney(n)}</td>
						</tr>
					);
				})}
			</tbody>
		</table>
	);
}

function Alerts({ store, content, state }: PanelProps) {
	const items = state.log.filter((e) => !isNoise(e.event)).slice(-80).reverse();
	if (!items.length) return <div className="ui-empty ui-pad">All quiet.</div>;
	return (
		<ul className="ui-alerts">
			{items.map((e, i) => {
				const d = describeEvent(e.event, state.view, content);
				const cell = d.cell;
				const day = Math.floor(e.tick / 1440);
				const min = (e.tick + 360) % 1440;
				const t = `D${day} ${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
				return (
					<li key={`${e.tick}-${i}`} className={`sev-${d.severity} ${cell ? "is-click" : ""}`} onClick={cell ? () => store.focus(cell) : undefined} title={cell ? "Click to focus" : undefined}>
						<span className="ui-alert-dot" />
						<span className="ui-alert-time">{t}</span>
						<span className="ui-alert-text">{d.text}</span>
					</li>
				);
			})}
		</ul>
	);
}

const TABS: { id: BottomTab; label: string }[] = [
	{ id: "contracts", label: "Contracts" },
	{ id: "jobs", label: "Jobs" },
	{ id: "telemetry", label: "Telemetry" },
	{ id: "finance", label: "Finance" },
	{ id: "alerts", label: "Alerts" },
];

export function BottomPanel(props: PanelProps) {
	const { state, ui, setUi } = props;
	const { view } = state;
	const badge: Partial<Record<BottomTab, number>> = {
		contracts: view.offers.length,
		jobs: view.jobs.filter((j) => j.status !== "completed" && j.status !== "failed").length,
		alerts: ui.bottomOpen && ui.bottomTab === "alerts" ? 0 : state.log.filter((e) => e.tick > ui.alertsSeenTick && isSerious(e.event)).length,
	};
	return (
		<section className={`ui-bottom ui-panel ${ui.bottomOpen ? "is-open" : "is-closed"}`}>
			<div className="ui-bottom-tabs" role="tablist">
				{TABS.map((t) => (
					<button
						key={t.id}
						type="button"
						role="tab"
						aria-selected={ui.bottomTab === t.id}
						className={`ui-tab ${ui.bottomTab === t.id && ui.bottomOpen ? "is-on" : ""}`}
						onClick={() => setUi(ui.bottomTab === t.id && ui.bottomOpen ? { bottomOpen: false } : { bottomTab: t.id, bottomOpen: true })}
					>
						{t.label}
						{!!badge[t.id] && <span className={`ui-badge ${t.id === "alerts" ? "is-alert" : ""}`}>{badge[t.id]}</span>}
					</button>
				))}
				<div className="ui-grow" />
				<button type="button" className="ui-btn ui-icon-btn ui-mini" onClick={() => setUi({ bottomOpen: !ui.bottomOpen })} title={ui.bottomOpen ? "Collapse (`)" : "Expand (`)"}>
					<Icon name={ui.bottomOpen ? "chevDown" : "chevUp"} size={12} />
				</button>
			</div>
			{ui.bottomOpen && (
				<div className="ui-bottom-body">
					{ui.bottomTab === "contracts" && <Contracts {...props} />}
					{ui.bottomTab === "jobs" && <Jobs {...props} />}
					{ui.bottomTab === "telemetry" && <Telemetry {...props} />}
					{ui.bottomTab === "finance" && <Finance {...props} />}
					{ui.bottomTab === "alerts" && <Alerts {...props} />}
				</div>
			)}
		</section>
	);
}
