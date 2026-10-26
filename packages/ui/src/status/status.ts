/** Pure parts of the status widgets: the active-effect chips. */
import type { ModifierView } from "@aitower/sim";
import { fmtDuration } from "../format";


/** "+8 °C", "×0.50" or "×1.40" depending on the modifier kind. */
export function modifierValue(m: Pick<ModifierView, "kind" | "value">): string {
	if (m.kind === "ambient") return `${m.value >= 0 ? "+" : "−"}${Math.abs(m.value)} °C`;
	return `×${m.value.toFixed(2)}`;
}

/** Chip text such as "HEATWAVE +8 °C · 14h". */
export const modifierChip = (m: ModifierView, tick: number): string => `${m.label.toUpperCase()} ${modifierValue(m)} · ${fmtDuration(Math.max(0, m.endsAt - tick))}`;

/** Does the modifier hurt (red chip) or help (green chip)? Hot weather, a smaller grid, dearer power and more failures hurt. */
export function modifierHurts(m: Pick<ModifierView, "kind" | "value">): boolean {
	switch (m.kind) {
		case "ambient":
		case "energyPrice":
		case "failureRate":
			return m.value > (m.kind === "ambient" ? 0 : 1);
		case "gridCap":
		case "payout":
			return m.value < 1;
	}
}
