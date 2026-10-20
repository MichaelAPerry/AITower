import type { CommandResult, JobStatus, SimEvent } from "@aitower/sim";
import { payPerPflopHour } from "@aitower/sim";
import { ClerkPanel } from "../clerk/ClerkPanel";
import { clerkRowText, clerkVerdict, fmtRate } from "../clerk/clerk";
import { feedLines } from "./calm";
import { fmtDuration, fmtMoney, fmtPflops, fmtPower, fmtPue, fmtTemp } from "../format";
import { pushNotice } from "../notices";
import { cheapestAvailable, nodeState, techList } from "../research/tech";
import { Meter, Pill, type Tone } from "../components/common";
import type { PanelProps } from "../components/context";
import { downsample, Sparkline } from "../components/Sparkline";

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

/** Contracts drawer: the clerk in one line (Edit opens its form), the offers as compact rows, then the running jobs. */
export function ContractsDrawer(props: PanelProps) {
	const { store, state, ui, setUi } = props;
	const { view } = state;
	const fit = new Map(view.offers.map((o) => [o.id, store.canBuild({ type: "acceptContract", contractId: o.id })]));
	const easy = view.offers.find((o) => fit.get(o.id)?.ok) ?? easiestOffer(view.offers);
	const clerk = view.clerk?.unlocked ? view.clerk : null;
	const live = view.jobs.filter((j) => j.status !== "completed" && j.status !== "failed");
	return (
		<>
			{clerk && (
				<div className="ui-clerkline">
					<span>
						CONTRACT AUTOMATION {clerk.policy.enabled ? "ON" : "OFF"} · {clerk.acceptedTotal} booked
					</span>
					<button type="button" className="ui-btn ui-mini" aria-expanded={!!ui.clerkEdit} onClick={() => setUi({ clerkEdit: !ui.clerkEdit })}>
						{ui.clerkEdit ? "Done" : "Edit"}
					</button>
				</div>
			)}
			{(!clerk || ui.clerkEdit) && <ClerkPanel {...props} />}
			<h4 className="ui-dh">
				<span>OFFERS</span>
				<span>{view.offers.length}</span>
			</h4>
			{view.offers.length === 0 && <div className="ui-empty">No offers right now. New ones arrive every few hours.</div>}
			{view.offers.map((o) => {
				const f = fit.get(o.id);
				const blocked = f && !f.ok ? f.reason : null;
				const left = o.expiresAt - view.tick;
				const verdict = clerk ? clerkVerdict(clerk.policy, o, f) : null;
				return (
					<div key={o.id} className={`ui-row-card ${blocked ? "is-blocked" : ""}`}>
						<span className="ui-rc-name">
							{o.clientName} <span className="ui-dim">· {o.kind}</span>
						</span>
						<span className="ui-rc-num is-money">{fmtMoney(o.payout)}</span>
						<span className="ui-rc-num" title="Dollars of payout per PFLOP-hour of work">
							{fmtRate(payPerPflopHour(o), false)}
						</span>
						<Pill status tone={blocked ? "error" : "good"}>
							{blocked ? "can't start" : "fits"}
						</Pill>
						<span className="ui-rc-act">
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
							<button type="button" className="ui-btn ui-mini" aria-label="Decline" title="Decline contract" onClick={() => report(store.dispatch({ type: "declineContract", contractId: o.id }))}>
								✕
							</button>
						</span>
						{blocked && <span className="ui-rc-why">{blocked}</span>}
						{clerk && <span className="ui-rc-why is-soft">{clerkRowText(clerk.policy.enabled, verdict as NonNullable<typeof verdict>)}</span>}
						{left < 120 && <span className="ui-rc-why is-soft">expires in {fmtDuration(left)}</span>}
					</div>
				);
			})}
			<h4 className="ui-dh">
				<span>RUNNING</span>
				<span>{live.length}</span>
			</h4>
			{live.length === 0 && <div className="ui-empty">Nothing running. Accept an offer to put the racks to work.</div>}
			{live.map((j) => {
				const p = j.total > 0 ? j.progress / j.total : 0;
				const left = j.deadline - view.tick;
				return (
					<div key={j.id} className={`ui-row-card ${ui.focusJobId === j.id ? "is-focus" : ""}`}>
						<span className="ui-rc-name">
							{j.clientName} <span className="ui-dim">· {j.kind}</span>
						</span>
						<span className="ui-rc-num">{(p * 100).toFixed(0)}%</span>
						<span className="ui-rc-num">{fmtPflops(j.pflops)}</span>
						<Pill status tone={jobTone[j.status]}>
							{j.status}
						</Pill>
						<span className="ui-rc-act">
							<button type="button" className="ui-btn ui-mini is-danger" onClick={() => report(store.dispatch({ type: "cancelJob", jobId: j.id }))} title="Cancel job">
								Abort
							</button>
						</span>
						<span className="ui-rc-bar">
							<Meter value={p} tone={j.status === "stalled" ? "warn" : "good"} height={4} />
						</span>
						{left < 360 && <span className="ui-rc-why">{left >= 0 ? `due in ${fmtDuration(left)}` : "overdue"}</span>}
					</div>
				);
			})}
		</>
	);
}

