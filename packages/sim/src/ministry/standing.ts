/** Standing (0..100) and the one-shot game-over flag. */
import type { Balance } from "@aitower/content";
import type { EndingId, GameOverKind, SimEvent, StandingCause } from "../api";
import type { TickCtx } from "../core/context";
import type { SimState } from "../core/state";

export function setGameOver(state: SimState, kind: GameOverKind, events: SimEvent[], ending?: EndingId): void {
	if (state.gameOver) return;
	state.gameOver = ending ? { kind, tick: state.tick, ending } : { kind, tick: state.tick };
	events.push(ending ? { type: "gameOver", kind, ending } : { type: "gameOver", kind });
}

const STANDING_LOG_MAX = 20;

/** Clamp to 0..100, emit `standingChanged` with the applied delta (nothing if unchanged) and log it with its cause; reaching 0 ends the game. */
export function changeStanding(state: SimState, delta: number, events: SimEvent[], cause: StandingCause, detail: string): void {
	const next = Math.min(100, Math.max(0, state.standing + delta));
	const applied = next - state.standing;
	state.standing = next;
	if (applied !== 0) {
		events.push({ type: "standingChanged", standing: next, delta: applied });
		state.standingLog.push({ tick: state.tick, delta: applied, cause, detail });
		if (state.standingLog.length > STANDING_LOG_MAX) state.standingLog.splice(0, state.standingLog.length - STANDING_LOG_MAX);
	}
	if (next <= 0 && !state.sandbox) setGameOver(state, "shutdown", events); // a sandbox has no Ministry shutdown
}

/** Per-tick job outcomes: reads this tick's jobCompleted / jobFailed events (one change each, so the log names the job). */
export function jobStanding(ctx: TickCtx): void {
	const { state, content, events } = ctx;
	const st = content.balance.standing;
	const n = events.length; // changeStanding appends events; only look at the ones that were here
	for (let i = 0; i < n; i++) {
		const e = events[i];
		if (e.type === "jobCompleted") changeStanding(state, st.jobCompleted, events, "job", `Job #${e.jobId} finished`);
		else if (e.type === "jobFailed") changeStanding(state, st.jobFailed, events, "job", `Job #${e.jobId} missed its deadline or was cancelled`);
	}
}

/** The daily change for a rolling uptime against a target: +dailyGood when met, else dailyNearMiss..dailyBad as the shortfall grows to dailyMissSpan. */
export function dailyDelta(st: Balance["standing"], uptime: number, target: number): number {
	if (uptime >= target) return st.dailyGood;
	const t = Math.min(1, (target - uptime) / Math.max(1e-9, st.dailyMissSpan));
	return Math.round(st.dailyNearMiss + (st.dailyBad - st.dailyNearMiss) * t);
}

/** Last tick of a day: good day if the rolling 24 h uptime met the current tier's target; a miss costs more the bigger it is. */
export function dailyStanding(ctx: TickCtx): void {
	const { state, content, events } = ctx;
	const target = content.balance.tiers.uptime[state.tier - 1] ?? 0;
	const up = state.metrics.uptime;
	const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;
	const detail = up >= target ? `Uptime ${pct(up)} met the ${pct(target)} target` : `Uptime ${pct(up)} fell short of the ${pct(target)} target`;
	changeStanding(state, dailyDelta(content.balance.standing, up, target), events, "daily-uptime", detail);
}
