import type { ContentDB } from "@aitower/content";
import { type CommandResult, type Sim, type SimEvent, createSim } from "@aitower/sim";
import {
	type AudioEngine,
	type GameState,
	type GameStore,
	type Ghost,
	type OverlayMode,
	type Renderer,
	SAVE_SLOTS,
	freeBuildBonus,
	loadLessonProgress,
	type SaveSlotId,
	type SaveSlotInfo,
	type Selection,
	type Settings,
	type Speed,
	type Tool,
} from "@aitower/shared";
import { type KeyValueStorage, type SaveBackend, createDefaultBackend, safeLocalStorage } from "./saveBackend";
import { decodeSave, makeEnvelope, readEnvelope } from "./saves";
import { loadSettings, mergeSettings, persistSettings, systemPrefersReducedMotion } from "./settings";

export const SCENARIO = "starter";
const LOG_CAP = 200;
/** HUD refresh cap while only the sim is advancing (UI-state changes notify immediately). */
const UI_NOTIFY_MS = 66;
/** Pre-M1 single-slot autosave (raw SimSnapshot JSON in localStorage). Migrated once into slot "auto". */
export const LEGACY_AUTOSAVE_KEY = "aitower.autosave.v1";
const NAME_MAX = 60;
/** Real time between advisor decisions (M6.3): never more than one per three real minutes, at any speed. */
export const DECISION_GAP_MS = 3 * 60 * 1000;

export interface StoreOptions {
	/** Where save slots live. Default: IndexedDB with a localStorage fallback. */
	backend?: SaveBackend;
	/** Settings + legacy autosave storage. Default: `localStorage` when usable. */
	storage?: KeyValueStorage | null;
	/** Default for `reducedMotion` when no settings are stored. Default: the OS media query. */
	prefersReducedMotion?: boolean;
	/** Epoch-ms clock (tests). */
	now?: () => number;
}

export interface GameStoreInternals extends GameStore {
	/** Advance the sim by `n` ticks, collecting events. Called by the loop. */
	advance(n: number): SimEvent[];
	/** Push the latest view to subscribers (throttled unless `force`). */
	publish(now: number, force?: boolean): void;
	sim(): Sim;
	/**
	 * Boot the game: migrate the legacy autosave, then start fresh (`fresh`) or load slot "auto".
	 * An invalid autosave starts a fresh game and sets `saveStatus.error` instead of throwing.
	 */
	boot(opts?: { fresh?: boolean; seed?: number }): Promise<void>;
	/** Resolves once every queued save-slot read/write has finished (tests, unload). */
	idle(): Promise<void>;
	/** True while the loop is dropping backlog because the sim cannot keep up. Set by the loop; a HUD may show it. */
	behind: boolean;
	/** Read one slot's raw envelope text (crash overlay export). Null when empty. */
	readSlotRaw(slot: SaveSlotId): Promise<string | null>;
}

const errText = (err: unknown) => (err instanceof Error ? err.message : String(err));

