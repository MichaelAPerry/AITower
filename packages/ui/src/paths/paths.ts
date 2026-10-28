/** Pure helpers for the top strip: the weather (drought) chip and the sandbox badge. */
import type { ContentDB } from "@aitower/content";
import type { SimView } from "@aitower/sim";

/** The weather chip while a Dunkelflaute is in force. */
export function droughtChip(view: Pick<SimView, "drought">, content: ContentDB): { label: string; value: string; title: string } | null {
	if (!view.drought) return null;
	const g = content.balance?.green;
	const out = g ? ` Solar and wind give ${Math.round(g.droughtFactor * 100)} % of their output for about ${g.droughtHours} hours.` : "";
	return { label: "WEATHER", value: "DARK CALM", title: `Dunkelflaute: no sun, no wind.${out}` };
}

export const SANDBOX_TITLE = "Sandbox: no bankruptcy. Audits still run.";
