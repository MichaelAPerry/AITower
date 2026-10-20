import { fmtDuration } from "../format";
/** Ticks until the memo is auto-filed (never negative). */
export const memoTicksLeft = (m, tick) => Math.max(0, m.expiresAt - tick);
/** A memo with under two game hours left is urgent. */
export const URGENT_TICKS = 120;
export const memoUrgent = (m, tick) => memoTicksLeft(m, tick) < URGENT_TICKS;
/** "AUTO-RESOLVES IN 11h 20m", or "BEING FILED" at zero. */
export const memoCountdown = (m, tick) => {
    const left = memoTicksLeft(m, tick);
    return left <= 0 ? "RESOLVING NOW" : `AUTO-RESOLVES IN ${fmtDuration(left)}`;
};
/** Label of the choice that is used if the memo is not answered. */
export const defaultChoiceLabel = (m) => m.choices.find((c) => c.id === m.defaultChoice)?.label ?? m.defaultChoice.toUpperCase();
/** Fraction of the memo's lifetime that remains, 0..1 (for the countdown bar). */
export const memoFraction = (m, tick) => {
    const span = m.expiresAt - m.issuedAt;
    return span <= 0 ? 0 : Math.min(1, memoTicksLeft(m, tick) / span);
};
/** Memos still waiting for an answer: not already stamped (a stamp is queued until the next tick). */
export const openMemos = (memos, stamped) => memos.filter((m) => !stamped.includes(m.id));
/** The memo to pop up: the oldest open one the player has not set aside. */
export const memoToPop = (memos, stamped, aside) => openMemos(memos, stamped).find((m) => !aside.includes(m.id)) ?? null;
/** Ids that still exist: drop bookkeeping for memos the sim has since resolved. */
export const pruneIds = (ids, memos) => ids.filter((id) => memos.some((m) => m.id === id));
/** Red below 25 (shutdown is near), amber below 50, otherwise green. */
export const standingTone = (standing) => (standing < 25 ? "red" : standing < 50 ? "amber" : "green");
export const clampStanding = (standing) => (Number.isFinite(standing) ? Math.min(100, Math.max(0, standing)) : 0);
/** "+8 °C", "×0.50" or "×1.40" depending on the modifier kind. */
export function modifierValue(m) {
    if (m.kind === "ambient")
        return `${m.value >= 0 ? "+" : "−"}${Math.abs(m.value)} °C`;
    return `×${m.value.toFixed(2)}`;
}
/** Chip text such as "HEATWAVE +8 °C · 14h". */
export const modifierChip = (m, tick) => `${m.label.toUpperCase()} ${modifierValue(m)} · ${fmtDuration(Math.max(0, m.endsAt - tick))}`;
/** Does the modifier hurt (red chip) or help (green chip)? Hot weather, a smaller grid, dearer power and more failures hurt. */
export function modifierHurts(m) {
    switch (m.kind) {
        case "ambient":
        case "energyPrice":
        case "failureRate":
            return m.value > (m.kind === "ambient" ? 0 : 1);
        case "gridCap":
        case "payout":
            return m.value < 1;
    }
}
/** Resolved memos newest first, with the label of the stamp that was used. */
export function historyRows(view, content) {
    return [...view.memoHistory].reverse().map((h) => {
        const label = content.events.find((e) => e.id === h.eventId)?.choices.find((c) => c.id === h.choiceId)?.label;
        return { memoId: h.memoId, title: h.title, stamp: label ?? h.choiceId.toUpperCase(), outcome: h.outcome, auto: h.auto, tick: h.tick };
    });
}
