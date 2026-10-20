import type { Speed, Tool } from "@aitower/shared";
import { describe, expect, it } from "vitest";
import { createFakeStore } from "../dev/fakeStore";
import { runKey } from "../keyboard";
import { applyEscape, escapeStep } from "./escape";
import { createMenuController } from "./menuController";

const sel = { kind: "facility", id: 9 } as const;

describe("escapeStep (pure)", () => {
	const place: Tool = { kind: "place", defId: "genset" };
	const select: Tool = { kind: "select" };
	it("closes the menu first, whatever else is going on", () => {
		expect(escapeStep({ menuOpen: true, tool: place, selection: sel })).toBe("closeMenu");
		expect(escapeStep({ menuOpen: true, tool: select, selection: null })).toBe("closeMenu");
	});
	it("drops the armed tool before it closes a drawer or the build catalog", () => {
		expect(escapeStep({ menuOpen: false, drawerOpen: true, tool: place, selection: null })).toBe("cancelTool");
		expect(escapeStep({ menuOpen: false, drawerOpen: true, tool: select, selection: null })).toBe("closeDrawer");
	});
	it("then cancels an armed tool, then clears the selection, then opens the menu", () => {
		expect(escapeStep({ menuOpen: false, tool: place, selection: sel })).toBe("cancelTool");
		expect(escapeStep({ menuOpen: false, tool: { kind: "demolish" }, selection: null })).toBe("cancelTool");
		expect(escapeStep({ menuOpen: false, tool: select, selection: sel })).toBe("clearSelection");
		expect(escapeStep({ menuOpen: false, tool: select, selection: null })).toBe("openMenu");
	});
});

function setup(speed: Speed = 3, tool: Tool = { kind: "select" }, selection: typeof sel | null = sel) {
	const store = createFakeStore();
	store.setSpeed(speed);
	store.setTool(tool);
	store.setSelection(selection);
	const states: boolean[] = [];
	const menu = createMenuController(store, (o) => states.push(o));
	const lastSpeed = { current: 1 as Speed };
	const key = (k: string) => runKey(store, k, { menu, toggleDrawer: () => {}, togglePalette: () => {}, lastSpeed });
	return { store, menu, states, key };
}

describe("Esc state machine against a store", () => {
	it("walks armed tool → selection → menu → close, one step per press", () => {
		const { store, menu, key } = setup(3, { kind: "place", defId: "genset" }, sel);
		expect(applyEscape(store, menu)).toBe("cancelTool");
		expect(store.get().tool).toEqual({ kind: "select" });
		expect(store.get().selection).toEqual(sel);
		expect(menu.isOpen()).toBe(false);
		expect(key("Escape")).toBe(true);
		expect(store.get().selection).toBeNull();
		expect(menu.isOpen()).toBe(false);
		key("Escape");
		expect(menu.isOpen()).toBe(true);
		expect(store.get().speed).toBe(0);
		key("Escape");
		expect(menu.isOpen()).toBe(false);
		expect(store.get().speed).toBe(3);
	});
	it("clears the ghost when cancelling a tool or opening the menu", () => {
		const { store, menu } = setup(1, { kind: "slab" }, null);
		store.setGhost({ cells: [{ x: 1, floor: 1 }], valid: true });
		applyEscape(store, menu);
		expect(store.ghost).toBeNull();
		store.setGhost({ cells: [{ x: 1, floor: 1 }], valid: true });
		applyEscape(store, menu);
		expect(store.ghost).toBeNull();
		expect(menu.isOpen()).toBe(true);
	});
});

describe("menu pause and restore", () => {
	it("pauses on open and restores the previous speed on close", () => {
		const { store, menu, states } = setup(10);
		menu.open();
		expect(store.get().speed).toBe(0);
		menu.close();
		expect(store.get().speed).toBe(10);
		expect(states).toEqual([true, false]);
	});
	it("is idempotent: double open keeps the original speed, double close is a no-op", () => {
		const { store, menu, states } = setup(3);
		menu.open();
		menu.open();
		expect(store.get().speed).toBe(0);
		menu.close();
		menu.close();
		expect(store.get().speed).toBe(3);
		expect(states).toEqual([true, false]);
	});
	it("a game that was already paused stays paused after the menu", () => {
		const { store, menu } = setup(0);
		menu.open();
		expect(store.get().speed).toBe(0);
		menu.close();
		expect(store.get().speed).toBe(0);
	});
	it("respects a speed the store changed while the menu was open", () => {
		const { store, menu } = setup(10);
		menu.open();
		store.setSpeed(1);
		menu.close();
		expect(store.get().speed).toBe(1);
	});
	it("toggle opens and closes", () => {
		const { store, menu } = setup(30);
		menu.toggle();
		expect(menu.isOpen()).toBe(true);
		menu.toggle();
		expect(menu.isOpen()).toBe(false);
		expect(store.get().speed).toBe(30);
	});
});

describe("hotkeys while the menu is open", () => {
	it("ignores speed, overlay, mute, demolish, space and backtick", () => {
		const { store, menu, key } = setup(3, { kind: "select" }, null);
		menu.open();
		const before = store.get();
		for (const k of ["1", "2", "3", "4", "5", " ", "h", "p", "c", "r", "f", "i", "b", "n", "m", "x"]) expect(key(k)).toBe(false);
		expect(store.get()).toBe(before);
		expect(store.get().speed).toBe(0);
	});
	it("still runs hotkeys once the menu is closed", () => {
		const { store, menu, key } = setup(3, { kind: "select" }, null);
		menu.open();
		menu.close();
		key("4");
		expect(store.get().speed).toBe(10);
		key("h");
		expect(store.get().overlay).toBe("heat");
		key("x");
		expect(store.get().tool).toEqual({ kind: "demolish" });
	});
	it("space toggles pause and remembers the last speed", () => {
		const { store, key } = setup(10, { kind: "select" }, null);
		key(" ");
		expect(store.get().speed).toBe(0);
		key(" ");
		expect(store.get().speed).toBe(10);
	});
});

