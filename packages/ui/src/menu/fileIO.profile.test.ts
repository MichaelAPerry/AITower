import { loadProfile } from "@aitower/shared";
import { describe, expect, it, vi } from "vitest";
import { createFakeStore } from "../dev/fakeStore";
import { exportSave, importSaveText } from "./fileIO";

const memory = () => {
	const m = new Map<string, string>();
	return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};
const earned = (ids: string[]) => ({ v: 1, earned: Object.fromEntries(ids.map((id) => [id, { day: 4, ending: null }])), epilogues: {} });
const fake = (extra: object = {}) => JSON.stringify({ fakeSave: 1, tick: 5 * 1440, day: 5, minuteOfDay: 3, cash: 42, tier: 1, ...extra });

describe("the profile in the save file", () => {
	it("import merges the file's profile into the stored one and never removes", () => {
		const mem = memory();
		vi.stubGlobal("localStorage", mem);
		try {
			mem.setItem("aitower.profile", JSON.stringify(earned(["end_lattice"])));
			const store = createFakeStore();
			expect(importSaveText(store, fake({ profile: earned(["end_flesh", "cash_deep"]) }))).toEqual({ ok: true });
			expect(Object.keys(loadProfile(mem).earned).sort()).toEqual(["cash_deep", "end_flesh", "end_lattice"]);
			// A file with no profile leaves the stored one alone.
			expect(importSaveText(store, fake())).toEqual({ ok: true });
			expect(Object.keys(loadProfile(mem).earned)).toHaveLength(3);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it("a save that fails to load merges nothing", () => {
		const mem = memory();
		vi.stubGlobal("localStorage", mem);
		try {
			const r = importSaveText(createFakeStore(), JSON.stringify({ fakeSave: 1, tick: "x", profile: earned(["end_flesh"]) }));
			expect(r.ok).toBe(false);
			expect(loadProfile(mem).earned).toEqual({});
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it("export writes the stored profile into the downloaded file", async () => {
		const mem = memory();
		mem.setItem("aitower.profile", JSON.stringify(earned(["cash_deep"])));
		let blob: Blob | null = null;
		const a = { click: () => {}, remove: () => {}, style: {} } as unknown as HTMLAnchorElement;
		vi.stubGlobal("localStorage", mem);
		vi.stubGlobal("URL", { createObjectURL: (b: Blob) => ((blob = b), "blob:x"), revokeObjectURL: () => {} });
		vi.stubGlobal("document", { createElement: () => a, body: { appendChild: () => {} } });
		try {
			expect(exportSave(createFakeStore(), 3).ok).toBe(true);
			const file = JSON.parse(await (blob as unknown as Blob).text());
			expect(file.profile.earned.cash_deep.day).toBe(4);
			expect(file.fakeSave).toBe(1);
		} finally {
			vi.unstubAllGlobals();
		}
	});
});
