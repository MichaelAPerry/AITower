/**
 * CONTRACT — client-side interfaces shared by render, ui, audio and app.
 * Types only (plus tiny pure helpers). Owned by the orchestrator.
 */
import type { CellRef, CommandResult, ConduitLayer, SimCommand, SimEvent, SimView } from "@aitower/sim";

export type OverlayMode = "normal" | "heat" | "power" | "coolant";

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
	setGhost(ghost: Ghost | null): void;
	setSelection(sel: Selection): void;
	/** Centre the camera on a cell. */
	focus(cell: CellRef): void;
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
	newGame(seed?: number): void;
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
