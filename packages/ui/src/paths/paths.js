import { fmtPct } from "../format";
const endingTarget = (content, id, what) => {
    const e = content.balance?.endings?.[id];
    if (!e)
        return "";
    const title = content.endings?.find((x) => x.id === id)?.title ?? id;
    return ` ${title} needs ${what} of ${fmtPct(e.minScore, 0)} and ${e.pflops} PF compute, held for ${e.days} day${e.days === 1 ? "" : "s"}.`;
};
/** The gauge of the chosen path: green score for Greentech, refinement for Synthetic; null on any other path. */
export function pathGauge(view, content) {
    if (view.path === "greentech") {
        const g = view.greenScore ?? 0;
        return { id: "greentech", label: "GREEN SCORE", value: g, tone: "good", title: `Green score ${fmtPct(g, 0)}: solar, wind and exported heat raise it; a Dunkelflaute lowers it.${endingTarget(content, "greenExemplar", "a score")}` };
    }
    if (view.path === "synthetic") {
        const r = view.refinement ?? 0;
        return { id: "synthetic", label: "REFINEMENT", value: r, tone: "cyan", title: `Refinement ${fmtPct(r, 0)}: uptime times the share of compute on top-tier racks.${endingTarget(content, "millionMinds", "a refinement")}` };
    }
    return null;
}
/** The weather chip while a Dunkelflaute is in force. */
export function droughtChip(view, content) {
    if (!view.drought)
        return null;
    const g = content.balance?.green;
    const out = g ? ` Solar and wind give ${Math.round(g.droughtFactor * 100)} % of their output for about ${g.droughtHours} hours.` : "";
    return { label: "WEATHER", value: "DARK CALM", title: `Dunkelflaute: no sun, no wind.${out}` };
}
export const SANDBOX_TITLE = "Sandbox: no bankruptcy and no Compute Authority shutdown. Audits still run.";
