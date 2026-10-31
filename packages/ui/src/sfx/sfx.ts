/**
 * UI sound effects: short retro FM-style blips made with the Web Audio API (no audio files).
 * Nothing is created until the first user gesture; every call is a safe no-op where audio is unavailable.
 * Master volume and Mute (settings) apply on top of the effects switch and volume.
 */
import type { Settings } from "@aitower/shared";

export type SfxId = "chime" | "click" | "alert" | "complete";

interface Note {
	freq: number;
	at: number;
	dur: number;
	gain: number;
	wave?: OscillatorType;
	/** Soft "FM" shimmer: a quiet partial at this ratio above the note. */
	partial?: number;
}

export const SFX: Record<SfxId, { minGapMs: number; notes: Note[] }> = {
	// Achievement: bright rising three-note chime.
	chime: {
		minGapMs: 400,
		notes: [
			{ freq: 784, at: 0, dur: 0.16, gain: 0.5, partial: 2 },
			{ freq: 1047, at: 0.1, dur: 0.18, gain: 0.5, partial: 2 },
			{ freq: 1568, at: 0.2, dur: 0.4, gain: 0.45, partial: 2 },
		],
	},
	// Button press / confirm: one tiny tick.
	click: { minGapMs: 40, notes: [{ freq: 1200, at: 0, dur: 0.035, gain: 0.3, wave: "square" }] },
	// Warning or error notice: two soft low-mid blips.
	alert: {
		minGapMs: 600,
		notes: [
			{ freq: 520, at: 0, dur: 0.09, gain: 0.35, wave: "triangle" },
			{ freq: 392, at: 0.11, dur: 0.14, gain: 0.35, wave: "triangle" },
		],
	},
	// Research complete / level up: rising major arpeggio.
	complete: {
		minGapMs: 500,
		notes: [
			{ freq: 523, at: 0, dur: 0.1, gain: 0.4, wave: "square" },
			{ freq: 659, at: 0.09, dur: 0.1, gain: 0.4, wave: "square" },
			{ freq: 784, at: 0.18, dur: 0.1, gain: 0.4, wave: "square" },
			{ freq: 1047, at: 0.27, dur: 0.3, gain: 0.4, wave: "square" },
		],
	},
};

/** Which effect a toast of this severity makes (warnings and errors only). */
export const noticeSfx = (severity: string): SfxId | null => (severity === "error" || severity === "warn" ? "alert" : null);

type LevelSettings = Pick<Settings, "masterVolume" | "sfxVolume" | "sfxEnabled" | "muted">;

/** 0..1 output level: master x effects, zero when off or muted. */
export function sfxLevel(s: LevelSettings): number {
	if (!s.sfxEnabled || s.muted) return 0;
	return Math.min(1, Math.max(0, s.masterVolume * s.sfxVolume));
}

type Ctor = new () => AudioContext;
const findCtor = (): Ctor | null => {
	const g = globalThis as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
	return g.AudioContext ?? g.webkitAudioContext ?? null;
};

let level = 0;
let gestured = false;
let listening = false;
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const last = new Map<SfxId, number>();

function onGesture(): void {
	gestured = true;
	listening = false;
	if (typeof window === "undefined") return;
	window.removeEventListener("pointerdown", onGesture, true);
	window.removeEventListener("keydown", onGesture, true);
}

/** Follow the settings. Cheap; call whenever they change. */
export function configureSfx(s: LevelSettings): void {
	level = sfxLevel(s);
	if (master) master.gain.value = level;
	if (!gestured && !listening && typeof window !== "undefined") {
		listening = true;
		window.addEventListener("pointerdown", onGesture, true);
		window.addEventListener("keydown", onGesture, true);
	}
}

/** Play one effect. Does nothing when off, muted, before a user gesture, or without Web Audio. */
export function playSfx(id: SfxId): void {
	if (level <= 0 || !gestured) return;
	try {
		const now = Date.now();
		const prev = last.get(id);
		if (prev !== undefined && now - prev < SFX[id].minGapMs) return;
		last.set(id, now);
		if (!ctx) {
			const C = findCtor();
			if (!C) return;
			ctx = new C();
			master = ctx.createGain();
			master.gain.value = level;
			master.connect(ctx.destination);
		}
		if (ctx.state === "suspended") void ctx.resume().catch(() => {});
		const t0 = ctx.currentTime + 0.01;
		for (const n of SFX[id].notes) voice(ctx, master as GainNode, n, t0);
	} catch {
		/* audio unavailable: stay silent */
	}
}

function voice(c: AudioContext, out: GainNode, n: Note, t0: number): void {
	const g = c.createGain();
	const t = t0 + n.at;
	g.gain.setValueAtTime(0.0001, t);
	g.gain.exponentialRampToValueAtTime(n.gain, t + 0.006);
	g.gain.exponentialRampToValueAtTime(0.0001, t + n.dur);
	g.connect(out);
	const parts: [number, number][] = [[n.freq, 1]];
	if (n.partial) parts.push([n.freq * n.partial, 0.25]);
	for (const [f, k] of parts) {
		const o = c.createOscillator();
		o.type = n.wave ?? "sine";
		o.frequency.value = f;
		if (k === 1) o.connect(g);
		else {
			const pg = c.createGain();
			pg.gain.value = k;
			o.connect(pg).connect(g);
		}
		o.start(t);
		o.stop(t + n.dur + 0.02);
	}
}

/** Test seam: forget gesture/context state. */
export function resetSfxForTests(): void {
	level = 0;
	gestured = false;
	listening = false;
	ctx = null;
	master = null;
	last.clear();
}
