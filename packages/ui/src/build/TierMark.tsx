import { type CatalogueGroup, GROUP_LABEL } from "@aitower/content";
import type { TierView } from "./tier";

/** Tier badge, with the filled diamond for Path items, and the catalogue tag (Starter, Specialist, Signature, Synthetic; Shared wears none). */
export function TierMark({ t, group }: { t: TierView; group?: CatalogueGroup }) {
	return (
		<span className="tier-mark">
			<span className="tier-badge" data-tier={t.info.tier}>
				{t.label}
			</span>
			{t.isPath && <span className="tier-diamond" aria-hidden="true" />}
			{group && group !== "shared" && (
				<span className="group-tag" data-group={group}>
					{GROUP_LABEL[group]}
				</span>
			)}
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
