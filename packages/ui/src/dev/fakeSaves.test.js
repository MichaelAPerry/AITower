import { describe, expect, it } from "vitest";
import { createFakeStore } from "./fakeStore";
describe("fake store saves", () => {
    it("saves into slots, lists newest first and tracks saveStatus", async () => {
        const store = createFakeStore(undefined, { saveDelayMs: 0 });
        expect(await store.listSaves()).toEqual([]);
        const p = store.saveTo("slot1", "  Alpha ");
        expect(store.get().saveStatus.busy).toBe(true);
        expect(await p).toEqual({ ok: true });
        const s = store.get().saveStatus;
        expect(s.busy).toBe(false);
        expect(s.error).toBeNull();
        expect(s.lastSavedAt).toBeGreaterThan(0);
        await store.saveTo("slot3");
        const list = await store.listSaves();
        expect(list.map((i) => i.id).sort()).toEqual(["slot1", "slot3"]);
        expect(list[0].savedAt).toBeGreaterThanOrEqual(list[1].savedAt);
        expect(list.find((i) => i.id === "slot1")).toMatchObject({ name: "Alpha", day: 12, tier: 2 });
        expect(list.find((i) => i.id === "slot3")?.name).toBe("Day 12");
    });
    it("loadFrom restores a save, and fails cleanly on an empty slot", async () => {
        const store = createFakeStore(undefined, { saveDelayMs: 0 });
        store.seedSlot("slot2", { name: "Old", savedAt: 1, day: 3, cash: 9, tier: 1 });
        expect(await store.loadFrom("slot2")).toEqual({ ok: true });
        expect(store.get().view).toMatchObject({ day: 3, cash: 9, tier: 1 });
        const before = store.get().view;
        expect(await store.loadFrom("slot3")).toEqual({ ok: false, reason: "That slot is empty" });
        expect(store.get().view).toBe(before);
        expect(store.get().saveStatus.error).toBe("That slot is empty");
    });
    it("deleteSave removes a slot", async () => {
        const store = createFakeStore(undefined, { saveDelayMs: 0 });
        await store.saveTo("slot1");
        await store.deleteSave("slot1");
        expect(await store.listSaves()).toEqual([]);
    });
    it("newGame rebuilds the world and setSettings normalises and mirrors muted", () => {
        const store = createFakeStore(undefined, { saveDelayMs: 0 });
        store.load(JSON.stringify({ fakeSave: 1, tick: 1, day: 1, minuteOfDay: 1, cash: 1, tier: 1 }));
        expect(store.get().view.cash).toBe(1);
        store.newGame();
        expect(store.get().view.cash).toBeGreaterThan(1000);
        store.setSettings({ textScale: 9, muted: true });
        expect(store.get().settings.textScale).toBe(1.5);
        expect(store.get().muted).toBe(true);
        const s = store.get();
        store.setMuted(false);
        expect(store.get()).not.toBe(s);
        expect(store.get().settings.muted).toBe(false);
    });
});
