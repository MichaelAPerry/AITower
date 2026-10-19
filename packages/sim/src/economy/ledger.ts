import type { LedgerDay } from "../api";
import { LEDGER_DAYS } from "../core/constants";
import type { SimState } from "../core/state";

export type CostField = "energy" | "upkeep" | "construction" | "penalties";

export const emptyLedgerDay = (day: number): LedgerDay => ({
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

export function earn(state: SimState, amount: number): void {
	state.cash += amount;
	state.today.revenue += amount;
}

/** Negative amounts are refunds. */
export function spend(state: SimState, field: CostField, amount: number): void {
	state.cash -= amount;
	state.today[field] += amount;
}

/** Close today, keep the last 30 completed days, open `day`. */
export function rollLedger(state: SimState, day: number): void {
	state.ledger.push(state.today);
	if (state.ledger.length > LEDGER_DAYS) state.ledger.splice(0, state.ledger.length - LEDGER_DAYS);
	state.today = emptyLedgerDay(day);
}
