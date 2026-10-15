/** Pure mapping from sim status to visual cues. */
import type { FacilityStatus } from "@aitower/sim";
import { T, dk } from "./palette";

/** Indicator lamp / phosphor colours (STYLE.md tokens). */
export const LED = {
	ok: T.green,
	amber: T.amber,
	red: T.red,
	idle: T.greenDim,
	off: dk(T.housing, 0.35),
} as const;

export type LedMode = "activity" | "steady" | "blink" | "off";

export interface LedCue {
	color: number;
	mode: LedMode;
}

/** Rack status lamps / CRT phosphor: green ok (activity), amber throttled, red tripped/failed, dim-green idle, off unpowered. */
export const ledCue = (status: FacilityStatus, enabled: boolean): LedCue => {
	if (!enabled) return { color: LED.off, mode: "off" };
	switch (status) {
		case "ok":
			return { color: LED.ok, mode: "activity" };
		case "idle":
			return { color: LED.idle, mode: "steady" };
		case "throttled":
		case "brownout":
			return { color: LED.amber, mode: "activity" };
		case "noCoolant":
			return { color: LED.amber, mode: "blink" };
		case "tripped":
		case "failed":
			return { color: LED.red, mode: "blink" };
		case "disabled":
		case "unpowered":
			return { color: LED.off, mode: "off" };
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
