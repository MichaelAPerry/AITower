/**
 * The walk-in and upload of a Consciousness Transfer Unit (docs/ART_DIRECTION.md). Pure timing, no Pixi: the sim's `consciousnessTransferred`
 * event starts a run for that facility; the walker (`pixi/transfers.ts`) and the pod (`pixi/synthSprites.ts`) both read the same phase
 * from the renderer clock, so the person reaches the door exactly as it is open.
 *
 *   s = 0 .. walk        the person walks out of the lift to the pod
 *   walk-0.7 .. -0.3     the door slides up      walk+0.5 .. +0.9   the door shuts behind them
 *   walk+0.9 .. +2.7     the upload: cold light floods the pod, the person rises as data
 */
export interface TransferPhase {
	/** Seconds since the run started. */
	s: number;
	/** Seconds the walk takes (it depends on how far the lift is). */
	walk: number;
}

export const DOOR_LEAD = 0.7;
export const STAND_SECONDS = 0.5;
export const SHUT_SECONDS = 0.9;
export const UPLOAD_SECONDS = 1.8;
const runs = new Map<number, { t0: number; walk: number }>();
const forced = new Map<number, TransferPhase>();

/** Seconds a run lasts. */
export const transferSeconds = (walk: number): number => walk + SHUT_SECONDS + UPLOAD_SECONDS;

/** Start a run for facility `id` at renderer time `t` with a walk of `walk` seconds. */
export function startTransfer(id: number, t: number, walk: number): void {
	runs.set(id, { t0: t, walk });
}

/** Hold facility `id` at `s` seconds into a run (previews and tests); `null` releases it. */
export function forceTransfer(id: number, s: number | null, walk = 3): void {
	if (s === null) forced.delete(id);
	else forced.set(id, { s, walk });
}

/** The phase of facility `id` at renderer time `t`, or null when nothing is going on. */
export function transferPhase(id: number, t: number): TransferPhase | null {
	const f = forced.get(id);
	if (f) return f;
	const r = runs.get(id);
	if (!r) return null;
	const s = t - r.t0;
	if (s < 0) return null;
	if (s > transferSeconds(r.walk)) {
		runs.delete(id);
		return null;
	}
	return { s, walk: r.walk };
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** How open the pod door is, 0..1. */
export const doorOpen = (p: TransferPhase): number =>
	p.s < p.walk + STAND_SECONDS ? clamp01((p.s - (p.walk - DOOR_LEAD)) / 0.4) : 1 - clamp01((p.s - (p.walk + STAND_SECONDS)) / (SHUT_SECONDS - STAND_SECONDS));

/** 0..1 through the upload; 0 before it starts, 1 after. */
export const uploadFraction = (p: TransferPhase): number => clamp01((p.s - (p.walk + SHUT_SECONDS)) / UPLOAD_SECONDS);

/** Walk speed in px per second, and the bounds of a walk in seconds. */
export const WALK_PX_PER_S = 18;
export const walkSeconds = (distPx: number): number => Math.min(6, Math.max(1.5, Math.abs(distPx) / WALK_PX_PER_S));
