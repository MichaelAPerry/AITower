/**
 * CONTRACT — client-side interfaces shared by render, ui, audio and app.
 * Types only (plus tiny pure helpers). Owned by the orchestrator.
 */
import type { CellRef, CommandResult, ConduitLayer, SimCommand, SimEvent, SimView } from "@aitower/sim";

export type OverlayMode = "normal" | "heat" | "power" | "coolant" | "nutrient" | "contamination";

export type Speed = 0 | 1 | 3 | 10 | 30;

export type Tool =
	| { kind: "select" }
	| { kind: "place"; defId: string }
	| { kind: "slab" }
	| { kind: "conduit"; layer: ConduitLayer }
	| { kind: "lift" }
	| { kind: "demolish" };

export type Selection = { kind: "facility"; id: number } | { kind: "bot"; id: number } | { kind: "lift"; id: number } | null;

/** A translucent preview the renderer draws over the world. */
export interface Ghost {
	cells: CellRef[];
	valid: boolean;
	/** Optional facility to preview at cells[0] (its def colour is used). */
	defId?: string;
	label?: string;
}

/** Pointer event in world-cell space, produced by the renderer. */
export interface CellPointerEvent {
	kind: "down" | "move" | "up" | "leave";
	cell: CellRef | null;
	button: number;
	shift: boolean;
}

// ─── Settings & saves ──────────────────────────────────────────────────

export type HorrorIntensity = "full" | "mild" | "off";

/** Player preferences. Persisted by the app (localStorage), independent of save games. */
export interface Settings {
	/** 0..1 */
	masterVolume: number;
	muted: boolean;
	/** Stop non-essential animation (CRT flicker, shimmer, needle overshoot, camera easing). */
	reducedMotion: boolean;
	/** Scanlines, vignette and CRT flicker. */
	crtEffects: boolean;
	/** HUD text scale, 0.85..1.5. */
	textScale: number;
	/** Colour-blind-safe heat ramp and status colours, plus glyphs on status lamps. */
	colorBlind: boolean;
	/** Body-horror presentation intensity (used from M3 onward). */
	horrorIntensity: HorrorIntensity;
	/** Autosave at each new game day. */
	autosave: boolean;
	/** Show the "best on desktop" notice on small screens. */
	showDesktopNotice: boolean;
	/** Music volume relative to master, 0..1. */
	musicVolume: number;
	/** Advisor tips in the strip. Decisions always appear; this only silences the unprompted tips (Ask still works). */
	advisorTips: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
	masterVolume: 0.8,
	muted: false,
	reducedMotion: false,
	crtEffects: true,
	textScale: 1,
	colorBlind: false,
	horrorIntensity: "full",
	autosave: true,
	showDesktopNotice: true,
	musicVolume: 0.6,
	advisorTips: true,
};

