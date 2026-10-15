/**
 * Seeded PRNG streams (mulberry32). The whole stream state is a uint32 stored in `SimState.rng`,
 * so snapshots restore the exact sequence. One stream per consuming system.
 */

export interface RngState {
	/** Contract offers: timing jitter + the content generator. */
	contracts: number;
	/** Component failure rolls. */
	reliability: number;
}

export type RngStream = keyof RngState;

/** Advance `stream` and return a float in [0, 1). */
export function nextRandom(rng: RngState, stream: RngStream): number {
	const a = (rng[stream] + 0x6d2b79f5) | 0;
	rng[stream] = a >>> 0;
	let t = Math.imul(a ^ (a >>> 15), 1 | a);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** splitmix32-style mix: derive independent stream seeds from one user seed. */
function mixSeed(seed: number, salt: number): number {
	let z = (seed + Math.imul(salt, 0x9e3779b9)) | 0;
	z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
	z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
	return (z ^ (z >>> 16)) >>> 0;
}

export function createRng(seed: number): RngState {
	return { contracts: mixSeed(seed, 1), reliability: mixSeed(seed, 2) };
}
