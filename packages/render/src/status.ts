/** Pure mapping from sim status to visual cues. */
import type { FacilityStatus } from "@aitower/sim";
import { CB, T, dk, lt } from "./palette";

/** Indicator lamp / phosphor colours (STYLE.md tokens). */
export const LED = {
	ok: T.green,
	amber: T.amber,
	red: T.red,
	idle: T.greenDim,
	off: dk(T.housing, 0.35),
} as const;

/** Colour-blind lamp scheme: blue ok, orange warning, vermilion fault. Same roles as `LED`. */
export const LED_CB = {
	ok: CB.blue,
	amber: CB.orange,
	red: lt(CB.vermilion, 0.15),
	idle: dk(CB.blue, 0.5),
	off: LED.off,
} as const;

/** Health bucket of a rack: drives phosphor colour and CRT speed; colour-independent. */
export type LedTone = "ok" | "warn" | "fault" | "idle" | "off";

export type LedMode = "activity" | "steady" | "blink" | "off";

export interface LedCue {
	/** Lamp colour for this status (colour-blind aware). */
	color: number;
	mode: LedMode;
	tone: LedTone;
	/** Third "activity" lamp colour (the warm accent), colour-blind aware. */
	accent: number;
}

/**
 * Rack status lamps / CRT phosphor: green ok (activity), amber throttled, red tripped/failed, dim-green idle,
 * off unpowered. With `colorBlind` the same roles use blue / orange / vermilion.
 */
export const ledCue = (status: FacilityStatus, enabled: boolean, colorBlind = false): LedCue => {
	const L = colorBlind ? LED_CB : LED;
	const accent = L.amber;
	const cue = (color: number, mode: LedMode, tone: LedTone): LedCue => ({ color, mode, tone, accent });
	if (!enabled) return cue(L.off, "off", "off");
	switch (status) {
		case "ok":
			return cue(L.ok, "activity", "ok");
		case "idle":
			return cue(L.idle, "steady", "idle");
		case "throttled":
		case "brownout":
			return cue(L.amber, "activity", "warn");
		case "noCoolant":
			return cue(L.amber, "blink", "warn");
		case "tripped":
		case "failed":
			return cue(L.red, "blink", "fault");
		case "disabled":
		case "unpowered":
			return cue(L.off, "off", "off");
	}
};

/** CRT phosphor pair [lit, dim] for a tone. */
export const phosphorFor = (tone: LedTone, colorBlind = false): readonly [number, number] => {
	const L = colorBlind ? LED_CB : LED;
	switch (tone) {
		case "ok":
			return [L.ok, dk(L.ok, 0.5)];
		case "warn":
			return [L.amber, dk(L.amber, 0.45)];
		case "fault":
			return [L.red, dk(L.red, 0.6)];
		case "idle":
		case "off":
			return [L.idle, dk(L.idle, 0.5)];
	}
};

/** 3×3 CRT glyphs (STYLE.md-style pixel icons): ✓ ok, ▲ throttled, ✕ tripped/failed, ○ idle. */
export type CrtGlyph = "ok" | "throttled" | "fault" | "idle";

export const CRT_GLYPHS: Record<CrtGlyph, readonly string[]> = {
	ok: ["..X", ".X.", "X.."],
	throttled: [".X.", "X.X", "XXX"],
	fault: ["X.X", ".X.", "X.X"],
	idle: [".X.", "X.X", ".X."],
};

/** Glyph shown on a rack CRT, or null for states with no screen (unpowered / disabled). Matches `ledCue` tones. */
export const crtGlyph = (status: FacilityStatus): CrtGlyph | null => {
	switch (status) {
		case "ok":
			return "ok";
		case "idle":
			return "idle";
		case "throttled":
		case "brownout":
		case "noCoolant":
			return "throttled";
		case "tripped":
		case "failed":
			return "fault";
		case "disabled":
		case "unpowered":
			return null;
	}
};

export type Badge = "wrench" | "noCoolant" | "noPower" | null;

export const badgeFor = (status: FacilityStatus): Badge => {
	switch (status) {
		case "failed":
		case "tripped":
			return "wrench";
		case "noCoolant":
			return "noCoolant";
		case "unpowered":
			return "noPower";
		default:
			return null;
	}
};

/** Whether a facility's fans / pumps should animate. */
export const isActive = (status: FacilityStatus, enabled: boolean): boolean =>
	enabled && status !== "unpowered" && status !== "disabled" && status !== "failed" && status !== "tripped";

/** Deterministic per-LED activity flicker in [0,1): stable hash of (id, led, timeslot). */
export const flicker = (id: number, led: number, slot: number): number => {
	let h = Math.imul(id + 0x9e37, 0x85ebca6b) ^ Math.imul(led + 0x79b9, 0xc2b2ae35) ^ Math.imul(slot, 0x27d4eb2f);
	h ^= h >>> 15;
	h = Math.imul(h, 0x2c1b3c6d);
	h ^= h >>> 12;
	return (h >>> 0) / 4294967296;
};
