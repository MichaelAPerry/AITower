import type { ContentDB } from "@aitower/content";
import { type Sim, type SimEvent, type SimSnapshot, createSim, simFromSnapshot } from "@aitower/sim";
import { type AudioEngine, DEFAULT_SETTINGS, type GameState, type GameStore, type Ghost, type OverlayMode, type Renderer, type Selection, type Speed, type Tool } from "@aitower/shared";

export const SCENARIO = "starter";
const LOG_CAP = 200;
/** HUD refresh cap while only the sim is advancing (UI-state changes notify immediately). */
const UI_NOTIFY_MS = 66;
const AUTOSAVE_KEY = "aitower.autosave.v1";

export interface GameStoreInternals extends GameStore {
	/** Advance the sim by `n` ticks, collecting events. Called by the loop. */
	advance(n: number): SimEvent[];
	/** Push the latest view to subscribers (throttled unless `force`). */
	publish(now: number, force?: boolean): void;
	sim(): Sim;
	loadAutosave(): boolean;
}

export function createGameStore(content: ContentDB, renderer: Renderer | null, audio: AudioEngine | null): GameStoreInternals {
	let sim = createSim(content, SCENARIO, 1);
	let state: GameState = {
		view: sim.view(),
		speed: 1,
		overlay: "normal",
		tool: { kind: "select" },
		selection: null,
		log: [],
		muted: false,
		settings: { ...DEFAULT_SETTINGS },
		saveStatus: { lastSavedAt: null, error: null, busy: false },
	};
	const subs = new Set<() => void>();
	let lastNotify = 0;
	let dirty = false;

	const notify = () => {
		for (const cb of subs) cb();
	};
	const patch = (p: Partial<GameState>) => {
		state = { ...state, ...p };
		notify();
	};
	const pushLog = (events: SimEvent[]) => {
		if (!events.length) return;
		const tick = sim.view().tick;
		const log = state.log.concat(events.map((event) => ({ tick, event })));
		state = { ...state, log: log.length > LOG_CAP ? log.slice(log.length - LOG_CAP) : log };
	};
	const replaceSim = (next: Sim) => {
		sim = next;
		state = { ...state, view: sim.view(), log: [], selection: null };
		renderer?.setSelection(null);
		notify();
	};

	const store: GameStoreInternals = {
		get: () => state,
		subscribe(cb) {
			subs.add(cb);
			return () => subs.delete(cb);
		},
		dispatch: (cmd) => sim.submit(cmd),
		canPlace: (defId, floor, x) => sim.canPlace(defId, floor, x),
		setSpeed: (speed: Speed) => patch({ speed }),
		setOverlay(overlay: OverlayMode) {
			renderer?.setOverlay(overlay);
			patch({ overlay });
		},
		setTool(tool: Tool) {
			renderer?.setGhost(null);
			patch({ tool });
		},
		setSelection(selection: Selection) {
			renderer?.setSelection(selection);
			patch({ selection });
		},
		setGhost: (g: Ghost | null) => renderer?.setGhost(g),
		focus: (cell) => renderer?.focus(cell),
		setMuted(muted) {
			store.setSettings({ muted });
		},
		// Placeholders until agent-platform implements settings persistence and save slots (M1-T3).
		setSettings(p) {
			const settings = { ...state.settings, ...p };
			audio?.setMuted(settings.muted);
			patch({ settings, muted: settings.muted });
		},
		canBuild: (cmd) => sim.canBuild(cmd),
		listSaves: async () => [],
		saveTo: async () => ({ ok: false, reason: "save slots not implemented yet" }),
		loadFrom: async () => ({ ok: false, reason: "save slots not implemented yet" }),
		deleteSave: async () => {},
		save: () => JSON.stringify(sim.snapshot()),
		load(json) {
			replaceSim(simFromSnapshot(content, JSON.parse(json) as SimSnapshot));
		},
		newGame(seed = (Math.random() * 2 ** 31) | 0) {
			replaceSim(createSim(content, SCENARIO, seed));
		},
		advance(n) {
			const events: SimEvent[] = [];
			for (let i = 0; i < n; i++) {
				const ev = sim.step();
				for (const e of ev) events.push(e);
			}
			if (n > 0) dirty = true;
			pushLog(events);
			if (events.some((e) => e.type === "newDay")) autosave();
			return events;
		},
		publish(now, force = false) {
			if (!dirty && !force) return;
			if (!force && now - lastNotify < UI_NOTIFY_MS) return;
			lastNotify = now;
			dirty = false;
			state = { ...state, view: sim.view() };
			notify();
		},
		sim: () => sim,
		loadAutosave() {
			try {
				const json = localStorage.getItem(AUTOSAVE_KEY);
				if (!json) return false;
				store.load(json);
				return true;
			} catch (err) {
				console.warn("autosave ignored:", err);
				return false;
			}
		},
	};

	function autosave() {
		try {
			localStorage.setItem(AUTOSAVE_KEY, store.save());
		} catch {
			/* storage may be unavailable (private mode, quota) — autosave is best-effort */
		}
	}

	return store;
}
