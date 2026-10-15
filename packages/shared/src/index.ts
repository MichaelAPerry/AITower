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
	resize(width: number, height: number): void;
	destroy(): void;
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
	muted: boolean;
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
	setMuted(m: boolean): void;
	save(): string;
	load(json: string): void;
	newGame(seed?: number): void;
}

// ─── Helpers ───────────────────────────────────────────────────────────

export const cellIndex = (view: Pick<SimView, "width" | "floorMin">, x: number, floor: number): number =>
	(floor - view.floorMin) * view.width + x;

export const inBounds = (view: Pick<SimView, "width" | "floorMin" | "floorMax">, x: number, floor: number): boolean =>
	x >= 0 && x < view.width && floor >= view.floorMin && floor <= view.floorMax;

/** Format minuteOfDay as HH:MM. */
export const clock = (minuteOfDay: number): string =>
	`${String(Math.floor(minuteOfDay / 60)).padStart(2, "0")}:${String(minuteOfDay % 60).padStart(2, "0")}`;
