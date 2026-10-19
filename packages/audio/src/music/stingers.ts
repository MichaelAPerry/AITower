/**
 * Stingers: short (1-4 s) note lists played over the music, and the pure
 * mapping from sim events to stinger ids. Times are seconds from the trigger.
 * `tapeStop` is DSP-only (see tape.ts).
 */
import type { SimEvent } from "@aitower/sim";
import type { HorrorIntensity } from "@aitower/shared";
import type { InstId } from "./score";

export type StingerId =
	| "teletype"
	| "fanfare"
	| "tapeStop"
	| "researched"
	| "auditGood"
	| "auditBad"
	| "pathChosen"
	| "sprout"
	| "mutation"
	| "irreversible"
	| "victory"
	| "absorbed";

export interface StingerNote {
	t: number;
	inst: InstId;
	midi: number;
	dur: number;
	vel: number;
}

const n = (t: number, inst: InstId, midi: number, dur: number, vel: number): StingerNote => ({ t, inst, midi, dur, vel });
const chord = (t: number, inst: InstId, midis: readonly number[], dur: number, vel: number, spread = 0.012): StingerNote[] =>
	midis.map((m, i) => n(t + i * spread, inst, m, dur, vel));

const ticks: StingerNote[] = Array.from({ length: 9 }, (_, i) => ({ t: i * 0.055 + (i % 3 === 2 ? 0.02 : 0), inst: "tick" as const, midi: 0, dur: 0.02, vel: 0.75 - (i % 2) * 0.2 }));
const rattle = (count: number, gap: number, vel = 0.6): StingerNote[] => Array.from({ length: count }, (_, i) => n(i * gap, "tick", 0, 0.02, vel - (i % 2) * 0.15));

export const STINGER_NOTES: Record<Exclude<StingerId, "tapeStop">, StingerNote[]> = {
	// Teletype rattle ending in a carriage-return bell.
	teletype: [...ticks, n(0.62, "vibes", 88, 0.5, 0.55), n(0.62, "vibes", 76, 0.5, 0.35)],
	// Rising Cmaj9 arpeggio on vibes over a held Rhodes/pad chord.
	fanfare: [
		n(0, "vibes", 72, 0.3, 0.6),
		n(0.13, "vibes", 76, 0.3, 0.65),
		n(0.26, "vibes", 79, 0.3, 0.7),
		n(0.39, "vibes", 83, 0.3, 0.75),
		n(0.52, "vibes", 86, 1.2, 0.8),
		...chord(0.52, "rhodes", [60, 64, 67, 71], 1.4, 0.7),
		...[55, 59, 62, 67].map((midi) => n(0.52, "pad", midi, 2, 0.5)),
	],
	// Research filed: a stamp-rattle, then a bright two-bell resolution.
	researched: [...rattle(3, 0.06), n(0.3, "vibes", 79, 0.6, 0.6), n(0.42, "vibes", 84, 1.0, 0.7), ...chord(0.42, "rhodes", [60, 64, 67], 1.0, 0.55)],
	// Audit filed, good grade: the stamp lands, a major cadence blooms.
	auditGood: [
		n(0, "rim", 0, 0.05, 0.9),
		n(0, "pluck", 48, 0.5, 0.8),
		n(0.18, "vibes", 76, 0.5, 0.55),
		n(0.3, "vibes", 79, 0.5, 0.6),
		n(0.42, "vibes", 84, 1.4, 0.7),
		...chord(0.42, "rhodes", [59, 64, 67, 71], 1.6, 0.6),
		...[52, 59, 64, 67].map((midi) => n(0.42, "pad", midi, 1.8, 0.45)),
	],
	// Audit filed, bad grade: the stamp lands, the cadence wilts to a flat sixth.
	auditBad: [
		n(0, "rim", 0, 0.05, 0.9),
		n(0, "pluck", 41, 0.7, 0.8),
		n(0.2, "vibes", 75, 0.6, 0.5),
		n(0.5, "vibes", 72, 0.6, 0.5),
		n(0.8, "vibes", 68, 1.4, 0.55),
		...chord(0.8, "rhodes", [53, 56, 60, 63], 1.6, 0.5),
		...[53, 56, 60, 68].map((midi) => n(0.8, "pad", midi, 1.8, 0.45)),
	],
	// Path chosen: a solemn, slowly swelling lydian chord and three deliberate bells.
	pathChosen: [
		n(0, "pluck", 38, 1.2, 0.8),
		...[50, 57, 62, 66, 69].map((midi, i) => n(0.05 + i * 0.02, "pad", midi, 3.4, 0.6)),
		n(0.3, "vibes", 74, 1.2, 0.6),
		n(1.1, "vibes", 78, 1.2, 0.6),
		n(1.9, "vibes", 81, 1.6, 0.65),
		...chord(1.9, "rhodes", [62, 66, 69, 73], 1.6, 0.45),
	],
	// Growth sprouted: a damp run of bubbles and one soft heartbeat.
	sprout: [n(0, "wet", 62, 0.1, 0.5), n(0.11, "wet", 67, 0.1, 0.5), n(0.19, "wet", 71, 0.1, 0.45), n(0.34, "wet", 66, 0.1, 0.4), n(0.52, "wet", 74, 0.1, 0.4), n(0.7, "heart", 0, 0.3, 0.55), n(0.98, "heart", 0, 0.3, 0.4), n(0.7, "vibes", 79, 0.9, 0.3)],
	// Mutation: the pleasant chord is replaced by a semitone cluster; wet clicks and a double thump.
	mutation: [
		...chord(0, "pad", [57, 58, 64, 65], 2.0, 0.55, 0.03),
		...chord(0.05, "rhodes", [60, 61, 66], 1.6, 0.45),
		n(0.15, "wet", 58, 0.1, 0.5),
		n(0.4, "wet", 65, 0.1, 0.45),
		n(0.62, "wet", 61, 0.1, 0.45),
		n(0.9, "heart", 0, 0.3, 0.7),
		n(1.18, "heart", 0, 0.3, 0.5),
		n(1.6, "vibes", 70, 0.9, 0.35),
	],
	// Irreversible: three slow heartbeats under a held cluster; one polite bell at the end.
	irreversible: [
		...[0, 1, 2].flatMap((b) => [n(b, "heart", 0, 0.3, 0.8 - b * 0.1), n(b + 0.28, "heart", 0, 0.3, 0.55 - b * 0.1)]),
		...chord(0, "pad", [48, 49, 51, 52], 3.3, 0.6, 0.04),
		...chord(0.5, "rhodes", [53, 54, 59], 2.8, 0.4),
		n(2.7, "wet", 60, 0.1, 0.4),
		n(2.6, "vibes", 84, 0.9, 0.45),
	],
	// Victory (Living/Clean tower): the fanfare extended into a long, warm Cmaj9.
	victory: [
		...[72, 76, 79, 83, 86, 88, 91].map((midi, i) => n(i * 0.14, "vibes", midi, 0.4, 0.55 + i * 0.04)),
		n(1.1, "pluck", 36, 2.4, 0.85),
		...chord(1.1, "rhodes", [60, 64, 67, 71, 74], 2.6, 0.65),
		...[52, 59, 62, 67, 71].map((midi) => n(1.1, "pad", midi, 2.5, 0.5)),
		n(1.1, "vibes", 88, 2.0, 0.7),
	],
	// Absorbed: the cheerful fanfare plays on, then the harmony slips into a cluster under a heartbeat.
	absorbed: [
		...[72, 76, 79, 83].map((midi, i) => n(i * 0.16, "vibes", midi, 0.4, 0.6)),
		...chord(0.7, "rhodes", [60, 64, 67, 71], 1.2, 0.55),
		...chord(1.0, "pad", [48, 49, 52, 53], 2.5, 0.6, 0.05),
		...chord(1.4, "rhodes", [61, 65, 68, 72], 2.0, 0.45),
		n(1.6, "heart", 0, 0.3, 0.7),
		n(1.88, "heart", 0, 0.3, 0.5),
		n(2.6, "heart", 0, 0.3, 0.7),
		n(2.88, "heart", 0, 0.3, 0.5),
		n(2.2, "wet", 64, 0.1, 0.4),
		n(3.0, "vibes", 84, 0.6, 0.4),
	],
};

