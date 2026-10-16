import { loadContent } from "@aitower/content";
import { createSim } from "@aitower/sim";
import { describe, expect, it, vi } from "vitest";
import { createMemoryBackend } from "./saveBackend";
import { LEGACY_AUTOSAVE_KEY, SCENARIO, createGameStore } from "./store";
import { memoryStorage } from "./testUtils";

const content = loadContent();

function setup(storageInit: Record<string, string> = {}) {
	const backend = createMemoryBackend();
	const storage = memoryStorage(storageInit);
	let t = 1000;
	const store = createGameStore(content, null, null, { backend, storage, prefersReducedMotion: false, now: () => ++t });
	return { backend, storage, store };
}

describe("save envelope", () => {
	it("round-trips through save()/load()", () => {
		const a = setup().store;
		a.advance(50);
		const text = a.save();
		const env = JSON.parse(text);
		expect(env).toMatchObject({ format: "aitower-save", version: 1, name: "Export" });
		const v = a.sim().view();
		expect(env.meta).toEqual({ day: v.day, cash: v.cash, tier: v.tier });
		const b = setup().store;
		b.load(text);
		expect(b.sim().hash()).toBe(a.sim().hash());
	});

	it("accepts a raw SimSnapshot (older exports)", () => {
		const sim = createSim(content, SCENARIO, 7);
		for (let i = 0; i < 20; i++) sim.step();
		const { store } = setup();
		store.load(JSON.stringify(sim.snapshot()));
		expect(store.sim().hash()).toBe(sim.hash());
	});

	it("rejects garbage with 'Invalid save' and keeps the running game", () => {
		const { store } = setup();
		store.advance(10);
		const before = store.sim().hash();
		const sim = store.sim();
		for (const bad of ["not json", "42", "null", "[]", "{}", JSON.stringify({ format: "other" }), JSON.stringify({ format: "aitower-save", version: 99 }), JSON.stringify({ format: "aitower-save", version: 1, snapshot: {} }), JSON.stringify({ version: 1, scenarioId: "nope", seed: 1, state: {} })]) {
			expect(() => store.load(bad), bad).toThrow(/^Invalid save/);
		}
		expect(store.sim()).toBe(sim);
		expect(store.sim().hash()).toBe(before);
	});
});

describe("save slots", () => {
	it("saveTo / listSaves / loadFrom round-trip with status", async () => {
		const { store } = setup();
		store.advance(30);
		const hash = store.sim().hash();
		const day = store.get().view.day;
		const p = store.saveTo("slot2", "  My tower ");
		expect(store.get().saveStatus.busy).toBe(true);
		expect(await p).toEqual({ ok: true });
		expect(store.get().saveStatus).toMatchObject({ busy: false, error: null });
		expect(store.get().saveStatus.lastSavedAt).not.toBeNull();
		store.advance(100);
		const list = await store.listSaves();
		expect(list).toHaveLength(1);
		expect(list[0]).toMatchObject({ id: "slot2", name: "My tower", day });
		expect(await store.loadFrom("slot2")).toEqual({ ok: true });
		expect(store.sim().hash()).toBe(hash);
		await store.deleteSave("slot2");
		expect(await store.listSaves()).toEqual([]);
	});

	it("lists newest first and skips corrupt entries", async () => {
		const { store, backend } = setup();
		await store.saveTo("slot1");
		await store.saveTo("slot3", "later");
		backend.data.set("slot2", "{ not json");
		backend.data.set("auto", JSON.stringify({ format: "aitower-save", version: 1 }));
		const list = await store.listSaves();
		expect(list.map((s) => s.id)).toEqual(["slot3", "slot1"]);
	});

	it("loadFrom never replaces the game with a broken slot", async () => {
		const { store, backend } = setup();
		store.advance(5);
		const sim = store.sim();
		backend.data.set("slot1", "garbage");
		const r = await store.loadFrom("slot1");
		expect(r.ok).toBe(false);
		expect(!r.ok && r.reason).toMatch(/^Invalid save/);
		expect(store.sim()).toBe(sim);
		expect(store.get().saveStatus.error).toMatch(/^Invalid save/);
		expect(store.get().saveStatus.busy).toBe(false);
		const empty = await store.loadFrom("slot3");
		expect(empty).toEqual({ ok: false, reason: "That slot is empty" });
		expect(store.sim()).toBe(sim);
	});

	it("reports backend write failures in saveStatus", async () => {
		const { store, backend } = setup();
		backend.put = async () => {
			throw new Error("quota exceeded");
		};
		const r = await store.saveTo("slot1");
		expect(r).toEqual({ ok: false, reason: "quota exceeded" });
		expect(store.get().saveStatus).toMatchObject({ error: "quota exceeded", busy: false });
	});

	it("rejects an unknown slot id", async () => {
		const { store } = setup();
		expect((await store.saveTo("bogus" as never)).ok).toBe(false);
	});
});

