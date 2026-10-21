import type { AudioEngine, Renderer } from "@aitower/shared";
import type { SimEvent } from "@aitower/sim";
import { type CrashInfo, describeError, showCrashOverlay } from "./crash";
import type { GameStoreInternals } from "./store";

/** Simulation rate at 1× speed (ticks per real second). 1 tick = 1 game-minute ⇒ a day lasts 144 s at 1×. */
export const TICKS_PER_SECOND = 10;
const TICK_MS = 1000 / TICKS_PER_SECOND;
/** Never run more than this many ticks in one frame (prevents the spiral of death after a stall). */
const MAX_TICKS_PER_FRAME = 120;
/** Wall-clock budget for stepping the sim in one frame; beyond it the backlog is dropped. */
export const STEP_BUDGET_MS = 12;
/** Consecutive renderer failures tolerated before the crash overlay. */
export const MAX_RENDER_FAILURES = 3;

export interface LoopOptions {
	onCrash?: (info: CrashInfo) => void;
	requestFrame?: (cb: (t: number) => void) => number;
	cancelFrame?: (handle: number) => void;
	/** High-resolution ms clock for the step budget. */
	now?: () => number;
	budgetMs?: number;
}

/**
 * Fixed-timestep simulation, variable-rate rendering ("Fix Your Timestep"). Returns a stop function.
 *
 * Faults: a sim exception stops the loop for good (the last good view stays on screen) and reports via `onCrash`;
 * renderer exceptions skip the frame and only crash after MAX_RENDER_FAILURES in a row. Audio/HUD-notify errors are logged.
 * Time budget: at most `budgetMs` of stepping per frame; any backlog beyond it is dropped and `store.behind` is set.
 */
export function startLoop(store: GameStoreInternals, renderer: Renderer, audio: AudioEngine | null, opts: LoopOptions = {}): () => void {
	const onCrash = opts.onCrash ?? ((info) => showCrashOverlay({ source: info.source, message: info.message }));
	const requestFrame = opts.requestFrame ?? ((cb) => requestAnimationFrame(cb));
	const cancelFrame = opts.cancelFrame ?? ((h) => cancelAnimationFrame(h));
	const clock = opts.now ?? (() => performance.now());
	const budgetMs = opts.budgetMs ?? STEP_BUDGET_MS;

	let acc = 0;
	let last = clock();
	let raf = 0;
	let dead = false;
	let renderFailures = 0;

	const halt = (source: CrashInfo["source"], error: unknown) => {
		dead = true;
		cancelFrame(raf);
		console.error(`AItower ${source} fault:`, error);
		try {
			onCrash({ source, message: describeError(error), error });
		} catch (err) {
			console.error("crash overlay failed:", err);
		}
	};

	const frame = (now: number) => {
		if (dead) return;
		const dt = Math.min(now - last, 250);
		last = now;
		const speed = store.get().speed;
		acc += dt * speed;
		let n = Math.floor(acc / TICK_MS);
		let behind = false;
		if (n > MAX_TICKS_PER_FRAME) {
			n = MAX_TICKS_PER_FRAME;
			acc = 0;
			behind = true;
		} else {
			acc -= n * TICK_MS;
		}

		const events: SimEvent[] = [];
		let view: ReturnType<ReturnType<GameStoreInternals["sim"]>["view"]>;
		try {
			const t0 = clock();
			let done = 0;
			let held = false;
			while (done < n) {
				const stepped = store.advance(1);
				for (const e of stepped) events.push(e);
				done++;
				if (stepped.some((e) => e.type === "decisionIssued")) {
					acc = 0; // a decision opened: the clock is held, do not chase the backlog
					held = true;
					break;
				}
				if (done < n && clock() - t0 > budgetMs) break;
			}
			if (done < n && !held) {
				acc = 0; // drop the backlog rather than chase it
				behind = true;
			}
			view = store.sim().view();
		} catch (err) {
			halt("sim", err);
			return;
		}
		store.behind = behind;

		try {
			if (events.length > 0) renderer.pushEvents(events);
			renderer.draw(view, speed === 0 ? 0 : Math.min(acc / TICK_MS, 0.999));
			renderFailures = 0;
		} catch (err) {
			console.error("render error (frame skipped):", err);
			if (++renderFailures >= MAX_RENDER_FAILURES) {
				halt("render", err);
				return;
			}
		}
		try {
			audio?.update(view, events);
		} catch (err) {
			console.warn("audio error:", err);
		}
		try {
			store.publish(now);
		} catch (err) {
			console.error("HUD update error:", err);
		}
		raf = requestFrame(frame);
	};
	raf = requestFrame(frame);
	return () => {
		dead = true;
		cancelFrame(raf);
	};
}
