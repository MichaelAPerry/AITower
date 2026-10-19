import { payPerPflopHour } from "@aitower/sim";
import { ClerkPanel } from "../clerk/ClerkPanel";
import { clerkRowText, clerkVerdict, fmtRate } from "../clerk/clerk";
import { FinanceTab } from "../finance/FinanceTab";
import { fmtDuration, fmtMoney, fmtPflops, fmtPower, fmtPue, fmtTemp } from "../format";
import { describeEvent, isNoise } from "../events";
import { pushNotice } from "../notices";
import { Counter, Meter, Pill, Toggle, type Tone } from "./common";
import type { BottomTab, PanelProps } from "./context";
import { downsample, Sparkline } from "./Sparkline";
import type { CommandResult, JobStatus, SimEvent } from "@aitower/sim";

const jobTone: Record<JobStatus, Tone> = { queued: "dim", running: "good", stalled: "warn", completed: "cyan", failed: "error" };

const SERIOUS = new Set<SimEvent["type"]>(["rackTripped", "componentFailed", "powerShortfall", "jobFailed", "bankrupt", "upsDepleted"]);
export const isSerious = (e: SimEvent): boolean => SERIOUS.has(e.type);

const report = (r: CommandResult): void => {
	if (!r.ok) pushNotice({ text: r.reason, severity: "warn", key: `bp:${r.reason}` });
};

/** The offer the induction points at: one that needs neither liquid cooling nor stored data, so the starter site can serve it. */
export function easiestOffer<T extends { needsLiquid: boolean; storageTB: number }>(offers: readonly T[]): T | undefined {
	return offers.find((o) => !o.needsLiquid && o.storageTB === 0) ?? offers.find((o) => !o.needsLiquid) ?? offers[0];
}