/** Seconds the tape-stop slowdown takes. */
export const TAPE_STOP_S = 1.8;
/** Reverb-less tail after the last note (instrument release). */
const TAIL_S = 0.3;

/** Seconds from trigger until a stinger has finished sounding. */
export function stingerDuration(id: StingerId): number {
	if (id === "tapeStop") return TAPE_STOP_S;
	let end = 0;
	for (const note of STINGER_NOTES[id]) end = Math.max(end, note.t + note.dur);
	return end + TAIL_S;
}

/** Stingers that are body horror: dropped at intensity "off", softer at "mild". */
export const HORROR_STINGERS: ReadonlySet<StingerId> = new Set<StingerId>(["sprout", "mutation", "irreversible", "absorbed"]);

/** Higher plays first when a frame carries several; at most `MAX_STINGERS_PER_UPDATE` are kept. */
const PRIORITY: Record<StingerId, number> = {
	tapeStop: 10,
	absorbed: 9,
	victory: 9,
	irreversible: 8,
	pathChosen: 7,
	fanfare: 6,
	mutation: 5,
	auditBad: 4,
	auditGood: 4,
	researched: 3,
	sprout: 2,
	teletype: 1,
};
export const MAX_STINGERS_PER_UPDATE = 2;

const GOOD_GRADES: ReadonlySet<string> = new Set(["A", "B"]);

/** The stinger for one event, or null. `intensity` "off" drops body-horror stingers. */
export function stingerForEvent(e: SimEvent, intensity: HorrorIntensity = "full"): StingerId | null {
	let id: StingerId | null = null;
	switch (e.type) {
		case "tierUp":
			id = "fanfare";
			break;
		case "memoIssued":
			id = "teletype";
			break;
		case "researched":
			id = "researched";
			break;
		case "quarterReport":
			id = GOOD_GRADES.has(e.grade) ? "auditGood" : "auditBad";
			break;
		case "pathChosen":
			id = "pathChosen";
			break;
		case "growthSprouted":
			id = "sprout";
			break;
		case "botMutated":
			id = "mutation";
			break;
		case "contaminationIrreversible":
			id = "irreversible";
			break;
		case "gameOver":
			// Victory is not final (sandbox play continues): it gets a stinger, the music stays.
			id = e.kind === "victory" ? "victory" : e.kind === "absorbed" ? "absorbed" : "tapeStop";
			break;
		default:
			return null;
	}
	if (intensity === "off" && HORROR_STINGERS.has(id)) return id === "absorbed" ? "tapeStop" : null;
	return id;
}

/** Deduplicated, priority-ordered, capped stingers for a frame's events. */
export function stingersForEvents(events: readonly SimEvent[], intensity: HorrorIntensity = "full"): StingerId[] {
	const seen = new Set<StingerId>();
	for (const e of events) {
		const id = stingerForEvent(e, intensity);
		if (id) seen.add(id);
	}
	const sorted = [...seen].sort((a, b) => PRIORITY[b] - PRIORITY[a]);
	// A game-ending stinger replaces everything else.
	const top = sorted[0];
	if (top === "tapeStop" || top === "absorbed") return [top];
	return sorted.slice(0, MAX_STINGERS_PER_UPDATE);
}
