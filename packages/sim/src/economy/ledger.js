import { LEDGER_DAYS } from "../core/constants";
export const emptyLedgerDay = (day) => ({
    day,
    revenue: 0,
    energy: 0,
    upkeep: 0,
    construction: 0,
    penalties: 0,
    taxes: 0,
    interest: 0,
    fees: 0,
});
export function earn(state, amount) {
    state.cash += amount;
    state.today.revenue += amount;
    state.stats.revenue += amount;
}
/** Negative amounts are refunds. */
export function spend(state, field, amount) {
    state.cash -= amount;
    state.today[field] += amount;
}
/** Close today, keep the last 30 completed days, open `day`. */
export function rollLedger(state, day) {
    state.ledger.push(state.today);
    if (state.ledger.length > LEDGER_DAYS)
        state.ledger.splice(0, state.ledger.length - LEDGER_DAYS);
    state.today = emptyLedgerDay(day);
}
/** Everything the day cost: energy + upkeep + construction + penalties + taxes + interest + fees. */
export const dayCosts = (d) => d.energy + d.upkeep + d.construction + d.penalties + d.taxes + d.interest + d.fees;
/** Profit before the levy: revenue minus every cost except the levy itself. */
export const profitBeforeLevy = (d) => d.revenue - (d.energy + d.upkeep + d.construction + d.penalties + d.interest + d.fees);
