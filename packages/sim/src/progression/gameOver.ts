/** The one-shot game-over flag. */
import type { EndingId, GameOverKind, SimEvent } from "../api";
import type { SimState } from "../core/state";

export function setGameOver(state: SimState, kind: GameOverKind, events: SimEvent[], ending?: EndingId): void {
	if (state.gameOver) return;
	state.gameOver = ending ? { kind, tick: state.tick, ending } : { kind, tick: state.tick };
	events.push(ending ? { type: "gameOver", kind, ending } : { type: "gameOver", kind });
}
