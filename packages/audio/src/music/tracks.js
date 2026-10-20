/**
 * Tier tracks 2 and 3: hand-authored 64-bar bossa / muzak loops in the same
 * voice as the tier-1 score (see score.ts), same stems and instruments. Data
 * only: compact chord, melody and rhythm tables expanded by `buildTrack`.
 *   - Tier 2 "Quarterly Synergy": 104 BPM, F major, bouncier comping, bridge + sunny C section.
 *   - Tier 3 "Deep Compliance": 88 BPM, D minor, spacious, half-diminished and diminished colours.
 * Tiers 4-5 reuse the tier-3 track (the corruption layers do the rest).
 */
import { SCORE, STEPS_PER_BAR } from "./score";
export const TRACK_BARS = 64;
const SECTION_BARS = 8;
/** Intervals above the root (semitones) of a 4-note colour voicing. */
const QUALITIES = {
    maj9: [4, 7, 11, 14],
    maj7: [4, 7, 11, 12],
    "maj7#11": [4, 11, 14, 18],
    m9: [3, 7, 10, 14],
    m7: [3, 7, 10, 12],
    m11: [3, 7, 10, 17],
    mMaj7: [3, 7, 11, 14],
    m7b5: [3, 6, 10, 12],
    dim7: [3, 6, 9, 12],
    "13": [4, 9, 10, 14],
    "7": [4, 7, 10, 12],
    "7b9": [4, 7, 10, 13],
};
const ROOT_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** "Dm9", "Bbmaj7#11", "A7b9" → voicing (keys/pad in 48..77, bass in 31..49). */
export function spell(name) {
    const m = /^([A-G])([b#]?)(.*)$/.exec(name);
    const intervals = m ? QUALITIES[m[3]] : undefined;
    if (!m || !intervals)
        throw new Error(`unknown chord ${name}`);
    const pc = ((ROOT_PC[m[1]] + (m[2] === "b" ? -1 : m[2] === "#" ? 1 : 0)) % 12 + 12) % 12;
    const top = 48 + ((pc - 48 + 120) % 12);
    const root = 31 + ((pc - 31 + 120) % 12);
    return { v: intervals.map((i) => top + i), root, fifth: root + 7 };
}
function buildTrack(spec) {
    const notes = [];
    const add = (n) => notes.push(n);
    const progression = spec.sections.flatMap((s) => s.bars);
    if (progression.length !== TRACK_BARS)
        throw new Error(`track has ${progression.length} bars`);
    const chordAt = (bar, half) => {
        const b = progression[bar];
        return spell((b[half] ?? b[0]));
    };
    for (let bar = 0; bar < TRACK_BARS; bar++) {
        const b0 = bar * STEPS_PER_BAR;
        const bars = progression[bar];
        const halves = bars.length === 2 ? [0, 1] : [0];
        for (const h of halves) {
            const len = bars.length === 2 ? 8 : 16;
            const voicing = chordAt(bar, h).v;
            for (let i = 0; i < voicing.length; i++)
                add({ stem: "pad", inst: "pad", step: b0 + h * 8, dur: len + 1, midi: voicing[i], vel: 0.5 - i * 0.03 });
        }
        for (const [s, d, v] of spec.comp) {
            const voicing = chordAt(bar, s >= 8 ? 1 : 0).v;
            for (let i = 0; i < voicing.length; i++)
                add({ stem: "keys", inst: "rhodes", step: b0 + s + i * 0.12, dur: d, midi: voicing[i], vel: v - i * 0.03 });
        }
        for (const [s, d, v, which] of spec.bass) {
            const c = chordAt(bar, s >= 8 ? 1 : 0);
            add({ stem: "bass", inst: "pluck", step: b0 + s, dur: d, midi: which === "root" ? c.root : c.fifth, vel: v });
        }
        for (const s of spec.brushQuarter)
            add({ stem: "brush", inst: "brush", step: b0 + s, dur: 3, midi: 0, vel: 0.7 });
        for (const s of spec.brushSwish)
            add({ stem: "brush", inst: "brush", step: b0 + s, dur: 2, midi: 0, vel: 0.35 });
        for (const s of spec.rim)
            add({ stem: "rim", inst: "rim", step: b0 + s, dur: 1, midi: 0, vel: s === 0 ? 0.6 : 0.45 });
        for (const s of spec.hat)
            add({ stem: "hat", inst: "tick", step: b0 + s, dur: 1, midi: 0, vel: s % 4 === 2 ? 0.4 : 0.22 });
    }
    spec.sections.forEach((sec, si) => {
        for (const [bar, beat, midi, beats] of sec.mel) {
            add({ stem: "vibes", inst: "vibes", step: (si * SECTION_BARS + bar) * STEPS_PER_BAR + beat * 4, dur: beats * 4, midi, vel: 0.7 });
        }
    });
    return { bpm: spec.bpm, bars: TRACK_BARS, stepsPerBar: STEPS_PER_BAR, notes: notes.sort((a, b) => a.step - b.step) };
}
/** A section whose melody only enters at bar 4 (the first half is comp-only). */
const late = (mel) => mel.filter((n) => n[0] >= 4);
// ─── Tier 2: Quarterly Synergy (F major, 104 BPM) ───────────────────────
const A2 = [["Fmaj9"], ["Dm9"], ["Gm9"], ["C13"], ["Fmaj9"], ["Dm7"], ["Gm9", "C13"], ["Fmaj9"]];
const A2_TURN = [...A2.slice(0, 7), ["Fmaj9", "C7b9"]];
const B2 = [["Bbmaj7#11"], ["Am7", "D7b9"], ["Gm9"], ["Gm9"], ["Cm9", "F13"], ["Bbmaj9"], ["Bbm7", "Eb13"], ["Am7", "D7b9"]];
const C2 = [["Am7"], ["D7b9"], ["Gmaj9"], ["Gmaj9"], ["Gm9"], ["C13"], ["Fmaj9"], ["Fmaj9", "Db13"]];
const MEL_A2 = [
    [0, 0.5, 81, 1], [0, 2, 84, 1.5], [0, 3.5, 81, 0.5],
    [1, 0, 77, 1], [1, 1, 81, 1], [1, 2, 79, 1], [1, 3, 77, 1],
    [2, 0.5, 79, 1], [2, 2, 82, 1.5], [2, 3.5, 79, 0.5],
    [3, 0, 76, 1], [3, 1, 79, 1], [3, 2, 82, 1], [3, 3, 79, 1],
    [4, 0, 84, 2], [4, 2, 81, 1], [4, 3, 77, 1],
    [5, 0.5, 74, 1], [5, 2, 77, 1], [5, 3, 81, 1],
    [6, 0, 82, 1], [6, 1, 79, 1], [6, 2, 76, 1], [6, 3, 72, 1],
    [7, 0, 77, 3],
];
const MEL_B2 = [
    [0, 0, 86, 1.5], [0, 2, 84, 1], [0, 3, 81, 1],
    [1, 0, 81, 1], [1, 1, 84, 1], [1, 2, 78, 1], [1, 3, 81, 1],
    [2, 0.5, 82, 1], [2, 2, 79, 2],
    [3, 0, 86, 1.5], [3, 2, 82, 1], [3, 3, 79, 1],
    [4, 0, 84, 1], [4, 1, 79, 1], [4, 2, 81, 1], [4, 3, 76, 1],
    [5, 0, 86, 2], [5, 2, 81, 1], [5, 3, 84, 1],
    [6, 0, 80, 1], [6, 1, 77, 1], [6, 2, 82, 1], [6, 3, 79, 1],
    [7, 0, 78, 1], [7, 1, 81, 1], [7, 2, 84, 2],
];
const MEL_C2 = [
    [0, 0.5, 84, 1], [0, 2, 81, 1], [0, 3, 76, 1],
    [1, 0, 81, 1], [1, 1, 78, 1], [1, 2, 74, 1.5],
    [2, 0.5, 79, 1], [2, 2, 83, 1], [2, 3, 86, 1],
    [3, 0, 83, 2], [3, 2, 79, 2],
    [4, 0, 82, 1], [4, 1, 79, 1], [4, 2, 74, 2],
    [5, 0.5, 76, 1], [5, 2, 79, 1], [5, 3, 82, 1],
    [6, 0, 84, 1.5], [6, 2, 81, 1], [6, 3, 77, 1],
    [7, 0, 77, 2], [7, 2, 73, 1.5],
];
export const TRACK_2 = buildTrack({
    bpm: 104,
    sections: [
        { bars: A2, mel: MEL_A2 },
        { bars: A2, mel: late(MEL_A2) },
        { bars: B2, mel: MEL_B2 },
        { bars: A2_TURN, mel: MEL_A2 },
        { bars: C2, mel: MEL_C2 },
        { bars: A2, mel: late(MEL_A2) },
        { bars: B2, mel: MEL_B2 },
        { bars: A2_TURN, mel: MEL_A2 },
    ],
    comp: [[0, 3, 0.8], [3, 2, 0.5], [6, 4, 0.6], [10, 3, 0.55], [14, 2, 0.5]],
    bass: [[0, 4, 0.85, "root"], [5, 2, 0.55, "fifth"], [8, 4, 0.8, "root"], [13, 2, 0.55, "fifth"]],
    brushQuarter: [0, 4, 8, 12],
    brushSwish: [2, 6, 10, 14],
    rim: [0, 3, 6, 9, 12],
    hat: [2, 3, 7, 10, 11, 15],
});
// ─── Tier 3: Deep Compliance (D minor, 88 BPM) ──────────────────────────
const A3 = [["Dm9"], ["Bbmaj7#11"], ["Gm11"], ["A7b9"], ["Dm9"], ["Em7b5"], ["A7b9"], ["Dm9"]];
const A3_END = [...A3.slice(0, 7), ["Dm9", "DmMaj7"]];
const B3 = [["Bbmaj9"], ["Bdim7"], ["Am7"], ["D7b9"], ["Gm9"], ["Ebmaj7#11"], ["Em7b5", "A7b9"], ["Dm9"]];
const C3 = [["Fmaj7"], ["Em7b5"], ["Dm9"], ["Dbmaj7#11"], ["Cmaj7"], ["Bdim7"], ["Bbmaj9"], ["A7b9"]];
const MEL_A3 = [
    [0, 0.5, 81, 1.5], [0, 2.5, 77, 1.5],
    [1, 0, 79, 1], [1, 1, 82, 1], [1, 2, 86, 2],
    [2, 0.5, 82, 1], [2, 2, 79, 1], [2, 3, 77, 1],
    [3, 0, 76, 1], [3, 1, 73, 1], [3, 2, 82, 2],
    [4, 0.5, 81, 1], [4, 2, 84, 2],
    [5, 0, 79, 1], [5, 1, 77, 1], [5, 2, 74, 2],
    [6, 0, 73, 1], [6, 1, 76, 1], [6, 2, 79, 1], [6, 3, 82, 1],
    [7, 0, 81, 2], [7, 2, 73, 2],
];
const MEL_B3 = [
    [0, 0, 86, 2], [0, 2, 82, 2],
    [1, 0.5, 80, 1], [1, 2, 77, 1], [1, 3, 74, 1],
    [2, 0, 84, 1], [2, 1, 81, 1], [2, 2, 79, 2],
    [3, 0.5, 78, 1], [3, 2, 75, 1], [3, 3, 78, 1],
    [4, 0, 86, 1.5], [4, 2, 82, 2],
    [5, 0, 87, 2], [5, 2, 82, 1], [5, 3, 79, 1],
    [6, 0, 79, 1], [6, 1, 76, 1], [6, 2, 73, 1], [6, 3, 76, 1],
    [7, 0, 77, 4],
];
const MEL_C3 = [
    [0, 0, 84, 1.5], [0, 2, 81, 1], [0, 3, 77, 1],
    [1, 0.5, 79, 1.5], [1, 2.5, 76, 1.5],
    [2, 0, 81, 1], [2, 1, 77, 1], [2, 2, 74, 2],
    [3, 0, 77, 1], [3, 1, 73, 1], [3, 2, 72, 2],
    [4, 0, 79, 1], [4, 1, 76, 1], [4, 2, 72, 2],
    [5, 0.5, 74, 1], [5, 2, 77, 1], [5, 3, 80, 1],
    [6, 0, 82, 2], [6, 2, 86, 2],
    [7, 0, 76, 1], [7, 1, 73, 1], [7, 2, 69, 2],
];
export const TRACK_3 = buildTrack({
    bpm: 88,
    sections: [
        { bars: A3, mel: MEL_A3 },
        { bars: A3, mel: late(MEL_A3) },
        { bars: B3, mel: MEL_B3 },
        { bars: A3_END, mel: MEL_A3 },
        { bars: C3, mel: MEL_C3 },
        { bars: A3, mel: late(MEL_A3) },
        { bars: B3, mel: MEL_B3 },
        { bars: A3_END, mel: MEL_A3 },
    ],
    comp: [[0, 7, 0.7], [10, 4, 0.5]],
    bass: [[0, 7, 0.8, "root"], [8, 5, 0.6, "fifth"], [13, 2, 0.45, "root"]],
    brushQuarter: [0, 4, 8, 12],
    brushSwish: [6, 14],
    rim: [0, 6, 12],
    hat: [4, 12, 15],
});
export const TRACKS = { 1: SCORE, 2: TRACK_2, 3: TRACK_3 };
/** Tier 1 → track 1, 2 → 2, 3 → 3, 4-5 reuse 3. Non-finite tiers fall back to track 1. */
export function trackForTier(tier) {
    if (!Number.isFinite(tier) || tier < 2)
        return 1;
    return tier < 3 ? 2 : 3;
}
