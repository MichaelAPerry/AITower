import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadContent } from "@aitower/content";
import { describe, expect, it } from "vitest";
import { buildEntries } from "../encyclopedia/entries";
import { DRAWER_TABS } from "../calm/calm";
import { HELP, HELP_KEYS, helpFor } from "./helpText";
import { tipDelay, tipPos } from "./placement";

const SRC = join(__dirname, "..");
const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : /\.tsx$/.test(f) && !/\.test\./.test(f) ? [join(dir, f)] : []));

describe("helpText", () => {
	it("every data-help key used in the HUD has text, and every key is used", () => {
		const used = new Set<string>();
		for (const f of files(SRC)) for (const m of readFileSync(f, "utf8").matchAll(/data-help=(?:"([\w-]+)"|\{`([\w-]+)\$\{)/g)) used.add(m[1] ?? m[2]);
		for (const k of used) if (!k.endsWith("-")) expect(helpFor(k), k).not.toBeNull();
		for (const k of HELP_KEYS.filter((k) => !k.startsWith("tab-"))) expect(used.has(k), `${k} is never attached`).toBe(true);
	});
	it("covers every drawer tab", () => {
		for (const d of DRAWER_TABS) expect(helpFor(`tab-${d.id}`), d.id).not.toBeNull();
	});
	it("short texts, and every More link lands on a real entry", () => {
		const ids = new Set(buildEntries(loadContent()).map((e) => e.id));
		for (const k of HELP_KEYS) {
			expect(HELP[k].text.length).toBeLessThan(200);
			expect(ids.has(HELP[k].entry), `${k} -> ${HELP[k].entry}`).toBe(true);
		}
	});
	it("tooltip delay and placement", () => {
		expect(tipDelay(true)).toBe(0);
		expect(tipDelay(false)).toBeGreaterThan(0);
		const p = tipPos({ left: 100, top: 10, right: 200, bottom: 50 }, { w: 260, h: 90 }, 1280, 720, 1);
		expect(p).toEqual({ left: 100, top: 56 });
		const edge = tipPos({ left: 1200, top: 300, right: 1280, bottom: 340 }, { w: 260, h: 90 }, 1280, 720, 1);
		expect(edge.left).toBeLessThan(1200);
	});
});

describe("keys", () => {
	it("? and F1 toggle help, K opens the Encyclopedia", async () => {
		const { keyAction } = await import("../keyboard");
		expect(keyAction("?")).toEqual({ type: "help" });
		expect(keyAction("F1")).toEqual({ type: "help" });
		expect(keyAction("h")).toEqual({ type: "drawer", id: "handbook" });
		expect(keyAction("k")).toEqual({ type: "drawer", id: "handbook" }); // the old key still works
		expect(keyAction("/")).toEqual({ type: "search" });
		expect(keyAction("e")).toEqual({ type: "overlay", mode: "heat" }); // H moved to the Handbook
	});
});
