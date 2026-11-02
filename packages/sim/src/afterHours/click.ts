/** The click on an after-hours item (docs/AFTER_HOURS.md): counts the day, and opens the third-day or tenth-day dialogue. */
import type { AfterHoursItemId } from "@aitower/content";
import { type Plan, type PlanCtx, accept, reject } from "../commands/plan";
import { openDecision } from "../ministry/decisions";
import { dayOf } from "../core/time";
import { ITEM_IDS, spotOf, spotVisible, streakOf } from "./spots";

/** Number of lead-in lines per item (`ah_<item>_again1..N`). */
export const AGAIN_VARIANTS = 3;

export function planClickAfterHours(ctx: PlanCtx, item: AfterHoursItemId): Plan {
	const { state, content } = ctx;
	const spot = ITEM_IDS.includes(item) ? spotOf(item) : undefined;
	if (!spot) return reject("no such item");
	if (state.lesson || state.sandbox) return reject("nothing to see here");
	if (state.decision) return reject("answer the open decision first");
	if (!spotVisible(state, spot)) return reject("nothing built here yet");
	return accept(0, (events) => {
		const s = state.afterHours[item];
		const day = dayOf(state.tick);
		const ah = content.balance.afterHours;
		// One counted click per day; a missed day starts the count again at 1.
		if (s.lastDay !== day) {
			s.streak = streakOf(s, day) + 1;
			s.lastDay = day;
		}
		if (s.bought) return;
		const event = (id: string) => content.events.find((e) => e.id === id);
		if (s.streak >= ah.tenthDay && !s.tenthReached) {
			s.tenthReached = true;
			const e = event(`ah_${item}_tenth`);
			if (e) openDecision(state, e, events);
		} else if (s.tenthReached) {
			// Said No before (or just came back): a short lead-in line, then the same tenth-day dialogue.
			const e = event(`ah_${item}_tenth`);
			if (!e) return;
			const lead = `ah_${item}_again${(s.offers % AGAIN_VARIANTS) + 1}`;
			s.offers++;
			openDecision(state, e, events);
			if (state.decision && event(lead)) state.decision.lead = lead;
		} else if (s.streak >= ah.thirdDay && !s.thirdSeen) {
			s.thirdSeen = true;
			const e = event(`ah_${item}_third`);
			if (e) openDecision(state, e, events);
		}
	});
}
