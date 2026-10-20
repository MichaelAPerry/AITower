import { describe, expect, it } from "vitest";
import { createFakeContent, createFakeStore } from "../dev/fakeStore";
import { clampStanding, defaultChoiceLabel, historyRows, memoCountdown, memoFraction, memoTicksLeft, memoToPop, memoUrgent, modifierChip, modifierHurts, openMemos, pruneIds, standingTone } from "./memoDesk";
const content = createFakeContent();
describe("memo desk logic", () => {
    it("counts down to auto-filing and names the default stamp", () => {
        const store = createFakeStore(content);
        store.issueMemo("heatwave", 840);
        const m = store.get().view.memos[0];
        const t = m.issuedAt;
        expect(memoTicksLeft(m, t)).toBe(840);
        expect(memoCountdown(m, t)).toBe("AUTO-RESOLVES IN 14h");
        expect(memoCountdown(m, t + 800)).toBe("AUTO-RESOLVES IN 40m");
        expect(memoCountdown(m, t + 840)).toBe("RESOLVING NOW");
        expect(memoTicksLeft(m, t + 9999)).toBe(0);
        expect(defaultChoiceLabel(m)).toBe("FILE IN TRIPLICATE");
        expect(memoFraction(m, t + 420)).toBeCloseTo(0.5);
        expect(memoUrgent(m, t)).toBe(false);
        expect(memoUrgent(m, t + 760)).toBe(true);
    });
    it("only the oldest open memo that was not stamped or set aside pops up", () => {
        const store = createFakeStore(content);
        const a = store.issueMemo("heatwave");
        const b = store.issueMemo("audit");
        const memos = store.get().view.memos;
        expect(memoToPop(memos, [], [])?.id).toBe(a);
        expect(memoToPop(memos, [], [a])?.id).toBe(b);
        expect(memoToPop(memos, [a], [])?.id).toBe(b);
        expect(memoToPop(memos, [a, b], [])).toBeNull();
        expect(openMemos(memos, [a]).map((m) => m.id)).toEqual([b]);
        expect(pruneIds([a, b, 99], memos)).toEqual([a, b]);
    });
    it("tones the standing meter: red below 25, amber below 50, green otherwise", () => {
        expect(standingTone(0)).toBe("red");
        expect(standingTone(24.9)).toBe("red");
        expect(standingTone(25)).toBe("amber");
        expect(standingTone(49)).toBe("amber");
        expect(standingTone(50)).toBe("green");
        expect(clampStanding(140)).toBe(100);
        expect(clampStanding(-3)).toBe(0);
        expect(clampStanding(Number.NaN)).toBe(0);
    });
    it("formats modifier chips with the time left", () => {
        const heat = { label: "Heatwave", kind: "ambient", value: 8, endsAt: 1000 + 14 * 60 };
        expect(modifierChip(heat, 1000)).toBe("HEATWAVE +8 °C · 14h");
        expect(modifierChip({ label: "Brownout", kind: "gridCap", value: 0.5, endsAt: 1090 }, 1000)).toBe("BROWNOUT ×0.50 · 1h 30m");
        expect(modifierChip(heat, 99999)).toContain("· 0m");
        expect(modifierHurts(heat)).toBe(true);
        expect(modifierHurts({ kind: "ambient", value: -4 })).toBe(false);
        expect(modifierHurts({ kind: "payout", value: 1.25 })).toBe(false);
        expect(modifierHurts({ kind: "payout", value: 0.5 })).toBe(true);
        expect(modifierHurts({ kind: "failureRate", value: 2 })).toBe(true);
    });
});
describe("memo flow on the fake store (mirrors the sim)", () => {
    it("resolveMemo is queued, then filed at the next tick with the outcome in the history and a memoResolved event", () => {
        const store = createFakeStore(content);
        const id = store.issueMemo("audit");
        expect(store.dispatch({ type: "resolveMemo", memoId: id, choiceId: "bribe" })).toEqual({ ok: true });
        expect(store.get().view.memos).toHaveLength(1); // still open until the clock runs
        store.advance(1);
        expect(store.get().view.memos).toHaveLength(0);
        const rows = historyRows(store.get().view, content);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ title: "Form A-9: Surprise Inspection", stamp: "OFFER TEA", outcome: "The Inspector enjoyed the tea.", auto: false });
        expect(store.get().log.at(-1)?.event).toMatchObject({ type: "memoResolved", memoId: id, choiceId: "bribe", auto: false });
    });
    it("rejects unknown memos and unknown choices, and a second stamp on the same memo", () => {
        const store = createFakeStore(content);
        const id = store.issueMemo("audit");
        expect(store.dispatch({ type: "resolveMemo", memoId: 99, choiceId: "bribe" }).ok).toBe(false);
        expect(store.dispatch({ type: "resolveMemo", memoId: id, choiceId: "nope" }).ok).toBe(false);
        expect(store.dispatch({ type: "resolveMemo", memoId: id, choiceId: "comply" }).ok).toBe(true);
        expect(store.dispatch({ type: "resolveMemo", memoId: id, choiceId: "protest" }).ok).toBe(false);
    });
    it("an unanswered memo is auto-filed with its default stamp when the countdown ends", () => {
        const store = createFakeStore(content);
        store.issueMemo("heatwave", 60);
        store.advance(30);
        expect(store.get().view.memos).toHaveLength(1);
        store.advance(40);
        expect(store.get().view.memos).toHaveLength(0);
        const row = historyRows(store.get().view, content)[0];
        expect(row).toMatchObject({ auto: true, stamp: "FILE IN TRIPLICATE" });
    });
    it("history lists the newest first", () => {
        const store = createFakeStore(content);
        const a = store.issueMemo("heatwave");
        const b = store.issueMemo("audit");
        store.dispatch({ type: "resolveMemo", memoId: a, choiceId: "credits" });
        store.advance(1);
        store.dispatch({ type: "resolveMemo", memoId: b, choiceId: "comply" });
        store.advance(1);
        expect(historyRows(store.get().view, content).map((r) => r.memoId)).toEqual([b, a]);
    });
});
