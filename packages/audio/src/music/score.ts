/**
 * Hand-authored tier-1 score: a 32-bar bossa / ministry-muzak loop at 96 BPM
 * (form A A B A', ii-V-I movement in C, ~80 s). Data only: the builders below
 * expand compact chord/melody tables into a flat, sorted note list. Time is in
 * 16th-note steps from loop start (16 steps per 4/4 bar).
 */

export type Stem = "pad" | "keys" | "bass" | "vibes" | "brush" | "rim" | "hat";
export type InstId = "pad" | "rhodes" | "pluck" | "vibes" | "brush" | "rim" | "tick" | "wet" | "heart";

export interface ScoreNote {
	stem: Stem;
	inst: InstId;
	/** Start, in 16th steps from loop start (may be fractional for strum/offbeats). */
	step: number;
	/** Duration in 16th steps. */
	dur: number;
	/** MIDI note (0 for unpitched percussion). */
	midi: number;
	/** 0..1 */
	vel: number;
}

export interface Score {
	bpm: number;
	bars: number;
	stepsPerBar: number;
	notes: ScoreNote[];
}

export const BPM = 96;
export const STEPS_PER_BAR = 16;
export const BARS = 32;

/** Allowed MIDI range per stem (percussion is unpitched). */
export const STEM_RANGES: Record<Stem, readonly [number, number]> = {
	pad: [48, 84],
	keys: [48, 80],
	bass: [28, 55],
	vibes: [65, 91],
	brush: [0, 0],
	rim: [0, 0],
	hat: [0, 0],
};

interface Chord {
	/** Rootless colour voicing, low to high (Rhodes and pad). */
	v: readonly number[];
	root: number;
	fifth: number;
}

const CHORDS = {
	Dm9: { v: [53, 60, 64, 69], root: 38, fifth: 45 },
	G13: { v: [53, 59, 64, 69], root: 43, fifth: 50 },
	G7: { v: [53, 59, 62, 67], root: 43, fifth: 50 },
	Cmaj9: { v: [52, 59, 62, 67], root: 36, fifth: 43 },
	A7b9: { v: [55, 61, 65, 71], root: 33, fifth: 40 },
	A7: { v: [55, 61, 64, 69], root: 33, fifth: 40 },
	Em7: { v: [55, 59, 62, 64], root: 40, fifth: 47 },
	Em9: { v: [55, 59, 62, 66], root: 40, fifth: 47 },
	Fmaj9: { v: [52, 57, 60, 67], root: 41, fifth: 48 },
	Bb13: { v: [56, 62, 67, 72], root: 46, fifth: 53 },
} satisfies Record<string, Chord>;
type ChordName = keyof typeof CHORDS;

/** One entry per bar: one chord for the whole bar, or two (one per half bar). */
type Bar = readonly [ChordName] | readonly [ChordName, ChordName];

const A: Bar[] = [["Dm9"], ["G13"], ["Cmaj9"], ["A7b9"], ["Dm9"], ["G13"], ["Em7", "A7"], ["Dm9", "G7"]];
const A2: Bar[] = [...A.slice(0, 7), ["Cmaj9", "A7b9"]];
const B: Bar[] = [["Fmaj9"], ["Bb13"], ["Em9"], ["A7b9"], ["Dm9"], ["G13"], ["Cmaj9"], ["Cmaj9", "A7b9"]];
/** Sections: A, A (melody enters late), B, A'. */
const PROGRESSION: Bar[] = [...A, ...A, ...B, ...A2];

/** Vibraphone melody: [bar in section, beat, midi, beats]. */
type Mel = readonly [number, number, number, number];
const MEL_A: Mel[] = [
	[0, 0.5, 77, 1], [0, 2, 81, 1], [0, 3.5, 79, 0.5],
	[1, 0, 77, 1.5], [1, 2, 76, 0.5], [1, 2.5, 74, 1.5],
	[2, 0.5, 76, 1], [2, 2, 79, 1.5], [2, 3.5, 76, 0.5],
	[3, 0.5, 73, 1], [3, 2, 77, 1], [3, 3, 76, 1],
	[4, 0, 74, 1.5], [4, 2, 77, 1], [4, 3.5, 81, 0.5],
	[5, 0, 79, 1.5], [5, 2, 76, 1], [5, 3, 74, 1],
	[6, 0, 71, 1], [6, 1, 74, 1], [6, 2, 73, 1], [6, 3, 69, 1],
	[7, 0, 77, 1], [7, 1, 74, 1], [7, 2, 71, 1.5],
];
const MEL_A2_END: Mel[] = [[7, 0, 76, 1], [7, 1, 72, 1], [7, 2, 73, 1], [7, 3, 69, 1]];
const MEL_B: Mel[] = [
	[0, 0, 81, 1.5], [0, 2, 79, 0.5], [0, 2.5, 77, 1.5],
	[1, 0.5, 74, 1], [1, 2, 79, 1.5], [1, 3.5, 77, 0.5],
	[2, 0, 76, 1.5], [2, 2, 74, 1], [2, 3, 71, 1],
	[3, 0.5, 73, 1], [3, 2, 76, 1], [3, 3, 81, 1],
	[4, 0, 77, 1.5], [4, 2, 76, 0.5], [4, 2.5, 74, 1.5],
	[5, 0, 71, 1], [5, 1, 74, 1], [5, 2, 76, 2],
	[6, 0, 72, 2], [6, 2, 76, 1], [6, 3, 79, 1],
	[7, 0, 76, 3],
];

