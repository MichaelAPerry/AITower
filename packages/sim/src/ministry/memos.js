import { accept, reject } from "../commands/plan";
import { stockParts } from "../commands/operations";
import { SCRIPTED_MINUTE_OF_DAY } from "../core/constants";
import { nextRandom } from "../core/rng";
import { dayOf, minuteOfDay } from "../core/time";
import { earn, spend } from "../economy/ledger";
import { failRack } from "../reliability/reliabilityStep";
import { getDef } from "../world/defs";
import { addAffinity } from "../progression/affinity";
import { expireModifiers, modifierLabel } from "./modifiers";
import { changeStanding } from "./standing";
export const MEMO_HISTORY_LENGTH = 20;
export function eventDef(content, eventId) {
    return content.events.find((e) => e.id === eventId);
}
/** Ticks until the next memo roll: intervalTicks ±50 % (uniform), one draw from the events stream. */
export function nextMemoDelay(state, content) {
    return Math.max(1, Math.round(content.balance.events.intervalTicks * (0.5 + nextRandom(state.rng, "events"))));
}
/** Horror gates: `minCorruption` and `path`. */
const bioGate = (state, e) => (e.minCorruption === undefined || state.corruption >= e.minCorruption) && (e.path === undefined || state.path === e.path);
function eligible(state, content) {
    const day = dayOf(state.tick);
    const open = new Set(state.memos.map((m) => m.eventId));
    return content.events.filter((e) => {
        if (e.scriptedDay !== undefined)
            return false; // scripted events are never picked randomly
        if (!bioGate(state, e))
            return false;
        if (open.has(e.id))
            return false;
        if (state.tier < e.minTier)
            return false;
        if (e.maxTier !== undefined && state.tier > e.maxTier)
            return false;
        if (day < (e.minDay ?? 0))
            return false;
        const last = Object.hasOwn(state.lastIssuedDay, e.id) ? state.lastIssuedDay[e.id] : undefined;
        return last === undefined || day - last >= e.cooldownDays;
    });
}
function openMemo(state, e, events) {
    const memo = { id: state.nextId.memo++, eventId: e.id, issuedAt: state.tick, expiresAt: state.tick + e.timeoutTicks };
    state.memos.push(memo);
    state.lastIssuedDay[e.id] = dayOf(state.tick);
    events.push({ type: "memoIssued", memoId: memo.id, eventId: e.id });
}
/** Scripted events (`scriptedDay`) are issued once, at 09:00 on their day: no weight, cooldown, timing or `maxOpen`; tier limits apply. */
function issueScripted(ctx) {
    const { state, content, events } = ctx;
    if (minuteOfDay(state.tick) !== SCRIPTED_MINUTE_OF_DAY)
        return;
    const day = dayOf(state.tick);
    for (const e of content.events) {
        if (e.scriptedDay !== day || state.scriptedIssued.includes(e.id) || !bioGate(state, e))
            continue;
        if (state.tier < e.minTier || (e.maxTier !== undefined && state.tier > e.maxTier))
            continue;
        state.scriptedIssued.push(e.id);
        openMemo(state, e, events);
    }
}
function issueMemo(ctx) {
    const { state, content, events } = ctx;
    const pool = eligible(state, content);
    if (pool.length === 0)
        return;
    let total = 0;
    for (const e of pool)
        total += e.weight;
    let r = nextRandom(state.rng, "events") * total;
    let pick = pool[pool.length - 1];
    for (const e of pool) {
        if (r < e.weight) {
            pick = e;
            break;
        }
        r -= e.weight;
    }
    openMemo(state, pick, events);
}
/** Tick stage 9b: expire modifiers, time out memos, issue scripted events, roll for a new memo. */
export function memoStep(ctx) {
    const { state, content, events } = ctx;
    expireModifiers(state);
    for (const memo of state.memos.slice()) {
        if (memo.expiresAt > state.tick)
            continue;
        const def = eventDef(content, memo.eventId);
        const choice = def?.choices.find((c) => c.id === def.defaultChoice);
        if (def && choice)
            resolveNow(state, content, memo, def, choice, true, events);
        else
            state.memos = state.memos.filter((m) => m.id !== memo.id); // unknown event (stale save): drop silently
    }
    issueScripted(ctx);
    const eb = content.balance.events;
    if (state.tick < state.nextMemoTick || state.tick < eb.graceTicks)
        return;
    state.nextMemoTick = state.tick + nextMemoDelay(state, content);
    if (state.memos.length < eb.maxOpen)
        issueMemo(ctx);
}
function failRandomRacks(state, content, count, events) {
    const racks = state.facilities.filter((f) => !f.failed && getDef(content, f.defId).kind === "rack");
    const n = Math.min(Math.max(0, Math.floor(count)), racks.length);
    for (let i = 0; i < n; i++) {
        const j = i + Math.floor(nextRandom(state.rng, "events") * (racks.length - i));
        [racks[i], racks[j]] = [racks[j], racks[i]];
        failRack(state, racks[i], events);
    }
}
function removeParts(state, content, count) {
    let left = count;
    for (const f of state.facilities) {
        if (left <= 0)
            break;
        if (getDef(content, f.defId).kind !== "depot")
            continue;
        const n = Math.min(left, f.stored);
        f.stored -= n;
        left -= n;
    }
}
function applyEffect(state, content, e, events, memoTitle) {
    switch (e.type) {
        case "cash":
            if (e.amount >= 0)
                earn(state, e.amount);
            else
                spend(state, "penalties", -e.amount);
            break;
        case "standing":
            changeStanding(state, e.amount, events, "memo", `Memo: ${memoTitle}`);
            break;
        case "ambient":
            state.modifiers.push({ kind: "ambient", value: e.deltaC, endsAt: state.tick + e.durationTicks, label: modifierLabel("ambient", e.deltaC) });
            break;
        case "gridCap":
        case "energyPrice":
        case "payout":
        case "failureRate":
            state.modifiers.push({ kind: e.type, value: e.factor, endsAt: state.tick + e.durationTicks, label: modifierLabel(e.type, e.factor) });
            break;
        case "failRacks":
            failRandomRacks(state, content, e.count, events);
            break;
        case "spareParts":
            if (e.count >= 0)
                stockParts({ state, content }, Math.floor(e.count));
            else
                removeParts(state, content, Math.floor(-e.count));
            break;
        case "affinity":
            addAffinity(state, e.path, e.amount);
            break;
    }
}
function resolveNow(state, content, memo, def, choice, auto, events) {
    state.memos = state.memos.filter((m) => m.id !== memo.id);
    if (!auto)
        state.stats.memosAnswered++;
    for (const e of choice.effects)
        applyEffect(state, content, e, events, def.title);
    state.memoHistory.push({ memoId: memo.id, eventId: def.id, title: def.title, choiceId: choice.id, outcome: choice.outcome, tick: state.tick, auto });
    if (state.memoHistory.length > MEMO_HISTORY_LENGTH)
        state.memoHistory.splice(0, state.memoHistory.length - MEMO_HISTORY_LENGTH);
    events.push({ type: "memoResolved", memoId: memo.id, eventId: def.id, choiceId: choice.id, auto });
}
export function planResolveMemo(ctx, memoId, choiceId) {
    const { state, content } = ctx;
    const memo = state.memos.find((m) => m.id === memoId);
    if (!memo)
        return reject("no such memo");
    const def = eventDef(content, memo.eventId);
    if (!def)
        return reject("memo refers to unknown event");
    const choice = def.choices.find((c) => c.id === choiceId);
    if (!choice)
        return reject("no such choice");
    return accept(0, (events) => resolveNow(state, content, memo, def, choice, false, events));
}