describe("autosave", () => {
	it("writes slot 'auto' on newDay, and only when enabled", async () => {
		const { store, backend } = setup();
		const day = store.get().view.day;
		store.advance(1440); // crosses at least one day boundary
		await store.idle();
		const text = backend.data.get("auto");
		expect(text).toBeTruthy();
		const env = JSON.parse(text as string);
		expect(env.name).toBe("Autosave");
		expect(env.meta.day).toBeGreaterThan(day);
		expect(store.get().saveStatus.lastSavedAt).not.toBeNull();

		backend.data.delete("auto");
		store.setSettings({ autosave: false });
		store.advance(1440);
		await store.idle();
		expect(backend.data.has("auto")).toBe(false);
	});

	it("does not block: the write is deferred until the backend resolves", async () => {
		const { store, backend } = setup();
		let release: () => void = () => {};
		let started = false;
		backend.put = (id, json) =>
			new Promise((res) => {
				started = true;
				release = () => {
					backend.data.set(id, json);
					res();
				};
			});
		store.advance(1440);
		expect(backend.data.has("auto")).toBe(false);
		await vi.waitFor(() => expect(started).toBe(true));
		expect(backend.data.has("auto")).toBe(false);
		release();
		await store.idle();
		expect(backend.data.has("auto")).toBe(true);
	});

	it("surfaces autosave write errors without throwing", async () => {
		const { store, backend } = setup();
		backend.put = async () => {
			throw new Error("disk full");
		};
		vi.spyOn(console, "warn").mockImplementation(() => {});
		expect(() => store.advance(1440)).not.toThrow();
		await store.idle();
		expect(store.get().saveStatus.error).toMatch(/disk full/);
	});
});

describe("boot", () => {
	it("migrates the legacy localStorage autosave once, then deletes it", async () => {
		const sim = createSim(content, SCENARIO, 9);
		for (let i = 0; i < 40; i++) sim.step();
		const { store, backend, storage } = setup({ [LEGACY_AUTOSAVE_KEY]: JSON.stringify(sim.snapshot()) });
		await store.boot();
		expect(storage.data.has(LEGACY_AUTOSAVE_KEY)).toBe(false);
		expect(JSON.parse(backend.data.get("auto") as string)).toMatchObject({ format: "aitower-save", name: "Autosave" });
		expect(store.sim().hash()).toBe(sim.hash());
	});

	it("does not overwrite an existing valid autosave with the legacy one", async () => {
		const first = setup();
		first.store.advance(77);
		await first.store.saveTo("auto");
		const legacy = createSim(content, SCENARIO, 3);
		const { store, storage } = setup({ [LEGACY_AUTOSAVE_KEY]: JSON.stringify(legacy.snapshot()) });
		const raw = first.backend.data.get("auto") as string;
		const backend = createMemoryBackend();
		backend.data.set("auto", raw);
		const s2 = createGameStore(content, null, null, { backend, storage, prefersReducedMotion: false });
		await s2.boot();
		expect(storage.data.has(LEGACY_AUTOSAVE_KEY)).toBe(false);
		expect(backend.data.get("auto")).toBe(raw);
		expect(s2.sim().hash()).toBe(first.store.sim().hash());
		void store;
	});

	it("keeps an unreadable legacy key instead of deleting the only copy", async () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		const { store, storage } = setup({ [LEGACY_AUTOSAVE_KEY]: "{broken" });
		await store.boot();
		expect(storage.data.has(LEGACY_AUTOSAVE_KEY)).toBe(true);
	});

	it("?new starts fresh and ignores the autosave", async () => {
		const { store, backend } = setup();
		store.advance(60);
		await store.saveTo("auto");
		expect(backend.data.has("auto")).toBe(true);
		await store.boot({ fresh: true, seed: 0 });
		expect(store.get().view.tick).toBe(0);
		expect(store.sim().snapshot().seed).toBe(0);
	});

	it("loads a valid autosave", async () => {
		const a = setup();
		a.store.advance(60);
		await a.store.saveTo("auto");
		const b = createGameStore(content, null, null, { backend: a.backend, storage: memoryStorage(), prefersReducedMotion: false });
		await b.boot();
		expect(b.sim().hash()).toBe(a.store.sim().hash());
		expect(b.get().saveStatus.error).toBeNull();
	});

	it("an invalid autosave starts fresh with saveStatus.error instead of crashing", async () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		const { store, backend } = setup();
		backend.data.set("auto", "totally broken");
		await store.boot();
		expect(store.get().view.tick).toBe(0);
		expect(store.get().saveStatus.error).toMatch(/Invalid save/);
	});
});

describe("decodeSave probe isolation", () => {
	it("the first-tick probe runs on a throwaway copy, never on the returned game", async () => {
		const { decodeSave } = await import("./saves");
		const sim = createSim(content, SCENARIO, 11);
		// Get jobs, bots and failures moving so the state holds plenty of mutable objects.
		for (let t = 0; t < 600; t++) {
			for (const o of sim.view().offers) sim.submit({ type: "acceptContract", contractId: o.id });
			sim.step();
		}
		const text = JSON.stringify(sim.snapshot());
		const { sim: loaded } = decodeSave(content, text);
		expect(loaded.hash()).toBe(sim.hash());
		expect(loaded.view().tick).toBe(sim.view().tick);
		// And both continue identically.
		for (let t = 0; t < 200; t++) {
			sim.step();
			loaded.step();
		}
		expect(loaded.hash()).toBe(sim.hash());
	});
});
