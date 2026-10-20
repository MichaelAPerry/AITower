import { START_MINUTE_OF_DAY, TICKS_PER_DAY } from "../api";
import { AMBIENT_PEAK_MINUTE } from "./constants";
/** Day index: each game-day is 1440 ticks starting at tick 0 (06:00). */
export const dayOf = (tick) => Math.floor(tick / TICKS_PER_DAY);
export const minuteOfDay = (tick) => (START_MINUTE_OF_DAY + tick) % TICKS_PER_DAY;
export const hourOf = (tick) => Math.floor(minuteOfDay(tick) / 60);
/** True on the last tick of a game-day (day-change evaluations run here). */
export const isLastTickOfDay = (tick) => (tick + 1) % TICKS_PER_DAY === 0;
/** Outdoor temperature: mean ± swing sinusoid peaking at 15:00. */
export function ambientAt(balance, tick) {
    const phase = ((minuteOfDay(tick) - AMBIENT_PEAK_MINUTE) / TICKS_PER_DAY) * 2 * Math.PI;
    return balance.ambientMeanC + balance.ambientSwingC * Math.cos(phase);
}
/** Current grid price $/kWh. */
export function energyPriceAt(balance, tick) {
    return balance.energyPrice * (balance.energyPriceByHour[hourOf(tick)] ?? 1);
}
