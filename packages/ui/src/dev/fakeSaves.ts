/** In-memory save slots for the fake store: async with a small delay, like the real IndexedDB-backed store. */
import type { CommandResult, SimView } from "@aitower/sim";
import { type GameState, type SaveSlotId, type SaveSlotInfo, SAVE_SLOTS } from "@aitower/shared";

interface Stored {
	info: SaveSlotInfo;
	json: string;
}

export interface FakeSavesCtx {
	getState(): GameState;
	patchState(patch: Partial<GameState>): void;
	/** Replace the world view (and notify). */
	setView(view: SimView): void;
	/** A new world; `scenarioId` picks the lot (default: the standard start). */
	freshView(scenarioId?: string): SimView;
	delayMs: number;
}

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Exported text for the fake world: just enough fields for the menu to show and restore. */
export function exportFake(view: SimView): string {
	return JSON.stringify({ fakeSave: 1, tick: view.tick, day: view.day, minuteOfDay: view.minuteOfDay, cash: view.cash, tier: view.tier });
}

export function parseFake(json: string): { tick: number; day: number; minuteOfDay: number; cash: number; tier: number } {
	let raw: unknown;
	try {
		raw = JSON.parse(json);
	} catch {
		throw new Error("Invalid save: not valid JSON");
	}
	const r = raw as Record<string, unknown> | null;
	if (!r || typeof r !== "object" || r.fakeSave !== 1) throw new Error("Invalid save: unrecognised file");
	for (const k of ["tick", "day", "minuteOfDay", "cash", "tier"] as const) if (typeof r[k] !== "number" || !Number.isFinite(r[k])) throw new Error(`Invalid save: bad ${k}`);
	return r as { tick: number; day: number; minuteOfDay: number; cash: number; tier: number };
}

export function createFakeSaves(ctx: FakeSavesCtx, seed: Partial<Record<SaveSlotId, Stored>> = {}) {
	const slots = new Map<SaveSlotId, Stored>(Object.entries(seed) as [SaveSlotId, Stored][]);
	const status = (patch: Partial<GameState["saveStatus"]>): void => ctx.patchState({ saveStatus: { ...ctx.getState().saveStatus, ...patch } });
	const apply = (json: string): void => {
		const p = parseFake(json);
		ctx.setView({ ...ctx.freshView(), ...p });
	};
	return {
		save: (): string => exportFake(ctx.getState().view),
		load(json: string): void {
			apply(json);
			status({ error: null });
		},
		newGame(_seed?: number, scenarioId?: string): void {
			ctx.setView(ctx.freshView(scenarioId));
		},
		async listSaves(): Promise<SaveSlotInfo[]> {
			await wait(ctx.delayMs);
			return SAVE_SLOTS.flatMap((id) => (slots.has(id) ? [(slots.get(id) as Stored).info] : [])).sort((a, b) => b.savedAt - a.savedAt);
		},
		async saveTo(slot: SaveSlotId, name?: string): Promise<CommandResult> {
			status({ busy: true });
			await wait(ctx.delayMs);
			const v = ctx.getState().view;
			const savedAt = Date.now();
			slots.set(slot, {
				json: exportFake(v),
				info: { id: slot, name: slot === "auto" ? "Autosave" : name?.trim() || `Day ${v.day}`, savedAt, day: v.day, cash: v.cash, tier: v.tier },
			});
			status({ busy: false, error: null, lastSavedAt: savedAt });
			return { ok: true };
		},
		async loadFrom(slot: SaveSlotId): Promise<CommandResult> {
			status({ busy: true });
			await wait(ctx.delayMs);
			const s = slots.get(slot);
			if (!s) {
				status({ busy: false, error: "That slot is empty" });
				return { ok: false, reason: "That slot is empty" };
			}
			try {
				apply(s.json);
			} catch (e) {
				const reason = e instanceof Error ? e.message : String(e);
				status({ busy: false, error: reason });
				return { ok: false, reason };
			}
			status({ busy: false, error: null });
			return { ok: true };
		},
		async deleteSave(slot: SaveSlotId): Promise<void> {
			await wait(ctx.delayMs);
			slots.delete(slot);
		},
		/** Test/harness hook: put a save straight into a slot. */
		seedSlot(slot: SaveSlotId, info: Omit<SaveSlotInfo, "id">): void {
			slots.set(slot, { info: { id: slot, ...info }, json: JSON.stringify({ fakeSave: 1, tick: info.day * 1440, day: info.day, minuteOfDay: 0, cash: info.cash, tier: info.tier }) });
		},
	};
}
