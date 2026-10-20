import { fmtMoney } from "../format";
export const DEFAULT_SCENARIO = "starter";
/** Shown when a scenario has no description of its own (the standard start). */
const DEFAULT_BLURB = "The standard start: a bare garage lot, a grid tie and a modest account. Everything is still to be built.";
/** Cards for `content.scenarios`: the standard start first, then the rest in the content's order. */
export function scenarioCards(content) {
    const all = Object.values(content.scenarios ?? {});
    const rank = (s) => (s.id === DEFAULT_SCENARIO ? 0 : 1);
    return all
        .map((s, i) => ({ s, i }))
        .sort((a, b) => rank(a.s) - rank(b.s) || a.i - b.i)
        .map(({ s }) => ({
        id: s.id,
        name: s.name,
        description: s.description?.trim() || DEFAULT_BLURB,
        facts: `${fmtMoney(s.startingCash ?? content.balance?.startingCash ?? 0)} · Level ${s.startTier ?? 1}`,
        sandbox: !!s.sandbox,
    }));
}
/** The picker only appears when there is a choice. */
export const showPicker = (cards) => cards.length > 1;
/** The selected id if the content has it, else the standard start (or the first scenario). */
export function validScenario(content, id) {
    const s = content.scenarios ?? {};
    if (id && s[id])
        return id;
    return s[DEFAULT_SCENARIO] ? DEFAULT_SCENARIO : (Object.keys(s)[0] ?? DEFAULT_SCENARIO);
}
