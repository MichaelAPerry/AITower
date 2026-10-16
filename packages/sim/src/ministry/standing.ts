/** Standing (0..100) and the one-shot game-over flag. */
import type { GameOverKind, SimEvent } from "../api";
import type { TickCtx } from "../core/context";
import type { SimState } from "../core/state";

export function setGameOver(state: SimState, kind: GameOverKind, events: SimEvent[]): void {
	if (state.gameOver) return;
	state.gameOver = { kind, tick: state.tick };
	events.push({ type: "gameOver", kind });
}

/** Clamp to 0..100, emit `standingChanged` with the applied delta (nothing if unchanged); reaching 0 ends the game. */
export function changeStanding(state: SimState, delta: number, events: SimEvent[]): void {
	const next = Math.min(100, Math.max(0, state.standing + delta));
	const applied = next - state.standing;
	state.standing = next;
	if (applied !== 0) events.push({ type: "standingChanged", standing: next, delta: applied });
	if (next <= 0) setGameOver(state, "shutdown", events);
}

/** Per-tick job outcomes: reads this tick's jobCompleted / jobFailed events and applies one combined change. */
export function jobStanding(ctx: TickCtx): void {
	const { state, content, events } = ctx;
	const st = content.balance.standing;
	let delta = 0;
	for (const e of events) {
		if (e.type === "jobCompleted") delta += st.jobCompleted;
		else if (e.type === "jobFailed") delta += st.jobFailed;
	}
	if (delta !== 0) changeStanding(state, delta, events);
}

/** Last tick of a day: good day if the rolling 24 h uptime met the current tier's target. */
export function dailyStanding(ctx: TickCtx): void {
	const { state, content, events } = ctx;
	const st = content.balance.standing;
	const target = content.balance.tiers.uptime[state.tier - 1] ?? 0;
	changeStanding(state, state.metrics.uptime >= target ? st.dailyGood : st.dailyBad, events);
}
