import type { SaveSlotId } from "@aitower/shared";

/** Where save envelopes (JSON text) live. Swappable so tests can use memory. */
export interface SaveBackend {
	readonly kind: string;
	get(id: SaveSlotId): Promise<string | null>;
	put(id: SaveSlotId, json: string): Promise<void>;
	remove(id: SaveSlotId): Promise<void>;
}

/** The subset of `Storage` the app uses (settings, legacy autosave, fallback saves). */
export interface KeyValueStorage {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

/** `localStorage` if it is usable, else null (private mode, blocked site data, non-browser). */
export function safeLocalStorage(): KeyValueStorage | null {
	try {
		return typeof localStorage === "undefined" ? null : localStorage;
	} catch {
		return null;
	}
}

export function createMemoryBackend(): SaveBackend & { data: Map<string, string> } {
	const data = new Map<string, string>();
	return {
		kind: "memory",
		data,
		get: async (id) => data.get(id) ?? null,
		put: async (id, json) => {
			data.set(id, json);
		},
		remove: async (id) => {
			data.delete(id);
		},
	};
}

const LS_PREFIX = "aitower.save.";

export function createLocalStorageBackend(storage: KeyValueStorage | null = safeLocalStorage()): SaveBackend {
	const need = () => {
		if (!storage) throw new Error("No storage available in this browser");
		return storage;
	};
	return {
		kind: "localStorage",
		get: async (id) => need().getItem(LS_PREFIX + id),
		put: async (id, json) => need().setItem(LS_PREFIX + id, json),
		remove: async (id) => need().removeItem(LS_PREFIX + id),
	};
}

const DB_NAME = "aitower";
const STORE_NAME = "saves";

const req = <T>(r: IDBRequest<T>): Promise<T> =>
	new Promise((resolve, reject) => {
		r.onsuccess = () => resolve(r.result);
		r.onerror = () => reject(r.error ?? new Error("IndexedDB request failed"));
	});

function openDb(factory: IDBFactory): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		let open: IDBOpenDBRequest;
		try {
			open = factory.open(DB_NAME, 1);
		} catch (err) {
			reject(err);
			return;
		}
		open.onupgradeneeded = () => {
			if (!open.result.objectStoreNames.contains(STORE_NAME)) open.result.createObjectStore(STORE_NAME);
		};
		open.onsuccess = () => resolve(open.result);
		open.onerror = () => reject(open.error ?? new Error("IndexedDB unavailable"));
		open.onblocked = () => reject(new Error("IndexedDB blocked"));
	});
}

export function createIndexedDbBackend(factory: IDBFactory): SaveBackend {
	let db: Promise<IDBDatabase> | null = null;
	const getDb = () => {
		db ??= openDb(factory);
		return db;
	};
	const store = async (mode: IDBTransactionMode) => (await getDb()).transaction(STORE_NAME, mode).objectStore(STORE_NAME);
	return {
		kind: "indexedDB",
		get: async (id) => {
			const v = await req((await store("readonly")).get(id));
			return typeof v === "string" ? v : null;
		},
		put: async (id, json) => {
			await req((await store("readwrite")).put(json, id));
		},
		remove: async (id) => {
			await req((await store("readwrite")).delete(id));
		},
	};
}

/**
 * IndexedDB when it opens, otherwise localStorage. The choice is made once, on first use, so a browser that
 * blocks IndexedDB (some private modes) still saves.
 */
export function createDefaultBackend(): SaveBackend {
	const ls = createLocalStorageBackend();
	let chosen: Promise<SaveBackend> | null = null;
	const pick = (): Promise<SaveBackend> => {
		chosen ??= (async () => {
			try {
				if (typeof indexedDB === "undefined") return ls;
				const idb = createIndexedDbBackend(indexedDB);
				await idb.get("auto"); // forces the open; throws if IndexedDB is unusable
				return idb;
			} catch (err) {
				console.warn("IndexedDB unavailable, saving to localStorage:", err);
				return ls;
			}
		})();
		return chosen;
	};
	return {
		kind: "default",
		get: async (id) => (await pick()).get(id),
		put: async (id, json) => (await pick()).put(id, json),
		remove: async (id) => (await pick()).remove(id),
	};
}
