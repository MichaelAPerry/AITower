import type { AudioEngine, Renderer } from "@aitower/shared";
import type { GameStoreInternals } from "./store";

/** Simulation rate at 1× speed (ticks per real second). 1 tick = 1 game-minute ⇒ a day lasts 144 s at 1×. */
export const TICKS_PER_SECOND = 10;
const TICK_MS = 1000 / TICKS_PER_SECOND;
/** Never run more than this many ticks in one frame (prevents the spiral of death after a stall). */
const MAX_TICKS_PER_FRAME = 120;

/** Fixed-timestep simulation, variable-rate rendering ("Fix Your Timestep"). Returns a stop function. */
export function startLoop(store: GameStoreInternals, renderer: Renderer, audio: AudioEngine | null): () => void {
	let acc = 0;
	let last = performance.now();
	let raf = 0;

	const frame = (now: number) => {
		const dt = Math.min(now - last, 250);
		last = now;
		const speed = store.get().speed;
		acc += dt * speed;
		let n = Math.floor(acc / TICK_MS);
		if (n > MAX_TICKS_PER_FRAME) {
			n = MAX_TICKS_PER_FRAME;
			acc = 0;
		} else {
			acc -= n * TICK_MS;
		}
		const events = store.advance(n);
		const view = store.sim().view();
		renderer.draw(view, speed === 0 ? 0 : Math.min(acc / TICK_MS, 0.999));
		audio?.update(view, events);
		store.publish(now);
		raf = requestAnimationFrame(frame);
	};
	raf = requestAnimationFrame(frame);
	return () => cancelAnimationFrame(raf);
}