function buildNotes(): ScoreNote[] {
	const notes: ScoreNote[] = [];
	const add = (n: ScoreNote) => notes.push(n);
	const chordAt = (bar: number, half: 0 | 1): Chord => {
		const b = PROGRESSION[bar] as Bar;
		return CHORDS[(b[half] ?? b[0]) as ChordName];
	};

	for (let bar = 0; bar < BARS; bar++) {
		const b0 = bar * STEPS_PER_BAR;
		const bars = PROGRESSION[bar] as Bar;

		// Pad: sustained string-machine chords, one per chord change (slightly overlapped).
		const halves: (0 | 1)[] = bars.length === 2 ? [0, 1] : [0];
		for (const h of halves) {
			const len = bars.length === 2 ? 8 : 16;
			const voicing = chordAt(bar, h).v;
			for (let i = 0; i < voicing.length; i++) add({ stem: "pad", inst: "pad", step: b0 + h * 8, dur: len + 1, midi: voicing[i] as number, vel: 0.5 - i * 0.03 });
		}

		// Rhodes bossa comp: stabs on 1, 2&, 4 with a light strum.
		for (const [s, d, v] of [[0, 5, 0.8], [6, 5, 0.55], [12, 3, 0.6]] as const) {
			const voicing = chordAt(bar, s >= 8 ? 1 : 0).v;
			for (let i = 0; i < voicing.length; i++) add({ stem: "keys", inst: "rhodes", step: b0 + s + i * 0.12, dur: d, midi: voicing[i] as number, vel: v - i * 0.03 });
		}

		// Nylon-ish bass: root on 1 / fifth on 2&, per half bar.
		for (const h of [0, 1] as const) {
			const c = chordAt(bar, h);
			add({ stem: "bass", inst: "pluck", step: b0 + h * 8, dur: 5, midi: c.root, vel: 0.85 });
			add({ stem: "bass", inst: "pluck", step: b0 + h * 8 + 6, dur: 2, midi: c.fifth, vel: 0.6 });
		}

		// Brushes: quarters with soft eighth swishes; rim on a bossa clave; teletype hat.
		for (const s of [0, 4, 8, 12]) add({ stem: "brush", inst: "brush", step: b0 + s, dur: 3, midi: 0, vel: 0.7 });
		for (const s of [2, 6, 10, 14]) add({ stem: "brush", inst: "brush", step: b0 + s, dur: 2, midi: 0, vel: 0.35 });
		for (const s of [0, 3, 6, 10, 12]) add({ stem: "rim", inst: "rim", step: b0 + s, dur: 1, midi: 0, vel: s === 0 ? 0.6 : 0.45 });
		for (const s of [2, 3, 7, 10, 11, 15]) add({ stem: "hat", inst: "tick", step: b0 + s, dur: 1, midi: 0, vel: s % 4 === 2 ? 0.4 : 0.22 });
	}

	// Vibraphone melody per section.
	const mel = (section: number, m: readonly Mel[]) => {
		for (const [bar, beat, midi, beats] of m) {
			add({ stem: "vibes", inst: "vibes", step: (section * 8 + bar) * STEPS_PER_BAR + beat * 4, dur: beats * 4, midi, vel: 0.7 });
		}
	};
	mel(0, MEL_A);
	mel(1, MEL_A.filter((n) => n[0] >= 4)); // second A: the first half is comp-only
	mel(2, MEL_B);
	mel(3, [...MEL_A.filter((n) => n[0] < 7), ...MEL_A2_END]);

	return notes.sort((a, b) => a.step - b.step);
}

export const SCORE: Score = { bpm: BPM, bars: BARS, stepsPerBar: STEPS_PER_BAR, notes: buildNotes() };