/** Clamp/repair a possibly partial or stale settings object (e.g. from storage). */
export function normalizeSettings(raw: unknown): Settings {
	const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof Settings, unknown>>;
	const num = (v: unknown, d: number, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
	const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
	const d = DEFAULT_SETTINGS;
	return {
		masterVolume: num(r.masterVolume, d.masterVolume, 0, 1),
		muted: bool(r.muted, d.muted),
		reducedMotion: bool(r.reducedMotion, d.reducedMotion),
		crtEffects: bool(r.crtEffects, d.crtEffects),
		textScale: num(r.textScale, d.textScale, 0.85, 1.5),
		colorBlind: bool(r.colorBlind, d.colorBlind),
		horrorIntensity: r.horrorIntensity === "mild" || r.horrorIntensity === "off" ? r.horrorIntensity : "full",
		autosave: bool(r.autosave, d.autosave),
		showDesktopNotice: bool(r.showDesktopNotice, d.showDesktopNotice),
		musicVolume: num(r.musicVolume, d.musicVolume, 0, 1),
		// `assistant` is the pre-advisor name of this switch: a player who turned UNIT-7 off keeps tips off.
		advisorTips: bool(r.advisorTips, bool((r as Record<string, unknown>).assistant, d.advisorTips)),
	};
}

/** Save slot ids: "auto" is the rolling autosave; "slot1".."slot3" are manual. */
export type SaveSlotId = "auto" | "slot1" | "slot2" | "slot3";
export const SAVE_SLOTS: SaveSlotId[] = ["auto", "slot1", "slot2", "slot3"];

export interface SaveSlotInfo {
	id: SaveSlotId;
	/** Player-given name (manual slots) or "Autosave". */
	name: string;
	/** Epoch ms when written. */
	savedAt: number;
	day: number;
	cash: number;
	tier: number;
}

export interface SaveStatus {
	/** Epoch ms of the last successful write (any slot), or null. */
	lastSavedAt: number | null;
	/** Human-readable error from the last failed save/load, or null. */
	error: string | null;
	/** True while an async save/load is running. */
	busy: boolean;
}

// ─── Renderer (implemented by @aitower/render) ─────────────────────────

export interface Renderer {
	/** Draw the world. `alpha` ∈ [0,1) is the fraction toward the next tick, for interpolation. */
	draw(view: SimView, alpha: number): void;
	setOverlay(mode: OverlayMode): void;
	/** Events from the latest steps (for in-world feedback: "+$" floaters, build puffs). Called by the app after stepping. */
	pushEvents(events: SimEvent[]): void;
	setGhost(ghost: Ghost | null): void;
	setSelection(sel: Selection): void;
	/** Centre the camera on a cell. */
	focus(cell: CellRef): void;
	/** Title screen backdrop: pan slowly and cycle day and night over the loaded game (a still frame under reduced motion). Never touches the sim. */
	setTitleScene?(on: boolean): void;
	onPointer(cb: (e: CellPointerEvent) => void): () => void;
	/** Apply presentation settings. Must be cheap and safe to call every time settings change. */
	setOptions(o: RenderOptions): void;
	resize(width: number, height: number): void;
	destroy(): void;
}

export interface RenderOptions {
	reducedMotion: boolean;
	crtEffects: boolean;
	colorBlind: boolean;
	horrorIntensity: HorrorIntensity;
}

/** Factory signature exported by @aitower/render as `createRenderer`. */
export type CreateRenderer = (host: HTMLElement, content: import("@aitower/content").ContentDB) => Promise<Renderer>;

// ─── Audio (implemented by @aitower/audio) ─────────────────────────────

export interface AudioEngine {
	/** Must be called from a user gesture before sound plays (browser autoplay policy). */
	resume(): Promise<void>;
	update(view: SimView, events: SimEvent[]): void;
	setMuted(muted: boolean): void;
	setVolume(v: number): void;
	/** Music level relative to master (0..1). 0 stops the music engine's scheduling. */
	setMusicVolume(v: number): void;
	/** Body-horror intensity for the corruption layers (off = clean tape, no organic sounds). */
	setHorrorIntensity(i: HorrorIntensity): void;
	destroy(): void;
}

// ─── Game store (implemented by app, consumed by ui) ───────────────────

export interface GameState {
	view: SimView;
	speed: Speed;
	overlay: OverlayMode;
	tool: Tool;
	selection: Selection;
	/** Recent events, newest last, capped (~200). */
	log: { tick: number; event: SimEvent }[];
	/** Mirrors settings.muted (kept for older callers). */
	muted: boolean;
	settings: Settings;
	saveStatus: SaveStatus;
}

export interface GameStore {
	get(): GameState;
	/** Notified at most once per animation frame. */
	subscribe(cb: () => void): () => void;
	dispatch(cmd: SimCommand): CommandResult;
	canPlace(defId: string, floor: number, x: number): CommandResult;
	setSpeed(s: Speed): void;
	setOverlay(m: OverlayMode): void;
	/** Title screen backdrop on or off (see `Renderer.setTitleScene`). Absent in test stores. */
	setTitleScene?(on: boolean): void;
	setTool(t: Tool): void;
	setSelection(s: Selection): void;
	setGhost(g: Ghost | null): void;
	focus(cell: CellRef): void;
	/** Same as setSettings({ muted }). */
	setMuted(m: boolean): void;
	/** Merge, normalise, persist and apply (audio volume, renderer options) the given settings. */
	setSettings(patch: Partial<Settings>): void;
	/** Same validation as dispatch() without queueing (for ghosts). Never throws. */
	canBuild(cmd: SimCommand): CommandResult;
	/** Export the current game as JSON text (for "export to file"). */
	save(): string;
	/** Replace the current game from exported JSON. Throws Error("Invalid save: …") on bad input; the running game is kept. */
	load(json: string): void;
	/** `scenarioId` defaults to "starter"; any id in content.scenarios is allowed (brownfield, sandbox…). */
	newGame(seed?: number, scenarioId?: string): void;
	/** Slots that currently hold a save, newest first. */
	listSaves(): Promise<SaveSlotInfo[]>;
	saveTo(slot: SaveSlotId, name?: string): Promise<CommandResult>;
	/** On failure the running game is kept and saveStatus.error is set. */
	loadFrom(slot: SaveSlotId): Promise<CommandResult>;
	deleteSave(slot: SaveSlotId): Promise<void>;
}

// ─── Helpers ───────────────────────────────────────────────────────────

export const cellIndex = (view: Pick<SimView, "width" | "floorMin">, x: number, floor: number): number =>
	(floor - view.floorMin) * view.width + x;

export const inBounds = (view: Pick<SimView, "width" | "floorMin" | "floorMax">, x: number, floor: number): boolean =>
	x >= 0 && x < view.width && floor >= view.floorMin && floor <= view.floorMax;

/** Format minuteOfDay as HH:MM. */
export const clock = (minuteOfDay: number): string =>
	`${String(Math.floor(minuteOfDay / 60)).padStart(2, "0")}:${String(minuteOfDay % 60).padStart(2, "0")}`;

// ─── Lesson progress (M6.4) ───────────────────────────────────────────

/** Where the campaign progress lives (best effort; the game works without it). */
export const LESSON_PROGRESS_KEY = "aitower.lessons.v1";

/** Best stars per completed lesson id. */
export interface LessonProgress {
	done: Record<string, number>;
}
type LessonStorage = Pick<Storage, "getItem" | "setItem">;
const defaultLessonStorage = (): LessonStorage | null => {
	try {
		return typeof localStorage === "undefined" ? null : localStorage;
	} catch {
		return null;
	}
};

export function loadLessonProgress(storage: LessonStorage | null = defaultLessonStorage()): LessonProgress {
	try {
		const raw = storage?.getItem(LESSON_PROGRESS_KEY);
		if (raw) {
			const p = JSON.parse(raw) as Partial<LessonProgress>;
			const done: Record<string, number> = {};
			if (p.done && typeof p.done === "object") for (const [k, v] of Object.entries(p.done)) if (typeof v === "number" && v >= 1 && v <= 3) done[k] = Math.floor(v);
			return { done };
		}
	} catch {
		/* unreadable: no progress */
	}
	return { done: {} };
}

/** Record a finished lesson (keeps the best stars). Returns the new progress and whether it was the first completion. */
export function recordLesson(id: string, stars: number, storage: LessonStorage | null = defaultLessonStorage()): { progress: LessonProgress; first: boolean } {
	const progress = loadLessonProgress(storage);
	const first = progress.done[id] === undefined;
	progress.done[id] = Math.max(progress.done[id] ?? 0, Math.min(3, Math.max(1, Math.floor(stars))));
	try {
		storage?.setItem(LESSON_PROGRESS_KEY, JSON.stringify(progress));
	} catch {
		/* best effort */
	}
	return { progress, first };
}

/** The Free Build starting-cash bonus: each lesson's `bonus`, once, for every lesson completed. */
export const freeBuildBonus = (lessons: readonly { id: string; bonus: number }[], progress: LessonProgress): number =>
	lessons.reduce((sum, l) => sum + (progress.done[l.id] !== undefined ? l.bonus : 0), 0);

// ─── Player profile (achievements; lifetime, not per run) ─────────────
// Same pattern as the lesson progress above: best effort, the game works without storage. See docs/ACHIEVEMENTS.md.

/** Where the profile lives. */
export const PROFILE_KEY = "aitower.profile";

export type AdvisorKey = "luci" | "mel" | "bea" | "cass";

export const ADVISOR_KEYS: readonly AdvisorKey[] = ["luci", "mel", "bea", "cass"];

export interface Profile {
	v: 1;
	/** Achievement id to the game day it was earned and the ending of that run (null when earned mid-run). Latched for life. */
	earned: Record<string, { day: number; ending: string | null }>;
	/** Which advisors' ending epilogues have been seen (for `heard_out`). */
	epilogues: Record<AdvisorKey, boolean>;
	/** Off-duty gallery: the casual portrait of each advisor is unlocked (`aitower.profile.offDuty.<advisor>.casual`). Latched. */
	offDuty: Record<AdvisorKey, { casual: boolean }>;
	/** Highest bond each advisor reached in any run (the gallery shows a locked frame's plain rule from 30). */
	bondMax: Record<AdvisorKey, number>;
	/** Unlock strips already shown, by key (an advisor id for a casual portrait, "bed" for the bed set). */
	told: Record<string, boolean>;
	/** One-time gallery scenes already played (`ach_bed_intro`, `ach_gallery_empty`). */
	scenesSeen: Record<string, boolean>;
}

const perAdvisor = <T,>(v: () => T): Record<AdvisorKey, T> => ({ luci: v(), mel: v(), bea: v(), cass: v() });
const emptyProfile = (): Profile => ({
	v: 1,
	earned: {},
	epilogues: perAdvisor(() => false),
	offDuty: perAdvisor(() => ({ casual: false })),
	bondMax: perAdvisor(() => 0),
	told: {},
	scenesSeen: {},
});

const flags = (raw: unknown): Record<string, boolean> => {
	const out: Record<string, boolean> = {};
	if (raw && typeof raw === "object") for (const [k, v] of Object.entries(raw)) if (v === true) out[k] = true;
	return out;
};

/** Read a profile from untrusted JSON (storage or an imported file). Anything malformed is dropped; never throws. */
export function parseProfile(raw: unknown): Profile {
	const profile = emptyProfile();
	try {
		const p = raw as Partial<Profile> | null;
		if (!p || typeof p !== "object" || p.v !== 1) return profile;
		if (p.earned && typeof p.earned === "object")
			for (const [id, e] of Object.entries(p.earned)) {
				if (e && typeof e === "object" && Number.isFinite((e as { day: unknown }).day)) {
					const ending = (e as { ending: unknown }).ending;
					profile.earned[id] = { day: Math.floor((e as { day: number }).day), ending: typeof ending === "string" ? ending : null };
				}
			}
		for (const a of ADVISOR_KEYS) {
			profile.epilogues[a] = (p.epilogues as Record<string, unknown> | undefined)?.[a] === true;
			profile.offDuty[a].casual = (p.offDuty as Record<string, { casual?: unknown } | undefined> | undefined)?.[a]?.casual === true;
			const b = (p.bondMax as Record<string, unknown> | undefined)?.[a];
			profile.bondMax[a] = typeof b === "number" && Number.isFinite(b) ? Math.max(0, Math.min(100, b)) : 0;
		}
		profile.told = flags(p.told);
		profile.scenesSeen = flags(p.scenesSeen);
	} catch {
		/* unreadable: an empty profile */
	}
	return profile;
}

export function loadProfile(storage: LessonStorage | null = defaultLessonStorage()): Profile {
	try {
		const raw = storage?.getItem(PROFILE_KEY);
		if (raw) return parseProfile(JSON.parse(raw));
	} catch {
		/* unreadable: an empty profile */
	}
	return emptyProfile();
}

function saveProfile(profile: Profile, storage: LessonStorage | null): void {
	try {
		storage?.setItem(PROFILE_KEY, JSON.stringify(profile));
	} catch {
		/* best effort */
	}
}

/** Latch an achievement. An id already earned is never overwritten or removed. Returns the profile and whether this call earned it. */
export function recordAchievement(id: string, day: number, ending: string | null, storage: LessonStorage | null = defaultLessonStorage()): { profile: Profile; first: boolean } {
	const profile = loadProfile(storage);
	if (profile.earned[id]) return { profile, first: false };
	profile.earned[id] = { day: Math.max(0, Math.floor(day)), ending };
	saveProfile(profile, storage);
	return { profile, first: true };
}

/** Apply `change` to the stored profile and save it. Returns the new profile. */
export function updateProfile(change: (p: Profile) => void, storage: LessonStorage | null = defaultLessonStorage()): Profile {
	const profile = loadProfile(storage);
	change(profile);
	saveProfile(profile, storage);
	return profile;
}

/** Latch that an advisor's epilogue was shown at an ending. Returns true the first time. */
export function recordEpilogue(advisor: AdvisorKey, storage: LessonStorage | null = defaultLessonStorage()): boolean {
	let first = false;
	updateProfile((p) => {
		first = !p.epilogues[advisor];
		p.epilogues[advisor] = true;
	}, storage);
	return first;
}

/** Latch an advisor's casual off-duty portrait. Returns true the first time. */
export function recordOffDuty(advisor: AdvisorKey, storage: LessonStorage | null = defaultLessonStorage()): boolean {
	let first = false;
	updateProfile((p) => {
		first = !p.offDuty[advisor].casual;
		p.offDuty[advisor].casual = true;
	}, storage);
	return first;
}

/** Remember the highest bond seen per advisor. */
export function recordBonds(bonds: Partial<Record<AdvisorKey, number>>, storage: LessonStorage | null = defaultLessonStorage()): void {
	const p0 = loadProfile(storage);
	if (!ADVISOR_KEYS.some((a) => (bonds[a] ?? 0) > p0.bondMax[a])) return;
	updateProfile((p) => {
		for (const a of ADVISOR_KEYS) p.bondMax[a] = Math.max(p.bondMax[a], Math.min(100, bonds[a] ?? 0));
	}, storage);
}

/** Mark an unlock strip as shown (`told`) or a one-time scene as played (`scenesSeen`). */
export function markProfileFlag(kind: "told" | "scenesSeen", key: string, storage: LessonStorage | null = defaultLessonStorage()): void {
	if (loadProfile(storage)[kind][key]) return;
	updateProfile((p) => {
		p[kind][key] = true;
	}, storage);
}

/** Union of two profiles: nothing is ever removed. For an achievement in both, the earlier day wins. */
export function mergeProfiles(a: Profile, b: Profile): Profile {
	const out = emptyProfile();
	for (const src of [a, b])
		for (const [id, e] of Object.entries(src.earned)) {
			const cur = out.earned[id];
			if (!cur || e.day < cur.day) out.earned[id] = { ...e };
		}
	for (const k of ADVISOR_KEYS) {
		out.epilogues[k] = a.epilogues[k] || b.epilogues[k];
		out.offDuty[k].casual = a.offDuty[k].casual || b.offDuty[k].casual;
		out.bondMax[k] = Math.max(a.bondMax[k], b.bondMax[k]);
	}
	// A strip counts as shown only if both sides showed it, so a merge never hides a portrait the player has not been told about.
	for (const k of Object.keys({ ...a.told, ...b.told })) if (a.told[k] && b.told[k]) out.told[k] = true;
	for (const k of Object.keys({ ...a.scenesSeen, ...b.scenesSeen })) if (a.scenesSeen[k] || b.scenesSeen[k]) out.scenesSeen[k] = true;
	return out;
}

/** The key the profile travels under in an exported save file. */
export const PROFILE_FILE_KEY = "profile";

/** Add the stored profile to an exported save's JSON text (an object at the top level). Text that is not a JSON object is returned unchanged. */
export function attachProfile(saveText: string, storage: LessonStorage | null = defaultLessonStorage()): string {
	try {
		const obj = JSON.parse(saveText) as unknown;
		if (!obj || typeof obj !== "object" || Array.isArray(obj)) return saveText;
		return JSON.stringify({ ...(obj as Record<string, unknown>), [PROFILE_FILE_KEY]: loadProfile(storage) });
	} catch {
		return saveText;
	}
}

/** Take the profile out of an imported file's text. `text` is what to hand to the save loader (the original when there is no profile or it does not parse). */
export function extractProfile(fileText: string): { text: string; profile: Profile | null } {
	try {
		const obj = JSON.parse(fileText) as unknown;
		if (!obj || typeof obj !== "object" || Array.isArray(obj) || !(PROFILE_FILE_KEY in obj)) return { text: fileText, profile: null };
		const { [PROFILE_FILE_KEY]: raw, ...rest } = obj as Record<string, unknown>;
		const profile = raw && typeof raw === "object" && (raw as { v?: unknown }).v === 1 ? parseProfile(raw) : null;
		return { text: JSON.stringify(rest), profile };
	} catch {
		return { text: fileText, profile: null };
	}
}

/** Merge an imported profile into the stored one (union; nothing removed) and save it. */
export function mergeStoredProfile(incoming: Profile, storage: LessonStorage | null = defaultLessonStorage()): Profile {
	const merged = mergeProfiles(loadProfile(storage), incoming);
	saveProfile(merged, storage);
	return merged;
}