function Contracts(props: PanelProps) {
	const { store, state } = props;
	const { view } = state;
	// Ask the sim whether each offer can start on today's idle racks; ones that can't are shown blocked with the reason.
	const fit = new Map(view.offers.map((o) => [o.id, store.canBuild({ type: "acceptContract", contractId: o.id })]));
	const easy = view.offers.find((o) => fit.get(o.id)?.ok) ?? easiestOffer(view.offers);
	const clerk = view.clerk?.unlocked ? view.clerk : null;
	if (!view.offers.length)
		return (
			<>
				<ClerkPanel {...props} />
				<div className="ui-empty ui-pad">No offers right now — new contracts arrive every few hours.</div>
			</>
		);
	return (
		<>
			<ClerkPanel {...props} />
		<div className="ui-form">
			<div className="ui-form-head">
				<span>FORM AT-7 · CONTRACT REQUISITION</span>
				<span>IN TRIPLICATE · {view.offers.length} PENDING</span>
			</div>
			<table className="ui-table">
				<thead>
					<tr>
						<th>Client</th>
						<th>Kind</th>
						<th>Size</th>
						<th>Window</th>
						<th className="num">Payout</th>
						<th className="num" title="Dollars of payout per PFLOP-hour of work">$/PF·h</th>
						<th className="num">Penalty</th>
						<th>Needs</th>
						<th>Expires</th>
						<th />
					</tr>
				</thead>
				<tbody>
					{view.offers.map((o) => {
						const left = o.expiresAt - view.tick;
						const f = fit.get(o.id);
						const blocked = f && !f.ok ? f.reason : null;
						const verdict = clerk ? clerkVerdict(clerk.policy, o, f) : null;
						return (
							<tr key={o.id} className={blocked ? "is-blocked" : undefined}>
								<td className="strong">
									{o.clientName}
									{blocked ? (
										<span className="ui-offer-why">Can't start: {blocked}</span>
									) : (
										<span className="ui-offer-ok">Fits your idle racks</span>
									)}
									{clerk && <span className={`ui-offer-clerk ${verdict?.takes && clerk.policy.enabled ? "is-take" : ""}`}>{clerkRowText(clerk.policy.enabled, verdict as NonNullable<typeof verdict>)}</span>}
								</td>
								<td>
									<Pill tone={o.kind === "inference" ? "info" : "cyan"}>{o.kind}</Pill>
								</td>
								<td>{o.kind === "inference" ? `${fmtPflops(o.sustainedPflops ?? o.work)} sustained` : `${Math.round(o.work).toLocaleString()} PF·h`}</td>
								<td>{fmtDuration(o.durationTicks)}</td>
								<td className="num is-pos">{fmtMoney(o.payout)}</td>
								<td className="num">{fmtRate(payPerPflopHour(o), false)}</td>
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
									<button
										type="button"
										className="ui-stampbtn stamp-green"
										data-tut={o.id === easy?.id ? "accept" : undefined}
										aria-label="Accept"
										title={blocked ? `Can't accept: ${blocked}` : "Accept contract"}
										disabled={!!blocked}
										onClick={() => report(store.dispatch({ type: "acceptContract", contractId: o.id }))}
									>
										<span className="rest">Accept</span>
										<span className="hot">Approved</span>
									</button>
									<button
										type="button"
										className="ui-stampbtn stamp-red"
										aria-label="Decline"
										title="Decline contract"
										onClick={() => report(store.dispatch({ type: "declineContract", contractId: o.id }))}
									>
										<span className="rest">Decline</span>
										<span className="hot">Denied</span>
									</button>
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
		</>
	);
}

function Jobs({ store, state, ui }: PanelProps) {
	const { view } = state;
	if (!view.jobs.length) return <div className="ui-empty ui-pad">No jobs. Accept a contract to put your racks to work.</div>;
	return (
		<table className="ui-table ui-crt crt-amber ui-crt-table">
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
								<Pill status tone={jobTone[j.status]}>{j.status}</Pill>
							</td>
							<td className="wide">
								<div className="ui-progress">
									<Meter value={p} tone={j.status === "stalled" ? "warn" : j.status === "failed" ? "error" : "good"} height={12} />
									<Counter text={`${(p * 100).toFixed(1).padStart(5, "0")}%`} />
								</div>
							</td>
							<td className="num">{fmtPflops(j.pflops)}</td>
							<td className="num">{j.rackIds.length}</td>
							<td className={!done && left < 360 ? "is-warn" : "ui-dim"}>{done ? "—" : left >= 0 ? fmtDuration(left) : "overdue"}</td>
							<td className="num is-pos">{fmtMoney(j.payout)}</td>
							<td className="actions">
								{!done && (
									<button type="button" className="ui-btn ui-mini is-danger" onClick={() => report(store.dispatch({ type: "cancelJob", jobId: j.id }))} title="Cancel job">
										Abort
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
		{ label: "PUE", color: "var(--green)", pick: (s) => s.pue, fmt: fmtPue, min: 1 },
		{ label: "IT load", color: "var(--green)", pick: (s) => s.itKw, fmt: fmtPower, min: 0 },
		{ label: "Compute", color: "var(--green)", pick: (s) => s.pflops, fmt: fmtPflops, min: 0 },
		{ label: "Cash", color: "var(--green)", pick: (s) => s.cash, fmt: fmtMoney },
		{ label: "Max rack temp", color: "var(--green)", pick: (s) => s.maxRackC, fmt: (v) => fmtTemp(v), ref: content.balance.thermal.throttleC },
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
					<div key={s.label} className="ui-spark-card ui-crt crt-green">
						<div className="ui-spark-head">
							<span className="ui-label">{s.label}</span>
							<span className="ui-big">{s.fmt(last)}</span>
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

function Alerts({ store, content, state }: PanelProps) {
	const items = state.log.filter((e) => !isNoise(e.event)).slice(-80).reverse();
	if (!items.length) return <div className="ui-empty ui-pad">All quiet.</div>;
	return (
		<ul className="ui-alerts ui-crt crt-amber">
			{items.map((e, i) => {
				const d = describeEvent(e.event, state.view, content, state.settings.horrorIntensity);
				const cell = d.cell;
				const day = Math.floor(e.tick / 1440);
				const min = (e.tick + 360) % 1440;
				const t = `D${day} ${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
				return (
					// biome-ignore lint/suspicious/noArrayIndexKey: log rows can share a tick; the tick-index pair is the stable key
					// biome-ignore lint/a11y/useKeyWithClickEvents: click-to-focus on a log row is a mouse convenience; the log text is the accessible content
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
						data-tut={`btab-${t.id}`}
						role="tab"
						aria-selected={ui.bottomTab === t.id}
						className={`ui-tab ${ui.bottomTab === t.id && ui.bottomOpen ? "is-on" : ""}`}
						// A tab only ever opens or switches; collapsing is the PANEL toggle (or `), so "open the Contracts tab" can never hide it.
						onClick={() => setUi({ bottomTab: t.id, bottomOpen: true })}
					>
						{t.label}
						{!!badge[t.id] && <span className={`ui-badge ${t.id === "alerts" ? "is-alert" : ""}`}>{badge[t.id]}</span>}
					</button>
				))}
				<div className="ui-grow" />
				<Toggle on={ui.bottomOpen} onClick={() => setUi({ bottomOpen: !ui.bottomOpen })} title={ui.bottomOpen ? "Collapse (`)" : "Expand (`)"} label="PANEL" className="ui-collapse" />
			</div>
			{ui.bottomOpen && (
				<div className="ui-bottom-body">
					{ui.bottomTab === "contracts" && <Contracts {...props} />}
					{ui.bottomTab === "jobs" && <Jobs {...props} />}
					{ui.bottomTab === "telemetry" && <Telemetry {...props} />}
					{ui.bottomTab === "finance" && <FinanceTab {...props} />}
					{ui.bottomTab === "alerts" && <Alerts {...props} />}
				</div>
			)}
		</section>
	);
}
