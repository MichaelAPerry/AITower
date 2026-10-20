export const TICKS_PER_DAY = 1440;
export const START_MINUTE_OF_DAY = 360;
/** Pay rate of an offer in $ per PFLOP-hour: training/finetune payout ÷ work; inference payout ÷ (PFLOPS × hours). */
export function payPerPflopHour(spec) {
    if (spec.kind === "inference") {
        const pf = spec.sustainedPflops ?? spec.work;
        const hours = spec.durationTicks / 60;
        return pf > 0 && hours > 0 ? spec.payout / (pf * hours) : 0;
    }
    return spec.work > 0 ? spec.payout / spec.work : 0;
}
