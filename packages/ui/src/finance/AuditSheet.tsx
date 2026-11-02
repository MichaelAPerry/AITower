import type { QuarterReport } from "@aitower/sim";
import { type KeyboardEvent, useEffect, useRef } from "react";
import { Stamp } from "../components/common";
import { focusables, nextFocusIndex } from "../menu/focus";
import { Portrait } from "../advisors/Portrait";
import { pickQuip, quipMood } from "./auditQuips";
import { auditOutcome, gradeTone, reportRows } from "./finance";

/**
 * QUARTERLY INSPECTION: a modal paper sheet with the figures, a big grade stamp, the standing and cash change and the
 * Compute Authority's remark. It does not pause the game. Closes with the button or Esc.
 */
export function AuditSheet({ report, onClose }: { report: QuarterReport; onClose: () => void }) {
	const root = useRef<HTMLDivElement>(null);
	// biome-ignore lint/correctness/useExhaustiveDependencies: focus the close button when a (new) report appears
	useEffect(() => {
		if (root.current) focusables(root.current)[0]?.focus();
	}, [report.quarter]);

	const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
		// The sheet does not pause the game, so game hotkeys still work; only the keys the sheet itself uses stay inside it.
		if (["Escape", "Tab", "Enter", " "].includes(e.key)) e.stopPropagation();
		if (e.key === "Escape") {
			e.preventDefault();
			onClose();
			return;
		}
		if (e.key !== "Tab" || !root.current) return;
		const els = focusables(root.current);
		const i = nextFocusIndex(els.length, els.indexOf(document.activeElement as HTMLElement), e.shiftKey);
		if (i >= 0) {
			e.preventDefault();
			els[i].focus();
		}
	};
	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: modal sheet; the key handler implements Esc and the focus loop
		<div className="ui-audit-backdrop" ref={root} onKeyDown={onKeyDown}>
			<AuditPaper report={report} onClose={onClose} />
		</div>
	);
}

/** The sheet itself (no hooks, so tests can call it directly): Luci's face and remark, the figures, the grade and a Close button. */
export function AuditPaper({ report, onClose }: { report: QuarterReport; onClose: () => void }) {
	const tone = gradeTone(report.grade);
	const out = auditOutcome(report);
	return (
		<article className="ui-panel ui-audit" role="dialog" aria-modal="true" aria-labelledby="audit-title">
			<header className="ui-audit-head">
				<span>FACILITY INSPECTION</span>
				<span>QUARTER {report.quarter}</span>
			</header>
			<h2 className="ui-audit-title" id="audit-title">
				QUARTERLY INSPECTION
			</h2>
			<div className="ui-audit-luci">
				<Portrait id="luci" size={96} mood={quipMood(report)} />
				<p className="ui-audit-quip">
					<b>Luci</b>
					{pickQuip(report)}
				</p>
			</div>
			<div className="ui-audit-main">
				<dl className="ui-audit-figs">
					{reportRows(report).map((r) => (
						<div key={r.label}>
							<dt>{r.label}</dt>
							<dd className={r.tone === "bad" ? "is-bad" : r.tone === "good" ? "is-good" : ""}>{r.value}</dd>
						</div>
					))}
				</dl>
				<div className="ui-audit-grade">
					<span className="ui-audit-gradelabel">GRADE</span>
					<Stamp tone={tone} className="ui-audit-stamp">
						{report.grade}
					</Stamp>
				</div>
			</div>
			<p className="ui-audit-outcome">
				<span className={report.cashDelta < 0 ? "is-bad" : report.cashDelta > 0 ? "is-good" : ""}>{out.cash}</span>
			</p>
			<blockquote className="ui-audit-remark">{report.remark}</blockquote>
			<footer className="ui-audit-acts">
				<button type="button" className="ui-btn ui-audit-close" data-audit-close onClick={onClose} title="Close the inspection (Esc)">
					Close
				</button>
			</footer>
		</article>
	);
}
