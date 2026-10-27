import type { TierView } from "./tier";

/** Tier badge, with the filled diamond for Path items. */
export function TierMark({ t }: { t: TierView }) {
	return (
		<span className="tier-mark">
			<span className="tier-badge" data-tier={t.info.tier}>
				{t.label}
			</span>
			{t.isPath && <span className="tier-diamond" aria-hidden="true" />}
		</span>
	);
}

/** Output as a share of the best item of its kind in the catalogue. */
export function OutputBar({ t, labelled }: { t: TierView; labelled?: boolean }) {
	if (!t.output) return null;
	const pct = Math.max(2, Math.round(t.output.share * 100));
	return (
		<span className="tier-out" title={`${pct}% of the best in the catalogue`}>
			<span className="tier-bar">
				<i style={{ width: `${pct}%` }} />
			</span>
			{labelled ? <span className="tier-out-text">Output {t.output.text}, {pct}% of the best in the catalogue</span> : <span className="tier-out-text">{t.output.text}</span>}
		</span>
	);
}
