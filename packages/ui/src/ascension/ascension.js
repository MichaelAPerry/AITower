import { pushNotice } from "../notices";
/** The paths as listed on the sheet, in the content's order. */
export function pathRows(content, view) {
    return (content.paths ?? []).map((p) => ({ id: p.id, name: p.name, description: p.description, available: p.available, chosen: view.path === p.id }));
}
/** Clearance is high enough, no path is chosen yet, and at least one path can be chosen. */
export function ascensionDue(view, content) {
    const min = content.balance?.ascension?.minTier;
    return min !== undefined && view.tier >= min && view.path === null && (content.paths ?? []).some((p) => p.available);
}
/** True between filing and the next tick (when the path appears in the view, or the sim has refused it). */
export const pathPending = (filed, view) => !!filed && view.path === null && view.tick <= filed.tick;
/** The path to ask confirmation for: only an available path of this content. */
export function pathToConfirm(content, id) {
    return (content.paths ?? []).some((p) => p.id === id && p.available) ? id : null;
}
export const confirmQuestion = (name) => `Commit to ${name}? This cannot be undone.`;
/** Dispatch the irreversible choice. Returns the filing marker on success; a refusal is shown as a notice. */
export function filePath(store, content, id) {
    if (!pathToConfirm(content, id))
        return null;
    const r = store.dispatch({ type: "choosePath", path: id });
    if (!r.ok) {
        pushNotice({ text: r.reason, severity: "warn", key: `path:${r.reason}` });
        return null;
    }
    return { path: id, tick: store.get().view.tick };
}
/** Path order and colours (one hue per path; used by the bars, the memo chips and the sheet). */
export const PATH_ORDER = ["biotech", "greentech", "synthetic"];
export const PATH_COLOR = { biotech: "#d9669c", greentech: "#4ee08a", synthetic: "#9b8cff" };
/** The path with the largest affinity share; null when all are zero or the top two tie. */
export function leadingPath(affinity) {
    const sorted = [...PATH_ORDER].sort((a, b) => affinity[b] - affinity[a]);
    return affinity[sorted[0]] > 0 && affinity[sorted[0]] > affinity[sorted[1]] ? sorted[0] : null;
}
/** The path the sheet opens with selected: the leading one if it can be chosen. */
export function preselectedPath(content, affinity) {
    const lead = leadingPath(affinity);
    return lead ? pathToConfirm(content, lead) : null;
}
/** "Biotech 62%" style label for a share. */
export const sharePct = (share) => `${Math.round(share * 100)}%`;
