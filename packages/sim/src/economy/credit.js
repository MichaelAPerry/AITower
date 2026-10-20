import { accept, reject } from "../commands/plan";
import { profitBeforeLevy, spend } from "./ledger";
const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
/** Largest outstanding principal allowed at the current clearance. */
export const loanMax = (state, content) => content.balance.loans.maxByTier[state.tier - 1] ?? 0;
export function planTakeLoan(ctx, amount) {
    const { state, content } = ctx;
    if (!(amount > 0))
        return reject("loan amount must be positive");
    const max = loanMax(state, content);
    if (state.loanPrincipal + amount > max) {
        const room = Math.max(0, max - state.loanPrincipal);
        return reject(`exceeds the Clearance ${state.tier} credit limit of ${money(max)} (you owe ${money(state.loanPrincipal)}; ${money(room)} available)`);
    }
    return accept(0, (events) => {
        state.cash += amount; // a loan is not revenue
        state.loanPrincipal += amount;
        events.push({ type: "loanTaken", amount });
    });
}
export function planRepayLoan(ctx, amount) {
    const { state } = ctx;
    if (!(amount > 0))
        return reject("repayment must be positive");
    if (state.loanPrincipal <= 0)
        return reject("no loan outstanding");
    const pay = Math.min(amount, state.loanPrincipal);
    if (state.cash < pay)
        return reject(`insufficient funds (need ${money(Math.ceil(pay))})`);
    return accept(0, (events) => {
        state.cash -= pay;
        state.loanPrincipal -= pay;
        events.push({ type: "loanRepaid", amount: pay });
    });
}
/**
 * Last tick of a day, before the day closes: interest on the principal first, then the levy on the day's profit
 * (revenue − energy − upkeep − construction − penalties − interest − fees), so the levy sees the interest.
 * Both land on the day being closed.
 */
export function midnightCredit(ctx) {
    const { state, content } = ctx;
    const interest = state.loanPrincipal * content.balance.loans.dailyRate;
    if (interest > 0)
        spend(state, "interest", interest);
    const profit = profitBeforeLevy(state.today);
    const levy = profit * content.balance.tax.profitShare;
    if (profit > 0 && levy > 0)
        spend(state, "taxes", levy);
}
