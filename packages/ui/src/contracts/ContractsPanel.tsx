import type { CommandResult } from "@aitower/sim";
import { ClerkPanel } from "../clerk/ClerkPanel";
import { easiestOffer } from "../calm/Panels";
import { Meter } from "../components/common";
import type { PanelProps } from "../components/context";
import { fmtDuration, fmtMoney } from "../format";
import { pushNotice } from "../notices";
import { FactRow, ListHeading, PanelHead, PrimaryAction, SplitPane } from "../panel/PanelShell";
import { clockText, fitText, jobStatus, KIND_BLURB, KIND_NAME, needLine, offerFacts, payLine, pickSelection, type Selection } from "./contractText";

const report = (r: CommandResult): boolean => {
	if (!r.ok) pushNotice({ text: r.reason, severity: "warn", key: `bp:${r.reason}` });
	return r.ok;
};

/** Contracts: running jobs pinned on top, the job board below, and an Inspector that explains the pick in plain words. */
export function ContractsDrawer(props: PanelProps) {
	const { store, state, content, ui, setUi } = props;
	const { view } = state;
	const fit = new Map(view.offers.map((o) => [o.id, store.canBuild({ type: "acceptContract", contractId: o.id })]));
	const easy = view.offers.find((o) => fit.get(o.id)?.ok) ?? easiestOffer(view.offers);
	const live = view.jobs.filter((j) => j.status !== "completed" && j.status !== "failed");
	const sel = pickSelection(ui.contractSel, ui.focusJobId, view.offers, live, easy?.id);
	const select = (s: Selection): void => setUi({ contractSel: s, focusJobId: null });
	const clerk = view.clerk?.unlocked ? view.clerk : null;
	const offer = sel?.kind === "offer" ? view.offers.find((o) => o.id === sel.id) : undefined;
	const job = sel?.kind === "job" ? live.find((j) => j.id === sel.id) : undefined;

	const take = (id: number): void => {
		const before = Math.max(-1, ...view.jobs.map((j) => j.id));
		if (!report(store.dispatch({ type: "acceptContract", contractId: id }))) return;
		const made = store.get().view.jobs.find((j) => j.id > before);
		setUi({ contractSel: made ? { kind: "job", id: made.id } : null, focusJobId: null });
	};

	const list = (
		<>
			{clerk && (
				<div className="ui-clerkline">
					<span>
						Contract Automation {clerk.policy.enabled ? "ON" : "OFF"} · {clerk.acceptedTotal} booked
					</span>
					<button type="button" className="ui-btn ui-mini" aria-expanded={!!ui.clerkEdit} onClick={() => setUi({ clerkEdit: !ui.clerkEdit })}>
						{ui.clerkEdit ? "Done" : "Edit"}
					</button>
				</div>
			)}
			{/* The "hire a clerk" upsell is noise for a beginner: it waits until a few contracts are done. */}
			{((!clerk && (view.stats?.jobsCompleted ?? 0) >= 3) || ui.clerkEdit) && <ClerkPanel {...props} />}
			{live.length > 0 && (
				<>
					<ListHeading count={live.length}>Running now</ListHeading>
					{live.map((j) => {
						const p = j.total > 0 ? j.progress / j.total : 0;
						const st = jobStatus(j, view.tick, content);
						const on = sel?.kind === "job" && sel.id === j.id;
						return (
							<button key={`j${j.id}`} type="button" role="option" aria-selected={on} className={`pnl-card ${on ? "is-sel" : ""}`} onClick={() => select({ kind: "job", id: j.id })}>
								<span className="pnl-card-top">
									<span className="pnl-card-name">{j.clientName}</span>
									<span className={`pnl-chip tone-${st.tone}`}>{st.label}</span>
								</span>
								<span className="pnl-card-sub">
									{KIND_NAME[j.kind]} · {(p * 100).toFixed(0)}% done
								</span>
								<Meter value={p} tone={st.tone === "bad" ? "error" : st.tone === "warn" ? "warn" : "good"} height={5} />
							</button>
						);
					})}
				</>
			)}
			<ListHeading count={view.offers.length}>Job board</ListHeading>
			{view.offers.length === 0 && <p className="pnl-empty">No jobs on the board right now. New ones arrive every few hours.</p>}
			{view.offers.map((o) => {
				const f = fitText(fit.get(o.id));
				const on = sel?.kind === "offer" && sel.id === o.id;
				return (
					<button key={`o${o.id}`} type="button" role="option" aria-selected={on} data-tut={o.id === easy?.id ? "offer" : undefined} className={`pnl-card ${on ? "is-sel" : ""} ${f.ok ? "" : "is-blocked"}`} onClick={() => select({ kind: "offer", id: o.id })}>
						<span className="pnl-card-top">
							<span className="pnl-card-name">{o.clientName}</span>
							<span className="pnl-card-pay">{payLine(o)}</span>
						</span>
						<span className="pnl-card-sub">
							{KIND_NAME[o.kind]} · needs {needLine(o)}
						</span>
						<span className={`pnl-fit ${f.ok ? "is-ok" : "is-no"}`}>{f.ok ? "Fits your idle racks ✓" : "Can't start yet"}</span>
					</button>
				);
			})}
		</>
	);

	let inspector: React.ReactNode;
	if (offer) {
		const f = fitText(fit.get(offer.id));
		const left = offer.expiresAt - view.tick;
		inspector = (
			<>
				<div className="bld-kicker">Job offer · {KIND_NAME[offer.kind]}</div>
				<h3 className="bld-h">{offer.clientName}</h3>
				<p className="bld-blurb">{KIND_BLURB[offer.kind]}</p>
				<div className="bld-stats">
					{offerFacts(offer, content).map((x) => (
						<FactRow key={x.label} f={x} />
					))}
				</div>
				<p className={f.ok ? "bld-placing" : "bld-warn"}>{f.text}</p>
				<p className="pnl-small">
					Offer ends in {fmtDuration(Math.max(0, left))} ({clockText(offer.expiresAt)}).
				</p>
				<PrimaryAction label={`Take job · earn ${fmtMoney(offer.payout)}`} tut="take" disabled={!f.ok} why={f.ok ? null : f.text} onClick={() => take(offer.id)} />
				<button type="button" className="pnl-link" onClick={() => report(store.dispatch({ type: "declineContract", contractId: offer.id }))}>
					No thanks, remove this offer
				</button>
			</>
		);
	} else if (job) {
		const p = job.total > 0 ? job.progress / job.total : 0;
		const st = jobStatus(job, view.tick, content);
		inspector = (
			<>
				<div className="bld-kicker">Running job · {KIND_NAME[job.kind]}</div>
				<h3 className="bld-h">{job.clientName}</h3>
				<div className={`pnl-status tone-${st.tone}`}>
					<b>{st.label}</b>
					<span>{st.detail}</span>
				</div>
				<div className="pnl-prog">
					<Meter value={p} tone={st.tone === "bad" ? "error" : st.tone === "warn" ? "warn" : "good"} height={8} />
					<span>{(p * 100).toFixed(0)}% done</span>
				</div>
				<div className="bld-stats">
					<FactRow f={{ icon: "$", label: `Pays ${fmtMoney(job.payout)}`, sub: "Paid as work is saved and when the job finishes.", value: fmtMoney(job.payout), tone: "money" }} />
					<FactRow f={{ icon: "⏱", label: `Deadline ${clockText(job.deadline)}`, sub: `${fmtDuration(Math.max(0, job.deadline - view.tick))} from now.`, value: fmtDuration(Math.max(0, job.deadline - view.tick)) }} />
					<FactRow f={{ icon: "PF", label: `${job.rackIds.length} rack${job.rackIds.length === 1 ? "" : "s"} working on it`, sub: "More free racks speed up training and finetune jobs.", value: `${Math.round(job.pflops * 10) / 10} PF` }} />
				</div>
				<div className="pnl-act">
					<button type="button" className="ui-btn pnl-secondary is-danger" onClick={() => report(store.dispatch({ type: "cancelJob", jobId: job.id }))}>
						Give up on this job
					</button>
					<p className="pnl-small">Giving up counts as a failed job, and a training job also charges its late fine. Only do it if you are stuck.</p>
				</div>
			</>
		);
	} else {
		inspector = (
			<>
				<div className="bld-kicker">Jobs</div>
				<h3 className="bld-h">Pick a job</h3>
				<p className="bld-blurb">Clients pay you to use your racks. When a job appears on the board, click it to read what it needs and what it pays, then press Take job.</p>
			</>
		);
	}

	return (
		<>
			<PanelHead kicker="Earn money" title="Contracts" />
			<SplitPane list={list} inspector={inspector} />
		</>
	);
}