export function createGameStore(content: ContentDB, renderer: Renderer | null, audio: AudioEngine | null, opts: StoreOptions = {}): GameStoreInternals {
	const backend = opts.backend ?? createDefaultBackend();
	const storage = opts.storage === undefined ? safeLocalStorage() : opts.storage;
	const clock = opts.now ?? Date.now;

	const applySettings = (s: Settings) => {
		try {
			audio?.setMuted(s.muted);
			audio?.setVolume(s.masterVolume);
			audio?.setMusicVolume(s.musicVolume);
			audio?.setHorrorIntensity(s.horrorIntensity);
		} catch (err) {
			console.warn("audio settings failed:", err);
		}
		try {
			renderer?.setOptions({ reducedMotion: s.reducedMotion, crtEffects: s.crtEffects, colorBlind: s.colorBlind, horrorIntensity: s.horrorIntensity });
		} catch (err) {
			console.warn("renderer settings failed:", err);
		}
	};

	const initialSettings = loadSettings(storage, opts.prefersReducedMotion ?? systemPrefersReducedMotion());
	applySettings(initialSettings);

	/**
	 * A new game, advanced one ordinary tick (one game-minute). Power, cooling and statuses are only solved inside a
	 * tick, so a game shown at tick 0 — paused behind the title screen or the induction — would display every rack as
	 * unpowered. Stepping through the normal pipeline keeps it deterministic; the first tick's events are not shown.
	 */
	const freshSim = (seed: number, scenarioId: string = SCENARIO): Sim => {
		// Unknown ids fall back to the default scenario rather than throwing from a UI click.
		const bonusCash = freeBuildBonus(content.lessons, loadLessonProgress(storage));
		const next = createSim(content, Object.hasOwn(content.scenarios, scenarioId) ? scenarioId : SCENARIO, seed, { bonusCash });
		next.step();
		return next;
	};

	let sim = freshSim(1);
	let state: GameState = {
		view: sim.view(),
		speed: 1,
		overlay: "normal",
		tool: { kind: "select" },
		selection: null,
		log: [],
		muted: initialSettings.muted,
		settings: initialSettings,
		saveStatus: { lastSavedAt: null, error: null, busy: false },
	};
	const subs = new Set<() => void>();
	let lastNotify = 0;
	let dirty = false;
	let pending = 0;
	let queue: Promise<unknown> = Promise.resolve();

	const notify = () => {
		for (const cb of subs) cb();
	};
	const patch = (p: Partial<GameState>) => {
		state = { ...state, ...p };
		notify();
	};
	const patchStatus = (p: Partial<GameState["saveStatus"]>) => patch({ saveStatus: { ...state.saveStatus, ...p } });
	const pushLog = (events: SimEvent[]) => {
		if (!events.length) return;
		const tick = sim.view().tick;
		const log = state.log.concat(events.map((event) => ({ tick, event })));
		state = { ...state, log: log.length > LOG_CAP ? log.slice(log.length - LOG_CAP) : log };
	};
	/**
	 * Advisor decisions. The sim never blocks; the clock owner (this store, via the loop) holds the clock while a decision is
	 * open, so the game stays a pure function of (seed, commands). Pacing: one decision per game day is the sim's rule; the
	 * 3-real-minute rule is the gate, which this store closes when a decision opens and reopens on a timer.
	 */
	let gateTimer: ReturnType<typeof setTimeout> | null = null;
	const reopenGateIn = (ms: number) => {
		if (gateTimer !== null) clearTimeout(gateTimer);
		gateTimer = setTimeout(() => {
			gateTimer = null;
			sim.submit({ type: "decisionGate", open: true });
		}, ms);
	};
	const decisionOpen = (): boolean => sim.view().decision !== null;
	/** A decision just opened: stop the clock and close the gate for three real minutes. */
	const holdForDecision = () => {
		sim.submit({ type: "decisionGate", open: false });
		reopenGateIn(DECISION_GAP_MS);
		if (state.speed !== 0) state = { ...state, speed: 0 };
	};
	/** After a load or a new game: a decision left open holds the clock; a closed gate gets its timer back. */
	const syncDecision = () => {
		if (gateTimer !== null) clearTimeout(gateTimer);
		gateTimer = null;
		const v = sim.view();
		if (v.decision && state.speed !== 0) state = { ...state, speed: 0 };
		if (!v.decisionGate) reopenGateIn(DECISION_GAP_MS);
	};
	const replaceSim = (next: Sim) => {
		sim = next;
		dirty = true;
		state = { ...state, view: sim.view(), log: [], selection: null, tool: { kind: "select" } };
		syncDecision();
		renderer?.setSelection(null);
		renderer?.setGhost(null);
		notify();
	};

	/** Serialise all backend access so a slow write can never be overtaken by a later read or write. */
	const enqueue = <T>(op: () => Promise<T>): Promise<T> => {
		const run = queue.then(op);
		queue = run.then(
			() => undefined,
			() => undefined,
		);
		return run;
	};
	/** Wrap a user-visible slot operation: sets busy, then lastSavedAt/error from the outcome. */
	const tracked = async (op: () => Promise<CommandResult>, savedOk: boolean): Promise<CommandResult> => {
		pending++;
		patchStatus({ busy: true });
		let result: CommandResult;
		try {
			result = await op();
		} catch (err) {
			result = { ok: false, reason: errText(err) };
		}
		pending--;
		patchStatus(result.ok ? { busy: pending > 0, error: null, ...(savedOk ? { lastSavedAt: clock() } : {}) } : { busy: pending > 0, error: result.reason });
		return result;
	};

	const serialize = (name: string) => JSON.stringify(makeEnvelope(sim.snapshot(), sim.view(), name, clock()));
	const defaultName = (slot: SaveSlotId) => (slot === "auto" ? "Autosave" : `Slot ${slot.replace("slot", "")}`);

	function autosave() {
		if (!state.settings.autosave) return;
		let json: string;
		try {
			json = serialize("Autosave"); // synchronous: captures the state as of this tick
		} catch (err) {
			console.warn("autosave failed:", err);
			patchStatus({ error: `Autosave failed: ${errText(err)}` });
			return;
		}
		// The write is async and never blocks the frame; failures surface in saveStatus.
		enqueue(() => backend.put("auto", json)).then(
			() => patchStatus({ lastSavedAt: clock() }),
			(err) => {
				console.warn("autosave write failed:", err);
				patchStatus({ error: `Autosave failed: ${errText(err)}` });
			},
		);
	}

	/** One-time move of the pre-M1 localStorage autosave into slot "auto". */
	async function migrateLegacyAutosave() {
		let legacy: string | null = null;
		try {
			legacy = storage?.getItem(LEGACY_AUTOSAVE_KEY) ?? null;
		} catch {
			return;
		}
		if (legacy === null) return;
		try {
			const existing = await enqueue(() => backend.get("auto"));
			if (existing === null || readEnvelope(existing) === null) {
				const { sim: old } = decodeSave(content, legacy);
				const json = JSON.stringify(makeEnvelope(old.snapshot(), old.view(), "Autosave", clock()));
				await enqueue(() => backend.put("auto", json));
			}
			storage?.removeItem(LEGACY_AUTOSAVE_KEY);
		} catch (err) {
			// Leave the old key in place: it is the only copy.
			console.warn("legacy autosave not migrated:", err);
		}
	}

	const store: GameStoreInternals = {
		behind: false,
		get: () => state,
		subscribe(cb) {
			subs.add(cb);
			return () => subs.delete(cb);
		},
		dispatch(cmd) {
			const r = sim.submit(cmd);
			// While paused, apply at once: otherwise an accepted contract or a placed cabinet would sit invisibly in the
			// queue until the clock runs (and the induction keeps the clock stopped while you work).
			if (r.ok && state.speed === 0) {
				pushLog(sim.flush());
				dirty = true;
				store.publish(0, true);
			}
			return r;
		},
		canPlace: (defId, floor, x) => sim.canPlace(defId, floor, x),
		setSpeed: (speed: Speed) => {
			if (speed !== 0 && decisionOpen()) return; // a decision is waiting: the clock stays stopped until it is answered
			patch({ speed });
		},
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
		setTitleScene: (on) => renderer?.setTitleScene?.(on),
		focus: (cell) => renderer?.focus(cell),
		setMuted(muted) {
			store.setSettings({ muted });
		},
		setSettings(p) {
			const settings = mergeSettings(state.settings, p);
			persistSettings(storage, settings);
			applySettings(settings);
			patch({ settings, muted: settings.muted });
		},
		canBuild: (cmd) => sim.canBuild(cmd),

		save: () => serialize("Export"),
		load(json) {
			const { sim: next } = decodeSave(content, json); // throws before anything is replaced
			replaceSim(next);
		},
		newGame(seed = (Math.random() * 2 ** 31) | 0, scenarioId?: string) {
			replaceSim(freshSim(seed, scenarioId));
		},

		async listSaves() {
			const found: SaveSlotInfo[] = [];
			for (const id of SAVE_SLOTS) {
				try {
					const text = await enqueue(() => backend.get(id));
					const env = text === null ? null : readEnvelope(text);
					if (env) found.push({ id, name: env.name, savedAt: env.savedAt, day: env.meta.day, cash: env.meta.cash, tier: env.meta.tier });
				} catch (err) {
					console.warn(`slot ${id} unreadable:`, err);
				}
			}
			return found.sort((a, b) => b.savedAt - a.savedAt);
		},
		saveTo(slot, name) {
			if (!SAVE_SLOTS.includes(slot)) return Promise.resolve({ ok: false, reason: `Unknown save slot "${String(slot)}"` });
			let json: string;
			try {
				json = serialize(name?.trim().slice(0, NAME_MAX) || defaultName(slot)); // captured now, written later
			} catch (err) {
				const reason = `Could not save: ${errText(err)}`;
				patchStatus({ error: reason });
				return Promise.resolve({ ok: false, reason });
			}
			return tracked(async () => {
				await enqueue(() => backend.put(slot, json));
				return { ok: true };
			}, true);
		},
		loadFrom(slot) {
			return tracked(async () => {
				const text = await enqueue(() => backend.get(slot));
				if (text === null) return { ok: false, reason: "That slot is empty" };
				try {
					const { sim: next } = decodeSave(content, text);
					replaceSim(next);
					return { ok: true };
				} catch (err) {
					return { ok: false, reason: errText(err) };
				}
			}, false);
		},
		async deleteSave(slot) {
			await tracked(async () => {
				await enqueue(() => backend.remove(slot));
				return { ok: true };
			}, false);
		},

		advance(n) {
			const events: SimEvent[] = [];
			for (let i = 0; i < n; i++) {
				const ev = sim.step();
				for (const e of ev) events.push(e);
				if (ev.some((e) => e.type === "decisionIssued")) {
					holdForDecision();
					break; // the rest of this frame's ticks are not run: the game stops where the decision opened
				}
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

		async boot({ fresh = false, seed } = {}) {
			await migrateLegacyAutosave();
			if (fresh) {
				store.newGame(seed);
				return;
			}
			try {
				const text = await enqueue(() => backend.get("auto"));
				if (text === null) return;
				replaceSim(decodeSave(content, text).sim);
			} catch (err) {
				console.warn("autosave ignored:", err);
				store.newGame(seed);
				patchStatus({ error: `Autosave could not be loaded (${errText(err)}). Started a new game.` });
			}
		},
		idle: () => queue.then(() => undefined),
		readSlotRaw: (slot) => enqueue(() => backend.get(slot)),
	};

	return store;
}
