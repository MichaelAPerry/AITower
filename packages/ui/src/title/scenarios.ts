/** Pure logic for the title screen's scenario picker. */
import type { ContentDB, Scenario } from "@aitower/content";
import { fmtMoney } from "../format";

export const DEFAULT_SCENARIO = "starter";

export interface ScenarioCard {
	id: string;
	name: string;
	description: string;
	/** "$3.00M · Clearance 1". */
	facts: string;
	sandbox: boolean;
}

/** Shown when a scenario has no description of its own (the standard start). */
const DEFAULT_BLURB = "The standard start: a bare garage lot, a grid tie and a modest account. Everything is still to be built.";

/** Cards for `content.scenarios`: the standard start first, then the rest in the content's order. */
export function scenarioCards(content: ContentDB): ScenarioCard[] {
	const all = Object.values(content.scenarios ?? {}) as Scenario[];
	const rank = (s: Scenario): number => (s.id === DEFAULT_SCENARIO ? 0 : 1);
	return all
		.map((s, i) => ({ s, i }))
		.sort((a, b) => rank(a.s) - rank(b.s) || a.i - b.i)
		.map(({ s }) => ({
			id: s.id,
			name: s.name,
			description: s.description?.trim() || DEFAULT_BLURB,
			facts: `${fmtMoney(s.startingCash ?? content.balance?.startingCash ?? 0)} · Clearance ${s.startTier ?? 1}`,
			sandbox: !!s.sandbox,
		}));
}

/** The picker only appears when there is a choice. */
export const showPicker = (cards: readonly ScenarioCard[]): boolean => cards.length > 1;

/** The selected id if the content has it, else the standard start (or the first scenario). */
export function validScenario(content: ContentDB, id: string | null | undefined): string {
	const s = content.scenarios ?? {};
	if (id && s[id]) return id;
	return s[DEFAULT_SCENARIO] ? DEFAULT_SCENARIO : (Object.keys(s)[0] ?? DEFAULT_SCENARIO);
}
