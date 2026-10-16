/** Stinger note data (seconds from trigger). tapeStop is DSP-only (see tape.ts). */
import type { InstId } from "./score";

export interface StingerNote {
	t: number;
	inst: InstId;
	midi: number;
	dur: number;
	vel: number;
}

const ticks: StingerNote[] = Array.from({ length: 9 }, (_, i) => ({ t: i * 0.055 + (i % 3 === 2 ? 0.02 : 0), inst: "tick" as const, midi: 0, dur: 0.02, vel: 0.75 - (i % 2) * 0.2 }));

export const STINGER_NOTES: Record<"teletype" | "fanfare", StingerNote[]> = {
	// Teletype rattle ending in a carriage-return bell.
	teletype: [...ticks, { t: 0.62, inst: "vibes", midi: 88, dur: 0.5, vel: 0.55 }, { t: 0.62, inst: "vibes", midi: 76, dur: 0.5, vel: 0.35 }],
	// Rising Cmaj9 arpeggio on vibes over a held Rhodes/pad chord.
	fanfare: [
		{ t: 0, inst: "vibes", midi: 72, dur: 0.3, vel: 0.6 },
		{ t: 0.13, inst: "vibes", midi: 76, dur: 0.3, vel: 0.65 },
		{ t: 0.26, inst: "vibes", midi: 79, dur: 0.3, vel: 0.7 },
		{ t: 0.39, inst: "vibes", midi: 83, dur: 0.3, vel: 0.75 },
		{ t: 0.52, inst: "vibes", midi: 86, dur: 1.2, vel: 0.8 },
		...[60, 64, 67, 71].map((midi, i) => ({ t: 0.52 + i * 0.012, inst: "rhodes" as const, midi, dur: 1.4, vel: 0.7 })),
		...[55, 59, 62, 67].map((midi) => ({ t: 0.52, inst: "pad" as const, midi, dur: 2, vel: 0.5 })),
	],
};

/** Seconds the tape-stop slowdown takes. */
export const TAPE_STOP_S = 1.8;
