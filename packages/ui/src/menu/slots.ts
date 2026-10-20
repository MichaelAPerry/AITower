import { type SaveSlotId, type SaveSlotInfo, type SaveStatus, SAVE_SLOTS } from "@aitower/shared";
import { fmtMoney } from "../format";

const p2 = (n: number): string => String(n).padStart(2, "0");
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** Local "12:04". */
export function fmtClock(ms: number): string {
	const d = new Date(ms);
	return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/** "12:04" for today, "3 MAR 12:04" for earlier days (local time). */
export function fmtSavedAt(ms: number, now: number = Date.now()): string {
	const d = new Date(ms);
	const t = fmtClock(ms);
	const n = new Date(now);
	const same = d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
	return same ? t : `${d.getDate()} ${MONTHS[d.getMonth()]} ${t}`;
}

export interface SlotRow {
	id: SaveSlotId;
	/** Engraved slot label: "AUTOSAVE", "SLOT 1"… */
	label: string;
	manual: boolean;
	empty: boolean;
	name: string;
	/** "DAY 12 · $1.28M · TIER 2", or "Empty slot". */
	summary: string;
	/** "12:04", or "—" when empty. */
	when: string;
	info: SaveSlotInfo | null;
}

const SLOT_LABEL: Record<SaveSlotId, string> = { auto: "AUTOSAVE", slot1: "SLOT 1", slot2: "SLOT 2", slot3: "SLOT 3" };

/** One row per slot in fixed order (autosave first), whether or not it holds a save. */
export function slotRows(saves: readonly SaveSlotInfo[], now: number = Date.now()): SlotRow[] {
	return SAVE_SLOTS.map((id) => {
		const info = saves.find((s) => s.id === id) ?? null;
		return {
			id,
			label: SLOT_LABEL[id],
			manual: id !== "auto",
			empty: !info,
			name: info ? info.name : "",
			summary: info ? `DAY ${info.day} · ${fmtMoney(info.cash)} · TIER ${info.tier}` : "Empty slot",
			when: info ? fmtSavedAt(info.savedAt, now) : "—",
			info,
		};
	});
}

/** Player-typed save name: trimmed, whitespace collapsed, at most 24 characters. Empty → undefined (the store picks a default). */
export function cleanSlotName(raw: string): string | undefined {
	const s = raw.replace(/\s+/g, " ").trim().slice(0, 24).trim();
	return s || undefined;
}

/** "aitower-day12-2026-10-16-1204.json" (local time). */
export function exportFileName(day: number, now: Date = new Date()): string {
	return `aitower-day${day}-${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())}-${p2(now.getHours())}${p2(now.getMinutes())}.json`;
}

export interface SaveLamp {
	text: string;
	tone: "green" | "amber" | "red";
	lit: boolean;
	blink: boolean;
}

/** Top-bar save lamp: "SAVED 12:04", "SAVING…", "SAVE FAILED" or "NOT SAVED". */
export function saveLamp(status: SaveStatus): SaveLamp {
	if (status.busy) return { text: "SAVING…", tone: "amber", lit: true, blink: true };
	if (status.error) return { text: "SAVE FAILED", tone: "red", lit: true, blink: true };
	if (status.lastSavedAt === null) return { text: "NOT SAVED", tone: "amber", lit: false, blink: false };
	return { text: `SAVED ${fmtClock(status.lastSavedAt)}`, tone: "green", lit: true, blink: false };
}

/** Message for the error toast, or null when there is nothing new to report. */
export function newSaveError(prev: string | null, next: string | null): string | null {
	return next && next !== prev ? next : null;
}

/** Text of an import failure: store.load throws Error("Invalid save: …"); anything else is wrapped the same way. */
export function importErrorMessage(e: unknown): string {
	const m = e instanceof Error ? e.message : String(e);
	return /^Invalid save/i.test(m) ? m : `Invalid save: ${m}`;
}
