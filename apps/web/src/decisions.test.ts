import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryBackend } from "./saveBackend";
import { DECISION_GAP_MS, createGameStore } from "./store";
import { contentWithoutStory, memoryStorage } from "./testUtils";

/** Decisions every few ticks, so one opens quickly. The store must hold the clock when it does. */
function make(backend = createMemoryBackend()) {
	const content = contentWithoutStory();
	content.balance.events = { intervalTicks: 10, graceTicks: 0 };
	content.events = content.events.filter((e) => e.scriptedDay === undefined); // the scripted day-2 event is exempt from the real-time gate
	return createGameStore(content, null, null, { backend, storage: memoryStorage(), prefersReducedMotion: false });
}

describe("advisor decisions pause the game", () => {
	beforeEach(() => void vi.useFakeTimers());
	afterEach(() => void vi.useRealTimers());

	it("stops the clock the tick a decision opens, at any speed, and refuses to restart it until answered", () => {
		const store = make();
		store.setSpeed(30);
		let events: ReturnType<typeof store.advance> = [];
		for (let i = 0; i < 40 && !events.some((e) => e.type === "decisionIssued"); i++) events = store.advance(500);
		expect(events.some((e) => e.type === "decisionIssued")).toBe(true);
		expect(store.get().speed).toBe(0);
		const tick = store.sim().view().tick;
		store.setSpeed(10);
		expect(store.get().speed).toBe(0); // refused while the decision is open
		const d = store.sim().view().decision;
		expect(d).not.toBeNull();
		store.dispatch({ type: "resolveDecision", decisionId: d?.id ?? 0, choiceId: d?.recommended ?? "" });
		expect(store.sim().view().decision).toBeNull();
		store.setSpeed(10);
		expect(store.get().speed).toBe(10);
		expect(store.sim().view().tick).toBe(tick); // nothing ran while it waited
	});

	it("advance(n) stops stepping where the decision opened", () => {
		const store = make();
		const start = store.sim().view().tick;
		const events = store.advance(100_000);
		expect(events.some((e) => e.type === "decisionIssued")).toBe(true);
		expect(store.sim().view().tick - start).toBeLessThan(5000);
	});

	it("never more than one per three real minutes: the gate closes on issue and reopens on a timer", () => {
		const store = make();
		store.advance(100_000);
		store.sim().step(); // the queued gate command lands on the next tick
		expect(store.sim().view().decisionGate).toBe(false);
		const d = store.sim().view().decision;
		store.dispatch({ type: "resolveDecision", decisionId: d?.id ?? 0, choiceId: d?.recommended ?? "" });
		// A day later the sim would happily roll another, but the gate holds it.
		store.setSpeed(1);
		const events = store.advance(1440 * 3);
		expect(events.some((e) => e.type === "decisionIssued")).toBe(false);
		vi.advanceTimersByTime(DECISION_GAP_MS - 1);
		store.advance(1);
		expect(store.sim().view().decisionGate).toBe(false);
		vi.advanceTimersByTime(2);
		const reopened = store.advance(1);
		expect(store.sim().view().decisionGate).toBe(true);
		const later = [...reopened, ...store.advance(1440 * 3)];
		expect(later.some((e) => e.type === "decisionIssued")).toBe(true); // a day-cap-eligible roll goes through now
	});

	it("waiting costs no reputation: the clock does not run, and nothing in the log blames a decision", () => {
		const store = make();
		store.advance(100_000);
		const rep = store.sim().view().standing;
		const tick = store.sim().view().tick;
		store.advance(0);
		expect(store.sim().view().standing).toBe(rep);
		expect(store.sim().view().tick).toBe(tick);
		expect(store.sim().view().standingLog.some((e) => e.cause === "decision")).toBe(false);
	});

	it("a saved game with an open decision loads paused", async () => {
		const backend = createMemoryBackend();
		const store = make(backend);
		store.advance(100_000);
		await store.saveTo("slot1");
		const other = make(backend);
		await other.loadFrom("slot1");
		expect(other.sim().view().decision).not.toBeNull();
		expect(other.get().speed).toBe(0);
	});
});