/** Research drawer: only what can be bought now or nearly (at least half the cost in hand), with a way into the full sheet. */
export function ResearchDrawer({ store, content, state, openResearch }: PanelProps) {
	const { view } = state;
	const rows = techList(content)
		.map((n) => ({ n, s: nodeState(n, view, content) }))
		.filter(({ n, s }) => s.kind === "available" || (s.kind === "poor" && view.researchPoints >= n.cost / 2))
		.sort((a, b) => a.n.cost - b.n.cost)
		.slice(0, 6);
	const next = cheapestAvailable(view, content);
	return (
		<>
			<h4 className="ui-dh">
				<span>RESEARCH</span>
				<span className="ui-rp">{Math.floor(view.researchPoints)} RP</span>
			</h4>
			{rows.length === 0 && <div className="ui-empty">Nothing within reach yet. Racks and finished jobs earn research points.</div>}
			{rows.map(({ n, s }) => (
				<div key={n.id} className={`ui-row-card ${s.kind === "available" ? "is-ready" : ""}`}>
					<span className="ui-rc-name">{n.name}</span>
					<span className="ui-rc-num is-rp">{n.cost}</span>
					{s.kind === "available" ? (
						<button type="button" className="ui-btn ui-mini is-accent" title={n.description} onClick={() => report(store.dispatch({ type: "research", techId: n.id }))}>
							Research
						</button>
					) : (
						<Pill tone="dim">{s.kind === "poor" ? `need ${s.short}` : ""}</Pill>
					)}
				</div>
			))}
			<button type="button" className={`ui-btn ui-wide ${next ? "is-accent" : ""}`} onClick={openResearch}>
				Open the full Department of Research
			</button>
		</>
	);
}

export function Telemetry({ content, state }: PanelProps) {
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

export function AlertsLog({ store, content, state }: PanelProps) {
	const items = feedLines(state.log.slice(-400), state.view, content, state.settings.horrorIntensity).slice(-80).reverse();
	if (!items.length) return <div className="ui-empty ui-pad">All quiet.</div>;
	return (
		<ul className="ui-alerts ui-crt crt-amber">
			{items.map((l) => {
				const cell = l.cell;
				const day = Math.floor(l.tick / 1440);
				const min = (l.tick + 360) % 1440;
				const t = `D${day} ${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
				return (
					// biome-ignore lint/a11y/useKeyWithClickEvents: click-to-focus on a log row is a mouse convenience; the log text is the accessible content
					<li key={l.key} className={`sev-${l.severity} ${cell ? "is-click" : ""}`} onClick={cell ? () => store.focus(cell) : undefined} title={cell ? "Click to focus" : undefined}>
						<span className="ui-alert-dot" />
						<span className="ui-alert-time">{t}</span>
						<span className="ui-alert-text">{l.text}</span>
					</li>
				);
			})}
		</ul>
	);
}
