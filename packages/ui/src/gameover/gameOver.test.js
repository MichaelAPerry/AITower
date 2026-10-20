import { describe, expect, it } from "vitest";
import { createFakeContent, createFakeStore } from "../dev/fakeStore";
import { fmtMoney } from "../format";
import { gameOverToShow, isFinal, keepDismissed, lifetimeStats, OVER_COPY, overKey } from "./gameOver";
describe("game-over notices", () => {
    it("shows nothing until the sim reports a game over", () => {
        expect(gameOverToShow(null, null)).toBeNull();
    });
    it("shows each game over once: dismissing it does not loop", () => {
        const go = { kind: "victory", tick: 5000 };
        expect(gameOverToShow(go, null)).toEqual(go);
        const dismissed = overKey(go);
        expect(gameOverToShow(go, dismissed)).toBeNull();
        // the sim keeps stepping and the same game over stays in the view: still hidden
        expect(gameOverToShow({ ...go }, keepDismissed(go, dismissed))).toBeNull();
    });
    it("forgets the dismissal when the game ends (new game or a save without a game over), so the next game can end again", () => {
        const go = { kind: "victory", tick: 5000 };
        const dismissed = keepDismissed(go, overKey(go));
        expect(keepDismissed(null, dismissed)).toBeNull();
        expect(gameOverToShow(go, keepDismissed(null, dismissed))).toEqual(go);
    });
    it("a different game over (another kind or tick) is not hidden by an old dismissal", () => {
        const old = overKey({ kind: "victory", tick: 100 });
        expect(gameOverToShow({ kind: "bankrupt", tick: 100 }, old)).not.toBeNull();
        expect(gameOverToShow({ kind: "victory", tick: 200 }, old)).not.toBeNull();
    });
    it("bankrupt and shutdown are final, victory is not; each has its own heading and stamp", () => {
        expect(isFinal("bankrupt")).toBe(true);
        expect(isFinal("shutdown")).toBe(true);
        expect(isFinal("victory")).toBe(false);
        expect(OVER_COPY.bankrupt.heading).toBe("NOTICE OF TERMINATION");
        expect(OVER_COPY.shutdown.heading).toBe("NOTICE OF TERMINATION");
        expect(OVER_COPY.victory.heading).toBe("COMMENDATION");
    });
    it("lists where the run ended, then the sim's lifetime stats", () => {
        const store = createFakeStore(createFakeContent());
        const v = store.get().view;
        const rows = lifetimeStats({ ...v, day: 42 });
        expect(rows.find((r) => r.label === "Days in service")?.value).toBe("42");
        expect(rows.find((r) => r.label === "Lifetime revenue")?.value).toBe(fmtMoney(v.stats.revenue));
        expect(rows.find((r) => r.label === "Jobs completed")?.value).toBe(String(v.stats.jobsCompleted));
        expect(rows.find((r) => r.label === "Peak compute")?.value).toMatch(/PF$/);
        expect(rows.length).toBe(4 + 10);
    });
    it("falls back to the view's own numbers when the view has no stats", () => {
        const v = createFakeStore(createFakeContent()).get().view;
        const old = { ...v, stats: undefined, jobs: [] };
        const rows = lifetimeStats(old);
        expect(rows.some((r) => r.label === "Contracts completed")).toBe(false);
        expect(rows.find((r) => r.label === "Peak compute")?.value).toMatch(/PF$/);
        const job = { ...v.jobs[0], status: "completed" };
        expect(lifetimeStats({ ...old, jobs: [job, job] }).find((r) => r.label === "Contracts completed")?.value).toBe("2");
    });
    it("the fake store ends the game like the sim: once, and standing 0 means shutdown", () => {
        const store = createFakeStore(createFakeContent());
        store.setStanding(0);
        expect(store.get().view.gameOver?.kind).toBe("shutdown");
        store.triggerGameOver("victory");
        expect(store.get().view.gameOver?.kind).toBe("shutdown");
    });
});
