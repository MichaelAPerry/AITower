/**
 * Bus mixer: music / sfx / ambience / ui → master → compressor → destination.
 * The music bus passes through a separate duck gain so alarms can dip the
 * music without disturbing the player's music volume.
 */
import type { SimEvent } from "@aitower/sim";

export const DUCK = {
	/** Music dip on alarms, dB. */
	db: -8,
	/** Seconds the dip is held before release starts. */
	holdS: 1.5,
	attackTau: 0.03,
	releaseTau: 0.4,
} as const;

/** Fixed trim so music sits under the sfx at equal slider positions. */
export const MUSIC_TRIM = 0.8;

export const DUCK_EVENT_TYPES: ReadonlySet<SimEvent["type"]> = new Set(["rackTripped", "powerShortfall", "gameOver"]);

export const shouldDuck = (events: readonly SimEvent[]): boolean => events.some((e) => DUCK_EVENT_TYPES.has(e.type));

export const duckLinear = (): number => 10 ** (DUCK.db / 20);

export interface DuckStep {
	time: number;
	target: number;
	tau: number;
}

/** setTargetAtTime steps for a duck triggered at `now`: dip, then release after the hold. */
export function duckSteps(now: number): DuckStep[] {
	return [
		{ time: now, target: duckLinear(), tau: DUCK.attackTau },
		{ time: now + DUCK.holdS, target: 1, tau: DUCK.releaseTau },
	];
}

export const clamp01 = (v: number, fallback = 0): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback);

export interface Buses {
	music: GainNode;
	sfx: GainNode;
	ambience: GainNode;
	ui: GainNode;
}

export interface Mixer {
	buses: Buses;
	/** Master level 0..1 (mute is folded in by the caller). */
	setMaster(v: number): void;
	setMusic(v: number): void;
	/** Dip the music bus for an alarm. */
	duck(): void;
	dispose(): void;
}

export function createMixer(ctx: BaseAudioContext, master: number, music: number): Mixer {
	const comp = ctx.createDynamicsCompressor();
	comp.threshold.value = -14;
	comp.ratio.value = 4;
	comp.connect(ctx.destination);
	const masterGain = ctx.createGain();
	masterGain.gain.value = master;
	masterGain.connect(comp);

	const bus = (v: number): GainNode => {
		const g = ctx.createGain();
		g.gain.value = v;
		return g;
	};
	const buses: Buses = { music: bus(music * MUSIC_TRIM), sfx: bus(1), ambience: bus(1), ui: bus(1) };
	const duckGain = bus(1);
	buses.music.connect(duckGain);
	duckGain.connect(masterGain);
	buses.sfx.connect(masterGain);
	buses.ambience.connect(masterGain);
	buses.ui.connect(masterGain);

	return {
		buses,
		setMaster: (v) => masterGain.gain.setTargetAtTime(v, ctx.currentTime, 0.05),
		setMusic: (v) => buses.music.gain.setTargetAtTime(v * MUSIC_TRIM, ctx.currentTime, 0.05),
		duck() {
			const now = ctx.currentTime;
			duckGain.gain.cancelScheduledValues(now);
			for (const s of duckSteps(now)) duckGain.gain.setTargetAtTime(s.target, s.time, s.tau);
		},
		dispose() {
			for (const n of [buses.music, duckGain, buses.sfx, buses.ambience, buses.ui, masterGain, comp]) n.disconnect();
		},
	};
}
