import { describe, expect, it, vi } from "vitest";
import { createFakeStore } from "../dev/fakeStore";
import { exportFake } from "../dev/fakeSaves";
import { importSaveFile, importSaveText } from "./fileIO";
describe("import / export", () => {
    it("imports a good file through store.load", () => {
        const store = createFakeStore();
        const text = JSON.stringify({ fakeSave: 1, tick: 5 * 1440, day: 5, minuteOfDay: 3, cash: 42, tier: 1 });
        expect(importSaveText(store, text)).toEqual({ ok: true });
        expect(store.get().view.day).toBe(5);
        expect(store.get().view.cash).toBe(42);
    });
    it("returns Invalid save: … and keeps the running game on bad input", () => {
        const store = createFakeStore();
        const before = store.get().view;
        for (const bad of ["not json", "{}", JSON.stringify({ fakeSave: 1, tick: "x" })]) {
            const r = importSaveText(store, bad);
            expect(r.ok).toBe(false);
            if (!r.ok)
                expect(r.reason).toMatch(/^Invalid save: /);
        }
        expect(store.get().view).toBe(before);
    });
    it("wraps non-Invalid errors from the store", () => {
        const store = { load: () => { throw new Error("kaboom"); } };
        expect(importSaveText(store, "x")).toEqual({ ok: false, reason: "Invalid save: kaboom" });
    });
});
/** Minimal FileReader for node: resolves with the Blob's text, or fails when the blob is marked bad. */
class StubReader {
    result = null;
    error = null;
    onload = null;
    onerror = null;
    readAsText(b) {
        if (b.bad) {
            this.error = new Error("disk unplugged");
            queueMicrotask(() => this.onerror?.());
            return;
        }
        void b.text().then((t) => {
            this.result = t;
            this.onload?.();
        });
    }
}
describe("importSaveFile (FileReader)", () => {
    it("reads a file with FileReader and loads it", async () => {
        vi.stubGlobal("FileReader", StubReader);
        try {
            const store = createFakeStore();
            const file = new Blob([exportFake({ ...store.get().view, day: 7, cash: 7 })]);
            expect(await importSaveFile(store, file)).toEqual({ ok: true });
            expect(store.get().view.day).toBe(7);
        }
        finally {
            vi.unstubAllGlobals();
        }
    });
    it("reports invalid content and unreadable files without throwing", async () => {
        vi.stubGlobal("FileReader", StubReader);
        try {
            const store = createFakeStore();
            const bad = await importSaveFile(store, new Blob(["garbage"]));
            expect(bad).toMatchObject({ ok: false });
            if (!bad.ok)
                expect(bad.reason).toMatch(/^Invalid save: /);
            const unreadable = Object.assign(new Blob(["x"]), { bad: true });
            expect(await importSaveFile(store, unreadable)).toEqual({ ok: false, reason: "Invalid save: disk unplugged" });
        }
        finally {
            vi.unstubAllGlobals();
        }
    });
});
