import type { JobKind } from "@aitower/content";
import type { ClerkPolicy } from "@aitower/sim";
import { useEffect, useState } from "react";
import { Toggle } from "../components/common";
import type { PanelProps } from "../components/context";
import { pushNotice } from "../notices";
import { clerkLockedText, feePercent, JOB_KINDS, parseAmount, toggleKind } from "./clerk";

const KIND_TITLE: Record<JobKind, string> = {
	training: "Training jobs: long, big payouts, penalised if late",
	finetune: "Fine-tuning jobs: medium length",
	inference: "Inference jobs: a steady load for a fixed time",
};

/**
 * A number box that keeps what you type (so "1." and an empty box are fine) and sends a valid value on every change.
 * An invalid entry leaves the standing order alone and snaps back when the box loses focus.
 */
export function AmountField({ label, value, onValue, title, prefix }: { label: string; value: number; onValue: (n: number) => void; title: string; prefix?: string }) {
	const [draft, setDraft] = useState(String(value));
	// Follow changes that came from elsewhere (a load, another control).
	useEffect(() => {
		setDraft((d) => (parseAmount(d) === value ? d : String(value)));
	}, [value]);
	return (
		<label className="ui-clerk-field" title={title}>
			<span className="ui-clerk-flabel">{label}</span>
			<span className="ui-clerk-box">
				{prefix && <span className="ui-clerk-prefix">{prefix}</span>}
				<input
					type="text"
					inputMode="decimal"
					className="ui-clerk-input"
					value={draft}
					aria-label={label}
					onChange={(e) => {
						setDraft(e.currentTarget.value);
						const n = parseAmount(e.currentTarget.value);
						if (n !== null) onValue(n);
					}}
					onBlur={() => setDraft(String(value))}
				/>
			</span>
		</label>
	);
}

/** The Contract Automation: a hire-me slip until researched, then a compact standing-order form. */
export function ClerkPanel({ store, content, state, openResearch }: PanelProps) {
	const clerk = state.view.clerk;
	if (!clerk) return null;
	if (!clerk.unlocked) {
		return (
			<div className="ui-clerk-slip" data-tut="clerk-locked">
				<span className="ui-clerk-slip-text">{clerkLockedText(content)}</span>
				<button type="button" className="ui-btn ui-mini" onClick={openResearch} title="Open the Department of Research (R)">
					Research (R)
				</button>
			</div>
		);
	}
	const p = clerk.policy;
	const send = (patch: Partial<ClerkPolicy>): void => {
		// Build on the policy as it is now, not as it was at the last render (the HUD redraws view changes at 10 Hz).
		const cur = store.get().view.clerk.policy;
		const r = store.dispatch({ type: "setClerk", policy: { ...cur, kinds: [...cur.kinds], ...patch } });
		if (!r.ok) pushNotice({ text: r.reason, severity: "warn", key: `clerk:${r.reason}` });
	};
	return (
		<section className={`ui-clerk ${p.enabled ? "is-on" : "is-off"}`} aria-label="Contract Automation standing order">
			<div className="ui-clerk-head">
				<span className="ui-clerk-title">CONTRACT AUTOMATION · STANDING ORDER</span>
				<span className="ui-clerk-stats" title="The clerk keeps this share of the earnings of every job it books">
					Fee {feePercent(content)} % · accepted so far: <b>{clerk.acceptedTotal}</b>
				</span>
			</div>
			<div className="ui-clerk-body">
				<Toggle on={p.enabled} onClick={() => send({ enabled: !p.enabled })} label={p.enabled ? "CLERK ON" : "CLERK OFF"} title={p.enabled ? "Clerk is on: it accepts matching offers once per tick. Click to switch off" : "Clerk is off: you accept offers by hand. Click to switch on"} className="ui-collapse ui-clerk-toggle" />
				<fieldset className="ui-clerk-kinds">
					<legend>Job kinds</legend>
					{JOB_KINDS.map((k) => (
						<label key={k} className="ui-clerk-check" title={p.kinds.length === 1 && p.kinds[0] === k ? "The clerk needs at least one job kind" : KIND_TITLE[k]}>
							<input type="checkbox" checked={p.kinds.includes(k)} disabled={p.kinds.length === 1 && p.kinds[0] === k} onChange={() => send({ kinds: toggleKind(p.kinds, k) })} />
							{k}
						</label>
					))}
				</fieldset>
				<AmountField label="Min $/PF·h" value={p.minPayPerPflopHour} onValue={(n) => send({ minPayPerPflopHour: n })} title="Skip offers that pay less than this many dollars per PFLOP-hour. 0 = any" prefix="$" />
				<AmountField label="Max penalty" value={p.maxPenalty} onValue={(n) => send({ maxPenalty: n })} title="Skip offers whose missed-deadline penalty is above this many dollars. 0 = any" prefix="$" />
				<label className="ui-clerk-check" title="Let the clerk take offers that need liquid-cooled racks">
					<input type="checkbox" checked={p.allowLiquid} onChange={() => send({ allowLiquid: !p.allowLiquid })} />
					allow liquid
				</label>
			</div>
		</section>
	);
}
