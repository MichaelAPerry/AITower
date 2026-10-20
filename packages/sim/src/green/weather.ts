/** Greentech weather: daylight, hourly wind and the Dunkelflaute (drought). Stage 2b of the tick. */
import type { TickCtx } from "../core/context";
import { TICKS_PER_DAY } from "../api";
import { DAYLIGHT_END_MINUTE, DAYLIGHT_START_MINUTE, TICKS_PER_HOUR, WIND_MAX, WIND_MIN } from "../core/constants";
import { nextRandom } from "../core/rng";
import type { SimState } from "../core/state";
import { minuteOfDay } from "../core/time";

/** 0 between 20:00 and 06:00; a sine over the day with its peak at 13:00. */
export function daylight(minute: number): number {
	if (minute <= DAYLIGHT_START_MINUTE || minute >= DAYLIGHT_END_MINUTE) return 0;
	return Math.sin((Math.PI * (minute - DAYLIGHT_START_MINUTE)) / (DAYLIGHT_END_MINUTE - DAYLIGHT_START_MINUTE));
}

export const isDrought = (state: SimState): boolean => state.tick < state.droughtUntil;

/** Output share of solar (0..1) and wind (0.2..1) this tick, drought included. */
export function renewableFactors(state: SimState, droughtFactor: number): { solar: number; wind: number } {
	const weather = isDrought(state) ? droughtFactor : 1;
	return { solar: daylight(minuteOfDay(state.tick)) * weather, wind: state.wind * weather };
}

/**
 * Draws from the `weather` stream: one wind value at the top of every game-hour, and one drought roll at the start of every
 * game-day (tick % 1440 == 0, i.e. at dawn).
 * Both always draw, so the stream does not depend on whether a drought is running.
 */
export function weatherStep(ctx: TickCtx): void {
	const { state, content, events } = ctx;
	const minute = minuteOfDay(state.tick);
	if (state.droughtUntil > 0 && state.tick === state.droughtUntil) events.push({ type: "droughtEnded" });
	if (minute % TICKS_PER_HOUR === 0) state.wind = WIND_MIN + (WIND_MAX - WIND_MIN) * nextRandom(state.rng, "weather");
	if (state.tick % TICKS_PER_DAY === 0) {
		const roll = nextRandom(state.rng, "weather");
		const g = content.balance.green;
		if (!isDrought(state) && roll < g.droughtChancePerDay) {
			state.droughtUntil = state.tick + Math.max(1, Math.round(g.droughtHours * TICKS_PER_HOUR));
			events.push({ type: "droughtStarted" });
		}
	}
}
