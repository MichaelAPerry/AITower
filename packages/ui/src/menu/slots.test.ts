import type { SaveSlotInfo } from "@aitower/shared";
import { describe, expect, it } from "vitest";
import { cleanSlotName, exportFileName, fmtClock, fmtSavedAt, importErrorMessage, newSaveError, saveLamp, slotRows } from "./slots";

const at = (y: number, mo: number, d: number, h: number, mi: number): number => new Date(y, mo - 1, d, h, mi).getTime();
const info = (p: Partial<SaveSlotInfo> & Pick<SaveSlotInfo, "id">): SaveSlotInfo => ({ name: "Test", savedAt: at(2026, 10, 16, 12, 4), day: 12, cash: 1_284_000, tier: 2, ...p });

describe("save slot formatting", () => {
	const now = at(2026, 10, 16, 18, 30);
	it("shows the time for today and the date for earlier days", () => {
		expect(fmtClock(at(2026, 10, 16, 9, 5))).toBe("09:05");
		expect(fmtSavedAt(at(2026, 10, 16, 12, 4), now)).toBe("12:04");
		expect(fmtSavedAt(at(2026, 10, 15, 23, 59), now)).toBe("15 OCT 23:59");
		expect(fmtSavedAt(at(2025, 10, 16, 12, 4), now)).toBe("16 OCT 12:04");
	});
	it("always lists autosave then slots 1-3, filling gaps with empty rows", () => {
		const rows = slotRows([info({ id: "slot2", name: "Mine" }), info({ id: "auto", name: "Autosave", day: 11 })], now);
		expect(rows.map((r) => r.id)).toEqual(["auto", "slot1", "slot2", "slot3"]);
		expect(rows.map((r) => r.label)).toEqual(["AUTOSAVE", "SLOT 1", "SLOT 2", "SLOT 3"]);
		expect(rows.map((r) => r.manual)).toEqual([false, true, true, true]);
		expect(rows.map((r) => r.empty)).toEqual([false, true, false, true]);
		expect(rows[2]).toMatchObject({ name: "Mine", summary: "DAY 12 · $1.28M · TIER 2", when: "12:04" });
		expect(rows[0].summary).toBe("DAY 11 · $1.28M · TIER 2");
		expect(rows[1]).toMatchObject({ name: "", summary: "Nothing filed here yet", when: "—", info: null });
	});
	it("handles an empty list", () => {
		expect(slotRows([]).every((r) => r.empty)).toBe(true);
	});
	it("cleans typed names", () => {
		expect(cleanSlotName("  My   base  ")).toBe("My base");
		expect(cleanSlotName("   ")).toBeUndefined();
		expect(cleanSlotName("")).toBeUndefined();
		expect(cleanSlotName("x".repeat(40))).toBe("x".repeat(24));
		expect(cleanSlotName(`${"y".repeat(23)} zzz`)).toBe("y".repeat(23));
	});
	it("builds a dated export file name", () => {
		expect(exportFileName(12, new Date(2026, 9, 6, 9, 4))).toBe("aitower-day12-2026-10-06-0904.json");
	});
});

describe("save status lamp", () => {
	it("shows SAVED hh:mm after a good save", () => {
		const l = saveLamp({ lastSavedAt: at(2026, 10, 16, 12, 4), error: null, busy: false });
		expect(l).toEqual({ text: "SAVED 12:04", tone: "green", lit: true, blink: false });
	});
	it("shows NOT SAVED before the first save, SAVING while busy, and the failure state", () => {
		expect(saveLamp({ lastSavedAt: null, error: null, busy: false })).toMatchObject({ text: "NOT SAVED", lit: false });
		expect(saveLamp({ lastSavedAt: 5, error: null, busy: true })).toMatchObject({ text: "SAVING…", tone: "amber", blink: true });
		expect(saveLamp({ lastSavedAt: 5, error: "disk full", busy: false })).toMatchObject({ text: "SAVE FAILED", tone: "red", blink: true });
	});
	it("busy wins over an old error", () => {
		expect(saveLamp({ lastSavedAt: null, error: "x", busy: true }).text).toBe("SAVING…");
	});
});

describe("save errors", () => {
	it("toasts only when the error changes to a new message", () => {
		expect(newSaveError(null, "disk full")).toBe("disk full");
		expect(newSaveError("disk full", "disk full")).toBeNull();
		expect(newSaveError("disk full", "quota exceeded")).toBe("quota exceeded");
		expect(newSaveError("disk full", null)).toBeNull();
		expect(newSaveError(null, null)).toBeNull();
	});
	it("keeps the Invalid save prefix on import failures", () => {
		expect(importErrorMessage(new Error("Invalid save: bad version"))).toBe("Invalid save: bad version");
		expect(importErrorMessage(new Error("Unexpected token"))).toBe("Invalid save: Unexpected token");
		expect(importErrorMessage("boom")).toBe("Invalid save: boom");
	});
});
