import type { ModifierView } from "@aitower/sim";
import { clampStanding, modifierChip, modifierHurts, standingTone } from "./status";
import "./status.css";

/** Authority standing as a horizontal needle meter, 0–100, with a red zone below 25. */
export function StandingMeter({ standing }: { standing: number }) {
	const v = clampStanding(standing);
	const tone = standingTone(v);
	return (
		// biome-ignore lint/a11y/useSemanticElements: a custom needle meter; a native <meter> cannot be styled into this gauge
		<div className={`ui-standing tone-${tone}`} data-tut="standing" role="meter" aria-label="Reputation" data-help="reputation" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)}>
			<span className="ui-dymo">REPUTATION</span>
			<span className="ui-standing-row">
				<span className="ui-standing-scale" aria-hidden="true">
					<i className="ui-standing-red" />
					<i className="ui-standing-needle" style={{ left: `${v}%` }} />
				</span>
				<span className={`ui-crt ${tone === "red" ? "crt-red" : tone === "green" ? "crt-green" : "crt-amber"} ui-standing-read`}>{Math.round(v)}</span>
			</span>
		</div>
	);
}

const MAX_CHIPS = 2;

/** Active temporary effects, e.g. "HEATWAVE +8 °C · 14h". */
export function ModifierChips({ modifiers, tick }: { modifiers: readonly ModifierView[]; tick: number }) {
	if (modifiers.length === 0) return null;
	const shown = modifiers.slice(0, MAX_CHIPS);
	const hidden = modifiers.slice(MAX_CHIPS);
	return (
		<ul className="ui-modchips" aria-label="Active effects">
			{hidden.length > 0 && (
				<li className="ui-modchip is-more" title={hidden.map((m) => modifierChip(m, tick)).join("\n")}>
					+{hidden.length} MORE
				</li>
			)}
			{shown.map((m) => (
				<li key={`${m.kind}:${m.label}:${m.endsAt}`} className={`ui-modchip ${modifierHurts(m) ? "is-bad" : "is-good"}`}>
					{modifierChip(m, tick)}
				</li>
			))}
		</ul>
	);
}
