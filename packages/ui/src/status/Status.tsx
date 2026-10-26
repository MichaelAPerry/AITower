import type { ModifierView } from "@aitower/sim";
import { modifierChip, modifierHurts } from "./status";
import "./status.css";

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
